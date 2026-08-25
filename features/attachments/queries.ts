import { headers } from "next/headers"

import { and, desc, eq, inArray, isNull, type SQL } from "drizzle-orm"

import { auth } from "@/lib/auth"
import { getCurrentRole } from "@/lib/auth/session"

import { database } from "@/database"
import {
  attachments,
  clients,
  expenses,
  invoices,
  projects,
  uploads,
  users
} from "@/database/schema"

import {
  attachmentIdSchema,
  attachmentParentSchema,
  type AttachmentParent,
  type AttachmentParentType
} from "./schemas"
import { toAttachmentParent } from "./services/attachmentParent"
import { type AttachmentDownload, type AttachmentListItem } from "./types"

export async function listAttachments(input: unknown): Promise<AttachmentListItem[]> {
  const parsed = attachmentParentSchema.safeParse(input)

  if (!parsed.success) return []

  const rows = await database
    .select({
      id: attachments.id,
      title: attachments.title,
      createdAt: attachments.createdAt,
      filename: uploads.filename,
      mimeType: uploads.mimeType,
      sizeBytes: uploads.sizeBytes,
      uploadedByName: users.name
    })
    .from(attachments)
    .innerJoin(uploads, eq(attachments.uploadId, uploads.id))
    .leftJoin(users, eq(attachments.uploadedByUserId, users.id))
    .where(parentCondition(parsed.data))
    .orderBy(desc(attachments.createdAt))

  return rows.map((row) => ({
    id: row.id,
    filename: row.filename,
    title: row.title,
    mimeType: row.mimeType,
    sizeBytes: Number(row.sizeBytes),
    createdAt: row.createdAt,
    uploadedByName: row.uploadedByName
  }))
}

// The read half of the stage's security property. Two gates, and the second is the one that matters:
// holding an attachment id is not enough — the record it hangs off has to still be live, so an
// attachment of a soft-deleted client, project, invoice, or expense is refused here rather than
// merely hidden from the list that would have shown it.
export async function getAttachmentForDownload(input: unknown): Promise<AttachmentDownload | null> {
  const parsed = attachmentIdSchema.safeParse(input)

  if (!parsed.success) return null

  const [row] = await database
    .select({
      clientId: attachments.clientId,
      projectId: attachments.projectId,
      invoiceId: attachments.invoiceId,
      expenseId: attachments.expenseId,
      storageKey: uploads.path,
      filename: uploads.filename,
      mimeType: uploads.mimeType
    })
    .from(attachments)
    .innerJoin(uploads, eq(attachments.uploadId, uploads.id))
    .where(eq(attachments.id, parsed.data.id))
    .limit(1)

  if (!row) return null

  const parent = toAttachmentParent(row)

  if (!parent) return null

  const parentIsLive = await isAttachmentParentLive(parent)

  if (!parentIsLive) return null

  return { storageKey: row.storageKey, filename: row.filename, mimeType: row.mimeType }
}

// The write half's precondition, shared with `mutations.ts`: an attachment may only be added to a
// record that exists and has not been soft-deleted, which is what stops a caller naming an id from
// a record they may not touch — including one that was deleted between the page render and the drop.
export async function isAttachmentParentLive(parent: AttachmentParent): Promise<boolean> {
  const [row] = await parentLiveQuery(parent)

  return Boolean(row)
}

export async function listAttachmentSizes(
  parent: AttachmentParent
): Promise<{ sizeBytes: number }[]> {
  const rows = await database
    .select({ sizeBytes: uploads.sizeBytes })
    .from(attachments)
    .innerJoin(uploads, eq(attachments.uploadId, uploads.id))
    .where(parentCondition(parent))

  return rows.map((row) => ({ sizeBytes: Number(row.sizeBytes) }))
}

function parentCondition(parent: AttachmentParent): SQL | undefined {
  switch (parent.parentType) {
    case "client":
      return eq(attachments.clientId, parent.parentId)
    case "project":
      return eq(attachments.projectId, parent.parentId)
    case "invoice":
      return eq(attachments.invoiceId, parent.parentId)
    case "expense":
      return eq(attachments.expenseId, parent.parentId)
  }
}

function parentLiveQuery(parent: AttachmentParent): Promise<{ id: string }[]> {
  switch (parent.parentType) {
    case "client":
      return database
        .select({ id: clients.id })
        .from(clients)
        .where(and(eq(clients.id, parent.parentId), isNull(clients.deletedAt)))
        .limit(1)
    case "project":
      return database
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, parent.parentId), isNull(projects.deletedAt)))
        .limit(1)
    case "invoice":
      return database
        .select({ id: invoices.id })
        .from(invoices)
        .where(and(eq(invoices.id, parent.parentId), isNull(invoices.deletedAt)))
        .limit(1)
    case "expense":
      return database
        .select({ id: expenses.id })
        .from(expenses)
        .where(and(eq(expenses.id, parent.parentId), isNull(expenses.deletedAt)))
        .limit(1)
  }
}

// Whether the current session may add or remove attachments, mirroring `mutations.ts`'s
// `requireAttachmentWrite` exactly. Read once per page so a panel can hide its drop target from an
// accountant instead of offering an action the action itself would refuse.
export async function canWriteAttachments(): Promise<boolean> {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({ headers: requestHeaders })

  if (!session) return false

  const role = await getCurrentRole({ headers: requestHeaders, userId: session.user.id })

  return role === "owner" || role === "assistant"
}

// The batched form of `listAttachments`, for a surface that renders many records at once and opens
// one of them in a sheet. The expenses list is the only such surface: an expense has no detail page,
// so its files panel lives inside the edit sheet, and fetching per row on open would need a
// client-callable read where one keyed query serves the whole page.
export async function listAttachmentsByParents(input: {
  parentType: AttachmentParentType
  parentIds: readonly string[]
}): Promise<Record<string, AttachmentListItem[]>> {
  if (input.parentIds.length === 0) return {}

  const column = parentColumn(input.parentType)

  const rows = await database
    .select({
      parentId: column,
      id: attachments.id,
      title: attachments.title,
      createdAt: attachments.createdAt,
      filename: uploads.filename,
      mimeType: uploads.mimeType,
      sizeBytes: uploads.sizeBytes,
      uploadedByName: users.name
    })
    .from(attachments)
    .innerJoin(uploads, eq(attachments.uploadId, uploads.id))
    .leftJoin(users, eq(attachments.uploadedByUserId, users.id))
    .where(inArray(column, [...input.parentIds]))
    .orderBy(desc(attachments.createdAt))

  const byParent: Record<string, AttachmentListItem[]> = {}

  for (const row of rows) {
    if (!row.parentId) continue

    const list = byParent[row.parentId] ?? []

    list.push({
      id: row.id,
      filename: row.filename,
      title: row.title,
      mimeType: row.mimeType,
      sizeBytes: Number(row.sizeBytes),
      createdAt: row.createdAt,
      uploadedByName: row.uploadedByName
    })

    byParent[row.parentId] = list
  }

  return byParent
}

function parentColumn(parentType: AttachmentParentType) {
  switch (parentType) {
    case "client":
      return attachments.clientId
    case "project":
      return attachments.projectId
    case "invoice":
      return attachments.invoiceId
    case "expense":
      return attachments.expenseId
  }
}
