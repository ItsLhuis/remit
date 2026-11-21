import { beforeEach, describe, expect, test, vi } from "vitest"

import { auditLogs, settings } from "@/database/schema"

import { makeUser } from "@/tests/factories"
import { database } from "@/tests/integration/database"

const mocks = vi.hoisted(() => {
  class BackupConnectionTestError extends Error {
    constructor(
      readonly code: string,
      readonly cause: unknown = null
    ) {
      super(code)
      this.name = "BackupConnectionTestError"
    }
  }

  return {
    BackupConnectionTestError,
    hostedMode: { value: false },
    getCurrentRole: vi.fn(),
    getSession: vi.fn(),
    headers: vi.fn(),
    loggerError: vi.fn(),
    revalidatePath: vi.fn(),
    testBackupConnection: vi.fn()
  }
})

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath
}))

vi.mock("next/headers", () => ({
  headers: mocks.headers
}))

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: mocks.getSession
    }
  }
}))

vi.mock("@/lib/auth/session", () => ({
  getCurrentRole: mocks.getCurrentRole
}))

// Overlaid rather than replaced: `@/database` reads its connection string from the same `env`, so a
// stub object would point the mutations at a database that does not exist.
vi.mock("@/lib/config/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/config/env")>()

  return {
    ...actual,
    env: {
      ...actual.env,
      get REMIT_HOSTED_MODE() {
        return mocks.hostedMode.value
      }
    }
  }
})

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError,
    fatal: vi.fn(),
    warn: vi.fn()
  }
}))

vi.mock("../connectionTest", () => ({
  BackupConnectionTestError: mocks.BackupConnectionTestError,
  testBackupConnection: mocks.testBackupConnection
}))

const ownerId = "00000000-0000-4000-8000-000000000201"
const ownerEmail = "owner-backup@example.com"

const storedAccessKey = "test-access-key-id"
const storedSecretKey = "test-secret-access-key"

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
  backupS3AccessKey: storedAccessKey,
  backupS3SecretKey: storedSecretKey
}

async function insertConfiguredS3Settings(): Promise<void> {
  await database.insert(settings).values({
    backupDestination: "s3",
    backupCadence: "daily",
    backupRetentionDaily: 7,
    backupRetentionWeekly: 4,
    backupRetentionMonthly: 12,
    backupS3Bucket: "remit-backups",
    backupS3Region: "eu-west-1",
    backupS3AccessKey: storedAccessKey,
    backupS3SecretKey: storedSecretKey
  })
}

