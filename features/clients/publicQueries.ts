import { and, desc, eq, inArray, isNotNull, isNull, ne } from "drizzle-orm"

import { matchesPublicToken } from "@/lib/publicToken"

import { database } from "@/database"
import { clients, contracts, creditNotes, invoices, projects, proposals } from "@/database/schema"

import { computeInvoiceOutstandingAfterCredits } from "@/features/creditNotes"

import { deriveInvoiceStatusView } from "@/features/invoices"

import { isProposalExpired } from "@/features/proposals"

import { clientPortalTokenSchema } from "./schemas"
import { resolvePortalContractStatus, summarizePortalOutstanding } from "./services"
import {
  type ClientPortal,
  type ClientPortalContract,
  type ClientPortalCreditNote,
  type ClientPortalInvoice,
  type ClientPortalProject,
  type ClientPortalProposal
} from "./types"

// The anonymous read side of `/s/[token]`. It lives beside `queries.ts` rather than inside it
// because the public surface answers to a different contract — one indivisible "unavailable" result
// instead of the specific nulls the dashboard reads return — and because the portal resolves a token
// to a client and then has to decide, for every record that client owns, whether an anonymous holder
// of that link may see it.
//
// The portal is an index, not a document viewer: every row carries what identifies a document and
// what it is worth, and nothing else. Line items, notes, terms and signatures stay behind the
// document's own public route, where their exposure was already decided.
// [ADR-0030](../../docs/architecture/adr/0030-client-portal-exposure.md) records the rule and the
// field-by-field list it produced.

type PortalInvoiceRow = Awaited<ReturnType<typeof listPortalInvoiceRows>>[number]

type PortalProposalRow = Awaited<ReturnType<typeof listPortalProposalRows>>[number]

type PortalContractRow = Awaited<ReturnType<typeof listPortalContractRows>>[number]

type PortalProjectRow = Awaited<ReturnType<typeof listPortalProjectRows>>[number]

type PortalCreditNoteRow = Awaited<ReturnType<typeof listPortalCreditNoteRows>>[number]

type PortalIssuerContext = {
  name: string
  email: string | null
  locale: string
  timeZone: string
}

const PUBLIC_TOKEN_MISS_DECOY = "0".repeat(43)

// The exclusion list of this stage, expressed where Postgres enforces it rather than where a mapper
// could forget it. `clients.notes` is encrypted because it may carry NDA-protected content and never
// leaves the server on this path; the address, tax id, phone and negotiated hourly rate answer no
// question the recipient of the link is asking. `name` is the one identity field kept, so the holder
// can tell at a glance that they opened their own link.
const PORTAL_CLIENT_COLUMNS = {
  id: true,
  name: true,
  locale: true,
  portalToken: true
} as const

// Every unavailable case — malformed token, unknown token, a portal that was never enabled, one that
// was revoked, and a soft-deleted client — returns the same `null`, so the page renders one
// indivisible "unavailable" surface and a caller learns nothing about which of those it hit.
// Revocation and "never enabled" are already one state in the column (ADR-0029), so only the
// soft-delete case needs collapsing here.
export async function getClientPortal(input: unknown): Promise<ClientPortal | null> {
  const parsed = clientPortalTokenSchema.safeParse(input)

  if (!parsed.success) return null

  const client = await findClientByPortalToken(parsed.data.token)

  if (!client) return null

  const now = new Date()

  const [invoiceRows, proposalRows, contractRows, projectRows, issuer] = await Promise.all([
    listPortalInvoiceRows(client.id),
    listPortalProposalRows(client.id),
    listPortalContractRows(client.id),
    listPortalProjectRows(client.id),
    getPortalIssuerContext()
  ])

  const creditNotesByInvoice = groupCreditNotesByInvoice(
    await listPortalCreditNoteRows(invoiceRows.map((row) => row.id))
  )

  const liveProjectIds = new Set(projectRows.map((row) => row.id))

  const portalInvoices = invoiceRows.map((row) =>
    toPortalInvoice(row, creditNotesByInvoice.get(row.id) ?? [], now)
  )

  return {
    clientName: client.name,
    issuer: { name: issuer.name, email: issuer.email },
    // The client's own locale wins over the instance default, because this page is read by that
    // client and ARCHITECTURE.md section 15 makes `clients.locale` the document locale. The time
    // zone stays the instance's: it is where the business books its dates, and a due date that moved
    // because the reader is travelling would be a different due date.
    locale: client.locale ?? issuer.locale,
    timeZone: issuer.timeZone,
    outstanding: summarizePortalOutstanding(portalInvoices),
    invoices: portalInvoices,
    proposals: proposalRows.map((row) => toPortalProposal(row, liveProjectIds, now)),
    contracts: contractRows.map((row) => toPortalContract(row, now)),
    projects: projectRows.map(toPortalProject)
  }
}

