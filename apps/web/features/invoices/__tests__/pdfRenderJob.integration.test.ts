import { eq } from "drizzle-orm"

import { beforeEach, expect, test, vi } from "vitest"

import { invoices } from "@/database/schema"

import { makeClient, makeInvoice, makeLineItem, makeSettings, makeUpload } from "@/tests/factories"
import { database } from "@/tests/integration/database"

const mocks = vi.hoisted(() => ({
  renderHtmlToPdf: vi.fn(),
  storeDocumentPdf: vi.fn(),
  enqueueJob: vi.fn()
}))

// Only the browser and the object store are stubbed: the layout resolution, the renderer and the
// database writes are the real ones under test.
vi.mock("@/lib/pdf", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pdf")>()),
  renderHtmlToPdf: mocks.renderHtmlToPdf,
  storeDocumentPdf: mocks.storeDocumentPdf
}))

vi.mock("@/lib/jobs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/jobs")>()),
  enqueueJob: mocks.enqueueJob
}))

beforeEach(() => {
  vi.clearAllMocks()

  mocks.renderHtmlToPdf.mockResolvedValue(Buffer.from("%PDF-1.7"))
})

test("renders a sent invoice from the built-in layout on an instance with no templates and chains its mail", async () => {
  await makeSettings()

  const upload = await makeUpload()

  mocks.storeDocumentPdf.mockResolvedValue(upload.id)

  const client = await makeClient({ name: "Acme Studio" })
  const invoice = await makeInvoice({ clientId: client.id, status: "sent", number: "INV-0042" })

  await makeLineItem({ invoiceId: invoice.id, description: "Logo design" })

  const { renderInvoicePdf } = await import("../pdfRenderJob")

  await renderInvoicePdf({ invoiceId: invoice.id, email: "sent" })

  const [renderInput] = mocks.renderHtmlToPdf.mock.calls[0] ?? []
  const stored = await database.query.invoices.findFirst({ where: eq(invoices.id, invoice.id) })

  expect(renderInput?.html).toContain("INV-0042")
  expect(renderInput?.html).toContain("Logo design")
  expect(stored?.pdfUploadId).toBe(upload.id)
  expect(mocks.enqueueJob).toHaveBeenCalledWith(
    "invoice.email.send",
    { invoiceId: invoice.id, occasion: "sent" },
    expect.anything()
  )
})