describe("backup settings mutations", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    mocks.hostedMode.value = false

    await makeUser({ id: ownerId, email: ownerEmail })

    mocks.headers.mockResolvedValue(
      new Headers({
        "user-agent": "Vitest",
        "x-forwarded-for": "203.0.113.20, 198.51.100.2"
      })
    )
    mocks.getSession.mockResolvedValue({ user: { id: ownerId, email: ownerEmail } })
    mocks.getCurrentRole.mockResolvedValue("owner")
    mocks.testBackupConnection.mockResolvedValue({ probeRemoved: true })
  })

  test("stores S3 credentials and never returns them to the client", async () => {
    const { saveBackupSettings } = await import("../mutations")

    const result = await saveBackupSettings(s3Settings)
    const [settingsRow] = await database.select().from(settings)

    expect(result).toEqual({
      data: {
        settings: expect.objectContaining({
          backupDestination: "s3",
          backupS3Bucket: "remit-backups",
          backupS3AccessKey: "",
          backupS3AccessKeyConfigured: true,
          backupS3SecretKey: "",
          backupS3SecretKeyConfigured: true
        }),
        status: expect.objectContaining({ backupLastSuccessAt: null })
      }
    })
    expect(settingsRow?.backupS3AccessKey).toBe(storedAccessKey)
    expect(settingsRow?.backupS3SecretKey).toBe(storedSecretKey)
    expect(JSON.stringify(result)).not.toContain(storedAccessKey)
    expect(JSON.stringify(result)).not.toContain(storedSecretKey)
  })

  test("keeps stored credentials when a save leaves their fields untouched", async () => {
    const { saveBackupSettings } = await import("../mutations")

    await insertConfiguredS3Settings()

    const result = await saveBackupSettings({
      ...s3Settings,
      backupRetentionDaily: "2",
      backupS3AccessKey: "",
      backupS3AccessKeyConfigured: true,
      backupS3SecretKey: "",
      backupS3SecretKeyConfigured: true
    })
    const [settingsRow] = await database.select().from(settings)

    expect(settingsRow?.backupS3AccessKey).toBe(storedAccessKey)
    expect(settingsRow?.backupS3SecretKey).toBe(storedSecretKey)
    expect(settingsRow?.backupRetentionDaily).toBe(2)
    expect(result).toEqual({
      data: {
        settings: expect.objectContaining({
          backupRetentionDaily: 2,
          backupS3AccessKeyConfigured: true,
          backupS3SecretKeyConfigured: true
        }),
        status: expect.anything()
      }
    })
  })

  test("replaces a stored credential when a new value is submitted", async () => {
    const { saveBackupSettings } = await import("../mutations")

    await insertConfiguredS3Settings()

    await saveBackupSettings({
      ...s3Settings,
      backupS3AccessKey: "replacement-access-key-id",
      backupS3SecretKey: "",
      backupS3SecretKeyConfigured: true
    })
    const [settingsRow] = await database.select().from(settings)

    expect(settingsRow?.backupS3AccessKey).toBe("replacement-access-key-id")
    expect(settingsRow?.backupS3SecretKey).toBe(storedSecretKey)
  })

  test("writes an audit entry naming the changed fields and no credential material", async () => {
    const { saveBackupSettings } = await import("../mutations")

    await saveBackupSettings(s3Settings)
    const auditRows = await database.select().from(auditLogs)

    expect(auditRows).toHaveLength(1)
    expect(auditRows[0]?.event).toBe("settings.backup.updated")
    expect(auditRows[0]?.actorUserId).toBe(ownerId)
    expect(auditRows[0]?.ipAddress).toBe("203.0.113.20")
    expect(auditRows[0]?.metadata).toEqual(
      expect.objectContaining({
        secretFieldsChanged: ["backupS3AccessKey", "backupS3SecretKey"]
      })
    )
    expect(JSON.stringify(auditRows[0]?.metadata)).not.toContain(storedAccessKey)
    expect(JSON.stringify(auditRows[0]?.metadata)).not.toContain(storedSecretKey)
  })

  test("refuses a save from a non-owner role", async () => {
    const { saveBackupSettings } = await import("../mutations")

    mocks.getCurrentRole.mockResolvedValue("accountant")

    const result = await saveBackupSettings(s3Settings)
    const settingsRows = await database.select().from(settings)

    expect(result).toEqual({ error: expect.any(String) })
    expect(settingsRows).toHaveLength(0)
  })

  test("refuses a save on a hosted instance where the operator owns the destination", async () => {
    const { saveBackupSettings } = await import("../mutations")

    mocks.hostedMode.value = true

    const result = await saveBackupSettings(s3Settings)
    const settingsRows = await database.select().from(settings)

    expect(result).toEqual({ error: expect.any(String) })
    expect(settingsRows).toHaveLength(0)
  })

  test("records the verification time when the destination accepts a test write", async () => {
    const { testBackupConnection } = await import("../mutations")

    await insertConfiguredS3Settings()

    const result = await testBackupConnection({})
    const [settingsRow] = await database.select().from(settings)

    expect(result).toEqual({ data: { backupTestConnectionAt: expect.any(String) } })
    expect(settingsRow?.backupTestConnectionAt).toBeInstanceOf(Date)
    expect(mocks.testBackupConnection).toHaveBeenCalledWith(
      "s3",
      expect.objectContaining({ accessKey: storedAccessKey, bucket: "remit-backups" })
    )
  })

  test("returns a translated failure and logs no provider text when the test is refused", async () => {
    const { testBackupConnection } = await import("../mutations")

    await insertConfiguredS3Settings()

    mocks.testBackupConnection.mockRejectedValue(
      new mocks.BackupConnectionTestError(
        "auth",
        new Error(`InvalidAccessKeyId: ${storedAccessKey} secret_key=${storedSecretKey}`)
      )
    )

    const result = await testBackupConnection({})
    const [settingsRow] = await database.select().from(settings)
    const loggedContext = JSON.stringify(mocks.loggerError.mock.calls[0]?.[0])

    expect(result).toEqual({ error: expect.any(String) })
    expect("error" in result && result.error).not.toContain("InvalidAccessKeyId")
    expect(settingsRow?.backupTestConnectionAt).toBeNull()
    expect(loggedContext).not.toContain(storedSecretKey)
  })

  test("refuses a test before the destination has credentials", async () => {
    const { testBackupConnection } = await import("../mutations")

    await database.insert(settings).values({ backupDestination: "s3" })

    const result = await testBackupConnection({})

    expect(result).toEqual({ error: expect.any(String) })
    expect(mocks.testBackupConnection).not.toHaveBeenCalled()
  })
})
