import { beforeEach, expect, test } from "vitest"

import {
  makeClient,
  makeClientContact,
  makeInvoice,
  makeProject,
  makeSettings
} from "@/tests/factories"

import { buildInvoiceDocumentData } from "../documentData"

beforeEach(async () => {
  await makeSettings({ businessName: "Studio Remit" })
})

test("addresses an invoice email to the client's primary contact", async () => {
  const client = await makeClient({ name: "Acme Studio", email: "billing@acme.test" })

  await makeClientContact({
    clientId: client.id,
    name: "Sam Reyes",
    email: "finance@acme.test",
    isPrimary: true
  })

  const invoice = await makeInvoice({ clientId: client.id })

  const document = await buildInvoiceDocumentData(invoice.id)

  expect(document?.recipientEmail).toBe("finance@acme.test")
  expect(document?.recipientName).toBe("Sam Reyes")
})

// The document is issued to the company even when a person receives it, so the merge data the PDF
// renders from must keep naming the client.
test("keeps naming the client in the rendered document", async () => {
  const client = await makeClient({ name: "Acme Studio", email: "billing@acme.test" })

  await makeClientContact({ clientId: client.id, email: "finance@acme.test", isPrimary: true })

  const invoice = await makeInvoice({ clientId: client.id })

  const document = await buildInvoiceDocumentData(invoice.id)

  expect(document?.renderData.values["client.name"]).toBe("Acme Studio")
})

test("falls back to the client's own address through a project parent", async () => {
  const client = await makeClient({ name: "Acme Studio", email: "billing@acme.test" })
  const project = await makeProject({ clientId: client.id })
  const invoice = await makeInvoice({ projectId: project.id })

  const document = await buildInvoiceDocumentData(invoice.id)

  expect(document?.recipientEmail).toBe("billing@acme.test")
})
