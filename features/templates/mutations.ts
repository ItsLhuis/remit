"use server"

import { revalidatePath } from "next/cache"

import { headers } from "next/headers"

import { and, eq, inArray, isNull } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"
import { getCurrentRole, type Role } from "@/lib/auth/session"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { getIpAddress } from "@/lib/utils"

import { database } from "@/database"
import { templates, uploads } from "@/database/schema"

import { emitTemplateCreated, emitTemplateDeleted, emitTemplateUpdated } from "./events"
import {
  confirmTemplateImageUploadSchema,
  createTemplateSchema,
  templateIdSchema,
  updateTemplateSchema,
  type Block,
  type Blocks,
  type UpdateTemplateValues
} from "./schemas"
import {
  findUnknownTokens,
  flattenBlocks,
  sanitizeTemplateHtml,
  toTemplateEditorData,
  validateLayout,
  type CanvasValidationReason
} from "./services"
import { type TemplateEditorData } from "./types"

export type TemplateMutationResult = { data: { template: TemplateEditorData } } | { error: string }

export type DeleteTemplateResult = { data: { id: string } } | { error: string }

export type SetDefaultTemplateResult = { data: { id: string } } | { error: string }

export type ConfirmTemplateImageUploadResult =
  | { data: { uploadId: string; storageKey: string } }
  | { error: string }

type TemplateWriteContext = {
  userId: string
  role: Role
  ipAddress: string | null
  userAgent: string | null
}

type TemplateWriteGate = { context: TemplateWriteContext } | { error: string }

type TemplateAuditEvent =
  | "template.created"
  | "template.updated"
  | "template.deleted"
  | "template.default_changed"

const templatesPath = "/templates"

export async function createTemplate(input: unknown): Promise<TemplateMutationResult> {
  const gate = await requireTemplateWrite()

  if ("error" in gate) return gate

  const parsed = createTemplateSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const [created] = await database
      .insert(templates)
      .values({
        name: parsed.data.name,
        type: parsed.data.type,
        subject: emptyToNull(parsed.data.subject),
        blocks: []
      })
      .returning()

    if (!created) throw new Error("Template insert returned no row")

    await writeTemplateAudit(context, "template.created", created.id, { type: created.type })
    await emitTemplateCreated({ templateId: created.id, userId: context.userId })

    revalidatePath(templatesPath)

    return { data: { template: toTemplateEditorData(created) } }
  } catch (error) {
    return handleTemplateActionError(error, "createTemplate", context.userId)
  }
}

export async function updateTemplate(input: unknown): Promise<TemplateMutationResult> {
  const gate = await requireTemplateWrite()

  if ("error" in gate) return gate

  const parsed = updateTemplateSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const existing = await database.query.templates.findFirst({
      where: and(eq(templates.id, parsed.data.id), isNull(templates.deletedAt))
    })

    if (!existing) throw new ExpectedTemplateError(t("templates.errors.notFound"))

    const blocks = sanitizeBlocks(parsed.data.blocks)
    const pageSettings = parsed.data.pageSettings

    // The free canvas can represent out-of-bounds rectangles, so the server never trusts the
    // client: nothing persists until this pure check passes.
    const layoutValidation = validateLayout(blocks, pageSettings, existing.type)

    if (!layoutValidation.valid) return { error: layoutValidationError(layoutValidation.reason) }

    const unknownTokens = findUnknownTokens(blocks, existing.type)

    if (unknownTokens[0]) {
      return { error: t("templates.validation.unknownMergeVariable", { token: unknownTokens[0] }) }
    }

    const missingUploadId = await findMissingImageUpload(blocks)

    if (missingUploadId) return { error: t("templates.validation.imageUploadMissing") }

    const name = existing.isSystem ? existing.name : parsed.data.name
    const subject = emptyToNull(parsed.data.subject)

    const [updated] = await database
      .update(templates)
      .set({ name, subject, blocks, pageSettings })
      .where(and(eq(templates.id, parsed.data.id), isNull(templates.deletedAt)))
      .returning()

    if (!updated) throw new ExpectedTemplateError(t("templates.errors.notFound"))

    const changedFields = getUpdatedFields(existing, { name, subject, blocks, pageSettings })

    await writeTemplateAudit(context, "template.updated", updated.id, { changedFields })
    await emitTemplateUpdated({ templateId: updated.id, userId: context.userId, changedFields })

    revalidatePath(templatesPath)
    revalidatePath(`${templatesPath}/${updated.id}`)

    return { data: { template: toTemplateEditorData(updated) } }
  } catch (error) {
    return handleTemplateActionError(error, "updateTemplate", context.userId, parsed.data.id)
  }
}

