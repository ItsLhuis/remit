import { createReadStream, createWriteStream } from "node:fs"
import { mkdir, rm, rmdir, stat } from "node:fs/promises"
import path from "node:path"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import { type ReadableStream as NodeReadableStream } from "node:stream/web"

import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  UploadPartCommand
} from "@aws-sdk/client-s3"

import {
  buildS3ClientConfig,
  validateBackupCredentials,
  type BackupCredentials,
  type BackupDestination,
  type BackupDestinationAdapter,
  type CompleteBackupCredentials
} from "./destinationConfig"
import { planMultipartUpload } from "./multipart"

export {
  buildS3ClientConfig,
  resolveBackupEndpoint,
  validateBackupCredentials
} from "./destinationConfig"

export type {
  BackupCredentials,
  BackupCredentialValidationResult,
  BackupDestination,
  BackupDestinationAdapter,
  CompleteBackupCredentials
} from "./destinationConfig"

export function buildDestinationAdapter(
  destination: BackupDestination,
  credentials: BackupCredentials,
  options: { multipartThresholdBytes?: number } = {}
): BackupDestinationAdapter {
  if (destination === "local") {
    return buildLocalDestinationAdapter(credentials.localDirectory ?? "data/backups")
  }

  const validation = validateBackupCredentials(destination, credentials)

  if (!validation.ok) {
    throw new Error(validation.reason)
  }

  const completeCredentials = credentials as CompleteBackupCredentials
  const client = new S3Client(buildS3ClientConfig(destination, completeCredentials))
  const bucket = completeCredentials.bucket

  return {
    async put(key, body, sizeHint) {
      const plan = planMultipartUpload(sizeHint, {
        thresholdBytes: options.multipartThresholdBytes
      })

      if (plan.kind === "multipart") {
        await putInParts(client, {
          bucket,
          key,
          body,
          partSize: plan.partSize,
          sizeBytes: sizeHint
        })

        return { key }
      }

      await client.send(
        new PutObjectCommand({
          Body: body,
          Bucket: bucket,
          ContentLength: sizeHint,
          ContentType: "application/octet-stream",
          Key: key
        })
      )

      return { key }
    },
    async list(prefix) {
      const objects: Array<{ key: string; createdAt: Date; size: number }> = []
      let continuationToken: string | undefined

      do {
        const response = await client.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            ContinuationToken: continuationToken,
            Prefix: prefix
          })
        )

        for (const object of response.Contents ?? []) {
          if (!object.Key) continue

          objects.push({
            key: object.Key,
            createdAt: object.LastModified ?? new Date(0),
            size: object.Size ?? 0
          })
        }

        continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined
      } while (continuationToken)

      return objects.sort((left, right) => left.key.localeCompare(right.key))
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    },
    async get(key) {
      const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))

      return toNodeReadable(response.Body)
    }
  }
}

// Copies the body into one part-sized buffer and sends it each time it fills, so the upload holds a
// single part in memory whatever the archive's size. The buffer is reused: a part's request has
// finished, retries included, by the time `sendPart` resolves. A failure part-way aborts the upload,
// so the destination never keeps the parts of an archive that was not completed; a body shorter or
// longer than announced is such a failure. A process killed outright cannot abort, which is why the
// destination bucket wants a lifecycle rule for incomplete uploads (BACKUP-ARCHIVE.md).
async function putInParts(
  client: S3Client,
  input: { bucket: string; key: string; body: Readable; partSize: number; sizeBytes: number }
): Promise<void> {
  const created = await client.send(
    new CreateMultipartUploadCommand({
      Bucket: input.bucket,
      Key: input.key,
      ContentType: "application/octet-stream"
    })
  )
  const uploadId = created.UploadId

  if (!uploadId) throw new Error("The backup destination did not start a multipart upload.")

  const parts: Array<{ ETag: string; PartNumber: number }> = []
  const part = Buffer.allocUnsafe(input.partSize)
  let filledBytes = 0
  let sentBytes = 0

  const sendPart = async (bytes: Buffer): Promise<void> => {
    const partNumber = parts.length + 1
    const uploaded = await client.send(
      new UploadPartCommand({
        Bucket: input.bucket,
        Key: input.key,
        UploadId: uploadId,
        PartNumber: partNumber,
        Body: bytes,
        ContentLength: bytes.length
      })
    )

    if (!uploaded.ETag) throw new Error("The backup destination did not acknowledge a part.")

    parts.push({ ETag: uploaded.ETag, PartNumber: partNumber })
    sentBytes += bytes.length
  }

  try {
    for await (const chunk of input.body) {
      const bytes = chunk as Buffer
      let offset = 0

      while (offset < bytes.length) {
        const copied = bytes.copy(part, filledBytes, offset)

        offset += copied
        filledBytes += copied

        if (filledBytes === input.partSize) {
          await sendPart(part)

          filledBytes = 0
        }
      }
    }

    if (filledBytes > 0) await sendPart(part.subarray(0, filledBytes))

    if (sentBytes !== input.sizeBytes) {
      throw new Error("The backup archive changed size while it was being uploaded.")
    }

    await client.send(
      new CompleteMultipartUploadCommand({
        Bucket: input.bucket,
        Key: input.key,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts }
      })
    )
  } catch (error) {
    await client
      .send(
        new AbortMultipartUploadCommand({
          Bucket: input.bucket,
          Key: input.key,
          UploadId: uploadId
        })
      )
      .catch(() => undefined)

    throw error
  }
}

