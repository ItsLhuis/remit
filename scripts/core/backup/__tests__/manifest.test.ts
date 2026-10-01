import { describe, expect, test } from "vitest"

import { computeKeyFingerprint } from "../../archive/header"
import { buildBackupManifest, serializeBackupManifest, sha256Hex } from "../manifest"

describe("backup manifest helpers", () => {
  test("builds the ratified manifest shape", () => {
    const key = Buffer.from("e".repeat(32))

    const manifest = buildBackupManifest({
      appVersion: "1.2.3",
      checksumsSha256: "f".repeat(64),
      components: {
        database: { size: 123, sha256: "a".repeat(64) },
        objects: {
          buckets: {
            public: { fileCount: 2, totalSize: 456 },
            documents: { fileCount: 1, totalSize: 789 }
          },
          contentTypes: { "objects/public/logos/a.png": "image/png" }
        }
      },
      createdAt: "2026-05-17T10:00:00.000Z",
      destination: "local",
      encryptionKey: key,
      schemaMigrationId: "0004_yellow_mockingbird"
    })

    expect(manifest).toEqual({
      archiveFormatVersion: 2,
      appVersion: "1.2.3",
      createdAt: "2026-05-17T10:00:00.000Z",
      createdBy: "remit:backup",
      schemaMigrationId: "0004_yellow_mockingbird",
      encryption: {
        algorithm: "AES-256-GCM",
        keySource: "REMIT_ENCRYPTION_KEY",
        keyFingerprint: `sha256:${computeKeyFingerprint(key)}`
      },
      compression: "gzip",
      components: {
        database: {
          format: "pg_dump-custom",
          size: 123,
          sha256: "a".repeat(64)
        },
        objects: {
          format: "tar-stream",
          sha256Manifest: "f".repeat(64),
          buckets: {
            public: { fileCount: 2, totalSize: 456 },
            documents: { fileCount: 1, totalSize: 789 }
          },
          contentTypes: { "objects/public/logos/a.png": "image/png" }
        }
      },
      destination: "local"
    })
  })

  test("serializes manifest JSON deterministically with a trailing newline", () => {
    const key = Buffer.from("g".repeat(32))
    const manifest = buildBackupManifest({
      appVersion: "1.0.0",
      checksumsSha256: sha256Hex("checksums"),
      components: {
        database: { size: 1, sha256: sha256Hex("database") },
        objects: {
          buckets: {
            public: { fileCount: 0, totalSize: 0 },
            documents: { fileCount: 0, totalSize: 0 }
          },
          contentTypes: {}
        }
      },
      createdAt: "2026-05-17T10:00:00.000Z",
      destination: "local",
      encryptionKey: key,
      schemaMigrationId: "0000_initial"
    })

    const serialized = serializeBackupManifest(manifest)

    expect(serialized.toString("utf8")).toBe(`${JSON.stringify(manifest, null, 2)}\n`)
  })
})
