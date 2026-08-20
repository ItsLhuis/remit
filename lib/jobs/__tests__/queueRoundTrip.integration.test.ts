import { eq } from "drizzle-orm"

import { afterAll, beforeAll, expect, test, vi } from "vitest"

import { enqueueJob } from "@/lib/jobs"
import { getQueue } from "@/lib/jobs/queue"
import { startWorker, stopWorker } from "@/lib/jobs/worker"

import { contractSignatures, invoices, uploads } from "@/database/schema"

import { loadWorkerFeatureModules } from "@/scripts/core/worker/loadWorkerFeatureModules"
import {
  makeClient,
  makeContract,
  makeInvoice,
  makeRecurringInvoice,
  makeSettings,
  makeTemplate
} from "@/tests/factories"
import { database } from "@/tests/integration/database"

const mocks = vi.hoisted(() => ({
  sendTransactionalEmail: vi.fn(),
  sendDocumentEmail: vi.fn(async () => "sent" as const),
  renderHtmlToPdf: vi.fn(async () => Buffer.from("%PDF-1.4 stub", "latin1")),
  putDocumentObject: vi.fn(async () => undefined)
}))

// The mail provider is the only thing stubbed here, and that is the whole point of the file. Every
// other integration test stubs `@/lib/jobs` too, which is precisely why a job id BullMQ refuses sat
// undetected through six stages: a stubbed `enqueueJob` accepts every id ever written. Here the
// queue, the worker, the registry and the job ids are all real, and only the network is not.
vi.mock("@/features/email/server", () => ({
  isEmailConfigured: () => true,
  sendTransactionalEmail: mocks.sendTransactionalEmail,
  sendDocumentEmail: mocks.sendDocumentEmail
}))

// Chromium is the one thing stubbed in the PDF path, and only because it is not installed on a
// developer host — it ships in the worker image (`Dockerfile`, stage `worker`). Everything either
// side of it is real here: the queue delivers the job, the worker runs the registered handler, the
// document HTML is assembled from a real template, and the bytes are written to real object storage
// and recorded as a real `uploads` row. The renderer itself is exercised against real Chromium
// separately.
vi.mock("@/lib/pdf", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pdf")>()),
  renderHtmlToPdf: mocks.renderHtmlToPdf
}))

// The object PUT is stubbed for the same reason and no further: `.env.test` owns this suite's
// storage credentials and they need not match a live MinIO. Everything the test asserts is still a
// real effect — the `uploads` row, its `bucket`, the pointer on the invoice, and the fact that a
// second delivery renders nothing. Writing a real object is covered by the manual worker smoke.
vi.mock("@/lib/storage/s3", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/storage/s3")>()),
  putDocumentObject: mocks.putDocumentObject
}))

const BLUEPRINT = [
  {
    description: "Monthly retainer",
    unit: null,
    quantity: 1,
    unitPriceCents: 150_000,
    taxRateId: null,
    taxPercentage: 0,
    discountType: null,
    discountPercentage: null,
    discountAmountCents: null
  }
]

const POLL_INTERVAL_MS = 100
const POLL_TIMEOUT_MS = 20_000

function toUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}

