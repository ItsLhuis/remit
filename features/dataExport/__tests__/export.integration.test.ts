import { type Readable } from "node:stream"

import { eq } from "drizzle-orm"

import { beforeEach, describe, expect, test, vi } from "vitest"

import { auditLogs, clients, dataExports } from "@/database/schema"

import {
  makeClient,
  makeDataExport,
  makeInvoice,
  makeProject,
  makeSettings,
  makeUpload,
  makeUser
} from "@/tests/factories"
import { database } from "@/tests/integration/database"
import { readZipEntries, readZipJson } from "@/tests/support/zip"

const mocks = vi.hoisted(() => ({
  getStorageObjectBytes: vi.fn(),
  loggerError: vi.fn(),
  putExportObject: vi.fn(),
  registerJobHandler: vi.fn()
}))

vi.mock("@/lib/jobs", () => ({
  enqueueJob: vi.fn(),
  registerJobHandler: mocks.registerJobHandler
}))

// Storage is stubbed at the module boundary and the uploaded archive is captured on the way past, which
// is what lets these tests assert the actual bytes an owner would download without a MinIO round trip.
vi.mock("@/lib/storage/s3", () => ({
  getStorageObjectBytes: mocks.getStorageObjectBytes,
  putExportObject: mocks.putExportObject
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError,
    fatal: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
}))

const ownerId = "00000000-0000-4000-8000-0000000006a1"

type AssembleHandler = (payload: { exportId: string }) => Promise<void>

// Cached because registration is a module-load side effect: the module is imported once for the file,
// and `vi.clearAllMocks()` wipes the recorded registration call every later test would look for.
let assembleHandler: AssembleHandler | null = null

async function getAssembleHandler(): Promise<AssembleHandler> {
  if (assembleHandler) return assembleHandler

  await import("../jobs")

  const call = mocks.registerJobHandler.mock.calls.find(([name]) => name === "data_export.assemble")

  if (!call) throw new Error("data_export.assemble handler was not registered")

  assembleHandler = call[1] as AssembleHandler

  return assembleHandler
}

// The job deletes the temp file as soon as the upload call returns, so the bytes are captured from the
// stream while the upload is still in flight. This is what an owner would download.
let uploadedArchive: Buffer | null = null

function readUploadedArchive(): Buffer {
  if (!uploadedArchive) throw new Error("No archive was uploaded")

  return uploadedArchive
}

function collectStream(body: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []

    body.on("data", (chunk: Buffer) => chunks.push(chunk))
    body.on("end", () => resolve(Buffer.concat(chunks)))
    body.on("error", reject)
  })
}

async function runExport(overrides?: { clientId?: string; scope?: "instance" | "client" }) {
  const dataExport = await makeDataExport({
    scope: overrides?.scope ?? "instance",
    clientId: overrides?.clientId ?? null,
    requestedByUserId: ownerId
  })

  const assemble = await getAssembleHandler()

  await assemble({ exportId: dataExport.id })

  const [row] = await database.select().from(dataExports).where(eq(dataExports.id, dataExport.id))

  if (!row) throw new Error("Export row disappeared")

  return row
}

beforeEach(async () => {
  vi.clearAllMocks()

  await makeUser({ id: ownerId, email: "owner-archive@example.com", name: "Ada Owner" })

  uploadedArchive = null

  mocks.putExportObject.mockImplementation(async (input: { body: Readable }) => {
    uploadedArchive = await collectStream(input.body)
  })
  mocks.getStorageObjectBytes.mockResolvedValue(Buffer.from("stored-object-bytes", "utf8"))
})

