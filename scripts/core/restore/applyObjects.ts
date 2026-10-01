import { createReadStream } from "node:fs"

import { type ObjectStore } from "@/lib/storage/objectStore"

import { ARCHIVED_BUCKET_ROLES } from "../backup/objectPlan"
import { mapWithConcurrency } from "../utils/concurrency"
import { hashStoredObject } from "../utils/objectBody"

import { RestoreCliError } from "./errors"
import { planObjectDeletions, type ObjectLocation } from "./objectDeletions"
import { type StagedObject } from "./verifyArchive"

const OBJECT_RESTORE_CONCURRENCY = 4

// The first step (ADR-0046): every archived object goes back into its bucket and is read back
// and hashed. Nothing is deleted here, so stopping part-way leaves every file either the old or the
// new database names, and running the restore again finishes the job.
export async function putArchivedObjects(
  store: ObjectStore,
  objects: readonly StagedObject[]
): Promise<void> {
  for (const role of ARCHIVED_BUCKET_ROLES) await store.ensureBucket(role)

  await mapWithConcurrency(objects, OBJECT_RESTORE_CONCURRENCY, async (object) => {
    if (!object.stagedPath) {
      throw new RestoreCliError(
        "Refusing restore: an archived file was not staged before it was needed.",
        "objects-staging-missing"
      )
    }

    await store.putObject({
      role: object.role,
      key: object.key,
      body: createReadStream(object.stagedPath),
      contentLength: object.size,
      contentType: object.contentType
    })

    const readBack = await hashStoredObject(await store.getObject(object.role, object.key))

    if (readBack.sha256 !== object.sha256) {
      throw new RestoreCliError(
        "Restore stopped: a file read back from object storage did not match the archive. No file was deleted; run the restore again.",
        "object-verification-failed"
      )
    }
  })
}

// The last step, run only after the database has been replaced and migrated: "replace, not merge"
// for the public and documents buckets. The exports bucket is not archived and is left alone. Every
// other object a backup would have archived goes, whoever put it there, which is why the buckets
// must be Remit's alone (docs/operations/RESTORE.md).
export async function deleteObjectsAbsentFromArchive(
  store: ObjectStore,
  archived: readonly ObjectLocation[]
): Promise<number> {
  const live: ObjectLocation[] = []

  for (const role of ARCHIVED_BUCKET_ROLES) {
    for await (const object of store.listObjects(role)) live.push({ role, key: object.key })
  }

  const deletions = planObjectDeletions(archived, live)

  for (const object of deletions) await store.deleteObject(object.role, object.key)

  return deletions.length
}