// Real timers throughout, unlike the handler-level tests that freeze `Date`. A faked clock reaches
// BullMQ's own lock and delay arithmetic here, and the fixtures are built relative to today instead
// so nothing needs one.
async function waitFor<TValue>(
  read: () => Promise<TValue>,
  isSettled: (value: TValue) => boolean
): Promise<TValue> {
  const deadline = Date.now() + POLL_TIMEOUT_MS

  for (;;) {
    const value = await read()

    if (isSettled(value)) return value

    if (Date.now() > deadline) throw new Error("Timed out waiting for the queue to settle")

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
}

// Completion of a named job, used to prove a sweep produced *nothing*. Waiting on an absence needs a
// point in time the absence is true at, and "the sweep has finished" is that point.
async function waitForJob(jobId: string): Promise<void> {
  await waitFor(
    async () => (await getQueue().getJob(jobId))?.finishedOn ?? null,
    (finishedOn) => finishedOn !== null
  )
}

async function countInvoicesFor(recurringInvoiceId: string): Promise<number> {
  const rows = await database
    .select({ id: invoices.id })
    .from(invoices)
    .where(eq(invoices.recurringInvoiceId, recurringInvoiceId))

  return rows.length
}

beforeAll(async () => {
  await getQueue().obliterate({ force: true })

  await loadWorkerFeatureModules()
  await startWorker()
})

afterAll(async () => {
  await stopWorker()
})

test("generates exactly one invoice when a due schedule is swept twice through the queue", async () => {
  await makeSettings({ invoicePrefix: "INV-", nextInvoiceNumber: 1, numberPaddingWidth: 4 })

  const today = toUtcDay(new Date())

  const schedule = await makeRecurringInvoice({
    nextRunAt: today,
    cadence: "monthly",
    cadenceDay: today.getUTCDate(),
    lineItemsBlueprint: BLUEPRINT
  })

  await enqueueJob("recurring.schedule.sweep", {}, { jobId: "test.recurring.sweep.first" })

  await waitFor(
    () => countInvoicesFor(schedule.id),
    (count) => count === 1
  )

  // The second sweep is the re-delivery. `next_run_at` has already advanced past this occurrence, so
  // the sweep finds nothing due and enqueues no generation at all — the guard is the schedule row,
  // not the deterministic job id, which BullMQ frees as soon as the first generation completes.
  await enqueueJob("recurring.schedule.sweep", {}, { jobId: "test.recurring.sweep.second" })
  await waitForJob("test.recurring.sweep.second")

  expect(await countInvoicesFor(schedule.id)).toBe(1)
})

test("sends one reminder and stamps the invoice when the reminder sweep runs twice", async () => {
  await makeSettings({ reminderBeforeDueDays: [0], reminderAfterDueDays: [] })

  const client = await makeClient({ email: "client@example.test" })

  const invoice = await makeInvoice({
    clientId: client.id,
    status: "sent",
    dueDate: toUtcDay(new Date()),
    totalCents: 150_000
  })

  await enqueueJob("invoice.reminder.sweep", {}, { jobId: "test.reminder.sweep.first" })

  await waitFor(
    async () =>
      (
        await database
          .select({ lastReminderSentAt: invoices.lastReminderSentAt })
          .from(invoices)
          .where(eq(invoices.id, invoice.id))
      )[0]?.lastReminderSentAt ?? null,
    (lastReminderSentAt) => lastReminderSentAt !== null
  )

  expect(mocks.sendDocumentEmail).toHaveBeenCalledTimes(1)

  await enqueueJob("invoice.reminder.sweep", {}, { jobId: "test.reminder.sweep.second" })
  await waitForJob("test.reminder.sweep.second")

  expect(mocks.sendDocumentEmail).toHaveBeenCalledTimes(1)
})

test("renders, stores and links an invoice PDF exactly once through the queue", async () => {
  await makeSettings({ businessName: "Remit Test" })

  const template = await makeTemplate({
    type: "invoice",
    isDefault: true,
    blocks: [
      {
        id: "11111111-1111-1111-1111-111111111111",
        type: "text",
        layout: { x: 0, y: 0, width: 400, height: 40 },
        hidden: false,
        locked: false,
        rotation: 0,
        content: { html: "Invoice {{invoice.number}} for {{client.name}}" }
      }
    ]
  })

  const client = await makeClient({ name: "Acme" })

  const invoice = await makeInvoice({
    clientId: client.id,
    templateId: template.id,
    status: "sent",
    number: "INV-9001",
    totalCents: 123_000
  })

  await enqueueJob("invoice.pdf.render", { invoiceId: invoice.id }, { jobId: "test.invoice.pdf.1" })

  const uploadId = await waitFor(
    async () =>
      (
        await database
          .select({ pdfUploadId: invoices.pdfUploadId })
          .from(invoices)
          .where(eq(invoices.id, invoice.id))
      )[0]?.pdfUploadId ?? null,
    (value) => value !== null
  )

  const [upload] = await database
    .select({ bucket: uploads.bucket, mimeType: uploads.mimeType, filename: uploads.filename })
    .from(uploads)
    .where(eq(uploads.id, uploadId ?? ""))

  // The private bucket, not the anonymously-readable one: a money document reachable by URL alone is
  // the thing the exposure decision exists to prevent.
  expect(upload).toMatchObject({
    bucket: "documents",
    mimeType: "application/pdf",
    filename: "INV-9001.pdf"
  })

  // The stored PDF is the snapshot, so a re-delivery must not render a second one or repoint the
  // invoice at it.
  await enqueueJob("invoice.pdf.render", { invoiceId: invoice.id }, { jobId: "test.invoice.pdf.2" })
  await waitForJob("test.invoice.pdf.2")

  const [after] = await database
    .select({ pdfUploadId: invoices.pdfUploadId })
    .from(invoices)
    .where(eq(invoices.id, invoice.id))

  expect(after?.pdfUploadId).toBe(uploadId)
  expect(mocks.renderHtmlToPdf).toHaveBeenCalledTimes(1)
})

test("renders the signed contract PDF and fills the write-once signature pointer", async () => {
  await makeSettings({ businessName: "Remit Test" })

  const client = await makeClient({ name: "Acme" })
  const contract = await makeContract({ clientId: client.id, status: "sent", number: "CTR-9001" })

  const [signature] = await database
    .insert(contractSignatures)
    .values({
      contractId: contract.id,
      signerName: "Ada Lovelace",
      signerEmail: "ada@example.test",
      consentText: "I agree",
      ipAddress: "203.0.113.10",
      userAgent: "probe"
    })
    .returning({ id: contractSignatures.id })

  const signatureId = signature?.id ?? ""

  await enqueueJob(
    "contract.signed_pdf.render",
    { contractId: contract.id, signatureId },
    { jobId: "test.contract.signed.1" }
  )

  const uploadId = await waitFor(
    async () =>
      (
        await database
          .select({ signedPdfUploadId: contractSignatures.signedPdfUploadId })
          .from(contractSignatures)
          .where(eq(contractSignatures.id, signatureId))
      )[0]?.signedPdfUploadId ?? null,
    (value) => value !== null
  )

  const [upload] = await database
    .select({ bucket: uploads.bucket, filename: uploads.filename })
    .from(uploads)
    .where(eq(uploads.id, uploadId ?? ""))

  expect(upload).toMatchObject({ bucket: "documents", filename: "CTR-9001-signed.pdf" })

  const rendersBeforeRedelivery = mocks.renderHtmlToPdf.mock.calls.length

  // The column is write-once and the row is otherwise insert-only
  // (`0001_insert_only_guards.sql`), so a re-delivery
  // must be turned away by the handler's own `IS NULL` guard before it ever reaches the trigger —
  // the trigger would raise, and a retry has to be a no-op rather than a failed job.
  await enqueueJob(
    "contract.signed_pdf.render",
    { contractId: contract.id, signatureId },
    { jobId: "test.contract.signed.2" }
  )
  await waitForJob("test.contract.signed.2")

  const [after] = await database
    .select({ signedPdfUploadId: contractSignatures.signedPdfUploadId })
    .from(contractSignatures)
    .where(eq(contractSignatures.id, signatureId))

  expect(after?.signedPdfUploadId).toBe(uploadId)
  expect(mocks.renderHtmlToPdf.mock.calls.length).toBe(rendersBeforeRedelivery)
})
