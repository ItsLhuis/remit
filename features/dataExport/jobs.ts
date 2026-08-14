import { createReadStream, createWriteStream } from "node:fs"
import { rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { finished } from "node:stream/promises"

import { and, eq } from "drizzle-orm"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { ZipWriter } from "@/lib/archive"
import { registerJobHandler } from "@/lib/jobs"
import { getStorageObjectBytes, putExportObject, type StorageBucketName } from "@/lib/storage/s3"

import { database } from "@/database"
import { clients, dataExports } from "@/database/schema"

import packageJson from "@/package.json"

import { readClientExportRows, readInstanceExportRows, type ExportRowsByTable } from "./queries"
import { type DataExportScope } from "./schemas"
import {
  buildExportFilename,
  buildExportIndex,
  buildExportStorageKey,
  computeExportProgress,
  EXPORT_ARCHIVE_CONTENT_TYPE,
  EXPORT_FILES_DIRECTORY,
  EXPORT_INDEX_FILE,
  getExportTables,
  serializeExportIndex,
  serializeExportTable,
  type DataExportFailureReason,
  type ExportFileSummary,
  type ExportTableSummary
} from "./services"

registerJobHandler("data_export.assemble", assembleDataExport)

type ClaimedExport = {
  id: string
  scope: DataExportScope
  clientId: string | null
  requestedByUserId: string | null
  requestedAt: Date
}

type AssembledArchive = {
  entryCount: number
  filename: string
  sizeBytes: number
  storageKey: string
}

class DataExportFailure extends Error {
  constructor(readonly reason: DataExportFailureReason) {
    super(`Data export failed: ${reason}`)
  }
}

// The consumer half of ADR-0023 for `/settings/data`. A full-instance export reads every business
// table and every stored object, which is exactly the work that must not happen inside a request.
//
// Retries are deliberately no-ops rather than a second attempt. `DEFAULT_JOB_OPTIONS` gives every job
// five attempts, and the conditional claim below only accepts a row that is still `pending`, so
// attempts 2..5 of a failed export find `failed` and return. An export is a user-initiated operation
// whose failure is already durable on the row and on screen; silently rebuilding a multi-gigabyte
// archive behind an owner who has been told it failed would cost real storage for no decision they
// made. Re-requesting is the retry.
async function assembleDataExport(payload: { exportId: string }): Promise<void> {
  const claimed = await claimExport(payload.exportId)

  if (!claimed) return

  try {
    const archive = await writeExportArchive(claimed)

    await database
      .update(dataExports)
      .set({
        status: "ready",
        progress: 100,
        completedAt: new Date(),
        filename: archive.filename,
        storageKey: archive.storageKey,
        sizeBytes: archive.sizeBytes,
        entryCount: archive.entryCount
      })
      .where(eq(dataExports.id, claimed.id))

    // The second half of the audit trail (`mutations.ts` writes the request). No IP or user-agent:
    // this runs in the worker process with no request behind it, and inventing the requester's last
    // known address would put a value in the audit log that nothing observed.
    await writeAudit("data_export.completed", {
      actorUserId: claimed.requestedByUserId,
      targetEntityType: claimed.scope === "client" ? "client" : "data_export",
      targetEntityId: claimed.scope === "client" ? claimed.clientId : claimed.id,
      metadata: {
        exportId: claimed.id,
        scope: claimed.scope,
        clientId: claimed.clientId,
        sizeBytes: archive.sizeBytes,
        entryCount: archive.entryCount
      },
      ipAddress: null,
      userAgent: null
    })
  } catch (error) {
    await failExport(claimed, error)
  }
}

// A conditional update rather than a read-then-write: two deliveries of the same job would otherwise
// both see `pending` and assemble the archive twice. The row is the guard, not the BullMQ job id,
// which is released as soon as the job completes.
async function claimExport(exportId: string): Promise<ClaimedExport | null> {
  const [claimed] = await database
    .update(dataExports)
    .set({ status: "running", progress: 0, startedAt: new Date(), failureReason: null })
    .where(and(eq(dataExports.id, exportId), eq(dataExports.status, "pending")))
    .returning({
      id: dataExports.id,
      scope: dataExports.scope,
      clientId: dataExports.clientId,
      requestedByUserId: dataExports.requestedByUserId,
      requestedAt: dataExports.createdAt
    })

  return claimed ?? null
}

async function writeExportArchive(claimed: ClaimedExport): Promise<AssembledArchive> {
  const rowsByTable = await readExportRows(claimed)
  const manifests = getExportTables(claimed.scope)
  const uploadRows = toUploadRows(rowsByTable)

  const filename = buildExportFilename({
    scope: claimed.scope,
    clientName: await readClientName(claimed.clientId),
    requestedAt: claimed.requestedAt
  })

  // Written to a temp file before it is uploaded, the same shape `scripts/core/backup/writeArchive.ts`
  // uses: a single PutObject needs the archive's length up front, and streaming it straight to storage
  // would mean buffering the whole export in memory to measure it.
  const archivePath = path.join(tmpdir(), `remit-export-${claimed.id}.zip`)
  const output = createWriteStream(archivePath, { flags: "wx" })
  const zip = new ZipWriter(output, { modifiedAt: claimed.requestedAt })
  const reportProgress = createProgressReporter(claimed.id)

  try {
    const tableSummaries: ExportTableSummary[] = []

    for (const [index, manifest] of manifests.entries()) {
      const rows = rowsByTable[manifest.table] ?? []

      await zip.writeEntry(manifest.file, Buffer.from(serializeExportTable(manifest, rows), "utf8"))

      tableSummaries.push({ table: manifest.table, file: manifest.file, rowCount: rows.length })

      await reportProgress({
        tablesDone: index + 1,
        tablesTotal: manifests.length,
        filesDone: 0,
        filesTotal: uploadRows.length
      })
    }

    const fileSummaries = await writeUploadEntries({
      zip,
      reportProgress,
      tablesTotal: manifests.length,
      uploadRows
    })

    await zip.writeEntry(
      EXPORT_INDEX_FILE,
      Buffer.from(
        serializeExportIndex(
          buildExportIndex({
            appVersion: packageJson.version,
            clientId: claimed.clientId,
            exportId: claimed.id,
            files: fileSummaries,
            generatedAt: new Date(),
            scope: claimed.scope,
            tables: tableSummaries
          })
        ),
        "utf8"
      )
    )

    await zip.finalize()
    await finished(output)

    const storageKey = buildExportStorageKey(claimed.id, filename)
    const archiveStats = await stat(archivePath)

    await uploadArchive(archivePath, storageKey, archiveStats.size)

    return {
      entryCount: tableSummaries.length + fileSummaries.length + 1,
      filename,
      sizeBytes: archiveStats.size,
      storageKey
    }
  } catch (error) {
    output.destroy()

    throw error
  } finally {
    await rm(archivePath, { force: true })
  }
}

async function readExportRows(claimed: ClaimedExport): Promise<ExportRowsByTable> {
  if (claimed.scope === "instance") return await readInstanceExportRows()

  // The client is gone by the time the worker picked the job up. Failing with a reason rather than
  // exporting the instance is the only safe reading of a scoped request whose scope disappeared.
  if (!claimed.clientId) throw new DataExportFailure("clientMissing")

  const rows = await readClientExportRows(claimed.clientId)

  if (!rows) throw new DataExportFailure("clientMissing")

  return rows
}

type UploadRow = {
  id: string
  path: string
  bucket: StorageBucketName
}

function toUploadRows(rowsByTable: ExportRowsByTable): UploadRow[] {
  return (rowsByTable.uploads ?? []).flatMap((row) => {
    const id = row.id
    const objectPath = row.path
    // Generated document PDFs live in the private `documents` bucket, so reading every row from the
    // public one would skip exactly the invoices and contracts an owner most wants in their archive
    // — and skip them silently, because `readStorageObject` logs and continues.
    const bucket = row.bucket === "documents" ? "documents" : "public"

    if (typeof id !== "string" || typeof objectPath !== "string") return []

    return [{ id, path: objectPath, bucket }]
  })
}

type WriteUploadEntriesInput = {
  reportProgress: ProgressReporter
  tablesTotal: number
  uploadRows: readonly UploadRow[]
  zip: ZipWriter
}

// Every stored object referenced by the exported rows, fetched one at a time and written straight into
// the archive. This is also how generated PDFs travel: ADR-0022 stores them as `uploads` rows, so a
// signed contract PDF appears here without this loop knowing anything about documents.
async function writeUploadEntries({
  reportProgress,
  tablesTotal,
  uploadRows,
  zip
}: WriteUploadEntriesInput): Promise<ExportFileSummary[]> {
  const summaries: ExportFileSummary[] = []

  for (const [index, upload] of uploadRows.entries()) {
    const bytes = await readStorageObject(upload)

    if (bytes) {
      const entryPath = `${EXPORT_FILES_DIRECTORY}/${upload.path}`

      // Uploads are images and PDFs, which are already compressed; deflating them again costs CPU per
      // byte and gives back nothing.
      await zip.writeEntry(entryPath, bytes, { compress: false })

      summaries.push({ path: entryPath, uploadId: upload.id, sizeBytes: bytes.length })
    }

    await reportProgress({
      tablesDone: tablesTotal,
      tablesTotal,
      filesDone: index + 1,
      filesTotal: uploadRows.length
    })
  }

  return summaries
}

// A missing object is skipped rather than failing the export: `uploads` rows outlive the objects they
// point at (a storage bucket restored from a partial backup, a manual deletion), and refusing to
// produce the archive at all would deny the owner the rest of their data for one absent receipt. The
// gap is visible — `index.json` lists the files that made it and `data/uploads.json` lists every row.
async function readStorageObject(upload: UploadRow): Promise<Buffer | null> {
  try {
    return await getStorageObjectBytes(upload.path, upload.bucket)
  } catch (error) {
    logger.error(
      { action: "assembleDataExport", uploadId: upload.id, err: error },
      "Data export skipped an unreadable storage object"
    )

    return null
  }
}

async function uploadArchive(
  archivePath: string,
  storageKey: string,
  sizeBytes: number
): Promise<void> {
  try {
    await putExportObject({
      objectKey: storageKey,
      body: createReadStream(archivePath),
      contentLength: sizeBytes,
      contentType: EXPORT_ARCHIVE_CONTENT_TYPE
    })
  } catch (error) {
    logger.error(
      { action: "assembleDataExport", storageKey, err: error },
      "Data export archive upload failed"
    )

    throw new DataExportFailure("storageFailed")
  }
}

type ProgressInput = {
  filesDone: number
  filesTotal: number
  tablesDone: number
  tablesTotal: number
}

type ProgressReporter = (input: ProgressInput) => Promise<void>

// Writes only when the whole-number percentage moves, so an instance with a thousand uploads costs at
// most a hundred updates rather than a thousand. The `status = 'running'` clause keeps a late write
// from resurrecting the progress of an export that has already been marked failed.
function createProgressReporter(exportId: string): ProgressReporter {
  let lastProgress = -1

  return async (input) => {
    const progress = computeExportProgress(input)

    if (progress === lastProgress) return

    lastProgress = progress

    await database
      .update(dataExports)
      .set({ progress })
      .where(and(eq(dataExports.id, exportId), eq(dataExports.status, "running")))
  }
}

async function readClientName(clientId: string | null): Promise<string | null> {
  if (!clientId) return null

  const client = await database.query.clients.findFirst({
    columns: { name: true },
    where: eq(clients.id, clientId)
  })

  return client?.name ?? null
}

async function failExport(claimed: ClaimedExport, error: unknown): Promise<void> {
  const reason = error instanceof DataExportFailure ? error.reason : "assemblyFailed"

  logger.error(
    { action: "assembleDataExport", exportId: claimed.id, reason, err: error },
    "Data export assembly failed"
  )

  // A stable reason code, never the caught error: the column is rendered to the owner through a
  // translation lookup, and a driver or provider message can carry connection details. The error text
  // stays in the server log above.
  await database
    .update(dataExports)
    .set({ status: "failed", failureReason: reason, completedAt: new Date() })
    .where(eq(dataExports.id, claimed.id))

  await writeAudit("data_export.failed", {
    actorUserId: claimed.requestedByUserId,
    targetEntityType: claimed.scope === "client" ? "client" : "data_export",
    targetEntityId: claimed.scope === "client" ? claimed.clientId : claimed.id,
    metadata: { exportId: claimed.id, scope: claimed.scope, reason },
    ipAddress: null,
    userAgent: null
  })
}
