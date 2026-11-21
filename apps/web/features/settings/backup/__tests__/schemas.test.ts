import { expect, test } from "vitest"

import { backupSettingsSchema } from "../schemas"

const localSettings = {
  backupDestination: "local",
  backupCadence: "daily",
  backupRetentionDaily: "7",
  backupRetentionWeekly: "4",
  backupRetentionMonthly: "12",
  backupS3Bucket: "",
  backupS3Region: "",
  backupS3Endpoint: "",
  backupS3AccessKey: "",
  backupS3AccessKeyConfigured: false,
  backupS3SecretKey: "",
  backupS3SecretKeyConfigured: false
}

const s3Settings = {
  ...localSettings,
  backupDestination: "s3",
  backupS3Bucket: "remit-backups",
  backupS3Region: "eu-west-1",
  backupS3AccessKey: "test-access-key-id",
  backupS3SecretKey: "test-secret-access-key"
}

function getIssuePaths(input: unknown): string[] {
  const result = backupSettingsSchema.safeParse(input)

  return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."))
}

test("accepts a local destination with no credentials", () => {
  const result = backupSettingsSchema.safeParse(localSettings)

  expect(result.success).toBe(true)
})

test("turns retention counts into numbers", () => {
  const result = backupSettingsSchema.safeParse(localSettings)

  expect(result.success && result.data.backupRetentionDaily).toBe(7)
  expect(result.success && result.data.backupRetentionMonthly).toBe(12)
})

test("accepts a complete S3 destination", () => {
  const result = backupSettingsSchema.safeParse(s3Settings)

  expect(result.success).toBe(true)
})

test("requires every S3 credential field when the destination is remote", () => {
  const paths = getIssuePaths({ ...s3Settings, ...localSettings, backupDestination: "s3" })

  expect(paths).toEqual([
    "backupS3Bucket",
    "backupS3Region",
    "backupS3AccessKey",
    "backupS3SecretKey"
  ])
})

test("accepts blank credentials when they are already configured", () => {
  const result = backupSettingsSchema.safeParse({
    ...s3Settings,
    backupS3AccessKey: "",
    backupS3AccessKeyConfigured: true,
    backupS3SecretKey: "",
    backupS3SecretKeyConfigured: true
  })

  expect(result.success).toBe(true)
})

test("requires an R2 endpoint when the region is not a Cloudflare account identifier", () => {
  const paths = getIssuePaths({ ...s3Settings, backupDestination: "r2" })

  expect(paths).toEqual(["backupS3Endpoint"])
})

test("accepts R2 without an endpoint when the region is a Cloudflare account identifier", () => {
  const result = backupSettingsSchema.safeParse({
    ...s3Settings,
    backupDestination: "r2",
    backupS3Region: "0123456789abcdef0123456789abcdef"
  })

  expect(result.success).toBe(true)
})

test("accepts B2 without an endpoint", () => {
  const result = backupSettingsSchema.safeParse({ ...s3Settings, backupDestination: "b2" })

  expect(result.success).toBe(true)
})

test("rejects an unknown destination", () => {
  expect(getIssuePaths({ ...localSettings, backupDestination: "gcs" })).toContain(
    "backupDestination"
  )
})

test("rejects an unknown cadence", () => {
  expect(getIssuePaths({ ...localSettings, backupCadence: "hourly" })).toContain("backupCadence")
})

test("accepts zero for a retention tier", () => {
  const result = backupSettingsSchema.safeParse({ ...localSettings, backupRetentionWeekly: "0" })

  expect(result.success && result.data.backupRetentionWeekly).toBe(0)
})

test("rejects a retention count that is negative, fractional, blank or above the maximum", () => {
  for (const value of ["-1", "1.5", "", "366", "many"]) {
    expect(getIssuePaths({ ...localSettings, backupRetentionDaily: value })).toContain(
      "backupRetentionDaily"
    )
  }
})
