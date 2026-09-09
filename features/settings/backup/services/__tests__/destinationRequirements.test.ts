import { describe, expect, test } from "vitest"

import { validateBackupCredentials, type BackupDestination } from "@/lib/backups/destinationConfig"

import {
  getMissingBackupCredentialFields,
  isBackupDestination,
  requiresBackupCredentials,
  type BackupCredentialInput
} from "../destinationRequirements"

const remoteDestinations: BackupDestination[] = ["s3", "r2", "b2"]

function makeCredentials(overrides: Partial<BackupCredentialInput> = {}): BackupCredentialInput {
  return {
    bucket: "remit-backups",
    region: "eu-west-1",
    endpoint: "",
    accessKeyConfigured: true,
    secretKeyConfigured: true,
    ...overrides
  }
}

test("requires nothing when the destination is local", () => {
  const missing = getMissingBackupCredentialFields(
    "local",
    makeCredentials({
      bucket: "",
      region: "",
      accessKeyConfigured: false,
      secretKeyConfigured: false
    })
  )

  expect(requiresBackupCredentials("local")).toBe(false)
  expect(missing).toEqual([])
})

test("accepts every unknown string as not a destination", () => {
  expect(isBackupDestination("local")).toBe(true)
  expect(isBackupDestination("gcs")).toBe(false)
})

describe.each(remoteDestinations)("%s", (destination) => {
  test("accepts a complete configuration", () => {
    const missing = getMissingBackupCredentialFields(
      destination,
      makeCredentials({ endpoint: "https://example.invalid" })
    )

    expect(missing).toEqual([])
  })

  test("reports a missing bucket", () => {
    const missing = getMissingBackupCredentialFields(
      destination,
      makeCredentials({ bucket: "  ", endpoint: "https://example.invalid" })
    )

    expect(missing).toContain("bucket")
  })

  test("reports a missing region", () => {
    const missing = getMissingBackupCredentialFields(
      destination,
      makeCredentials({ region: "", endpoint: "https://example.invalid" })
    )

    expect(missing).toContain("region")
  })

  test("reports a missing access key", () => {
    const missing = getMissingBackupCredentialFields(
      destination,
      makeCredentials({ accessKeyConfigured: false, endpoint: "https://example.invalid" })
    )

    expect(missing).toContain("accessKey")
  })

  test("reports a missing secret key", () => {
    const missing = getMissingBackupCredentialFields(
      destination,
      makeCredentials({ secretKeyConfigured: false, endpoint: "https://example.invalid" })
    )

    expect(missing).toContain("secretKey")
  })
})

test("requires an R2 endpoint when the region is not a Cloudflare account identifier", () => {
  const missing = getMissingBackupCredentialFields("r2", makeCredentials({ region: "eu-west-1" }))

  expect(missing).toEqual(["endpoint"])
})

test("accepts an R2 configuration whose region is a Cloudflare account identifier", () => {
  const missing = getMissingBackupCredentialFields(
    "r2",
    makeCredentials({ region: "0123456789abcdef0123456789abcdef" })
  )

  expect(missing).toEqual([])
})

test("leaves the endpoint optional for s3 and b2", () => {
  expect(getMissingBackupCredentialFields("s3", makeCredentials())).toEqual([])
  expect(getMissingBackupCredentialFields("b2", makeCredentials())).toEqual([])
})

// The binding to the command's own gate: every combination this service calls complete must also
// pass `validateBackupCredentials`, and every combination it calls incomplete must fail it. Without
// this the form could save a destination the backup then refuses at 02:00.
function buildCredentialCombinations(): BackupCredentialInput[] {
  const buckets = ["remit-backups", ""]
  const regions = ["eu-west-1", "0123456789abcdef0123456789abcdef", ""]
  const endpoints = ["https://example.invalid", ""]
  const flags = [true, false]

  return buckets.flatMap((bucket) =>
    regions.flatMap((region) =>
      endpoints.flatMap((endpoint) =>
        flags.flatMap((accessKeyConfigured) =>
          flags.map((secretKeyConfigured) => ({
            bucket,
            region,
            endpoint,
            accessKeyConfigured,
            secretKeyConfigured
          }))
        )
      )
    )
  )
}

test.each(remoteDestinations)(
  "agrees with the backup command's own credential gate for every %s combination",
  (destination) => {
    const disagreements = buildCredentialCombinations().filter((credentials) => {
      const complete = getMissingBackupCredentialFields(destination, credentials).length === 0
      const validation = validateBackupCredentials(destination, {
        accessKey: credentials.accessKeyConfigured ? "access-key" : null,
        bucket: credentials.bucket || null,
        endpoint: credentials.endpoint || null,
        region: credentials.region || null,
        secretKey: credentials.secretKeyConfigured ? "secret-key" : null
      })

      return complete !== validation.ok
    })

    expect(disagreements).toEqual([])
  }
)
