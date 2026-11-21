import { and, desc, eq, isNull } from "drizzle-orm"

import { matchesPublicToken } from "@/lib/publicToken"

import { database } from "@/database"
import { clients, creditNotes, invoices, projects } from "@/database/schema"

import { getPublicPaymentBlock } from "@/features/settings/server"

import { listInvoiceLineItems, toInvoiceDetailLineItem } from "./queries"
import { readInvoiceCreditedCents } from "./queryFragments"
import { publicInvoiceTokenSchema } from "./schemas"
import { deriveInvoiceStatusView, getInvoiceOutstandingCents } from "./services"
import { type PublicInvoice, type PublicInvoiceCreditNote, type PublicInvoiceIssuer } from "./types"

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
  creditedCents: number
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

  const [preparedFor, rows, context, payment, credits] = await Promise.all([
    findInvoiceParentLabel(invoice),
    listInvoiceLineItems(invoice.id),
    getInvoiceIssuerContext(),
    getPublicPaymentBlock(),
    listPublicInvoiceCreditNotes(invoice.id)
  ])

  const amounts = {
    status: invoice.status,
    dueDate: invoice.dueDate,
    paidAt: invoice.paidAt,
    amountPaidCents: Number(invoice.amountPaidCents),
    totalCents: Number(invoice.totalCents),
    creditedCents: credits.reduce((total, creditNote) => total + creditNote.totalCents, 0)
  }

  return {
    number: invoice.number,
    status: invoice.status,
    viewStatus: deriveInvoiceStatusView(amounts, new Date()),
    currency: invoice.currency,
    subtotalCents: Number(invoice.subtotalCents),
    discountAmountTotalCents: Number(invoice.discountAmountTotalCents),
    taxAmountCents: Number(invoice.taxAmountCents),
    lateFeeCents: invoice.lateFeeCents,
    totalCents: amounts.totalCents,
    amountPaidCents: amounts.amountPaidCents,
    creditedCents: amounts.creditedCents,
    // The same definition the client portal prints for this invoice and the one hosted checkout
    // charges, so the page, the portal and the card agree on what is owed.
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
    lineItems: rows.map(toInvoiceDetailLineItem),
    creditNotes: credits
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
    amountPaidCents: Number(invoice.amountPaidCents),
    creditedCents: await readInvoiceCreditedCents(invoice.id)
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

// The number, date and amount of each live credit note — what the client portal shows for the same
// invoice and what the client already holds on the credit note itself. No id and no `reason`: the
// page is anonymous, and the reason is free text the freelancer wrote per correction.
async function listPublicInvoiceCreditNotes(invoiceId: string): Promise<PublicInvoiceCreditNote[]> {
  const rows = await database.query.creditNotes.findMany({
    where: and(eq(creditNotes.invoiceId, invoiceId), isNull(creditNotes.deletedAt)),
    columns: { number: true, issuedAt: true, totalCents: true },
    orderBy: desc(creditNotes.issuedAt)
  })

  return rows.map((row) => ({
    number: row.number,
    issuedAt: row.issuedAt,
    totalCents: Number(row.totalCents)
  }))
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
