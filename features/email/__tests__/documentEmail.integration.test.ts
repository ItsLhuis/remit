import { eq } from "drizzle-orm"

import { beforeEach, describe, expect, test, vi } from "vitest"

import { auditLogs, emailLogs, settings } from "@/database/schema"

import { makeSettings } from "@/tests/factories"
import { database } from "@/tests/integration/database"

const mocks = vi.hoisted(() => ({
  sendTransactionalEmail: vi.fn(),
  getStorageObjectBytes: vi.fn()
}))

vi.mock("../transactional", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../transactional")>()),
  sendTransactionalEmail: mocks.sendTransactionalEmail
}))

vi.mock("@/lib/storage/s3", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/storage/s3")>()),
  getStorageObjectBytes: mocks.getStorageObjectBytes
}))

const DOCUMENT_ID = "11111111-1111-1111-1111-111111111111"

function makeInput(overrides: Record<string, unknown> = {}) {
  return {
    documentType: "invoice" as const,
    documentId: DOCUMENT_ID,
    recipientEmail: "client@example.test",
    recipientName: "Acme",
    occasion: "sent",
    subject: "Invoice INV-0001",
    text: "Body",
    html: "<p>Body</p>",
    attachment: null,
    ...overrides
  }
}

async function readLog() {
  const [log] = await database
    .select({ status: emailLogs.status, pdfAttached: emailLogs.pdfAttached })
    .from(emailLogs)
    .where(eq(emailLogs.documentId, DOCUMENT_ID))

  return log ?? null
}

beforeEach(async () => {
  vi.clearAllMocks()

  mocks.sendTransactionalEmail.mockResolvedValue(undefined)
  mocks.getStorageObjectBytes.mockResolvedValue(Buffer.from("%PDF-1.4", "latin1"))

  await makeSettings({
    emailProvider: "smtp",
    smtpHost: "smtp.example.test",
    smtpPort: 587,
    smtpUser: "mailer@example.test",
    smtpPass: "secret",
    emailFromAddress: "billing@example.test"
  })
})

describe("sendDocumentEmail", () => {
  test("records pdf_attached as false when the mail carries no attachment", async () => {
    const { sendDocumentEmail } = await import("../documentEmail")

    await expect(sendDocumentEmail(makeInput())).resolves.toBe("sent")

    expect(await readLog()).toMatchObject({ status: "sent", pdfAttached: false })
  })

  test("records pdf_attached as true only once the provider accepted the bytes", async () => {
    const { sendDocumentEmail } = await import("../documentEmail")

    await sendDocumentEmail(
      makeInput({ attachment: { filename: "INV-0001.pdf", storageKey: "documents/x.pdf" } })
    )

    expect(await readLog()).toMatchObject({ status: "sent", pdfAttached: true })
    expect(mocks.sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [expect.objectContaining({ filename: "INV-0001.pdf" })]
      })
    )
  })

  // The column must describe what was sent, not what was asked for. An unreadable object still
  // produces a mail — chasing payment matters more than the attachment — but it must not claim one.
  test("sends without the attachment and reports it truthfully when the object cannot be read", async () => {
    mocks.getStorageObjectBytes.mockRejectedValue(new Error("gone"))

    const { sendDocumentEmail } = await import("../documentEmail")

    await sendDocumentEmail(
      makeInput({ attachment: { filename: "INV-0001.pdf", storageKey: "documents/missing.pdf" } })
    )

    expect(await readLog()).toMatchObject({ status: "sent", pdfAttached: false })
    expect(mocks.sendTransactionalEmail).toHaveBeenCalledWith(
      expect.not.objectContaining({ attachments: expect.anything() })
    )
  })

  test("sends nothing a second time for the same document and occasion", async () => {
    const { sendDocumentEmail } = await import("../documentEmail")

    await sendDocumentEmail(makeInput())

    await expect(sendDocumentEmail(makeInput())).resolves.toBe("already_sent")

    expect(mocks.sendTransactionalEmail).toHaveBeenCalledTimes(1)
  })

  // Two different mails about one invoice — the send and the receipt — must not collapse onto each
  // other just because they share a document id.
  test("still sends a different occasion for the same document", async () => {
    const { sendDocumentEmail } = await import("../documentEmail")

    await sendDocumentEmail(makeInput())

    await expect(sendDocumentEmail(makeInput({ occasion: "receipt" }))).resolves.toBe("sent")

    expect(mocks.sendTransactionalEmail).toHaveBeenCalledTimes(2)
  })

  test("derives the provider idempotency key from the document and the occasion", async () => {
    const { sendDocumentEmail } = await import("../documentEmail")

    await sendDocumentEmail(makeInput())

    expect(mocks.sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: `invoice.${DOCUMENT_ID}.sent` })
    )
  })

  test("marks the log failed and rethrows when delivery fails", async () => {
    mocks.sendTransactionalEmail.mockRejectedValue(new Error("smtp down"))

    const { sendDocumentEmail } = await import("../documentEmail")

    await expect(sendDocumentEmail(makeInput())).rejects.toThrow("smtp down")

    expect(await readLog()).toMatchObject({ status: "failed" })

    // No audit entry, so a retry is free to try again rather than being deduplicated away by a send
    // that never happened.
    const audits = await database
      .select({ id: auditLogs.id })
      .from(auditLogs)
      .where(eq(auditLogs.targetEntityId, DOCUMENT_ID))

    expect(audits).toEqual([])
  })

  test("skips silently when the instance has no mail provider", async () => {
    // The configured row from `beforeEach` has to go first: `settings` is a singleton the code reads
    // with `findFirst`, so a second row inserted beside it would simply be ignored.
    await database.delete(settings)
    await makeSettings({ emailProvider: null })

    const { sendDocumentEmail } = await import("../documentEmail")

    await expect(sendDocumentEmail(makeInput())).resolves.toBe("skipped")

    expect(mocks.sendTransactionalEmail).not.toHaveBeenCalled()
  })
})
