import { and, eq, isNull } from "drizzle-orm"

import { matchesPublicToken } from "@/lib/publicToken"

import { database } from "@/database"
import { clients, invoices, projects } from "@/database/schema"

import { getPublicPaymentBlock } from "@/features/settings/server"

import { listInvoiceLineItems, toInvoiceDetailLineItem } from "./queries"
import { publicInvoiceTokenSchema } from "./schemas"
import { deriveInvoiceStatusView, getInvoiceOutstandingCents } from "./services"
import { type PublicInvoice, type PublicInvoiceIssuer } from "./types"

// The anonymous read side of `/i/[token]`, paired with the view-tracking write in `publicView.ts`.
// It lives beside `queries.ts` rather than inside it because the public surface answers to a
// different contract — one indivisible "unavailable" result instead of the specific nulls the
// dashboard reads return — and because `queries.ts` is already at the file-length ceiling.

type InvoiceRow = typeof invoices.$inferSelect

type InvoiceIssuerContext = {
  issuer: PublicInvoiceIssuer
  locale: string
  timeZone: string
}

export type PublicInvoiceCheckoutTarget = {
  id: string
  number: string
  status: InvoiceRow["status"]
  currency: string
  totalCents: number
  amountPaidCents: number
}

const PUBLIC_TOKEN_MISS_DECOY = "0".repeat(43)

// Every unavailable case — malformed token, unknown token, soft-deleted invoice, and an invoice
// still in draft — returns the same `null`, so the page renders one indivisible "unavailable"
// surface and a caller learns nothing about which of those it hit.
export async function getPublicInvoice(input: unknown): Promise<PublicInvoice | null> {
  const parsed = publicInvoiceTokenSchema.safeParse(input)

  if (!parsed.success) return null

  const invoice = await findIssuedInvoiceByPublicToken(parsed.data.token)

  if (!invoice) return null

  const [preparedFor, rows, context, payment] = await Promise.all([
    findInvoiceParentLabel(invoice),
    listInvoiceLineItems(invoice.id),
    getInvoiceIssuerContext(),
    getPublicPaymentBlock()
  ])

  const amounts = {
    status: invoice.status,
    dueDate: invoice.dueDate,
    paidAt: invoice.paidAt,
    amountPaidCents: Number(invoice.amountPaidCents),
    totalCents: Number(invoice.totalCents)
  }

  return {
    number: invoice.number,
    status: invoice.status,
    viewStatus: deriveInvoiceStatusView(amounts, new Date()),
    currency: invoice.currency,
    subtotalCents: Number(invoice.subtotalCents),
    discountAmountTotalCents: Number(invoice.discountAmountTotalCents),
    taxAmountCents: Number(invoice.taxAmountCents),
    totalCents: amounts.totalCents,
    amountPaidCents: amounts.amountPaidCents,
    outstandingCents: getInvoiceOutstandingCents(amounts),
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    paidAt: invoice.paidAt,
    notes: invoice.notes ?? "",
    preparedFor,
    issuer: context.issuer,
    locale: context.locale,
    timeZone: context.timeZone,
    payment: {
      bankName: payment.bankName,
      ibanDisplay: payment.paymentIbanDisplay,
      instructions: payment.paymentInstructions,
      hasBankTransferDetails: payment.hasBankTransferDetails,
      stripeConfigured: payment.stripeConfigured
    },
    lineItems: rows.map(toInvoiceDetailLineItem)
  }
}

// What `features/payments/stripeCheckout.ts` needs to open a Checkout Session, and nothing more: no
// token, no notes, no line items. It resolves through `findIssuedInvoiceByPublicToken`, the same
// function `getPublicInvoice` above uses, so an invoice that is not publicly viewable can never be
// publicly payable — there is one definition of visibility and both reads share it.
export async function getPublicInvoiceCheckoutTarget(
  input: unknown
): Promise<PublicInvoiceCheckoutTarget | null> {
  const parsed = publicInvoiceTokenSchema.safeParse(input)

  if (!parsed.success) return null

  const invoice = await findIssuedInvoiceByPublicToken(parsed.data.token)

  if (!invoice) return null

  return {
    id: invoice.id,
    number: invoice.number,
    status: invoice.status,
    currency: invoice.currency,
    totalCents: Number(invoice.totalCents),
    amountPaidCents: Number(invoice.amountPaidCents)
  }
}

// The unique index on `invoices.public_token` finds the candidate row; `matchesPublicToken` is what
// actually admits it. The compare runs on every call, against a decoy when the lookup missed, so a
// miss and a hit spend the same work here and the branch cannot be timed apart. The decoy is the
// length of a real token and cannot collide with one — `randomBytes(32)` would have to return 32
// zero bytes to encode as 43 zeros.
//
// The status is what gates availability, not `issueDate`: a draft may already carry an issue date
// entered in the form, and a draft is a document the client is not meant to have seen.
async function findIssuedInvoiceByPublicToken(token: string): Promise<InvoiceRow | null> {
  const invoice = await database.query.invoices.findFirst({
    where: and(eq(invoices.publicToken, token), isNull(invoices.deletedAt))
  })

  const tokenMatches = matchesPublicToken(token, invoice?.publicToken ?? PUBLIC_TOKEN_MISS_DECOY)

  if (!invoice || !tokenMatches) return null

  return invoice.status === "draft" ? null : invoice
}

// `chk_invoices_parent` guarantees a project or a client, and both links are `ON DELETE SET NULL`,
// so this is best-effort and may end up empty. Unlike a proposal, an archived parent does not take
// the public link down: a sent invoice is a demand for payment and has to stay payable whatever
// happened to the project it was raised from.
async function findInvoiceParentLabel(invoice: InvoiceRow): Promise<string> {
  if (invoice.projectId) {
    const project = await database.query.projects.findFirst({
      where: and(eq(projects.id, invoice.projectId), isNull(projects.deletedAt)),
      columns: { name: true }
    })

    if (project) return project.name
  }

  if (!invoice.clientId) return ""

  const client = await database.query.clients.findFirst({
    where: and(eq(clients.id, invoice.clientId), isNull(clients.deletedAt)),
    columns: { name: true }
  })

  return client?.name ?? ""
}

async function getInvoiceIssuerContext(): Promise<InvoiceIssuerContext> {
  const row = await database.query.settings.findFirst({
    columns: {
      businessName: true,
      businessEmail: true,
      defaultLocale: true,
      defaultTimezone: true
    }
  })

  return {
    issuer: { name: row?.businessName ?? "", email: row?.businessEmail ?? null },
    locale: row?.defaultLocale ?? "en",
    timeZone: row?.defaultTimezone ?? "UTC"
  }
}
