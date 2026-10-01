import { createHash, randomBytes, randomUUID } from "node:crypto"
import { Readable } from "node:stream"

import { DeleteBucketCommand, S3Client } from "@aws-sdk/client-s3"

import { afterAll, describe, expect, test } from "vitest"

import { BUNDLED_STORE_CONNECTION } from "@/tests/integration/storageTargets"

import { resolveBucketNames, type StorageBucketRole } from "../bucketNames"
import { buildStorageClientConfig } from "../clientConfig"
import { isMissingObjectError } from "../objectErrors"
import { createObjectStore, type ObjectStore } from "../objectStore"

const ROLES: StorageBucketRole[] = ["public", "documents", "exports"]

function sha256(bytes: Buffer | Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex")
}

async function drain(store: ObjectStore, role: StorageBucketRole): Promise<void> {
  for await (const object of store.listObjects(role)) await store.deleteObject(role, object.key)
}

// The contract the adapter relies on, run against the bundled store rather than a mock: the semantics
// that matter here — what a missing key answers, whether a short listing is really the end — are
// exactly what a mock would have to assume.
describe("object storage contract", () => {
  const client = new S3Client(buildStorageClientConfig(BUNDLED_STORE_CONNECTION))
  const bucketNames = resolveBucketNames(`contract-${randomUUID().slice(0, 8)}`)
  const store = createObjectStore({ client, bucketNames })

  afterAll(async () => {
    for (const role of ROLES) {
      await drain(store, role)
      await client
        .send(new DeleteBucketCommand({ Bucket: bucketNames[role] }))
        .catch(() => undefined)
    }

    client.destroy()
  })

  test("lists a bucket nothing has created yet as empty", async () => {
    const keys: string[] = []

    for await (const object of store.listObjects("exports")) keys.push(object.key)

    expect(keys).toEqual([])
  })

  test("creates each bucket on first use and treats an existing one as present", async () => {
    for (const role of ROLES) {
      await store.ensureBucket(role)
      await store.ensureBucket(role)
    }

    for (const role of ROLES) {
      await expect(store.headObject(role, "absent")).resolves.toBeNull()
    }
  })

  test("streams an object in and reads the same bytes and type back", async () => {
    await store.ensureBucket("documents")

    const bytes = randomBytes(3 * 1024 * 1024 + 17)
    const key = `documents/invoice/${randomUUID()}/${randomUUID()}.pdf`

    await store.putObject({
      role: "documents",
      key,
      body: Readable.from(
        (function* () {
          for (let offset = 0; offset < bytes.length; offset += 64 * 1024) {
            yield bytes.subarray(offset, offset + 64 * 1024)
          }
        })()
      ),
      contentLength: bytes.length,
      contentType: "application/pdf"
    })

    const read = await store.getObject("documents", key)
    const readBytes = await read.body.transformToByteArray()

    expect(sha256(readBytes)).toBe(sha256(bytes))
    expect(read.contentLength).toBe(bytes.length)
    expect(read.contentType).toBe("application/pdf")
    await expect(store.headObject("documents", key)).resolves.toEqual({ size: bytes.length })
  })

  test("answers a missing key as missing, for a read and for a head", async () => {
    await store.ensureBucket("public")

    const failure = await store
      .getObject("public", `avatars/${randomUUID()}.png`)
      .catch((error: unknown) => error)

    expect(isMissingObjectError(failure)).toBe(true)
    await expect(store.headObject("public", `logos/${randomUUID()}.png`)).resolves.toBeNull()
  })

  test("refuses a body shorter than its declared length and stores nothing", async () => {
    await store.ensureBucket("public")

    const key = `logos/${randomUUID()}.png`
    const shortBody = new Readable({
      read() {
        this.destroy(new Error("client went away"))
      }
    })

    await expect(
      store.putObject({
        role: "public",
        key,
        body: shortBody,
        contentLength: 4096,
        contentType: "image/png"
      })
    ).rejects.toThrow()

    await expect(store.headObject("public", key)).resolves.toBeNull()
  })

  test("deletes a key twice without complaint", async () => {
    await store.ensureBucket("public")

    const key = `logos/${randomUUID()}.png`

    await store.putObject({
      role: "public",
      key,
      body: Buffer.from("x"),
      contentLength: 1,
      contentType: "image/png"
    })
    await store.deleteObject("public", key)
    await store.deleteObject("public", key)

    await expect(store.headObject("public", key)).resolves.toBeNull()
  })

  test("lists every object of a bucket that spans several pages, each exactly once", async () => {
    await store.ensureBucket("public")
    await drain(store, "public")

    const keys = Array.from({ length: 1_050 }, (_, index) =>
      index % 2 === 0
        ? `avatars/${randomUUID()}/${randomUUID()}.png`
        : `expenses/${randomUUID()}.png`
    )
    let next = 0

    await Promise.all(
      Array.from({ length: 16 }, async () => {
        while (next < keys.length) {
          const key = keys[next++]

          await store.putObject({
            role: "public",
            key,
            body: Buffer.from(key),
            contentLength: key.length,
            contentType: "image/png"
          })
        }
      })
    )

    const listed: string[] = []

    for await (const object of store.listObjects("public")) listed.push(object.key)

    expect(listed).toHaveLength(keys.length)
    expect(new Set(listed)).toEqual(new Set(keys))
  })
})
