import { describe, expect, test } from "vitest"

import { type ClientDetail, type ClientListItem } from "@/features/clients"

import { type ExpenseListItem } from "@/features/expenses"

import { type InvoiceDetail, type InvoiceOverviewItem } from "@/features/invoices"

import { type ProjectDetail } from "@/features/projects"

import { type TimeEntryListItem } from "@/features/timeTracking"

import {
  toApiClient,
  toApiClientDetail,
  toApiExpense,
  toApiInvoice,
  toApiInvoiceDetail,
  toApiProjectDetail,
  toApiTimeEntry
} from "../serializers"

// Written out by hand rather than derived: these are the values the read models carry that must
// never reach an API caller, and a list computed from the serialisers would agree with whatever
// they happen to emit.
const PORTAL_PATH = "/s/portal-bearer-token"
const PUBLIC_PATH = "/i/invoice-bearer-token"
const NOTES = "Confidential: covered by the Acme NDA"
const IMAGE_KEY = "clients/5c2f-private-image.png"
const RECEIPT_KEY = "expenses/9a1b-private-receipt.pdf"

const createdAt = new Date("2026-09-01T09:00:00.000Z")

const clientListItem: ClientListItem = {
  id: "8f7c3c8e-2d6a-4f1e-9b5a-1c2d3e4f5a6b",
  name: "Acme",
  email: "billing@acme.test",
  imageStorageKey: IMAGE_KEY,
  currency: "EUR",
  outstandingBalanceCents: 125_00,
  invoiceCount: 2,
  health: "owing",
  createdAt,
  deletedAt: null
}

const clientDetail: ClientDetail = {
  id: clientListItem.id,
  name: "Acme",
  email: "billing@acme.test",
  phone: "",
  website: "https://acme.test",
  taxId: "PT123",
  currency: "EUR",
  address: {
    line1: "1 Main St",
    line2: "",
    city: "Lisbon",
    state: "",
    postalCode: "",
    country: "PT"
  },
  notes: NOTES,
  imageStorageKey: IMAGE_KEY,
  portalPath: PORTAL_PATH,
  outstandingBalanceCents: 125_00,
  health: "owing",
  deletedAt: null,
  createdAt,
  updatedAt: createdAt,
  relatedResources: { projects: 1, invoices: 2, recurringInvoices: 0 },
  billingTrend: []
}

const invoiceOverviewItem: InvoiceOverviewItem = {
  id: "0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e",
  number: "INV-0001",
  status: "sent",
  viewStatus: "sent",
  currency: "EUR",
  totalCents: 500_00,
  amountPaidCents: 0,
  outstandingCents: 500_00,
  issueDate: createdAt,
  dueDate: null,
  paidAt: null,
  createdAt,
  parentLabel: "Acme",
  projectId: null,
  clientId: clientListItem.id,
  clientName: "Acme"
}

const invoiceDetail: InvoiceDetail = {
  id: invoiceOverviewItem.id,
  projectId: null,
  projectName: "",
  clientId: clientListItem.id,
  clientName: "Acme",
  proposalId: null,
  number: "INV-0001",
  status: "sent",
  currency: "EUR",
  subtotalCents: 500_00,
  discountAmountTotalCents: 0,
  taxAmountCents: 0,
  totalCents: 500_00,
  amountPaidCents: 0,
  discountPercentage: null,
  discountAmountCents: null,
  issueDate: createdAt,
  dueDate: null,
  paidAt: null,
  notes: "",
  viewCount: 3,
  templateName: null,
  publicPath: PUBLIC_PATH,
  publicLinkState: "live",
  lateFee: null,
  lineItems: [],
  defaults: {
    defaultCurrency: "EUR",
    defaultLocale: "en",
    defaultTimezone: "UTC",
    paymentTermsDays: 30,
    defaultNotesInvoice: ""
  }
}

const expenseListItem: ExpenseListItem = {
  id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
  spentAt: createdAt,
  category: "Travel",
  description: "Train",
  projectId: null,
  projectName: null,
  clientId: clientListItem.id,
  clientName: "Acme",
  amountCents: 42_00,
  currency: "EUR",
  rebillable: true,
  markupPercentage: null,
  rebillableCents: 42_00,
  invoicedInId: null,
  receipt: {
    uploadId: "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e",
    filename: "receipt.pdf",
    mimeType: "application/pdf",
    sizeBytes: 2048,
    path: RECEIPT_KEY
  },
  deletedAt: null
}

describe("API serialisers", () => {
  test("publish no bearer path, note or storage key from any read model that carries one", () => {
    const published = JSON.stringify([
      toApiClient(clientListItem),
      toApiClientDetail(clientDetail),
      toApiInvoice(invoiceOverviewItem),
      toApiInvoiceDetail(invoiceDetail),
      toApiExpense(expenseListItem)
    ])

    for (const secret of [PORTAL_PATH, PUBLIC_PATH, NOTES, IMAGE_KEY, RECEIPT_KEY]) {
      expect(published).not.toContain(secret)
    }
  })

  test("say whether an expense has a receipt without saying where it is stored", () => {
    const expense = toApiExpense(expenseListItem)

    expect(expense.hasReceipt).toBe(true)
    expect(Object.keys(expense)).not.toContain("receipt")
  })

  test("publish the client detail fields a consumer integrates with and nothing else", () => {
    const client = toApiClientDetail(clientDetail)

    expect(Object.keys(client).sort()).toEqual(
      [
        "address",
        "createdAt",
        "currency",
        "email",
        "id",
        "name",
        "outstandingBalanceCents",
        "phone",
        "taxId",
        "updatedAt",
        "website"
      ].sort()
    )
  })

  test("turn the read models' empty-string fallbacks back into null", () => {
    const client = toApiClientDetail(clientDetail)

    expect(client.phone).toBeNull()
    expect(client.address.line2).toBeNull()
    expect(client.website).toBe("https://acme.test")
  })

  test("render every instant as an ISO 8601 UTC string", () => {
    const entry: TimeEntryListItem = {
      id: "3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f",
      clientId: clientListItem.id,
      projectId: "4d5e6f7a-8b9c-4d0e-8f1a-2b3c4d5e6f7a",
      projectName: "Site",
      clientName: "Acme",
      taskId: null,
      taskTitle: null,
      description: "Design",
      startedAt: createdAt,
      endedAt: null,
      durationSeconds: null,
      billable: true,
      hourlyRateOverrideCents: null,
      hourlyRateSnapshotCents: 80_00,
      amountCents: 0,
      currency: "EUR",
      source: "timer",
      invoicedInId: null,
      deletedAt: null
    }

    const project: ProjectDetail = {
      id: entry.projectId,
      name: "Site",
      clientId: clientListItem.id,
      clientName: "Acme",
      status: "active",
      currency: "EUR",
      budgetCents: null,
      hourlyRateCents: 80_00,
      startDate: createdAt,
      endDate: null,
      description: "",
      deletedAt: null,
      createdAt,
      updatedAt: createdAt
    }

    expect(toApiTimeEntry(entry).startedAt).toBe("2026-09-01T09:00:00.000Z")
    expect(toApiTimeEntry(entry).endedAt).toBeNull()
    expect(toApiProjectDetail(project).startDate).toBe("2026-09-01T09:00:00.000Z")
    expect(toApiProjectDetail(project).description).toBeNull()
  })
})
