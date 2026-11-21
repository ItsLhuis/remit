import { type ReportKind } from "../schemas"

// The report key in kebab case, so a downloaded file sorts and reads like a filename rather than
// like an identifier. Derived from the key itself so a new report needs no second list to update.
//
// The PDF path rebuilds the name at download time from the row's `report` and `created_at` rather
// than storing it, which is why the date is an argument: the two halves of the name are already on
// the row and a `filename` column would be a third copy that can disagree with them.
export function buildReportExportFilename(
  report: ReportKind,
  exportedAt: Date,
  extension: "csv" | "pdf"
): string {
  const slug = report.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)

  return `${slug}-${exportedAt.toISOString().slice(0, 10)}.${extension}`
}

// Keyed by export id rather than by a random token, for the reason `buildExportStorageKey` gives in
// features/dataExport: the exports bucket carries no anonymous read policy, so the credentialed
// route below is the only reader and key unguessability is not what protects the file.
export function buildReportExportStorageKey(exportId: string, filename: string): string {
  return `report-exports/${exportId}/${filename}`
}

// Kept beside the storage key so "where the PDF lives" and "how it is reached" cannot drift apart.
export function buildReportExportDownloadPath(exportId: string): string {
  return `/api/report-exports/${exportId}`
}
