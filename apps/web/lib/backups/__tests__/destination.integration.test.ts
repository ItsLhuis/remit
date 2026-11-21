import { createHash, randomBytes, randomUUID } from "node:crypto"
import { Readable } from "node:stream"

import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3"

import { beforeAll, expect, test } from "vitest"

import { buildStorageClientConfig } from "@/lib/storage/clientConfig"

import { BUNDLED_STORE_CONNECTION } from "@/tests/integration/storageTargets"

import { buildDestinationAdapter } from "../destination"

const bucket = `backups-${randomUUID().slice(0, 8)}`

const credentials = {
  accessKey: BUNDLED_STORE_CONNECTION.accessKeyId,
  secretKey: BUNDLED_STORE_CONNECTION.secretAccessKey,
  bucket,
  endpoint: BUNDLED_STORE_CONNECTION.endpoint,
  region: BUNDLED_STORE_CONNECTION.region
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex")
}

async function readAll(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []

  for await (const chunk of stream) chunks.push(chunk as Buffer)

  return Buffer.concat(chunks)
}

beforeAll(async () => {
  const client = new S3Client(buildStorageClientConfig(BUNDLED_STORE_CONNECTION))

  await client.send(new CreateBucketCommand({ Bucket: bucket }))

  client.destroy()
})

test("uploads an archive above the multipart threshold in parts and reads it back whole", async () => {
  const adapter = buildDestinationAdapter("s3", credentials, { multipartThresholdBytes: 1 })
  const archive = randomBytes(12 * 1024 * 1024 + 3)
  const key = `remit-backups/2026/09/${randomUUID()}.remitbak`

  await adapter.put(
    key,
    Readable.from([archive.subarray(0, 7_000_000), archive.subarray(7_000_000)]),
    archive.length
  )

  expect(sha256(await readAll(await adapter.get(key)))).toBe(sha256(archive))
})

test("fails a multipart upload whose body ends short and leaves no object behind", async () => {
  const adapter = buildDestinationAdapter("s3", credentials, { multipartThresholdBytes: 1 })
  const key = `remit-backups/2026/09/${randomUUID()}.remitbak`

  await expect(
    adapter.put(key, Readable.from([randomBytes(6 * 1024 * 1024)]), 12 * 1024 * 1024)
  ).rejects.toThrow()

  const listed = await adapter.list("remit-backups/")

  expect(listed.map((object) => object.key)).not.toContain(key)
})
