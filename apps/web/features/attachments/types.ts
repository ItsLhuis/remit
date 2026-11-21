export type AttachmentListItem = {
  id: string
  filename: string
  title: string | null
  mimeType: string
  sizeBytes: number
  createdAt: Date
  uploadedByName: string | null
}

// Deliberately carries `storageKey` where `AttachmentListItem` does not. The list is client-bound
// and a storage key is the only thing standing between a private-bucket object and anyone who can
// read it, so it stays server-side: `app/api/attachments/[id]/route.ts` is the one consumer.
export type AttachmentDownload = {
  storageKey: string
  filename: string
  mimeType: string
}