describe("instance export", () => {
  test("assembles an archive and marks the export ready", async () => {
    await makeSettings({ businessName: "Studio Remit", smtpPass: "super-secret" })
    await makeClient({ name: "Acme" })

    const row = await runExport()

    expect(row.status).toBe("ready")
    expect(row.progress).toBe(100)
    expect(row.completedAt).not.toBeNull()
    expect(row.sizeBytes).toBeGreaterThan(0)
    expect(row.filename).toMatch(/^remit-export-instance-\d{4}-\d{2}-\d{2}\.zip$/)
    expect(row.storageKey).toBe(`exports/${row.id}/${row.filename}`)
  })

  test("writes one JSON file per exported table plus an index", async () => {
    await makeSettings({})
    await makeClient({ name: "Acme" })

    await runExport()

    const paths = readZipEntries(readUploadedArchive()).map((entry) => entry.path)

    expect(paths).toContain("index.json")
    expect(paths).toContain("data/clients.json")
    expect(paths).toContain("data/invoices.json")
    expect(paths).toContain("data/settings.json")
    expect(paths).toContain("data/audit-logs.json")
  })

  test("never writes a configuration secret into the archive", async () => {
    await makeSettings({
      businessName: "Studio Remit",
      smtpPass: "smtp-secret-value",
      resendApiKey: "resend-secret-value",
      stripeSecretKey: "stripe-secret-value",
      stripeWebhookSecret: "webhook-secret-value",
      paymentIban: "PT50000201231234567890154",
      backupS3AccessKey: "backup-access-secret",
      backupS3SecretKey: "backup-secret-secret"
    })

    await runExport()

    const archive = readUploadedArchive()
    const archiveText = archive.toString("binary")
    const settingsJson = readZipJson(archive, "data/settings.json")

    for (const secret of [
      "smtp-secret-value",
      "resend-secret-value",
      "stripe-secret-value",
      "webhook-secret-value",
      "PT50000201231234567890154",
      "backup-access-secret",
      "backup-secret-secret"
    ]) {
      expect(archiveText).not.toContain(secret)
    }

    expect(settingsJson).toEqual([expect.objectContaining({ businessName: "Studio Remit" })])
    expect(settingsJson).not.toEqual([expect.objectContaining({ smtpPass: expect.anything() })])
  })

  test("never writes a public document token into the archive", async () => {
    const client = await makeClient({ name: "Acme", portalToken: "portal-token-value" })
    const project = await makeProject({ clientId: client.id })

    await makeInvoice({
      clientId: client.id,
      projectId: project.id,
      publicToken: "invoice-token-value"
    })

    await runExport()

    const archive = readUploadedArchive()

    expect(archive.toString("binary")).not.toContain("portal-token-value")
    expect(archive.toString("binary")).not.toContain("invoice-token-value")
  })

  test("includes the stored bytes of every upload", async () => {
    const upload = await makeUpload({ path: "expenses/receipt.png" })

    await runExport()

    const entries = readZipEntries(readUploadedArchive())
    const fileEntry = entries.find((entry) => entry.path === "files/expenses/receipt.png")

    expect(mocks.getStorageObjectBytes).toHaveBeenCalledWith("expenses/receipt.png")
    expect(fileEntry?.content.toString("utf8")).toBe("stored-object-bytes")
    expect(readZipJson(readUploadedArchive(), "index.json")).toEqual(
      expect.objectContaining({
        files: [{ path: "files/expenses/receipt.png", uploadId: upload.id, sizeBytes: 19 }]
      })
    )
  })

  test("still produces a downloadable archive when the instance is empty", async () => {
    const row = await runExport()

    expect(row.status).toBe("ready")
    expect(readZipJson(readUploadedArchive(), "data/clients.json")).toEqual([])
    expect(readZipJson(readUploadedArchive(), "data/invoices.json")).toEqual([])
  })

  test("skips an upload whose object is gone rather than failing the export", async () => {
    await makeUpload({ path: "expenses/missing.png" })

    mocks.getStorageObjectBytes.mockRejectedValue(new Error("NoSuchKey"))

    const row = await runExport()

    expect(row.status).toBe("ready")
    expect(
      readZipEntries(readUploadedArchive()).some((entry) => entry.path.startsWith("files/"))
    ).toBe(false)
  })

  test("records the completed export in the audit log", async () => {
    const row = await runExport()

    const [audit] = await database.select().from(auditLogs)

    expect(audit).toEqual(
      expect.objectContaining({
        event: "data_export.completed",
        actorUserId: ownerId,
        targetEntityType: "data_export",
        targetEntityId: row.id,
        ipAddress: null,
        userAgent: null
      })
    )
  })
})

