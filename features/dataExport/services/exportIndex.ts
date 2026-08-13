import { type DataExportScope } from "../schemas"

import {
  getExportExcludedTables,
  getExportTables,
  type ExcludedExportColumn
} from "./exportManifest"

export const EXPORT_INDEX_FILE = "index.json"

export const EXPORT_FILES_DIRECTORY = "files"

export type ExportTableSummary = {
  table: string
  file: string
  rowCount: number
}

export type ExportFileSummary = {
  path: string
  uploadId: string
  sizeBytes: number
}

export type BuildExportIndexInput = {
  appVersion: string
  clientId: string | null
  exportId: string
  files: readonly ExportFileSummary[]
  generatedAt: Date
  scope: DataExportScope
  tables: readonly ExportTableSummary[]
}

export type ExportIndex = {
  formatVersion: 1
  appVersion: string
  exportId: string
  generatedAt: string
  scope: DataExportScope
  clientId: string | null
  tables: readonly ExportTableSummary[]
  files: readonly ExportFileSummary[]
  // The exclusion list travels inside the archive so a recipient can tell an omission from a gap: an
  // export with no `settings.smtpPass` is a policy decision recorded here, not a lost column.
  excluded: {
    tables: readonly { table: string; reason: string }[]
    columns: readonly { table: string; column: string; reason: string }[]
  }
}

export function buildExportIndex(input: BuildExportIndexInput): ExportIndex {
  return {
    formatVersion: 1,
    appVersion: input.appVersion,
    exportId: input.exportId,
    generatedAt: input.generatedAt.toISOString(),
    scope: input.scope,
    clientId: input.clientId,
    tables: input.tables,
    files: input.files,
    excluded: {
      tables: getExportExcludedTables().map((excluded) => ({
        table: excluded.table,
        reason: excluded.reason
      })),
      columns: getExportTables(input.scope).flatMap((manifest) =>
        manifest.excludedColumns.map((excluded: ExcludedExportColumn) => ({
          table: manifest.table,
          column: excluded.column,
          reason: excluded.reason
        }))
      )
    }
  }
}

export function serializeExportIndex(index: ExportIndex): string {
  return `${JSON.stringify(index, null, 2)}\n`
}
