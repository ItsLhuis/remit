import { describe, expect, test } from "vitest"

import {
  buildInvoiceAttention,
  buildSignalAttention,
  rankAttentionItems,
  type AttentionContractRow,
  type AttentionInvoiceRow,
  type AttentionItem,
  type AttentionProposalRow,
  type AttentionTaskRow
} from "../selectAttentionItems"

const NOW = new Date("2026-08-17T09:30:00.000Z")

function makeInvoice(overrides: Partial<AttentionInvoiceRow> = {}): AttentionInvoiceRow {
  return {
    id: "invoice-1",
    number: "INV-0001",
    parentName: "Acme",
    projectId: "project-1",
    currency: "EUR",
    receivableCents: 50_000,
    issueDate: new Date("2026-08-01T00:00:00.000Z"),
    viewCount: 1,
    isOverdue: false,
    dueDate: new Date("2026-09-01T00:00:00.000Z"),
    ...overrides
  }
}

function makeProposal(overrides: Partial<AttentionProposalRow> = {}): AttentionProposalRow {
  return {
    id: "proposal-1",
    number: "PROP-0001",
    projectId: "project-1",
    parentName: "Acme",
    currency: "EUR",
    totalCents: 200_000,
    validUntil: null,
    issuedAt: new Date("2026-08-01T00:00:00.000Z"),
    viewCount: 1,
    ...overrides
  }
}

function makeContract(overrides: Partial<AttentionContractRow> = {}): AttentionContractRow {
  return {
    id: "contract-1",
    number: "CON-0001",
    title: "Retainer agreement",
    issuedAt: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides
  }
}

function makeTask(overrides: Partial<AttentionTaskRow> = {}): AttentionTaskRow {
  return {
    id: "task-1",
    title: "Ship the report",
    projectId: "project-1",
    projectName: "Website",
    dueAt: new Date("2026-08-18T00:00:00.000Z"),
    ...overrides
  }
}

function makeItem(overrides: Partial<AttentionItem> = {}): AttentionItem {
  return {
    id: "item-1",
    kind: "invoiceOverdue",
    severity: "error",
    subject: "INV-0001",
    context: "Acme",
    days: 3,
    amountCents: null,
    currency: null,
    href: "/invoices",
    ...overrides
  }
}

describe("buildInvoiceAttention", () => {
  test("returns nothing for an invoice that is current and already opened", () => {
    expect(buildInvoiceAttention([makeInvoice()], NOW)).toEqual([])
  })

  test("raises an overdue item counting whole days since the due date", () => {
    const rows = [makeInvoice({ isOverdue: true, dueDate: new Date("2026-08-10T00:00:00.000Z") })]

    const items = buildInvoiceAttention(rows, NOW)

    expect(items[0]?.kind).toBe("invoiceOverdue")
    expect(items[0]?.days).toBe(7)
    expect(items[0]?.severity).toBe("error")
  })

  test("ignores an invoice whose receivable has already been settled", () => {
    const rows = [makeInvoice({ isOverdue: true, receivableCents: 0 })]

    expect(buildInvoiceAttention(rows, NOW)).toEqual([])
  })

  test("waits three days before calling an unopened invoice a problem", () => {
    const rows = [makeInvoice({ viewCount: 0, issueDate: new Date("2026-08-16T00:00:00.000Z") })]

    expect(buildInvoiceAttention(rows, NOW)).toEqual([])
  })

  test("raises an unopened item once the invoice has been out for three days", () => {
    const rows = [makeInvoice({ viewCount: 0, issueDate: new Date("2026-08-14T00:00:00.000Z") })]

    expect(buildInvoiceAttention(rows, NOW)[0]?.kind).toBe("invoiceUnviewed")
  })

  test("raises both items for an invoice that is late and was never opened", () => {
    const rows = [
      makeInvoice({
        viewCount: 0,
        isOverdue: true,
        issueDate: new Date("2026-07-01T00:00:00.000Z"),
        dueDate: new Date("2026-07-15T00:00:00.000Z")
      })
    ]

    expect(buildInvoiceAttention(rows, NOW).map((item) => item.id)).toEqual([
      "invoiceOverdue:invoice-1",
      "invoiceUnviewed:invoice-1"
    ])
  })

  test("links an invoice raised straight against a client to the invoice list", () => {
    const rows = [
      makeInvoice({
        projectId: null,
        isOverdue: true,
        dueDate: new Date("2026-08-01T00:00:00.000Z")
      })
    ]

    expect(buildInvoiceAttention(rows, NOW)[0]?.href).toBe("/invoices")
  })

  test("links an invoice that has a project to its nested detail route", () => {
    const rows = [makeInvoice({ isOverdue: true, dueDate: new Date("2026-08-01T00:00:00.000Z") })]

    expect(buildInvoiceAttention(rows, NOW)[0]?.href).toBe("/projects/project-1/invoices/invoice-1")
  })
})

