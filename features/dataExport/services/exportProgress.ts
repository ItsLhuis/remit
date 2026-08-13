// The JSON half of an archive is a bounded number of queries; the file half is one storage read per
// upload and is what actually takes time on an instance with attachments. Progress therefore reserves
// the first slice for the tables and spends the rest on files, so an export with no uploads still
// finishes at 100 rather than stalling at the handover.
const TABLE_PHASE_CEILING = 20

export type ExportProgressInput = {
  filesDone: number
  filesTotal: number
  tablesDone: number
  tablesTotal: number
}

export function computeExportProgress(input: ExportProgressInput): number {
  const tableShare =
    input.tablesTotal > 0
      ? Math.min(input.tablesDone / input.tablesTotal, 1) * TABLE_PHASE_CEILING
      : TABLE_PHASE_CEILING

  const fileShare =
    input.filesTotal > 0
      ? Math.min(input.filesDone / input.filesTotal, 1) * (100 - TABLE_PHASE_CEILING)
      : 100 - TABLE_PHASE_CEILING

  // Floored so the value only reaches 100 once both phases are complete: a rounded 99.6 would report
  // a finished export while the archive is still being uploaded to storage.
  return Math.max(0, Math.min(100, Math.floor(tableShare + fileShare)))
}