// The partial unique index on `clients.portal_token` finds the candidate row; `matchesPublicToken` is
// what actually admits it. The compare runs on every call, against a decoy when the lookup missed, so
// a miss and a hit spend the same work here and the branch cannot be timed apart. The decoy is the
// length of a real token and cannot collide with one — `randomBytes(32)` would have to return 32
// zero bytes to encode as 43 zeros.
//
// `softDeleteClient` clears the token, so a client archived since ADR-0029 shipped is already
// unreachable by the lookup. The `deleted_at` guard covers the rows archived before it did, and is
// what stops a restored portal from reappearing on a record the owner believes is gone.
async function findClientByPortalToken(token: string) {
  const client = await database.query.clients.findFirst({
    where: and(eq(clients.portalToken, token), isNull(clients.deletedAt)),
    columns: PORTAL_CLIENT_COLUMNS
  })

  const tokenMatches = matchesPublicToken(token, client?.portalToken ?? PUBLIC_TOKEN_MISS_DECOY)

  if (!client || !tokenMatches) return null

  return client
}

// `chk_invoices_project_requires_client` guarantees that a project-parented invoice also names its
// client, so filtering on `client_id` alone reaches every invoice raised for this client and cannot
// reach another's. A draft is withheld for the same reason `/i/[token]` withholds it: it has never
// been sent and its number may still change.
async function listPortalInvoiceRows(clientId: string) {
  return database.query.invoices.findMany({
    where: and(
      eq(invoices.clientId, clientId),
      isNull(invoices.deletedAt),
      ne(invoices.status, "draft")
    ),
    columns: {
      id: true,
      number: true,
      status: true,
      currency: true,
      totalCents: true,
      amountPaidCents: true,
      issueDate: true,
      dueDate: true,
      paidAt: true,
      publicToken: true
    },
    orderBy: desc(invoices.createdAt)
  })
}

// `issued_at` is the boundary SCHEMA.md records for a proposal token: it is minted at draft creation
// and does not exist as far as any reader is concerned until the proposal is issued. The portal
// honours the same line.
async function listPortalProposalRows(clientId: string) {
  return database.query.proposals.findMany({
    where: and(
      eq(proposals.clientId, clientId),
      isNull(proposals.deletedAt),
      isNotNull(proposals.issuedAt)
    ),
    columns: {
      number: true,
      status: true,
      currency: true,
      totalCents: true,
      issuedAt: true,
      validUntil: true,
      projectId: true,
      publicToken: true
    },
    orderBy: desc(proposals.createdAt)
  })
}

async function listPortalContractRows(clientId: string) {
  return database.query.contracts.findMany({
    where: and(
      eq(contracts.clientId, clientId),
      isNull(contracts.deletedAt),
      isNotNull(contracts.issuedAt)
    ),
    columns: {
      number: true,
      title: true,
      status: true,
      issuedAt: true,
      effectiveFrom: true,
      effectiveUntil: true
    },
    orderBy: desc(contracts.createdAt)
  })
}

// The budget, the hourly rate and the description are deliberately absent. A budget is a number the
// freelancer chose and may never have quoted, and the description is working notes written in a tool
// the client was not expected to read; what a client asks of a project list is what is running and
// when it runs until.
async function listPortalProjectRows(clientId: string) {
  return database.query.projects.findMany({
    where: and(eq(projects.clientId, clientId), isNull(projects.deletedAt)),
    columns: {
      id: true,
      name: true,
      status: true,
      startDate: true,
      endDate: true
    },
    orderBy: desc(projects.createdAt)
  })
}

// Keyed on the invoice ids already narrowed to this client, so a credit note cannot arrive from
// anywhere else. `reason` is left behind: it is free text the freelancer wrote per correction, and
// the client already has it on the credit note itself.
async function listPortalCreditNoteRows(invoiceIds: string[]) {
  if (invoiceIds.length === 0) return []

  return database.query.creditNotes.findMany({
    where: and(inArray(creditNotes.invoiceId, invoiceIds), isNull(creditNotes.deletedAt)),
    columns: {
      invoiceId: true,
      number: true,
      issuedAt: true,
      totalCents: true
    },
    orderBy: desc(creditNotes.issuedAt)
  })
}