describe("buildSignalAttention", () => {
  test("reports a proposal expiring within the week as days remaining", () => {
    const items = buildSignalAttention(
      {
        proposals: [makeProposal({ validUntil: new Date("2026-08-20T00:00:00.000Z") })],
        contracts: [],
        tasks: []
      },
      NOW
    )

    expect(items[0]?.kind).toBe("proposalExpiring")
    expect(items[0]?.days).toBe(3)
    expect(items[0]?.severity).toBe("info")
  })

  test("raises an expired proposal to a warning with a negative day count", () => {
    const items = buildSignalAttention(
      {
        proposals: [makeProposal({ validUntil: new Date("2026-08-12T00:00:00.000Z") })],
        contracts: [],
        tasks: []
      },
      NOW
    )

    expect(items[0]?.severity).toBe("warning")
    expect(items[0]?.days).toBe(-5)
  })

  test("reports an unopened proposal when its expiry is not already the story", () => {
    const items = buildSignalAttention(
      {
        proposals: [
          makeProposal({
            validUntil: new Date("2026-12-01T00:00:00.000Z"),
            viewCount: 0,
            issuedAt: new Date("2026-08-05T00:00:00.000Z")
          })
        ],
        contracts: [],
        tasks: []
      },
      NOW
    )

    expect(items.map((item) => item.kind)).toEqual(["proposalStale"])
  })

  test("ignores a contract that was issued today", () => {
    const items = buildSignalAttention(
      { proposals: [], contracts: [makeContract({ issuedAt: NOW })], tasks: [] },
      NOW
    )

    expect(items).toEqual([])
  })

  test("links an unsigned contract to its own detail route", () => {
    const items = buildSignalAttention(
      { proposals: [], contracts: [makeContract()], tasks: [] },
      NOW
    )

    expect(items[0]?.href).toBe("/contracts/contract-1")
  })

  test("raises an overdue task to a warning", () => {
    const items = buildSignalAttention(
      {
        proposals: [],
        contracts: [],
        tasks: [makeTask({ dueAt: new Date("2026-08-15T00:00:00.000Z") })]
      },
      NOW
    )

    expect(items[0]?.severity).toBe("warning")
    expect(items[0]?.days).toBe(-2)
  })

  test("ignores a task due beyond the three-day horizon", () => {
    const items = buildSignalAttention(
      {
        proposals: [],
        contracts: [],
        tasks: [makeTask({ dueAt: new Date("2026-08-25T00:00:00.000Z") })]
      },
      NOW
    )

    expect(items).toEqual([])
  })
})

describe("rankAttentionItems", () => {
  test("puts errors above warnings and warnings above notices", () => {
    const items = [
      makeItem({ id: "c", severity: "info", kind: "contractUnsigned" }),
      makeItem({ id: "a", severity: "error" }),
      makeItem({ id: "b", severity: "warning", kind: "invoiceUnviewed" })
    ]

    expect(rankAttentionItems(items).items.map((item) => item.id)).toEqual(["a", "b", "c"])
  })

  test("puts the older of two equally severe items first", () => {
    const items = [makeItem({ id: "recent", days: 2 }), makeItem({ id: "ancient", days: 90 })]

    expect(rankAttentionItems(items).items.map((item) => item.id)).toEqual(["ancient", "recent"])
  })

  test("puts the most imminent of two forward-looking items first", () => {
    const items = [
      makeItem({ id: "later", kind: "taskDue", severity: "info", days: 3 }),
      makeItem({ id: "today", kind: "taskDue", severity: "info", days: 0 })
    ]

    expect(rankAttentionItems(items).items.map((item) => item.id)).toEqual(["today", "later"])
  })

  test("orders a tie by subject so two renders cannot disagree", () => {
    const items = [
      makeItem({ id: "second", subject: "INV-0002" }),
      makeItem({ id: "first", subject: "INV-0001" })
    ]

    expect(rankAttentionItems(items).items.map((item) => item.id)).toEqual(["first", "second"])
  })

  test("reports the untruncated count when the list is capped", () => {
    const items = Array.from({ length: 12 }, (_, index) =>
      makeItem({ id: `item-${index}`, subject: `INV-${index}` })
    )

    const ranked = rankAttentionItems(items, 7)

    expect(ranked.items).toHaveLength(7)
    expect(ranked.totalCount).toBe(12)
  })
})