export async function softDeleteTemplate(input: unknown): Promise<DeleteTemplateResult> {
  const gate = await requireTemplateDelete()

  if ("error" in gate) return gate

  const parsed = templateIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const existing = await database.query.templates.findFirst({
      where: and(eq(templates.id, parsed.data.id), isNull(templates.deletedAt))
    })

    if (!existing) throw new ExpectedTemplateError(t("templates.errors.notFound"))

    if (existing.isSystem) return { error: t("templates.errors.systemProtected") }

    const [deleted] = await database
      .update(templates)
      .set({ deletedAt: new Date() })
      .where(and(eq(templates.id, parsed.data.id), isNull(templates.deletedAt)))
      .returning({ id: templates.id })

    if (!deleted) throw new ExpectedTemplateError(t("templates.errors.notFound"))

    await writeTemplateAudit(context, "template.deleted", deleted.id, { softDeleted: true })
    await emitTemplateDeleted({ templateId: deleted.id, userId: context.userId })

    revalidatePath(templatesPath)
    revalidatePath(`${templatesPath}/${deleted.id}`)

    return { data: { id: deleted.id } }
  } catch (error) {
    return handleTemplateActionError(error, "softDeleteTemplate", context.userId, parsed.data.id)
  }
}

export async function setDefaultTemplate(input: unknown): Promise<SetDefaultTemplateResult> {
  const gate = await requireTemplateWrite()

  if ("error" in gate) return gate

  const parsed = templateIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const updated = await database.transaction(async (tx) => {
      const target = await tx.query.templates.findFirst({
        where: and(eq(templates.id, parsed.data.id), isNull(templates.deletedAt))
      })

      if (!target) throw new ExpectedTemplateError(t("templates.errors.notFound"))

      await tx
        .update(templates)
        .set({ isDefault: false })
        .where(
          and(
            eq(templates.type, target.type),
            eq(templates.isDefault, true),
            isNull(templates.deletedAt)
          )
        )

      const [row] = await tx
        .update(templates)
        .set({ isDefault: true })
        .where(and(eq(templates.id, target.id), isNull(templates.deletedAt)))
        .returning({ id: templates.id, type: templates.type })

      return row
    })

    if (!updated) throw new ExpectedTemplateError(t("templates.errors.notFound"))

    await writeTemplateAudit(context, "template.default_changed", updated.id, {
      type: updated.type
    })

    revalidatePath(templatesPath)

    return { data: { id: updated.id } }
  } catch (error) {
    return handleTemplateActionError(error, "setDefaultTemplate", context.userId, parsed.data.id)
  }
}

export async function confirmTemplateImageUpload(
  input: unknown
): Promise<ConfirmTemplateImageUploadResult> {
  const gate = await requireTemplateWrite()

  if ("error" in gate) return gate

  const parsed = confirmTemplateImageUploadSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const [upload] = await database
      .insert(uploads)
      .values({
        filename: parsed.data.filename,
        path: parsed.data.objectKey,
        mimeType: parsed.data.contentType,
        sizeBytes: parsed.data.sizeBytes
      })
      .returning({ id: uploads.id, path: uploads.path })

    if (!upload) throw new Error("Template image upload insert returned no row")

    return { data: { uploadId: upload.id, storageKey: upload.path } }
  } catch (error) {
    if (error instanceof ExpectedTemplateError) return { error: error.message }

    logger.error(
      {
        action: "confirmTemplateImageUpload",
        userId: context.userId,
        objectKey: parsed.data.objectKey,
        err: error
      },
      "Template image upload confirmation failed"
    )

    return { error: t("templates.validation.imageUploadFailed") }
  }
}

async function requireTemplateWrite(): Promise<TemplateWriteGate> {
  const gate = await getTemplateActionContext()

  if ("error" in gate) return gate

  if (gate.context.role !== "owner" && gate.context.role !== "assistant") {
    return { error: t("errors.forbidden") }
  }

  return gate
}

