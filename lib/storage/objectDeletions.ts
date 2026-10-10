import { asc, eq, inArray, sql, type SQL } from "drizzle-orm"

import { z } from "zod"

import { logger } from "@/lib/logger"

import { database } from "@/database"
import { objectDeletions, uploads } from "@/database/schema"

import {
  dedupeReleasedObjects,
  selectReleasedUploadIds,
  type ReleasedObject
} from "./objectOwnership"
import { type ObjectStore } from "./objectStore"
import { storage } from "./s3"

type Database = typeof database

// A transaction or the database itself: the release runs inside the caller's transaction, and the
// reset command passes its own.
export type ObjectReleaseExecutor = Pick<Database, "delete" | "execute" | "insert" | "select">

export type ObjectRelease = {
  uploadRows: number
  objects: number
  deletionIds: string[]
}

export type ObjectDrainResult = {
  deleted: number
  failed: number
}

type ReadUploadReferencesOptions = {
  // Tables whose references are left out, so a plan can ask what a delete would release before it
  // runs (`scripts/core/resetData/plan.ts`).
  excludeTables?: ReadonlySet<string>
}

type DrainOptions = {
  ids?: readonly string[]
  limit?: number
  store?: ObjectStore
}

// The block trees that can name an upload by id with no foreign key behind it: a template's image
// blocks, and the contract body copied from one. Both are validated as uuids on save, and the
// pattern below re-checks before the cast so one malformed value cannot fail a purge.
const BLOCK_TABLES = ["templates", "contracts"] as const

const UUID_PATTERN = "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"

const ID_CHUNK_SIZE = 1000

const DRAIN_BATCH_SIZE = 500

// A store that refused this many deletes in a row is down rather than refusing one key, and the next
// sweep retries the rest instead of this one waiting out a timeout per object.
const CONSECUTIVE_FAILURE_LIMIT = 3

const foreignKeyRowSchema = z.object({ tableName: z.string(), columnName: z.string() })

const uploadIdRowSchema = z.object({ uploadId: z.string() })

// Every upload id something in the database points at. Foreign keys are read from the catalogue
// rather than listed here, so a reference added to a future table is covered without editing this
// file; the two references with no foreign key — an avatar stored as its key on `users.image`, and
// image blocks inside a block tree — are the ones spelled out.
export async function readUploadReferences(
  executor: ObjectReleaseExecutor,
  options: ReadUploadReferencesOptions = {}
): Promise<string[]> {
  const excluded = options.excludeTables ?? new Set<string>()

  const foreignKeys = z.array(foreignKeyRowSchema).parse([
    ...(await executor.execute(sql`
      SELECT DISTINCT tc.table_name AS "tableName", kcu.column_name AS "columnName"
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = tc.constraint_name
        AND kcu.constraint_schema = tc.constraint_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.constraint_schema = tc.constraint_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND ccu.table_name = 'uploads'
      ORDER BY 1, 2
    `))
  ])

  const sources: SQL[] = [
    ...foreignKeys
      .filter((reference) => !excluded.has(reference.tableName))
      .map(
        (reference) => sql`
          SELECT ${sql.identifier(reference.columnName)}::text AS "uploadId"
          FROM ${sql.identifier(reference.tableName)}
          WHERE ${sql.identifier(reference.columnName)} IS NOT NULL
        `
      ),
    ...BLOCK_TABLES.filter((table) => !excluded.has(table)).map(
      (table) => sql`
        SELECT block_upload.value #>> '{}' AS "uploadId"
        FROM ${sql.identifier(table)},
          jsonb_path_query(${sql.identifier(table)}.blocks, 'lax $.**.uploadId') AS block_upload(value)
        WHERE jsonb_typeof(block_upload.value) = 'string'
          AND block_upload.value #>> '{}' ~* ${UUID_PATTERN}
      `
    ),
    sql`
      SELECT uploads.id::text AS "uploadId"
      FROM uploads
      JOIN users ON users.image = uploads.path
    `
  ]

  const rows = z
    .array(uploadIdRowSchema)
    .parse([...(await executor.execute(sql.join(sources, sql` UNION `)))])

  return rows.map((row) => row.uploadId.toLowerCase())
}

// Called inside the transaction that deleted the rows, after the deletes: the uploads those rows
// were the last to reference lose their row here, and every object they and the caller's own
// artifacts held is queued in `object_deletions` in the same commit. Nothing is removed from the
// bucket yet — that is `drainObjectDeletions`, after the commit — so a rollback takes the queue
// entries with it and no object is ever gone while a row still names it.
export async function releaseObjects(
  executor: ObjectReleaseExecutor,
  {
    referencedBefore,
    objects = []
  }: { referencedBefore: readonly string[]; objects?: readonly ReleasedObject[] }
): Promise<ObjectRelease> {
  // Nothing referenced before means nothing can have been released, and the read below scans every
  // reference in the instance — an export expiry, which owns its keys outright, skips it.
  const releasedIds =
    referencedBefore.length === 0
      ? []
      : selectReleasedUploadIds(referencedBefore, await readUploadReferences(executor))

  const releasedUploads: ReleasedObject[] = []

  for (const chunk of chunked(releasedIds)) {
    releasedUploads.push(
      ...(await executor
        .delete(uploads)
        .where(inArray(uploads.id, chunk))
        .returning({ bucket: uploads.bucket, key: uploads.path }))
    )
  }

  const queued = dedupeReleasedObjects([...releasedUploads, ...objects])
  const deletionIds: string[] = []

  for (const chunk of chunked(queued)) {
    const rows = await executor
      .insert(objectDeletions)
      .values(chunk)
      // A no-op update rather than `DO NOTHING`, so a key already queued by an earlier operation
      // still returns its id and is drained with the rest.
      .onConflictDoUpdate({
        target: [objectDeletions.bucket, objectDeletions.key],
        set: { attempts: sql`${objectDeletions.attempts}` }
      })
      .returning({ id: objectDeletions.id })

    deletionIds.push(...rows.map((row) => row.id))
  }

  return { uploadRows: releasedUploads.length, objects: queued.length, deletionIds }
}

