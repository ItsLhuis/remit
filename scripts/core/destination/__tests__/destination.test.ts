import { describe, expect, test, vi } from "vitest"

import { buildDestinationAdapter, validateBackupCredentials } from "../index"

// The S3 client is replaced at module load rather than inside a case, because the module under test
// re-exports `@/lib/backups/destination`, whose import pulls the whole AWS SDK: a `vi.doMock` plus
// `vi.resetModules()` per case paid for that graph four times over and made this file the slowest in
// its project.
const mocks = vi.hoisted(() => ({ constructorCalls: [] as unknown[] }))

vi.mock("@aws-sdk/client-s3", () => ({
  DeleteObjectCommand: class DeleteObjectCommand {
    constructor(readonly input: unknown) {}
  },
  GetObjectCommand: class GetObjectCommand {
    constructor(readonly input: unknown) {}
  },
  ListObjectsV2Command: class ListObjectsV2Command {
    constructor(readonly input: unknown) {}
  },
  PutObjectCommand: class PutObjectCommand {
    constructor(readonly input: unknown) {}
  },
  S3Client: class S3Client {
    constructor(config: unknown) {
      mocks.constructorCalls.push(config)
    }

    async send(): Promise<unknown> {
      return {}
    }
  }
}))

describe("validateBackupCredentials", () => {
  test("accepts complete S3-compatible configurations", () => {
    expect(
      validateBackupCredentials("s3", {
        accessKey: "backup-user",
        bucket: "remit-backups",
        endpoint: null,
        region: "eu-west-1",
        secretKey: "backup-pass"
      })
    ).toEqual({ ok: true })
    expect(
      validateBackupCredentials("r2", {
        accessKey: "backup-user",
        bucket: "remit-backups",
        endpoint: "https://example.r2.cloudflarestorage.com",
        region: "auto",
        secretKey: "backup-pass"
      })
    ).toEqual({ ok: true })
    expect(
      validateBackupCredentials("b2", {
        accessKey: "backup-user",
        bucket: "remit-backups",
        endpoint: null,
        region: "us-west-004",
        secretKey: "backup-pass"
      })
    ).toEqual({ ok: true })
  })

  test("returns an actionable setup reason when required fields are missing", () => {
    const result = validateBackupCredentials("s3", {
      accessKey: "backup-user",
      bucket: null,
      endpoint: null,
      region: "eu-west-1",
      secretKey: "backup-pass"
    })

    expect(result).toEqual({
      ok: false,
      reason: "Set backup credentials in /settings/backup, including a bucket name."
    })
  })

  test("requires an R2 endpoint unless the account identifier is supplied as the region", () => {
    expect(
      validateBackupCredentials("r2", {
        accessKey: "backup-user",
        bucket: "remit-backups",
        endpoint: null,
        region: "auto",
        secretKey: "backup-pass"
      })
    ).toEqual({
      ok: false,
      reason: "Set backup credentials in /settings/backup, including the Cloudflare R2 endpoint."
    })
    expect(
      validateBackupCredentials("r2", {
        accessKey: "backup-user",
        bucket: "remit-backups",
        endpoint: null,
        region: "a1b2c3d4e5f6a7b8",
        secretKey: "backup-pass"
      })
    ).toEqual({ ok: true })
  })
})

describe("buildDestinationAdapter", () => {
  test("constructs S3 clients with destination-specific endpoints", () => {
    buildDestinationAdapter("s3", {
      accessKey: "backup-user",
      bucket: "remit-backups",
      endpoint: null,
      region: "eu-west-1",
      secretKey: "backup-pass"
    })
    buildDestinationAdapter("r2", {
      accessKey: "backup-user",
      bucket: "remit-backups",
      endpoint: null,
      region: "a1b2c3d4e5f6a7b8",
      secretKey: "backup-pass"
    })
    buildDestinationAdapter("b2", {
      accessKey: "backup-user",
      bucket: "remit-backups",
      endpoint: null,
      region: "us-west-004",
      secretKey: "backup-pass"
    })

    expect(mocks.constructorCalls).toEqual([
      expect.objectContaining({
        endpoint: undefined,
        forcePathStyle: false,
        region: "eu-west-1"
      }),
      expect.objectContaining({
        endpoint: "https://a1b2c3d4e5f6a7b8.r2.cloudflarestorage.com",
        forcePathStyle: true,
        region: "auto"
      }),
      expect.objectContaining({
        endpoint: "https://s3.us-west-004.backblazeb2.com",
        forcePathStyle: true,
        region: "us-west-004"
      })
    ])
  })
})
