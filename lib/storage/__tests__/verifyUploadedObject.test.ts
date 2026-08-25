import { createHash } from "node:crypto"

import { beforeEach, describe, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getStorageObjectBytes: vi.fn()
}))

vi.mock("@/lib/storage/s3", () => ({
  getStorageObjectBytes: mocks.getStorageObjectBytes
}))

function serviceError(httpStatusCode: number): Error {
  return Object.assign(new Error("storage"), { $metadata: { httpStatusCode } })
}

describe("verifyUploadedObject", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("returns the size measured from the object, not the size the caller expected", async () => {
    const bytes = Buffer.from("a stored file")

    mocks.getStorageObjectBytes.mockResolvedValue(bytes)

    const { verifyUploadedObject } = await import("../verifyUploadedObject")

    const result = await verifyUploadedObject({
      objectKey: "attachments/file.pdf",
      bucket: "documents",
      maxBytes: 1024
    })

    expect(result?.sizeBytes).toBe(bytes.byteLength)
  })

  test("returns the sha256 of the stored bytes", async () => {
    const bytes = Buffer.from("a stored file")

    mocks.getStorageObjectBytes.mockResolvedValue(bytes)

    const { verifyUploadedObject } = await import("../verifyUploadedObject")

    const result = await verifyUploadedObject({
      objectKey: "attachments/file.pdf",
      bucket: "documents",
      maxBytes: 1024
    })

    expect(result?.checksumSha256).toBe(createHash("sha256").update(bytes).digest("hex"))
  })

  test("reads from the bucket the caller named", async () => {
    mocks.getStorageObjectBytes.mockResolvedValue(Buffer.from("x"))

    const { verifyUploadedObject } = await import("../verifyUploadedObject")

    await verifyUploadedObject({
      objectKey: "avatars/user-1/a.png",
      bucket: "public",
      maxBytes: 1024
    })

    expect(mocks.getStorageObjectBytes).toHaveBeenCalledWith("avatars/user-1/a.png", "public")
  })

  // A presigned PUT that was never used leaves no object. This is the case that turns "the client
  // says it uploaded" into "the store agrees", and it is the whole reason the helper exists.
  test("returns null when the object does not exist", async () => {
    mocks.getStorageObjectBytes.mockRejectedValue(serviceError(404))

    const { verifyUploadedObject } = await import("../verifyUploadedObject")

    const result = await verifyUploadedObject({
      objectKey: "attachments/never-uploaded.pdf",
      bucket: "documents",
      maxBytes: 1024
    })

    expect(result).toBeNull()
  })

  // S3 and MinIO answer a GET for a missing key with AccessDenied when the caller lacks ListBucket,
  // so a 403 has to mean the same thing as a 404 or a legitimate upload would look like an outage.
  test("returns null when the store answers a missing key with access denied", async () => {
    mocks.getStorageObjectBytes.mockRejectedValue(serviceError(403))

    const { verifyUploadedObject } = await import("../verifyUploadedObject")

    const result = await verifyUploadedObject({
      objectKey: "attachments/never-uploaded.pdf",
      bucket: "documents",
      maxBytes: 1024
    })

    expect(result).toBeNull()
  })

  test("returns null when the stored object is larger than the caller's ceiling", async () => {
    mocks.getStorageObjectBytes.mockResolvedValue(Buffer.alloc(2048))

    const { verifyUploadedObject } = await import("../verifyUploadedObject")

    const result = await verifyUploadedObject({
      objectKey: "attachments/too-big.pdf",
      bucket: "documents",
      maxBytes: 1024
    })

    expect(result).toBeNull()
  })

  test("returns null for a zero-byte object, which the size check constraint would reject", async () => {
    mocks.getStorageObjectBytes.mockResolvedValue(Buffer.alloc(0))

    const { verifyUploadedObject } = await import("../verifyUploadedObject")

    const result = await verifyUploadedObject({
      objectKey: "attachments/empty.pdf",
      bucket: "documents",
      maxBytes: 1024
    })

    expect(result).toBeNull()
  })

  // A storage outage is the caller's problem to log and report as a server error, not something to
  // blame on the file. Swallowing it here would tell the user their upload failed when the store did.
  test("rethrows a storage failure that is not a missing object", async () => {
    mocks.getStorageObjectBytes.mockRejectedValue(serviceError(500))

    const { verifyUploadedObject } = await import("../verifyUploadedObject")

    await expect(
      verifyUploadedObject({
        objectKey: "attachments/file.pdf",
        bucket: "documents",
        maxBytes: 1024
      })
    ).rejects.toThrow()
  })
})