async function getPortalIssuerContext(): Promise<PortalIssuerContext> {
  const row = await database.query.settings.findFirst({
    columns: {
      businessName: true,
      businessEmail: true,
      defaultLocale: true,
      defaultTimezone: true
    }
  })

  return {
    name: row?.businessName ?? "",
    email: row?.businessEmail ?? null,
    locale: row?.defaultLocale ?? "en",
    timeZone: row?.defaultTimezone ?? "UTC"
  }
}

function groupCreditNotesByInvoice(
  rows: PortalCreditNoteRow[]
): Map<string, ClientPortalCreditNote[]> {
  const grouped = new Map<string, ClientPortalCreditNote[]>()

  for (const row of rows) {
    const existing = grouped.get(row.invoiceId)
    const creditNote = toPortalCreditNote(row)

    if (existing) {
      existing.push(creditNote)
    } else {
      grouped.set(row.invoiceId, [creditNote])
    }
  }

  return grouped
}

function toPortalInvoice(
  row: PortalInvoiceRow,
  creditNotes: ClientPortalCreditNote[],
  now: Date
): ClientPortalInvoice {
  const amounts = {
    status: row.status,
    dueDate: row.dueDate,
    paidAt: row.paidAt,
    amountPaidCents: Number(row.amountPaidCents),
    totalCents: Number(row.totalCents)
  }

  return {
    number: row.number,
    viewStatus: deriveInvoiceStatusView(amounts, now),
    currency: row.currency,
    totalCents: amounts.totalCents,
    amountPaidCents: amounts.amountPaidCents,
    // Credit-aware, unlike `/i/[token]`'s own figure: this row prints the credit notes immediately
    // beneath the amount, so an outstanding total that ignored them would contradict itself on one
    // line. `computeInvoiceOutstandingAfterCredits` is the same helper the owner's invoice screen
    // uses (services/effectiveReceivable.ts), and it is what `summarizePortalOutstanding` then adds
    // up per currency.
    outstandingCents: computeInvoiceOutstandingAfterCredits(
      amounts,
      creditNotes.map((creditNote) => creditNote.totalCents)
    ),
    issueDate: row.issueDate,
    dueDate: row.dueDate,
    // Every invoice this read returns is one `/i/[token]` itself admits — not deleted, not a draft —
    // so a live token is the only remaining condition. A revoked one leaves the row visible and the
    // link absent, which is the withdrawal the owner asked for.
    documentPath: row.publicToken ? `/i/${row.publicToken}` : null,
    creditNotes
  }
}

function toPortalCreditNote(row: PortalCreditNoteRow): ClientPortalCreditNote {
  return {
    number: row.number,
    issuedAt: row.issuedAt,
    totalCents: Number(row.totalCents)
  }
}

// The link condition restates what `getPublicProposal` admits, rather than approximating it: an
// expired pending proposal and one hanging off an archived project both answer "unavailable" at
// `/p/[token]`, so offering the link here would send the client to a dead end. The row still shows,
// carrying its status, because the client was sent that proposal and its outcome is part of their
// history.
function toPortalProposal(
  row: PortalProposalRow,
  liveProjectIds: ReadonlySet<string>,
  now: Date
): ClientPortalProposal {
  const isReachable =
    Boolean(row.publicToken) &&
    !(row.status === "sent" && isProposalExpired(row.validUntil, now)) &&
    (!row.projectId || liveProjectIds.has(row.projectId))

  return {
    number: row.number,
    status: row.status,
    currency: row.currency,
    totalCents: Number(row.totalCents),
    issuedAt: row.issuedAt,
    validUntil: row.validUntil,
    documentPath: isReachable && row.publicToken ? `/p/${row.publicToken}` : null
  }
}

// A contract is the one document the portal lists without an opener, and `contracts.public_token` is
// therefore never read on this path at all. `/c/[token]` binds the client on a name and an address
// the signer types in themselves, with no second factor, while `/p/[token]` sends an OTP to an
// address the instance already knows and `/i/[token]` only displays. Putting the one unauthenticated
// signature in the repository behind a link that may be forwarded, pinned or shared inside the
// client's own organisation would widen who can commit them, so the portal reports where each
// agreement stands and leaves signing to the link that was sent to a person.
function toPortalContract(row: PortalContractRow, now: Date): ClientPortalContract {
  return {
    number: row.number,
    title: row.title,
    status: resolvePortalContractStatus(row.status, row.effectiveUntil, now),
    issuedAt: row.issuedAt,
    effectiveFrom: row.effectiveFrom,
    effectiveUntil: row.effectiveUntil
  }
}

function toPortalProject(row: PortalProjectRow): ClientPortalProject {
  return {
    name: row.name,
    status: row.status,
    startDate: row.startDate,
    endDate: row.endDate
  }
}
