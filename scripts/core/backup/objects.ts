import { createHash } from "node:crypto"
import { Readable } from "node:stream"

import { type StorageBucketName } from "@/lib/storage/bucketNames"
import { readStatusCode } from "@/lib/storage/objectErrors"
import { type ObjectStore, type StoredObjectRead } from "@/lib/storage/objectStore"

import { mapWithConcurrency } from "../utils/concurrency"
import { hashStoredObject, toNodeReadable } from "../utils/objectBody"

import {
  ARCHIVED_BUCKET_ROLES,
  findUnlistedUploads,
  isArchivableObjectKey,
  isBackupArchiveKey,
  toArchivedContentType,
  toObjectArchivePath,
  type UploadRowLocation
} from "./objectPlan"

// Bounded so an instance with thousands of files never opens thousands of streams at once.
const OBJECT_HASH_CONCURRENCY = 8

export class BackupObjectError extends Error {}

export type ListedObject = {
  role: StorageBucketName
  key: string
  size: number
}

export type ArchivedObject = ListedObject & {
  archivePath: string
  contentType: string
  sha256: string
}

export type ListedObjects = {
  objects: ListedObject[]
  // Objects left out because their key is one an archive cannot hold (`objectPlan.ts`'s
  // `isArchivableObjectKey`). The application mints no such key, so these are never Remit's files.
  unarchivableObjectCount: number
}

export type CollectedObjects = {
  objects: ArchivedObject[]
  // Files the archive lacks: rows whose object was already gone, and objects deleted after the
  // listing saw them.
  missingObjectCount: number
  unarchivableObjectCount: number
}

// Rows first, listing second. The upload route stores an object before it inserts the row naming
// it, so every row read here already has its object in the store, and a listing that starts
// afterwards contains it unless it has been deleted since. Rows read after the listing would include
// a file uploaded while the listing ran, which looks exactly like a listing that ended early.
export async function collectArchivedObjects(
  store: ObjectStore,
  readUploadRows: () => Promise<UploadRowLocation[]>
): Promise<CollectedObjects> {
  const rows = await readUploadRows()
  const { objects: listed, unarchivableObjectCount } = await listArchivedObjects(store)
  const { missingObjectCount } = await assertListingCoversUploads(store, listed, rows)
  const described = await describeArchivedObjects(store, listed)
  const objects = described.filter((object): object is ArchivedObject => object !== null)

  return {
    objects,
    missingObjectCount: missingObjectCount + described.length - objects.length,
    unarchivableObjectCount
  }
}

export async function listArchivedObjects(store: ObjectStore): Promise<ListedObjects> {
  const listed: ListedObject[] = []
  let unarchivableObjectCount = 0

  for (const role of ARCHIVED_BUCKET_ROLES) {
    for await (const object of store.listObjects(role)) {
      if (isBackupArchiveKey(object.key)) continue

      // Left out and counted rather than fatal: one folder marker made in a provider's console
      // would otherwise stop every backup, the pre-restore snapshot with them, over an object that
      // was never Remit's. A row naming such a key still fails the backup, in
      // `assertListingCoversUploads`.
      if (!isArchivableObjectKey(role, object.key)) {
        unarchivableObjectCount += 1

        continue
      }

      listed.push({ role, key: object.key, size: object.size })
    }
  }

  const objects = listed.sort((left, right) =>
    left.role === right.role
      ? left.key.localeCompare(right.key)
      : left.role.localeCompare(right.role)
  )

  return { objects, unarchivableObjectCount }
}

