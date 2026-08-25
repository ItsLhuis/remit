// The image upload contract the `avatar`, `business-logo`, `client-image` and `template-image`
// variants share. It lives in `lib/storage` rather than in a feature because four features and the
// presign route all need the same numbers, and `lib/storage` is the one module all of them may
// already import: the route reaches `@/lib/storage/s3`, the confirm mutations reach
// `verifyUploadedObject`, and `hooks/useFileUpload.ts` reaches this file from the browser. Stating
// it once here is what keeps the client's pre-check, the signed URL, and the server's verification
// from drifting apart.
export const IMAGE_UPLOAD_MIME_TYPES = [
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp"
] as const

export const IMAGE_UPLOAD_MAX_BYTES = 5 * 1024 * 1024
