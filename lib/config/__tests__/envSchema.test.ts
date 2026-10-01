import { describe, expect, test } from "vitest"

import { envSchema } from "../envSchema"

const BASE_ENVIRONMENT = {
  DATABASE_URL: "postgresql://remit:remit@localhost:5432/remit",
  REDIS_URL: "redis://localhost:6379",
  BETTER_AUTH_SECRET: "test-secret",
  REMIT_PUBLIC_URL: "http://localhost:3000",
  REMIT_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  S3_ENDPOINT: "http://localhost:9000",
  S3_ACCESS_KEY_ID: "remit",
  S3_SECRET_ACCESS_KEY: "secret"
}

describe("object storage configuration", () => {
  test("defaults the region, bucket and path style when they are not set", () => {
    const parsed = envSchema.parse(BASE_ENVIRONMENT)

    expect(parsed.S3_REGION).toBe("us-east-1")
    expect(parsed.S3_BUCKET).toBe("remit")
    expect(parsed.S3_FORCE_PATH_STYLE).toBe(true)
  })

  test("turns path-style addressing off only when told false", () => {
    expect(
      envSchema.parse({ ...BASE_ENVIRONMENT, S3_FORCE_PATH_STYLE: "false" }).S3_FORCE_PATH_STYLE
    ).toBe(false)
    expect(
      envSchema.parse({ ...BASE_ENVIRONMENT, S3_FORCE_PATH_STYLE: "true" }).S3_FORCE_PATH_STYLE
    ).toBe(true)
  })

  test("refuses a path-style value that is neither true nor false, rather than reading it as true", () => {
    for (const value of ["False", "no", "off", "yes"]) {
      expect(envSchema.safeParse({ ...BASE_ENVIRONMENT, S3_FORCE_PATH_STYLE: value }).success).toBe(
        false
      )
    }
  })

  test("keeps path-style addressing on when the variable is left blank", () => {
    expect(
      envSchema.parse({ ...BASE_ENVIRONMENT, S3_FORCE_PATH_STYLE: "" }).S3_FORCE_PATH_STYLE
    ).toBe(true)
  })

  test("refuses a missing endpoint rather than falling back to AWS", () => {
    const { S3_ENDPOINT: _omitted, ...withoutEndpoint } = BASE_ENVIRONMENT

    expect(envSchema.safeParse(withoutEndpoint).success).toBe(false)
  })

  test("refuses a bucket name too long for its -documents bucket to be a valid name", () => {
    const parsed = envSchema.safeParse({ ...BASE_ENVIRONMENT, S3_BUCKET: "a".repeat(54) })

    expect(parsed.success).toBe(false)
  })

  test("refuses a bucket name S3 would reject", () => {
    expect(envSchema.safeParse({ ...BASE_ENVIRONMENT, S3_BUCKET: "Remit_Files" }).success).toBe(
      false
    )
  })

  test("accepts the longest base name whose derived buckets still fit", () => {
    expect(envSchema.safeParse({ ...BASE_ENVIRONMENT, S3_BUCKET: "a".repeat(53) }).success).toBe(
      true
    )
  })
})
