import { createHash, randomBytes } from "node:crypto"

import { putDocumentObject } from "@/lib/storage/s3"

import { database } from "@/database"
import { uploads } from "@/database/schema"

// Writes a rendered PDF to the private documents bucket and records it as an `uploads` row, whose id
// the caller links to its document. One writer for all five PDF jobs, so the bucket, the key shape
// and the row shape cannot drift apart per feature.

export type DocumentPdfKind =
  | "invoice"
  | "proposal"
  | "contract"
  | "contract_signed"
  | "credit_note"

export type StoreDocumentPdfInput = {
  bytes: Buffer
  kind: DocumentPdfKind
  documentId: string
  filename: string
}

const PDF_CONTENT_TYPE = "application/pdf"
const KEY_SUFFIX_BYTES = 16

export async function storeDocumentPdf({
  bytes,
  kind,
  documentId,
  filename
}: StoreDocumentPdfInput): Promise<string> {
  const objectKey = buildDocumentObjectKey(kind, documentId)

  // Storage first, row second. A row pointing at an object that does not exist would make a document
  // claim a PDF a reader cannot fetch; an object with no row is invisible, costs a few kilobytes,
  // and is cleaned up by the next successful render writing a fresh key.
  await putDocumentObject({ objectKey, body: bytes, contentType: PDF_CONTENT_TYPE })

  const [upload] = await database
    .insert(uploads)
    .values({
      filename,
      path: objectKey,
      mimeType: PDF_CONTENT_TYPE,
      sizeBytes: bytes.length,
      // Hashed from the buffer this function just wrote, not read back from the store: the bytes are
      // already in hand, so a verification round trip would only confirm what was sent.
      checksumSha256: createHash("sha256").update(bytes).digest("hex"),
      bucket: "documents"
    })
    .returning({ id: uploads.id })

  if (!upload) throw new Error(`Failed to record the stored PDF for ${kind} ${documentId}`)

  return upload.id
}

// A random suffix even though the bucket is private and credentialed. It is defence in depth for the
// one failure that has happened before in this codebase's own storage design — a bucket policy that
// turns out to be more permissive than intended (see `ensureBucket` in `lib/storage/s3.ts`) — and it
// also makes every render write a distinct key, so a re-render can never half-overwrite the object a
// document already points at.
function buildDocumentObjectKey(kind: DocumentPdfKind, documentId: string): string {
  return `documents/${kind}/${documentId}/${randomBytes(KEY_SUFFIX_BYTES).toString("base64url")}.pdf`
}
