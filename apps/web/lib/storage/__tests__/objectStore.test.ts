import {
  CreateBucketCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  S3ServiceException
} from "@aws-sdk/client-s3"

import { describe, expect, test } from "vitest"

import { resolveBucketNames } from "../bucketNames"
import { buildStorageClientConfig } from "../clientConfig"
import { createObjectStore, type StorageClient } from "../objectStore"

function serviceError(status: number, name: string): S3ServiceException {
  return new S3ServiceException({ name, $fault: "client", $metadata: { httpStatusCode: status } })
}

function fakeClient(answer: (command: unknown) => unknown): StorageClient & { sent: unknown[] } {
  const sent: unknown[] = []

  return {
    sent,
    send: (async (command: unknown) => {
      sent.push(command)

      const result = answer(command)

      if (result instanceof Error) throw result

      return result
    }) as StorageClient["send"]
  }
}

describe("resolveBucketNames", () => {
  test("derives the documents and exports buckets from the base name", () => {
    expect(resolveBucketNames("acme")).toEqual({
      public: "acme",
      documents: "acme-documents",
      exports: "acme-exports"
    })
  })
})

describe("buildStorageClientConfig", () => {
  test("passes the credentials explicitly and computes checksums only when an operation requires one", () => {
    const config = buildStorageClientConfig({
      endpoint: "http://storage:9000",
      region: "us-east-1",
      accessKeyId: "remit",
      secretAccessKey: "secret",
      forcePathStyle: true
    })

    expect(config.credentials).toEqual({ accessKeyId: "remit", secretAccessKey: "secret" })
    expect(config.requestChecksumCalculation).toBe("WHEN_REQUIRED")
    expect(config.responseChecksumValidation).toBe("WHEN_REQUIRED")
    expect(config.forcePathStyle).toBe(true)
    expect(config.endpoint).toBe("http://storage:9000")
  })
})

describe("ensureBucket", () => {
  test("creates a bucket the store answers 404 for", async () => {
    const client = fakeClient((command) =>
      command instanceof HeadBucketCommand ? serviceError(404, "NotFound") : {}
    )

    await createObjectStore({ client, bucketNames: resolveBucketNames("remit") }).ensureBucket(
      "documents"
    )

    const created = client.sent.filter((command) => command instanceof CreateBucketCommand)

    expect(created).toHaveLength(1)
    expect(created[0]?.input.Bucket).toBe("remit-documents")
  })

  test("leaves a bucket alone when a key that may not inspect it gets 403", async () => {
    const client = fakeClient((command) =>
      command instanceof HeadBucketCommand ? serviceError(403, "Forbidden") : {}
    )

    await createObjectStore({ client, bucketNames: resolveBucketNames("remit") }).ensureBucket(
      "public"
    )

    expect(client.sent.some((command) => command instanceof CreateBucketCommand)).toBe(false)
  })

  test("accepts losing a creation race to another process", async () => {
    const client = fakeClient((command) => {
      if (command instanceof HeadBucketCommand) return serviceError(404, "NotFound")

      return serviceError(409, "BucketAlreadyOwnedByYou")
    })

    await expect(
      createObjectStore({ client, bucketNames: resolveBucketNames("remit") }).ensureBucket(
        "exports"
      )
    ).resolves.toBeUndefined()
  })

  test("surfaces any other failure, so an outage is not mistaken for a missing bucket", async () => {
    const client = fakeClient(() => serviceError(500, "InternalError"))

    await expect(
      createObjectStore({ client, bucketNames: resolveBucketNames("remit") }).ensureBucket("public")
    ).rejects.toThrow()
  })
})

describe("headObject", () => {
  test("answers null for a key the store does not hold", async () => {
    const client = fakeClient(() => serviceError(404, "NotFound"))
    const store = createObjectStore({ client, bucketNames: resolveBucketNames("remit") })

    await expect(store.headObject("public", "logos/gone.png")).resolves.toBeNull()
  })

  test("surfaces a refused read instead of calling the object missing", async () => {
    const client = fakeClient(() => serviceError(403, "Forbidden"))
    const store = createObjectStore({ client, bucketNames: resolveBucketNames("remit") })

    await expect(store.headObject("public", "logos/a.png")).rejects.toThrow()
  })
})

describe("listObjects", () => {
  test("lists a lazily created bucket that was never created as empty", async () => {
    const client = fakeClient((command) =>
      command instanceof ListObjectsV2Command ? serviceError(404, "NoSuchBucket") : {}
    )
    const store = createObjectStore({ client, bucketNames: resolveBucketNames("remit") })
    const keys: string[] = []

    for (const role of ["documents", "exports"] as const) {
      for await (const object of store.listObjects(role)) keys.push(object.key)
    }

    expect(keys).toEqual([])
  })

  test("fails on a missing public bucket rather than listing it as empty", async () => {
    const client = fakeClient((command) =>
      command instanceof ListObjectsV2Command ? serviceError(404, "NoSuchBucket") : {}
    )
    const store = createObjectStore({ client, bucketNames: resolveBucketNames("remit") })

    await expect(async () => {
      for await (const object of store.listObjects("public")) void object
    }).rejects.toThrow("The public bucket does not exist")
  })

  test("follows continuation tokens until the listing ends", async () => {
    const pages = [
      { Contents: [{ Key: "a", Size: 1 }], IsTruncated: true, NextContinuationToken: "t1" },
      { Contents: [{ Key: "b", Size: 2 }], IsTruncated: false }
    ]
    const client = fakeClient(() => pages.shift())
    const store = createObjectStore({ client, bucketNames: resolveBucketNames("remit") })
    const listed: Array<{ key: string; size: number }> = []

    for await (const object of store.listObjects("public")) listed.push(object)

    expect(listed).toEqual([
      { key: "a", size: 1 },
      { key: "b", size: 2 }
    ])
    expect((client.sent[1] as ListObjectsV2Command).input.ContinuationToken).toBe("t1")
  })
})
