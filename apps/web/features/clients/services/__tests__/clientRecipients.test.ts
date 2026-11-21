import { describe, expect, test } from "vitest"

import {
  listRecipientIdentities,
  resolveDocumentRecipient,
  type RecipientContact
} from "../clientRecipients"

const client = { name: "Acme Studio", email: "billing@acme.test" }

function makeContact(overrides: Partial<RecipientContact> = {}): RecipientContact {
  return { name: "Jordan Ellis", email: "jordan@acme.test", isPrimary: false, ...overrides }
}

describe("resolveDocumentRecipient", () => {
  test("returns the client's own address when it has no contacts", () => {
    const recipient = resolveDocumentRecipient(client, [])

    expect(recipient).toEqual({ email: "billing@acme.test", name: "Acme Studio" })
  })

  test("returns the client's own address when no contact is primary", () => {
    const recipient = resolveDocumentRecipient(client, [makeContact()])

    expect(recipient).toEqual({ email: "billing@acme.test", name: "Acme Studio" })
  })

  test("returns the primary contact when the client has one", () => {
    const recipient = resolveDocumentRecipient(client, [
      makeContact(),
      makeContact({ name: "Sam Reyes", email: "finance@acme.test", isPrimary: true })
    ])

    expect(recipient).toEqual({ email: "finance@acme.test", name: "Sam Reyes" })
  })
})

describe("listRecipientIdentities", () => {
  test("returns only the client's own address when it has no contacts", () => {
    const identities = listRecipientIdentities(client, [])

    expect(identities).toEqual([{ email: "billing@acme.test", name: "Acme Studio" }])
  })

  test("includes every contact alongside the client's own address", () => {
    const identities = listRecipientIdentities(client, [
      makeContact({ isPrimary: true }),
      makeContact({ name: "Sam Reyes", email: "finance@acme.test" })
    ])

    expect(identities.map((identity) => identity.email)).toEqual([
      "billing@acme.test",
      "jordan@acme.test",
      "finance@acme.test"
    ])
  })
})