describe("client export", () => {
  test("carries only the requested client's records", async () => {
    const exported = await makeClient({ name: "Acme" })
    const other = await makeClient({ name: "Globex" })

    const exportedProject = await makeProject({ clientId: exported.id, name: "Acme site" })
    const otherProject = await makeProject({ clientId: other.id, name: "Globex site" })

    const exportedInvoice = await makeInvoice({
      clientId: exported.id,
      projectId: exportedProject.id
    })

    await makeInvoice({ clientId: other.id, projectId: otherProject.id })

    const row = await runExport({ scope: "client", clientId: exported.id })

    expect(row.status).toBe("ready")

    const archive = readUploadedArchive()

    expect(readZipJson(archive, "data/clients.json")).toEqual([
      expect.objectContaining({ id: exported.id })
    ])
    expect(readZipJson(archive, "data/projects.json")).toEqual([
      expect.objectContaining({ id: exportedProject.id })
    ])
    expect(readZipJson(archive, "data/invoices.json")).toEqual([
      expect.objectContaining({ id: exportedInvoice.id })
    ])
  })

  test("omits the instance-wide files a client export has no business carrying", async () => {
    const client = await makeClient({ name: "Acme" })

    await makeSettings({ businessName: "Studio Remit" })

    await runExport({ scope: "client", clientId: client.id })

    const paths = readZipEntries(readUploadedArchive()).map((entry) => entry.path)

    expect(paths).not.toContain("data/settings.json")
    expect(paths).not.toContain("data/audit-logs.json")
    expect(paths).not.toContain("data/templates.json")
  })

  test("names the archive after the client", async () => {
    const client = await makeClient({ name: "Acme Corp" })

    const row = await runExport({ scope: "client", clientId: client.id })

    expect(row.filename).toMatch(/^remit-export-acme-corp-\d{4}-\d{2}-\d{2}\.zip$/)
  })

  test("fails with a stable reason when the client is deleted before assembly", async () => {
    const client = await makeClient({ name: "Acme" })
    const dataExport = await makeDataExport({
      scope: "client",
      clientId: client.id,
      requestedByUserId: ownerId
    })

    await database.delete(clients).where(eq(clients.id, client.id))

    const assemble = await getAssembleHandler()

    await assemble({ exportId: dataExport.id })

    const [row] = await database.select().from(dataExports).where(eq(dataExports.id, dataExport.id))

    expect(row?.status).toBe("failed")
    expect(row?.failureReason).toBe("clientMissing")
    expect(mocks.putExportObject).not.toHaveBeenCalled()

    const [audit] = await database.select().from(auditLogs)

    expect(audit?.event).toBe("data_export.failed")
  })
})

describe("idempotency", () => {
  test("a redelivered job does not rebuild an archive that is already ready", async () => {
    const dataExport = await makeDataExport({ scope: "instance", requestedByUserId: ownerId })
    const assemble = await getAssembleHandler()

    await assemble({ exportId: dataExport.id })
    await assemble({ exportId: dataExport.id })

    expect(mocks.putExportObject).toHaveBeenCalledTimes(1)

    const [row] = await database.select().from(dataExports).where(eq(dataExports.id, dataExport.id))

    expect(row?.status).toBe("ready")
    expect(await database.select().from(auditLogs)).toHaveLength(1)
  })

  test("a retry after a failure is a no-op rather than a second attempt", async () => {
    const dataExport = await makeDataExport({
      scope: "client",
      clientId: null,
      requestedByUserId: ownerId,
      status: "failed",
      failureReason: "assemblyFailed"
    })

    const assemble = await getAssembleHandler()

    await assemble({ exportId: dataExport.id })

    const [row] = await database.select().from(dataExports).where(eq(dataExports.id, dataExport.id))

    expect(row?.status).toBe("failed")
    expect(row?.failureReason).toBe("assemblyFailed")
    expect(mocks.putExportObject).not.toHaveBeenCalled()
  })

  test("a job for an export that no longer exists does nothing", async () => {
    const assemble = await getAssembleHandler()

    await assemble({ exportId: "00000000-0000-4000-8000-0000000006ff" })

    expect(mocks.putExportObject).not.toHaveBeenCalled()
  })
})
