import {
  ATTACHMENT_MAX_PER_RECORD,
  ATTACHMENT_MAX_TOTAL_BYTES,
  type AddAttachmentValues
} from "../schemas"

export type AttachmentLimitCheck =
  | { allowed: true }
  | { allowed: false; reason: "count" | "totalBytes" }

export type ExistingAttachmentSize = {
  sizeBytes: number
}

// The server-side half of the limits. The dropzone refuses an oversized file before it is uploaded
// and the presign route refuses one it is asked to sign, but neither is authoritative: a signed PUT
// is a URL, not a permission, so the count and the running total are re-derived here from what the
// record already holds at the moment the row would be written.
export function checkAttachmentLimits(
  existing: readonly ExistingAttachmentSize[],
  incoming: Pick<AddAttachmentValues, "sizeBytes">
): AttachmentLimitCheck {
  if (existing.length >= ATTACHMENT_MAX_PER_RECORD) return { allowed: false, reason: "count" }

  const totalBytes = existing.reduce((sum, attachment) => sum + attachment.sizeBytes, 0)

  if (totalBytes + incoming.sizeBytes > ATTACHMENT_MAX_TOTAL_BYTES) {
    return { allowed: false, reason: "totalBytes" }
  }

  return { allowed: true }
}
