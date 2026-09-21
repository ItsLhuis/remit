import { z } from "zod"

import i18n from "@/lib/i18n/i18n"

import { MAX_PAGE_SIZE } from "@/lib/utils"

import { projectStatus } from "@/database/schema"

import { API_DEFAULT_PAGE_SIZE } from "@/features/api"

import { type InvoiceViewStatus } from "@/features/invoices"

const SEARCH_MAX_LENGTH = 100

// Restated rather than imported: the invoices barrel re-exports React components, and this module
// sits in a route handler's graph. `__tests__/schemas.test.ts` fails when the two lists disagree.
export const MCP_INVOICE_STATUSES = [
  "draft",
  "sent",
  "paid",
  "overdue",
  "partially_paid"
] as const satisfies readonly InvoiceViewStatus[]

// Every tool argument arrives from a language model — the least trustworthy input in the
// repository — so every object is strict: an argument no tool declares is refused rather than
// ignored, and the model is told so instead of silently receiving an unfiltered collection.
const unknownArgument = { error: i18n.t("mcp.validation.unknownArgument") }

const pagingShape = {
  page: z
    .number(i18n.t("api.validation.pageInvalid"))
    .int(i18n.t("api.validation.pageInvalid"))
    .positive(i18n.t("api.validation.pageInvalid"))
    .default(1)
    .meta({ description: "1-based page number. Defaults to 1." }),
  perPage: z
    .number(i18n.t("api.validation.perPageInvalid", { max: MAX_PAGE_SIZE }))
    .int(i18n.t("api.validation.perPageInvalid", { max: MAX_PAGE_SIZE }))
    .min(1, i18n.t("api.validation.perPageInvalid", { max: MAX_PAGE_SIZE }))
    .max(MAX_PAGE_SIZE, i18n.t("api.validation.perPageInvalid", { max: MAX_PAGE_SIZE }))
    .default(API_DEFAULT_PAGE_SIZE)
    .meta({ description: `Rows per page, 1 to ${MAX_PAGE_SIZE}. Defaults to 25.` })
}

const search = z
  .string(i18n.t("mcp.validation.searchInvalid", { max: SEARCH_MAX_LENGTH }))
  .trim()
  .min(1, i18n.t("mcp.validation.searchInvalid", { max: SEARCH_MAX_LENGTH }))
  .max(SEARCH_MAX_LENGTH, i18n.t("mcp.validation.searchInvalid", { max: SEARCH_MAX_LENGTH }))
  .optional()

const recordId = z.uuid(i18n.t("api.validation.idInvalid"))

const flag = z.boolean(i18n.t("mcp.validation.flagInvalid")).optional()

// A calendar day rather than an instant: the filters compare against dates the owner entered, and
// "March" is a range of days whatever time zone the assistant happens to reason in.
const day = z.iso
  .date(i18n.t("mcp.validation.dayInvalid"))
  .optional()
  .meta({ description: "A calendar day, YYYY-MM-DD. Both ends of a range are inclusive." })

export const listClientsInputSchema = z.strictObject(
  {
    search: search.meta({ description: "Matches a client's name or email address." }),
    ...pagingShape
  },
  unknownArgument
)

export const getClientInputSchema = z.strictObject(
  { clientId: recordId.meta({ description: "The client's id, from list_clients." }) },
  unknownArgument
)

export const listProjectsInputSchema = z.strictObject(
  {
    search: search.meta({ description: "Matches a project's name or its client's name." }),
    statuses: z
      .array(z.enum(projectStatus.enumValues, i18n.t("mcp.validation.statusInvalid")))
      .min(1, i18n.t("mcp.validation.statusInvalid"))
      .optional()
      .meta({ description: "Only projects in any of these stages." }),
    ...pagingShape
  },
  unknownArgument
)

export const getProjectInputSchema = z.strictObject(
  { projectId: recordId.meta({ description: "The project's id, from list_projects." }) },
  unknownArgument
)

export const listInvoicesInputSchema = z.strictObject(
  {
    search: search.meta({
      description: "Matches an invoice number, or the name of its project or client."
    }),
    statuses: z
      .array(z.enum(MCP_INVOICE_STATUSES, i18n.t("mcp.validation.statusInvalid")))
      .min(1, i18n.t("mcp.validation.statusInvalid"))
      .optional()
      .meta({
        description:
          "Only invoices in any of these states. `overdue` is a sent invoice past its due date and not paid; `partially_paid` has received some but not all of its total."
      }),
    clientId: recordId
      .optional()
      .meta({ description: "Only invoices for this client, directly or through a project." }),
    issuedFrom: day,
    issuedTo: day,
    dueFrom: day,
    dueTo: day,
    ...pagingShape
  },
  unknownArgument
)

export const getInvoiceInputSchema = z.strictObject(
  { invoiceId: recordId.meta({ description: "The invoice's id, from list_invoices." }) },
  unknownArgument
)

export const listTimeEntriesInputSchema = z.strictObject(
  {
    search: search.meta({
      description: "Matches an entry's description, or the name of its project or task."
    }),
    projectId: recordId.optional().meta({ description: "Only entries logged to this project." }),
    billable: flag.meta({
      description: "true for billable entries only, false for non-billable only."
    }),
    invoiced: flag.meta({
      description:
        "true for entries already billed onto an invoice, false for unbilled entries only."
    }),
    startedFrom: day,
    startedTo: day,
    ...pagingShape
  },
  unknownArgument
)

export const listExpensesInputSchema = z.strictObject(
  {
    search: search.meta({
      description:
        "Matches an expense's description or category, or the name of its project or client."
    }),
    projectId: recordId.optional().meta({ description: "Only expenses on this project." }),
    clientId: recordId.optional().meta({ description: "Only expenses for this client." }),
    rebillable: flag.meta({
      description: "true for expenses billed on to a client, false for the others."
    }),
    invoiced: flag.meta({
      description: "true for expenses already on an invoice, false for unbilled expenses only."
    }),
    spentFrom: day,
    spentTo: day,
    ...pagingShape
  },
  unknownArgument
)
