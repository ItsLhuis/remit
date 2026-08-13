import { type DataExportScope } from "../schemas"

export const EXPORT_ARCHIVE_CONTENT_TYPE = "application/zip"

export type BuildExportFilenameInput = {
  clientName: string | null
  requestedAt: Date
  scope: DataExportScope
}

export function buildExportFilename(input: BuildExportFilenameInput): string {
  const day = input.requestedAt.toISOString().slice(0, 10)
  const label =
    input.scope === "client" ? (toFilenameSlug(input.clientName) ?? "client") : "instance"

  return `remit-export-${label}-${day}.zip`
}

// Keyed by export id rather than by a random token: the exports bucket carries no anonymous read
// policy (see `lib/storage/s3.ts`), so the only reader is the credentialed download route and key
// unguessability is not what protects the archive here.
export function buildExportStorageKey(exportId: string, filename: string): string {
  return `exports/${exportId}/${filename}`
}

// The archive is never served from storage directly: the exports bucket is credentialed, and this
// route is where the owner gate and the audit-relevant `ready` check live. Kept beside the storage key
// so the two halves of "where an archive lives" and "how it is reached" cannot drift apart.
export function buildDataExportDownloadPath(exportId: string): string {
  return `/api/exports/${exportId}`
}

function toFilenameSlug(value: string | null): string | null {
  if (!value) return null

  const slug = value
    // Decompose, then drop the combining marks: a client named "Ação" slugs to "acao" rather than
    // losing the whole letter to the ASCII filter below.
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)

  return slug.length > 0 ? slug : null
}
