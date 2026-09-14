import { z } from "zod"

import { invoiceStatus, projectStatus } from "@/database/schema"

// The response half of the public API contract, and its boundary: every route parses its payload
// through one of these before answering, so a read model that grows a field — a storage key, a
// token, a note — cannot reach a caller until a schema here is edited to name it. The OpenAPI
// document is generated from these same objects (`openapi.ts`), so the document and the boundary
// cannot drift apart.
//
// Server-only: the enum values come from the database schema rather than the feature barrels,
// because `@/features/invoices` and `@/features/projects` re-export React components that have no
// place in a route handler's graph.

export const API_ERROR_CODES = [
  "unauthorized",
  "not_found",
  "invalid_request",
  "rate_limited",
  "internal_error"
] as const

export type ApiErrorCode = (typeof API_ERROR_CODES)[number]

const timestamp = z.iso.datetime().meta({ description: "ISO 8601 instant in UTC" })

const currencyCode = z.string().length(3).meta({ description: "ISO 4217 currency code" })

const minorUnits = z
  .number()
  .int()
  .meta({ description: "Integer minor units of the record's `currency`" })

export const apiErrorSchema = z
  .object({
    error: z.object({
      code: z.enum(API_ERROR_CODES),
      message: z.string()
    })
  })
  .meta({ id: "Error" })

export type ApiErrorBody = z.infer<typeof apiErrorSchema>

const paginationSchema = z
  .object({
    page: z.number().int().positive(),
    perPage: z.number().int().positive(),
    total: z.number().int().nonnegative()
  })
  .meta({ id: "Pagination" })

export const apiClientSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    email: z.string(),
    currency: currencyCode,
    outstandingBalanceCents: minorUnits,
    createdAt: timestamp
  })
  .meta({ id: "Client" })

export type ApiClient = z.infer<typeof apiClientSchema>

export const apiClientDetailSchema = apiClientSchema
  .extend({
    phone: z.string().nullable(),
    website: z.string().nullable(),
    taxId: z.string().nullable(),
    address: z.object({
      line1: z.string().nullable(),
      line2: z.string().nullable(),
      city: z.string().nullable(),
      state: z.string().nullable(),
      postalCode: z.string().nullable(),
      country: z.string().nullable()
    }),
    updatedAt: timestamp
  })
  .meta({ id: "ClientDetail" })

export type ApiClientDetail = z.infer<typeof apiClientDetailSchema>

export const apiProjectSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    clientId: z.uuid(),
    status: z.enum(projectStatus.enumValues),
    currency: currencyCode,
    budgetCents: minorUnits.nullable(),
    hourlyRateCents: minorUnits.nullable(),
    startDate: timestamp.nullable(),
    endDate: timestamp.nullable(),
    createdAt: timestamp
  })
  .meta({ id: "Project" })

export type ApiProject = z.infer<typeof apiProjectSchema>

export const apiProjectDetailSchema = apiProjectSchema
  .extend({
    description: z.string().nullable(),
    updatedAt: timestamp
  })
  .meta({ id: "ProjectDetail" })

export type ApiProjectDetail = z.infer<typeof apiProjectDetailSchema>

const invoiceBaseShape = {
  id: z.uuid(),
  number: z.string(),
  status: z.enum(invoiceStatus.enumValues),
  currency: currencyCode,
  totalCents: minorUnits,
  amountPaidCents: minorUnits,
  issueDate: timestamp.nullable(),
  dueDate: timestamp.nullable(),
  paidAt: timestamp.nullable(),
  projectId: z.uuid().nullable(),
  clientId: z.uuid().nullable()
}

export const apiInvoiceSchema = z
  .object({
    ...invoiceBaseShape,
    outstandingCents: minorUnits,
    createdAt: timestamp
  })
  .meta({ id: "Invoice" })

export type ApiInvoice = z.infer<typeof apiInvoiceSchema>

const invoiceLineItemSchema = z
  .object({
    position: z.number().int(),
    description: z.string(),
    unit: z.string(),
    quantity: z.number(),
    unitPriceCents: minorUnits,
    discountPercentage: z.number().nullable(),
    discountAmountCents: minorUnits.nullable(),
    taxPercentage: z.number(),
    subtotalCents: minorUnits,
    taxAmountCents: minorUnits,
    totalCents: minorUnits
  })
  .meta({ id: "InvoiceLineItem" })

export const apiInvoiceDetailSchema = z
  .object({
    ...invoiceBaseShape,
    subtotalCents: minorUnits,
    discountAmountTotalCents: minorUnits,
    taxAmountCents: minorUnits,
    notes: z.string().nullable(),
    lineItems: z.array(invoiceLineItemSchema)
  })
  .meta({ id: "InvoiceDetail" })

export type ApiInvoiceDetail = z.infer<typeof apiInvoiceDetailSchema>

export const apiTimeEntrySchema = z
  .object({
    id: z.uuid(),
    projectId: z.uuid(),
    taskId: z.uuid().nullable(),
    description: z.string(),
    startedAt: timestamp,
    endedAt: timestamp.nullable(),
    durationSeconds: z.number().int().nullable(),
    billable: z.boolean(),
    hourlyRateCents: minorUnits,
    amountCents: minorUnits,
    currency: currencyCode,
    invoiceId: z.uuid().nullable()
  })
  .meta({ id: "TimeEntry" })

export type ApiTimeEntry = z.infer<typeof apiTimeEntrySchema>

export const apiExpenseSchema = z
  .object({
    id: z.uuid(),
    spentAt: timestamp,
    category: z.string(),
    description: z.string(),
    projectId: z.uuid().nullable(),
    clientId: z.uuid().nullable(),
    amountCents: minorUnits,
    currency: currencyCode,
    rebillable: z.boolean(),
    markupPercentage: z.number().nullable(),
    rebillableCents: minorUnits,
    invoiceId: z.uuid().nullable(),
    // Whether a receipt is on file, never where: the receipt's storage key is an internal object
    // path, and the API has no route that would serve the file anyway.
    hasReceipt: z.boolean()
  })
  .meta({ id: "Expense" })

export type ApiExpense = z.infer<typeof apiExpenseSchema>

export function apiListResponseSchema<TItem extends z.ZodType>(item: TItem, id: string) {
  return z.object({ data: z.array(item), pagination: paginationSchema }).meta({ id })
}

export function apiItemResponseSchema<TItem extends z.ZodType>(item: TItem, id: string) {
  return z.object({ data: item }).meta({ id })
}