// A listing that ends early looks, from the outside, like a bucket with fewer files — RustFS 1.0.0
// can return one (ADR-0045). Every file the database names is therefore checked against it: one that
// exists but was not listed fails the backup rather than leaving it out of an archive that would
// otherwise look complete. A row whose object is truly gone is an earlier interrupted delete; it is
// counted and reported, not fatal, or a single lost file would stop every backup from then on.
export async function assertListingCoversUploads(
  store: ObjectStore,
  listed: readonly ListedObject[],
  rows: readonly UploadRowLocation[]
): Promise<{ missingObjectCount: number }> {
  const listedKeys: Record<StorageBucketName, Set<string>> = {
    public: new Set(),
    documents: new Set()
  }

  for (const object of listed) listedKeys[object.role].add(object.key)

  let missingObjectCount = 0

  for (const row of findUnlistedUploads(listedKeys, rows)) {
    // A key the listing left out on purpose. The application mints none, so this is not expected to
    // happen; if it does, the file is Remit's and an archive without it must not look complete.
    if (!isArchivableObjectKey(row.bucket, row.path)) {
      throw new BackupObjectError(
        `A file the database names in the ${row.bucket} bucket has a key a backup archive cannot hold, so no archive was written.`
      )
    }

    if (await store.headObject(row.bucket, row.path)) {
      throw new BackupObjectError(
        `The object store listed the ${row.bucket} bucket incompletely, so no archive was written. Run the backup again; if it keeps failing, check the store's logs.`
      )
    }

    missingObjectCount += 1
  }

  return { missingObjectCount }
}

// The second read, into the archive. The bytes are hashed again on the way through, and a mismatch
// with the first read fails the whole archive: Remit writes every key once, so different bytes under
// the same key mean corruption, never a legitimate update. An object deleted between the two reads
// fails it too: the manifest and the checksums already promise it, and the next backup succeeds.
// Reading every object once instead was weighed and turned down in ADR-0046.
export async function openVerifiedObjectStream(
  store: ObjectStore,
  object: ArchivedObject
): Promise<Readable> {
  const read = await store.getObject(object.role, object.key)

  async function* verifiedChunks(): AsyncGenerator<Buffer> {
    const hash = createHash("sha256")
    let size = 0

    for await (const chunk of toNodeReadable(read)) {
      const bytes = chunk as Buffer

      size += bytes.length

      // Checked before the chunk goes out: the tar header already promised `object.size` bytes, and
      // one surplus byte would corrupt every entry after it rather than just this one.
      if (size > object.size) {
        throw new BackupObjectError(
          `An object in the ${object.role} bucket changed while the backup read it, so no archive was written.`
        )
      }

      hash.update(bytes)

      yield bytes
    }

    if (size !== object.size || hash.digest("hex") !== object.sha256) {
      throw new BackupObjectError(
        `An object in the ${object.role} bucket changed while the backup read it, so no archive was written.`
      )
    }
  }

  return Readable.from(verifiedChunks())
}

// The first of two reads: `checksums.sha256` precedes the objects in the archive, so every object is
// hashed before any is written. `openVerifiedObjectStream` reads it again and must see the same
// bytes. Null for an object deleted after the listing saw it — an owner removing an attachment while
// the backup runs — which the archive then leaves out, as it would had the listing come a moment
// later.
async function describeArchivedObjects(
  store: ObjectStore,
  listed: readonly ListedObject[]
): Promise<Array<ArchivedObject | null>> {
  return await mapWithConcurrency(listed, OBJECT_HASH_CONCURRENCY, async (object) => {
    const read = await readUnlessDeleted(store, object)

    if (!read) return null

    const { sha256, size } = await hashStoredObject(read)

    if (size !== object.size) {
      throw new BackupObjectError(
        `An object in the ${object.role} bucket changed size while the backup read it, so no archive was written.`
      )
    }

    return {
      ...object,
      archivePath: toObjectArchivePath(object.role, object.key),
      contentType: toArchivedContentType(read.contentType),
      sha256
    }
  })
}

async function readUnlessDeleted(
  store: ObjectStore,
  object: ListedObject
): Promise<StoredObjectRead | null> {
  try {
    return await store.getObject(object.role, object.key)
  } catch (error) {
    // 404 only, never `objectErrors.ts`'s `isMissingObjectError`: the listing that produced this key
    // proves the credential holds `s3:ListBucket`, under which a deleted key answers 404. A 403 is a
    // refused read — a policy without `s3:GetObject`, a key rotated mid-run — and treating it as a
    // deletion would write an archive with no files and report success.
    if (readStatusCode(error) === 404) return null

    throw error
  }
}
