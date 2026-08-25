import { eq } from "drizzle-orm"

import { beforeEach, describe, expect, test, vi } from "vitest"

import { attachments, clients, expenses, invoices, projects } from "@/database/schema"

import {
  makeAttachment,
  makeClient,
  makeExpense,
  makeInvoice,
  makeProject,
  makeSettings,
  makeUpload,
  makeUser
} from "@/tests/factories"
import { database } from "@/tests/integration/database"

const mocks = vi.hoisted(() => ({
  deleteDocumentObject: vi.fn(),
  getCurrentRole: vi.fn(),
  getSession: vi.fn(),
  headers: vi.fn(),
  loggerError: vi.fn(),
  revalidatePath: vi.fn(),
  verifyUploadedObject: vi.fn()
}))

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
  getCurrentRole: mocks.getCurrentRole,
  getSession: mocks.getSession
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError,
    fatal: vi.fn(),
    warn: vi.fn()
  }
}))

vi.mock("@/lib/storage/s3", () => ({
  deleteDocumentObject: mocks.deleteDocumentObject
}))

// Stubbed at its own module boundary: this suite is about which records a caller may reach, not
// about hashing bytes, and the real helper would need a live object store.
vi.mock("@/lib/storage/verifyUploadedObject", () => ({
  verifyUploadedObject: mocks.verifyUploadedObject
}))

const ownerId = "00000000-0000-4000-8000-0000000a0001"

function attachmentInput(overrides: Record<string, unknown>) {
  return {
    objectKey: `attachments/${crypto.randomUUID()}.pdf`,
    filename: "nda.pdf",
    mimeType: "application/pdf",
    sizeBytes: 2048,
    ...overrides
  }
}

describe("attachment authorization", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    mocks.headers.mockResolvedValue(new Headers())
    mocks.getSession.mockResolvedValue({ user: { id: ownerId } })
    mocks.getCurrentRole.mockResolvedValue("owner")
    mocks.verifyUploadedObject.mockResolvedValue({
      sizeBytes: 2048,
      checksumSha256: "d".repeat(64)
    })

    await makeSettings()
    await makeUser({ id: ownerId, email: "owner-attachments@example.com" })
  })

  test("attaches a file to a live client", async () => {
    const client = await makeClient()

    const { addAttachment } = await import("../mutations")

    const result = await addAttachment(
      attachmentInput({ parentType: "client", parentId: client.id })
    )

    expect(result).toEqual({ data: { id: expect.any(String) } })
  })

  // The write half of the stage's security property. A caller who names an id this instance does not
  // have is refused before any row is written, so a fabricated parent id cannot mint an attachment.
  test("refuses to attach to a parent id the instance does not have", async () => {
    const { addAttachment } = await import("../mutations")

    const result = await addAttachment(
      attachmentInput({ parentType: "client", parentId: crypto.randomUUID() })
    )

    expect("error" in result).toBe(true)
    expect(await database.select().from(attachments)).toHaveLength(0)
  })

  // Naming a real id under the wrong parent type is the cross-record reach that a polymorphic
  // `entity_id` could not refuse structurally: a project id offered as a client id resolves against
  // `clients` and finds nothing.
  test("refuses to attach a project id offered as a client id", async () => {
    const client = await makeClient()
    const project = await makeProject({ clientId: client.id })

    const { addAttachment } = await import("../mutations")

    const result = await addAttachment(
      attachmentInput({ parentType: "client", parentId: project.id })
    )

    expect("error" in result).toBe(true)
    expect(await database.select().from(attachments)).toHaveLength(0)
  })

  test("refuses to attach to a soft-deleted client", async () => {
    const client = await makeClient({ deletedAt: new Date() })

    const { addAttachment } = await import("../mutations")

    const result = await addAttachment(
      attachmentInput({ parentType: "client", parentId: client.id })
    )

    expect("error" in result).toBe(true)
    expect(await database.select().from(attachments)).toHaveLength(0)
  })

  test("refuses to attach an object the store does not actually hold", async () => {
    mocks.verifyUploadedObject.mockResolvedValueOnce(null)

    const client = await makeClient()

    const { addAttachment } = await import("../mutations")

    const result = await addAttachment(
      attachmentInput({ parentType: "client", parentId: client.id })
    )

    expect("error" in result).toBe(true)
    expect(await database.select().from(attachments)).toHaveLength(0)
  })

  // An accountant reads the business records and does not change them.
  test("refuses a write from a role that may only read", async () => {
    mocks.getCurrentRole.mockResolvedValue("accountant")

    const client = await makeClient()

    const { addAttachment } = await import("../mutations")

    const result = await addAttachment(
      attachmentInput({ parentType: "client", parentId: client.id })
    )

    expect("error" in result).toBe(true)
    expect(await database.select().from(attachments)).toHaveLength(0)
  })

  test("refuses a write from an anonymous request", async () => {
    mocks.getSession.mockResolvedValue(null)

    const client = await makeClient()

    const { addAttachment } = await import("../mutations")

    const result = await addAttachment(
      attachmentInput({ parentType: "client", parentId: client.id })
    )

    expect("error" in result).toBe(true)
    expect(await database.select().from(attachments)).toHaveLength(0)
  })
})