// Removes queued objects from the bucket, then their queue rows — in that order, so a crash between
// the two leaves a row whose object is already gone, and the next drain's delete of a missing key
// succeeds and clears it. Oldest untried first, so a key the store keeps refusing drifts to the back
// rather than blocking the queue.
//
// Never throws. Every caller has already committed the deletes that released these objects, so a
// failure here is not a failure of the purge, erasure or reset that called it: the rows stay queued
// and `storage.deletion.sweep` retries them within the hour. Counts are logged and keys never are —
// a public-bucket key is the only thing standing between the object and anyone who can read a log
// (`security.md`).
export async function drainObjectDeletions(options: DrainOptions = {}): Promise<ObjectDrainResult> {
  if (options.ids?.length === 0) return { deleted: 0, failed: 0 }

  try {
    return await drainPending(options.store ?? storage, options)
  } catch (error) {
    logger.error(
      { action: "drainObjectDeletions", err: error },
      "Queued stored objects could not be read for deletion and stay queued"
    )

    return { deleted: 0, failed: 0 }
  }
}

// In batches: every batch of the given ids, or for a sweep, batches of the oldest rows until one
// comes back short. A store that stops answering ends the whole drain, not only the batch.
async function drainPending(store: ObjectStore, options: DrainOptions): Promise<ObjectDrainResult> {
  const batchSize = options.limit ?? DRAIN_BATCH_SIZE
  const idBatches = options.ids ? chunked(options.ids) : null
  const progress: DrainProgress = { deleted: 0, failed: 0, consecutiveFailures: 0, lastError: null }

  for (let batchIndex = 0; !isStoreDown(progress); batchIndex += 1) {
    const ids = idBatches ? idBatches[batchIndex] : undefined

    if (idBatches && !ids) break

    const pending = await readPendingBatch(ids, batchSize)

    await deleteBatch(store, pending, progress)

    // A sweep stops at the first short batch, or at any failure: a failed row is re-read by the next
    // batch, so carrying on would retry it within the same run instead of in the next one.
    if (!idBatches && (pending.length < batchSize || progress.failed > 0)) break
  }

  if (progress.failed > 0) {
    logger.warn(
      {
        action: "drainObjectDeletions",
        deleted: progress.deleted,
        failed: progress.failed,
        err: progress.lastError
      },
      "Some stored objects could not be deleted yet and stay queued for the next sweep"
    )
  }

  return { deleted: progress.deleted, failed: progress.failed }
}

type DrainProgress = ObjectDrainResult & { consecutiveFailures: number; lastError: unknown }

function isStoreDown(progress: DrainProgress): boolean {
  return progress.consecutiveFailures >= CONSECUTIVE_FAILURE_LIMIT
}

async function readPendingBatch(ids: string[] | undefined, batchSize: number) {
  return database
    .select({ id: objectDeletions.id, bucket: objectDeletions.bucket, key: objectDeletions.key })
    .from(objectDeletions)
    .where(ids ? inArray(objectDeletions.id, ids) : undefined)
    .orderBy(sql`${objectDeletions.lastAttemptAt} ASC NULLS FIRST`, asc(objectDeletions.createdAt))
    .limit(ids ? ids.length : batchSize)
}

async function deleteBatch(
  store: ObjectStore,
  pending: Awaited<ReturnType<typeof readPendingBatch>>,
  progress: DrainProgress
): Promise<void> {
  for (const row of pending) {
    if (isStoreDown(progress)) return

    try {
      await store.deleteObject(row.bucket, row.key)
      await database.delete(objectDeletions).where(eq(objectDeletions.id, row.id))

      progress.deleted += 1
      progress.consecutiveFailures = 0
    } catch (error) {
      progress.failed += 1
      progress.consecutiveFailures += 1
      progress.lastError = error

      await recordFailedAttempt(row.id)
    }
  }
}

// Best-effort: the attempt count only orders the queue, so a database that is also unreachable
// leaves the row as it was and costs nothing but its place.
async function recordFailedAttempt(id: string): Promise<void> {
  try {
    await database
      .update(objectDeletions)
      .set({ attempts: sql`${objectDeletions.attempts} + 1`, lastAttemptAt: new Date() })
      .where(eq(objectDeletions.id, id))
  } catch (error) {
    logger.error(
      { action: "drainObjectDeletions", err: error },
      "Failed to record an object deletion attempt"
    )
  }
}

function chunked<T>(values: readonly T[]): T[][] {
  const chunks: T[][] = []

  for (let index = 0; index < values.length; index += ID_CHUNK_SIZE) {
    chunks.push(values.slice(index, index + ID_CHUNK_SIZE))
  }

  return chunks
}
