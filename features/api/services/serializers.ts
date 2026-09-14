import { type ClientDetail, type ClientListItem } from "@/features/clients"

import { type ExpenseListItem } from "@/features/expenses"

import {
  type InvoiceDetail,
  type InvoiceDetailLineItem,
  type InvoiceOverviewItem
} from "@/features/invoices"

import { type ProjectDetail, type ProjectListItem } from "@/features/projects"

import { type TimeEntryListItem } from "@/features/timeTracking"

import {
  type ApiClient,
  type ApiClientDetail,
  type ApiExpense,
  type ApiInvoice,
  type ApiInvoiceDetail,
  type ApiProject,
  type ApiProjectDetail,
  type ApiTimeEntry
} from "../responseSchemas"

// Each mapper names the fields it hands out, one by one, rather than spreading a read model: the
// read models these take in carry `clients.notes`, a portal path, an invoice's public path and a
// receipt's storage key, and a spread would publish whichever of them the next edit added. The
// route then parses the result through the matching schema in `responseSchemas.ts`, which strips
// anything a mapper here ever lets through by mistake.

export function toApiClient(client: ClientListItem): ApiClient {
  return {
    id: client.id,
    name: client.name,
    email: client.email,
    currency: client.currency,
    outstandingBalanceCents: client.outstandingBalanceCents,
    createdAt: client.createdAt.toISOString()
  }
}

export function toApiClientDetail(client: ClientDetail): ApiClientDetail {
  return {
    id: client.id,
    name: client.name,
    email: client.email,
    currency: client.currency,
    outstandingBalanceCents: client.outstandingBalanceCents,
    createdAt: client.createdAt.toISOString(),
    phone: emptyToNull(client.phone),
    website: emptyToNull(client.website),
    taxId: emptyToNull(client.taxId),
    address: {
      line1: emptyToNull(client.address.line1),
      line2: emptyToNull(client.address.line2),
      city: emptyToNull(client.address.city),
      state: emptyToNull(client.address.state),
      postalCode: emptyToNull(client.address.postalCode),
      country: emptyToNull(client.address.country)
    },
    updatedAt: client.updatedAt.toISOString()
  }
}

export function toApiProject(project: ProjectListItem): ApiProject {
  return {
    id: project.id,
    name: project.name,
    clientId: project.clientId,
    status: project.status,
    currency: project.currency,
    budgetCents: project.budgetCents,
    hourlyRateCents: project.hourlyRateCents,
    startDate: toIsoOrNull(project.startDate),
    endDate: toIsoOrNull(project.endDate),
    createdAt: project.createdAt.toISOString()
  }
}

export function toApiProjectDetail(project: ProjectDetail): ApiProjectDetail {
  return {
    id: project.id,
    name: project.name,
    clientId: project.clientId,
    status: project.status,
    currency: project.currency,
    budgetCents: project.budgetCents,
    hourlyRateCents: project.hourlyRateCents,
    startDate: toIsoOrNull(project.startDate),
    endDate: toIsoOrNull(project.endDate),
    createdAt: project.createdAt.toISOString(),
    description: emptyToNull(project.description),
    updatedAt: project.updatedAt.toISOString()
  }
}

export function toApiInvoice(invoice: InvoiceOverviewItem): ApiInvoice {
  return {
    id: invoice.id,
    number: invoice.number,
    status: invoice.status,
    currency: invoice.currency,
    totalCents: invoice.totalCents,
    amountPaidCents: invoice.amountPaidCents,
    issueDate: toIsoOrNull(invoice.issueDate),
    dueDate: toIsoOrNull(invoice.dueDate),
    paidAt: toIsoOrNull(invoice.paidAt),
    projectId: invoice.projectId,
    clientId: invoice.clientId,
    outstandingCents: invoice.outstandingCents,
    createdAt: invoice.createdAt.toISOString()
  }
}

export function toApiInvoiceDetail(invoice: InvoiceDetail): ApiInvoiceDetail {
  return {
    id: invoice.id,
    number: invoice.number,
    status: invoice.status,
    currency: invoice.currency,
    totalCents: invoice.totalCents,
    amountPaidCents: invoice.amountPaidCents,
    issueDate: toIsoOrNull(invoice.issueDate),
    dueDate: toIsoOrNull(invoice.dueDate),
    paidAt: toIsoOrNull(invoice.paidAt),
    projectId: invoice.projectId,
    clientId: invoice.clientId,
    subtotalCents: invoice.subtotalCents,
    discountAmountTotalCents: invoice.discountAmountTotalCents,
    taxAmountCents: invoice.taxAmountCents,
    notes: emptyToNull(invoice.notes),
    lineItems: invoice.lineItems.map(toApiInvoiceLineItem)
  }
}

export function toApiTimeEntry(entry: TimeEntryListItem): ApiTimeEntry {
  return {
    id: entry.id,
    projectId: entry.projectId,
    taskId: entry.taskId,
    description: entry.description,
    startedAt: entry.startedAt.toISOString(),
    endedAt: toIsoOrNull(entry.endedAt),
    durationSeconds: entry.durationSeconds,
    billable: entry.billable,
    hourlyRateCents: entry.hourlyRateSnapshotCents,
    amountCents: entry.amountCents,
    currency: entry.currency,
    invoiceId: entry.invoicedInId
  }
}

export function toApiExpense(expense: ExpenseListItem): ApiExpense {
  return {
    id: expense.id,
    spentAt: expense.spentAt.toISOString(),
    category: expense.category,
    description: expense.description,
    projectId: expense.projectId,
    clientId: expense.clientId,
    amountCents: expense.amountCents,
    currency: expense.currency,
    rebillable: expense.rebillable,
    markupPercentage: expense.markupPercentage,
    rebillableCents: expense.rebillableCents,
    invoiceId: expense.invoicedInId,
    hasReceipt: expense.receipt !== null
  }
}

function toApiInvoiceLineItem(line: InvoiceDetailLineItem): ApiInvoiceDetail["lineItems"][number] {
  return {
    position: line.position,
    description: line.description,
    unit: line.unit,
    quantity: line.quantity,
    unitPriceCents: line.unitPriceCents,
    discountPercentage: line.discountPercentage,
    discountAmountCents: line.discountAmountCents,
    taxPercentage: line.taxPercentage,
    subtotalCents: line.subtotalCents,
    taxAmountCents: line.taxAmountCents,
    totalCents: line.totalCents
  }
}

function toIsoOrNull(value: Date | null): string | null {
  return value ? value.toISOString() : null
}

function emptyToNull(value: string): string | null {
  return value.length > 0 ? value : null
}