function buildLocalDestinationAdapter(rootDirectory: string): BackupDestinationAdapter {
  const rootDir = path.resolve(rootDirectory)

  return {
    async put(key, body) {
      const destinationPath = resolveLocalKeyPath(rootDir, key)
      await mkdir(path.dirname(destinationPath), { recursive: true })
      // "wx" fails when the path already exists rather than truncating it, so a key collision can
      // never overwrite an existing archive with a partial or unrelated one.
      await pipeline(body, createWriteStream(destinationPath, { flags: "wx" }))

      return { key }
    },
    async list(prefix) {
      const prefixPath = resolveLocalKeyPath(rootDir, prefix)

      return await listLocalBackupObjects(rootDir, prefixPath)
    },
    async delete(key) {
      const keyPath = resolveLocalKeyPath(rootDir, key)

      await rm(keyPath, { force: true })
      await removeEmptyParents(rootDir, path.dirname(keyPath))
    },
    async get(key) {
      return createReadStream(resolveLocalKeyPath(rootDir, key))
    }
  }
}

// A key's prefix is a directory here and nothing at all in a bucket, so deleting the last key under
// one leaves a directory a bucket would not show — the connection test's `remit-connection-test/`
// being the case an operator sees. Walks up to, and never removes, the backup directory itself.
// `rmdir` refuses a directory that is not empty, which is what stops the walk at the first one still
// holding something; that refusal, and a parent already gone, are the expected ends of the walk.
async function removeEmptyParents(rootDir: string, directory: string): Promise<void> {
  for (
    let current = directory;
    current !== rootDir && !path.relative(rootDir, current).startsWith("..");
    current = path.dirname(current)
  ) {
    try {
      await rmdir(current)
    } catch {
      return
    }
  }
}

async function listLocalBackupObjects(
  rootDir: string,
  currentPath: string
): Promise<Array<{ key: string; createdAt: Date; size: number }>> {
  const { readdir } = await import("node:fs/promises")

  try {
    const stats = await stat(currentPath)

    if (stats.isFile()) {
      return [
        {
          key: path.relative(rootDir, currentPath).split(path.sep).join("/"),
          createdAt: stats.mtime,
          size: stats.size
        }
      ]
    }

    if (!stats.isDirectory()) return []
  } catch (error) {
    if (isMissingPathError(error)) return []

    throw error
  }

  const entries = await readdir(currentPath, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map((entry) => listLocalBackupObjects(rootDir, path.join(currentPath, entry.name)))
  )

  return nested.flat().sort((left, right) => left.key.localeCompare(right.key))
}

// The containment check is where a backup key stops being untrusted: keys reach the local adapter
// from stored settings and from listings, and this is the only thing keeping `delete` and `put`
// from reaching outside the configured backup directory.
function resolveLocalKeyPath(rootDir: string, key: string): string {
  const resolved = path.resolve(rootDir, key)
  const relative = path.relative(rootDir, resolved)

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Backup key escapes the local backup directory.")
  }

  return resolved
}

function toNodeReadable(body: unknown): Readable {
  if (body instanceof Readable) {
    return body
  }

  if (isTransformableSdkBody(body)) {
    return Readable.fromWeb(body.transformToWebStream())
  }

  if (isWebReadableStream(body)) {
    return Readable.fromWeb(body)
  }

  throw new Error("Remote backup object did not return a readable stream.")
}

function isTransformableSdkBody(
  value: unknown
): value is { transformToWebStream: () => NodeReadableStream<Uint8Array> } {
  return (
    typeof value === "object" &&
    value !== null &&
    "transformToWebStream" in value &&
    typeof value.transformToWebStream === "function"
  )
}

function isWebReadableStream(value: unknown): value is NodeReadableStream<Uint8Array> {
  return (
    typeof value === "object" &&
    value !== null &&
    "getReader" in value &&
    typeof value.getReader === "function"
  )
}

function isMissingPathError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  )
}
