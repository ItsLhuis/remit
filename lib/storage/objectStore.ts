import { type Readable } from "node:stream"

import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type GetObjectCommandOutput,
  type ListObjectsV2CommandOutput,
  type S3Client
} from "@aws-sdk/client-s3"

import { type StorageBucketRole } from "./bucketNames"
import { readStatusCode } from "./objectErrors"

export type StorageClient = Pick<S3Client, "send">

export type StoredObject = {
  key: string
  size: number
}

export type StoredObjectRead = {
  body: NonNullable<GetObjectCommandOutput["Body"]>
  contentLength: number | null
  contentType: string | null
}

export type PutStoredObjectInput = {
  role: StorageBucketRole
  key: string
  body: Readable | Buffer
  contentLength: number
  contentType: string
}

// Every S3 call Remit makes against object storage, addressed by bucket role over an injected
// client. `lib/storage/s3.ts` builds the running application's one from `S3_*`; backups and restores
// take it as an argument rather than importing it.
export type ObjectStore = {
  listObjects: (role: StorageBucketRole) => AsyncIterable<StoredObject>
  headObject: (role: StorageBucketRole, key: string) => Promise<{ size: number } | null>
  getObject: (role: StorageBucketRole, key: string) => Promise<StoredObjectRead>
  putObject: (input: PutStoredObjectInput) => Promise<void>
  deleteObject: (role: StorageBucketRole, key: string) => Promise<void>
  ensureBucket: (role: StorageBucketRole) => Promise<void>
}

export type CreateObjectStoreInput = {
  client: StorageClient
  bucketNames: Record<StorageBucketRole, string>
}

export function createObjectStore({ client, bucketNames }: CreateObjectStoreInput): ObjectStore {
  return {
    listObjects: (role) => listBucket(client, bucketNames[role], role),

    async headObject(role, key) {
      try {
        const head = await client.send(
          new HeadObjectCommand({ Bucket: bucketNames[role], Key: key })
        )

        return { size: head.ContentLength ?? 0 }
      } catch (error) {
        // 404 only, unlike `objectErrors.ts`'s `isMissingObjectError`. The one caller is a backup
        // deciding whether a file the database names is gone, and it has just listed the bucket, so
        // its key holds `s3:ListBucket` and a missing key answers 404. A 403 here is a refused
        // read, and calling that "gone" would write an archive without the file and report success.
        if (readStatusCode(error) === 404) return null

        throw error
      }
    },

    async getObject(role, key) {
      const object = await client.send(
        new GetObjectCommand({ Bucket: bucketNames[role], Key: key })
      )

      if (!object.Body) throw new Error(`Stored object has no body in the ${role} bucket`)

      return {
        body: object.Body,
        contentLength: object.ContentLength ?? null,
        contentType: object.ContentType ?? null
      }
    },

    async putObject(input) {
      // The SDK pipes a stream body into the request without forwarding the stream's own failure: a
      // body that errors part-way — a browser abandoning an upload the route is relaying — would
      // escape as an uncaught exception and leave the request open until the store gave up on it.
      // Aborting on that error fails the write at once, and the store keeps nothing of it.
      const abort = new AbortController()

      if (!Buffer.isBuffer(input.body)) {
        input.body.once("error", (error) => abort.abort(error))
      }

      // `ContentLength` is what bounds the write: the SDK sends exactly that many bytes and the store
      // refuses a body that ends short, and without it a stream body would be buffered whole to be
      // measured.
      await client.send(
        new PutObjectCommand({
          Bucket: bucketNames[input.role],
          Key: input.key,
          Body: input.body,
          ContentLength: input.contentLength,
          ContentType: input.contentType
        }),
        { abortSignal: abort.signal }
      )
    },

    async deleteObject(role, key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucketNames[role], Key: key }))
    },

    ensureBucket: (role) => ensureBucketExists(client, bucketNames[role])
  }
}

async function* listBucket(
  client: StorageClient,
  bucket: string,
  role: StorageBucketRole
): AsyncGenerator<StoredObject> {
  let continuationToken: string | undefined

  do {
    const page = await fetchListingPage(client, bucket, continuationToken)

    if (!page) {
      // The documents and exports buckets are created lazily by their first writer, so an instance
      // can legitimately have neither. The public bucket is created at boot (`instrumentation.ts`):
      // its absence means `S3_BUCKET` or `S3_ENDPOINT` points somewhere else, and listing it as
      // empty would let a backup archive no files and still succeed.
      if (role === "public") {
        throw new Error(
          "The public bucket does not exist. Check that S3_BUCKET and S3_ENDPOINT name the store this instance uses."
        )
      }

      return
    }

    yield* toStoredObjects(page)

    continuationToken = readContinuationToken(page, role)
  } while (continuationToken)
}

function toStoredObjects(page: ListObjectsV2CommandOutput): StoredObject[] {
  return (page.Contents ?? []).flatMap((object) =>
    object.Key ? [{ key: object.Key, size: object.Size ?? 0 }] : []
  )
}

// A truncated page without a token would end the listing early while looking complete, and backups
// and restores treat the listing as the whole bucket.
function readContinuationToken(
  page: ListObjectsV2CommandOutput,
  role: StorageBucketRole
): string | undefined {
  if (!page.IsTruncated) return undefined

  if (!page.NextContinuationToken) {
    throw new Error(`Listing of the ${role} bucket was truncated without a continuation token`)
  }

  return page.NextContinuationToken
}

// Null for a bucket that does not exist; `listBucket` decides which roles may be missing.
async function fetchListingPage(
  client: StorageClient,
  bucket: string,
  continuationToken: string | undefined
): Promise<ListObjectsV2CommandOutput | null> {
  try {
    return await client.send(
      new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: continuationToken })
    )
  } catch (error) {
    if (readStatusCode(error) === 404) return null

    throw error
  }
}

// No bucket policy is ever set, and none may be: nothing reads the store anonymously, and the public
// bucket's openness is enforced by `app/api/storage/[...key]/route.ts` instead (ADR-0040).
async function ensureBucketExists(client: StorageClient, bucket: string): Promise<void> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }))

    return
  } catch (error) {
    // 403 means the bucket exists and this key may not inspect it — an operator's pre-created bucket
    // under a key scoped to its objects (ADR-0045). Creating it is not Remit's to do, and the object
    // calls that follow succeed or fail on their own permissions.
    if (readStatusCode(error) === 403) return

    if (readStatusCode(error) !== 404) throw error
  }

  try {
    await client.send(new CreateBucketCommand({ Bucket: bucket }))
  } catch (error) {
    // Another process — the app and the worker both create lazily — won the race.
    if (readStatusCode(error) !== 409) throw error
  }
}
