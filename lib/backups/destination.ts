import { createReadStream, createWriteStream } from "node:fs"
import { mkdir, rm, stat } from "node:fs/promises"
import path from "node:path"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import type { ReadableStream as NodeReadableStream } from "node:stream/web"

import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3"

import type {
  BackupCredentials,
  BackupDestination,
  BackupDestinationAdapter,
  CompleteBackupCredentials
} from "./destinationConfig"
import { buildS3ClientConfig, validateBackupCredentials } from "./destinationConfig"

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
  credentials: BackupCredentials
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

function buildLocalDestinationAdapter(rootDirectory: string): BackupDestinationAdapter {
  const rootDir = path.resolve(rootDirectory)

  return {
    async put(key, body) {
      const destinationPath = resolveLocalKeyPath(rootDir, key)
      await mkdir(path.dirname(destinationPath), { recursive: true })
      await pipeline(body, createWriteStream(destinationPath, { flags: "wx" }))

      return { key }
    },
    async list(prefix) {
      const prefixPath = resolveLocalKeyPath(rootDir, prefix)

      return await listLocalBackupObjects(rootDir, prefixPath)
    },
    async delete(key) {
      await rm(resolveLocalKeyPath(rootDir, key), { force: true })
    },
    async get(key) {
      return createReadStream(resolveLocalKeyPath(rootDir, key))
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
