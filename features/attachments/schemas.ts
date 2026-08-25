import { z } from "zod"

import i18n from "@/lib/i18n/i18n"

// The four entities that carry files in v1, and the discriminator every attachment write and read
// travels with. `attachments` stores this as one of four nullable foreign keys plus
// `chk_attachments_parent`, so this union and that constraint have to stay in step —
// `services/attachmentParent.ts` is the single place that maps between them.
export const ATTACHMENT_PARENT_TYPES = ["client", "project", "invoice", "expense"] as const

export type AttachmentParentType = (typeof ATTACHMENT_PARENT_TYPES)[number]

// 25 MB, the ceiling most mail providers put on an attachment (Gmail's is exactly this), which is
// the size a freelancer already thinks of as "a file you can send". Deliberately larger than the
// 10 MB `EXPENSE_RECEIPT_MAX_BYTES`, because a receipt is a phone photo of a slip and an attachment
// is a brief, a signed PDF, or a design export.
export const ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024

// "Infinite attachments" means "no small fixed cap", not "no limit": an unbounded upload surface on
// a self-hosted box is an availability problem, and an unbounded list is a read the panel cannot
// paginate. Twenty is past the point any single record has needed in practice.
export const ATTACHMENT_MAX_PER_RECORD = 20

// The number that actually protects the disk. Twenty files at the per-file ceiling would be 500 MB
// on one record; 100 MB is the realistic worst case, and it binds first for a record full of large
// files while the count binds first for a record full of small ones.
export const ATTACHMENT_MAX_TOTAL_BYTES = 100 * 1024 * 1024

// Everything a freelancer hands to or receives from a client. No executables and no archives: an
// archive defeats the mime allowlist by carrying anything inside it, and this bucket's objects are
// served back through a route that names their type.
export const ATTACHMENT_MIME_TYPES = [
  "application/pdf",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "text/plain"
] as const

// The prefix the presign route mints attachment keys under. Restated in
// `app/api/upload/[type]/route.ts` rather than imported, exactly as `RECEIPT_KEY_PREFIX` is and for
// the same reason: that module is reachable from an anonymous request and this feature's barrel
// pulls `@/database` into its graph. `addAttachment` refuses any key outside this prefix, so the two
// sides drifting apart fails loudly at the mutation rather than quietly at the object store.
export const ATTACHMENT_KEY_PREFIX = "attachments/"

export const attachmentParentSchema = z.object({
  parentType: z.enum(ATTACHMENT_PARENT_TYPES),
  parentId: z.uuid()
})

export type AttachmentParent = z.infer<typeof attachmentParentSchema>

export const addAttachmentSchema = attachmentParentSchema.extend({
  objectKey: z
    .string()
    .trim()
    .min(1, i18n.t("attachments.errors.invalidKey"))
    .startsWith(ATTACHMENT_KEY_PREFIX, i18n.t("attachments.errors.invalidKey")),
  filename: z.string().trim().min(1, i18n.t("attachments.errors.invalidKey")).max(255),
  mimeType: z.enum(ATTACHMENT_MIME_TYPES, i18n.t("attachments.errors.invalidType")),
  sizeBytes: z
    .number()
    .int(i18n.t("attachments.errors.tooLarge"))
    .positive(i18n.t("attachments.errors.tooLarge"))
    .max(ATTACHMENT_MAX_BYTES, i18n.t("attachments.errors.tooLarge")),
  title: z.string().trim().max(200).optional()
})

export type AddAttachmentValues = z.infer<typeof addAttachmentSchema>

export const attachmentIdSchema = z.object({
  id: z.uuid()
})
