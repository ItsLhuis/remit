import { beforeEach, expect, test } from "vitest"

import { makeClient, makeClientContact, makeContract, makeSettings } from "@/tests/factories"

import { buildContractDocumentData } from "../documentData"

beforeEach(async () => {
  await makeSettings({ businessName: "Studio Remit" })
})

test("addresses a contract email to the client's primary contact", async () => {
  const client = await makeClient({ name: "Acme Studio", email: "billing@acme.test" })

  await makeClientContact({
    clientId: client.id,
    name: "Sam Reyes",
    email: "signatory@acme.test",
    isPrimary: true
  })

  const contract = await makeContract({ clientId: client.id })

  const document = await buildContractDocumentData(contract.id)

  expect(document?.recipientEmail).toBe("signatory@acme.test")
  expect(document?.recipientName).toBe("Sam Reyes")
  expect(document?.renderData.values["client.name"]).toBe("Acme Studio")
})

test("falls back to the client's own address when no contact holds the slot", async () => {
  const client = await makeClient({ name: "Acme Studio", email: "billing@acme.test" })

  await makeClientContact({ clientId: client.id, email: "nobody@acme.test" })

  const contract = await makeContract({ clientId: client.id })

  const document = await buildContractDocumentData(contract.id)

  expect(document?.recipientEmail).toBe("billing@acme.test")
})