async function requireTemplateDelete(): Promise<TemplateWriteGate> {
  const gate = await getTemplateActionContext()

  if ("error" in gate) return gate

  if (gate.context.role !== "owner") return { error: t("errors.forbidden") }

  return gate
}

async function getTemplateActionContext(): Promise<TemplateWriteGate> {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({ headers: requestHeaders })

  if (!session) return { error: t("errors.unauthorized") }

  const role = await getCurrentRole({ headers: requestHeaders, userId: session.user.id })

  if (!isRole(role)) return { error: t("errors.forbidden") }

  return {
    context: {
      userId: session.user.id,
      role,
      ipAddress: getIpAddress(requestHeaders),
      userAgent: requestHeaders.get("user-agent")
    }
  }
}

async function writeTemplateAudit(
  context: TemplateWriteContext,
  event: TemplateAuditEvent,
  templateId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await writeAudit(event, {
    actorUserId: context.userId,
    actorRole: context.role,
    targetEntityType: "template",
    targetEntityId: templateId,
    metadata,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent
  })
}

type TemplateUpdatePayload = {
  name: string
  subject: string | null
  blocks: Blocks
  pageSettings: UpdateTemplateValues["pageSettings"]
}

function getUpdatedFields(
  existing: typeof templates.$inferSelect,
  next: TemplateUpdatePayload
): string[] {
  const changedFields: string[] = []

  if (existing.name !== next.name) changedFields.push("name")
  if ((existing.subject ?? null) !== next.subject) changedFields.push("subject")
  if (JSON.stringify(existing.blocks) !== JSON.stringify(next.blocks)) changedFields.push("blocks")
  if (JSON.stringify(existing.pageSettings) !== JSON.stringify(next.pageSettings)) {
    changedFields.push("pageSettings")
  }

  return changedFields
}

function layoutValidationError(reason: CanvasValidationReason): string {
  switch (reason) {
    case "overlap":
      return t("templates.validation.blocksOverlap")
    case "outOfBounds":
      return t("templates.validation.blocksOutOfBounds")
    case "collectionUnavailable":
      return t("templates.validation.collectionUnavailable")
  }
}

// A template author may be a lower-privileged assistant whose markup later renders in the owner's
// browser and in the PDF/email pipeline, so text HTML is sanitized at the write boundary - frame
// children included, to any depth. Merge tokens survive untouched, and table cells are plain text
// the renderer escapes before substitution, so they carry no HTML to sanitize.
function sanitizeBlocks(blocks: Blocks): Blocks {
  return blocks.map(sanitizeBlock)
}

function sanitizeBlock(block: Block): Block {
  if (block.type === "text") {
    return { ...block, content: { html: sanitizeTemplateHtml(block.content.html) } }
  }

  if (block.type === "frame") {
    return {
      ...block,
      content: { ...block.content, children: block.content.children.map(sanitizeBlock) }
    }
  }

  return block
}

// Uploads carry no ownership column by design, so the authorization boundary is the authenticated
// write gate plus row existence, checked to any nesting depth.
async function findMissingImageUpload(blocks: Blocks): Promise<string | null> {
  const uploadIds = flattenBlocks(blocks)
    .map((block) => (block.type === "image" ? block.content.uploadId : null))
    .filter((uploadId): uploadId is string => uploadId !== null)

  if (uploadIds.length === 0) return null

  const rows = await database
    .select({ id: uploads.id })
    .from(uploads)
    .where(inArray(uploads.id, uploadIds))

  const existingIds = new Set(rows.map((row) => row.id))

  return uploadIds.find((uploadId) => !existingIds.has(uploadId)) ?? null
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : null
}

function handleTemplateActionError(
  error: unknown,
  action: string,
  userId: string | null,
  templateId?: string
): { error: string } {
  if (error instanceof ExpectedTemplateError) return { error: error.message }

  logger.error({ action, userId, templateId, err: error }, "Template action failed")

  return { error: t("templates.errors.saveFailed") }
}

function isRole(value: string | null | undefined): value is Role {
  return value === "owner" || value === "accountant" || value === "assistant"
}

class ExpectedTemplateError extends Error {}