describe("attachment reads", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    mocks.headers.mockResolvedValue(new Headers())
    mocks.getSession.mockResolvedValue({ user: { id: ownerId } })
    mocks.getCurrentRole.mockResolvedValue("owner")

    await makeSettings()
    await makeUser({ id: ownerId, email: "owner-attachments@example.com" })
  })

  // The read half of the security property, and the one a forgotten `where` clause would break: the
  // list is scoped to one parent, so an attachment of another record never appears in it.
  test("lists only the attachments of the record asked for", async () => {
    const [clientA, clientB] = await Promise.all([makeClient(), makeClient()])

    await makeAttachment({ clientId: clientA.id, title: "belongs to A" })
    await makeAttachment({ clientId: clientB.id, title: "belongs to B" })

    const { listAttachments } = await import("../queries")

    const rows = await listAttachments({ parentType: "client", parentId: clientA.id })

    expect(rows.map((row) => row.title)).toEqual(["belongs to A"])
  })

  test("does not list a client's attachments under a project of that client", async () => {
    const client = await makeClient()
    const project = await makeProject({ clientId: client.id })

    await makeAttachment({ clientId: client.id })

    const { listAttachments } = await import("../queries")

    const rows = await listAttachments({ parentType: "project", parentId: project.id })

    expect(rows).toEqual([])
  })

  test("serves a download for an attachment whose record is live", async () => {
    const client = await makeClient()
    const upload = await makeUpload({ bucket: "documents", path: "attachments/live.pdf" })
    const attachment = await makeAttachment({ clientId: client.id, uploadId: upload.id })

    const { getAttachmentForDownload } = await import("../queries")

    const result = await getAttachmentForDownload({ id: attachment.id })

    expect(result?.storageKey).toBe("attachments/live.pdf")
  })

  // Holding a valid attachment id is not enough. This is what stops a stale link from a record the
  // owner has since deleted from continuing to serve its file.
  test("refuses a download when the record the attachment hangs off was soft-deleted", async () => {
    const client = await makeClient()
    const attachment = await makeAttachment({ clientId: client.id })

    await database.update(clients).set({ deletedAt: new Date() }).where(eq(clients.id, client.id))

    const { getAttachmentForDownload } = await import("../queries")

    expect(await getAttachmentForDownload({ id: attachment.id })).toBeNull()
  })

  test("refuses a download for an attachment id that does not exist", async () => {
    const { getAttachmentForDownload } = await import("../queries")

    expect(await getAttachmentForDownload({ id: crypto.randomUUID() })).toBeNull()
  })

  test.each([
    ["project", projects] as const,
    ["invoice", invoices] as const,
    ["expense", expenses] as const
  ])("refuses a download when the %s it hangs off was soft-deleted", async (parentType, table) => {
    const client = await makeClient()
    const project = await makeProject({ clientId: client.id })

    const parentId =
      parentType === "project"
        ? project.id
        : parentType === "invoice"
          ? (await makeInvoice({ projectId: project.id, clientId: client.id })).id
          : (await makeExpense({ projectId: project.id, clientId: client.id })).id

    const attachment = await makeAttachment({
      [parentType === "project"
        ? "projectId"
        : parentType === "invoice"
          ? "invoiceId"
          : "expenseId"]: parentId
    })

    await database.update(table).set({ deletedAt: new Date() }).where(eq(table.id, parentId))

    const { getAttachmentForDownload } = await import("../queries")

    expect(await getAttachmentForDownload({ id: attachment.id })).toBeNull()
  })
})
