import { and, eq, isNull } from "drizzle-orm"

import { matchesPublicToken } from "@/lib/publicToken"

import { database } from "@/database"
import { clients, projects, proposals } from "@/database/schema"

import { listClientRecipientIdentities } from "@/features/clients/server"

import { listProposalLineItems, toProposalDetailLineItem } from "./queries"
import { publicProposalTokenSchema } from "./schemas"
import { canTransitionProposalStatus, isProposalExpired } from "./services"
import {
  type ProposalResponseTarget,
  type PublicProposal,
  type PublicProposalIssuer
} from "./types"

// The anonymous read side of `/p/[token]`, paired with the write side in `publicResponse.ts`. It
// lives beside `queries.ts` rather than inside it because the public surface answers to a different
// contract — one indivisible "unavailable" result instead of the specific nulls the dashboard reads
// return — and because `queries.ts` is already at the file-length ceiling.

type ProposalRow = typeof proposals.$inferSelect

// The recipient side of a proposal, whichever parent it hangs off. `preparedForLabel` is the
// project's name for a project-level proposal and the client's for a client-level one.
type ProposalRecipientContext = {
  preparedForLabel: string
  clientId: string
}

type ProposalIssuerContext = {
  issuer: PublicProposalIssuer
  locale: string
  timeZone: string
}

const PUBLIC_TOKEN_MISS_DECOY = "0".repeat(43)

// Every unavailable case — malformed token, unknown token, soft-deleted proposal, dead project or
// client, a proposal never sent, and a still-pending proposal past its validity window — returns
// the same `null`, so the page renders one indivisible "unavailable" surface and a caller learns
// nothing about which of those it hit.
export async function getPublicProposal(input: unknown): Promise<PublicProposal | null> {
  const parsed = publicProposalTokenSchema.safeParse(input)

  if (!parsed.success) return null

  const proposal = await findProposalByPublicToken(parsed.data.token)

  if (!proposal?.issuedAt) return null

  if (proposal.status === "sent" && isProposalExpired(proposal.validUntil, new Date())) return null

  const [recipient, rows, issuer] = await Promise.all([
    findLiveRecipientContext(proposal),
    listProposalLineItems(proposal.id),
    getProposalIssuer()
  ])

  if (!recipient) return null

  return {
    number: proposal.number,
    status: proposal.status,
    currency: proposal.currency,
    subtotalCents: Number(proposal.subtotalCents),
    discountAmountTotalCents: Number(proposal.discountAmountTotalCents),
    taxAmountCents: Number(proposal.taxAmountCents),
    totalCents: Number(proposal.totalCents),
    validUntil: proposal.validUntil,
    notes: proposal.notes ?? "",
    issuedAt: proposal.issuedAt,
    respondedAt: proposal.respondedAt,
    rejectionReason: proposal.rejectionReason ?? "",
    preparedForLabel: recipient.preparedForLabel,
    issuer: issuer.issuer,
    locale: issuer.locale,
    timeZone: issuer.timeZone,
    canRespond: canTransitionProposalStatus(proposal.status, "accepted").allowed,
    lineItems: rows.map(toProposalDetailLineItem)
  }
}

// The server-side counterpart of `getPublicProposal`, carrying the two facts the public read model
// must never leak: the proposal's id and the client's email address. Only `publicResponse.ts` reads
// it, so it is exported from neither `index.ts` nor `server.ts`.
export async function getProposalResponseTarget(
  token: string
): Promise<ProposalResponseTarget | null> {
  const proposal = await findProposalByPublicToken(token)

  if (!proposal?.issuedAt) return null

  if (proposal.status === "sent" && isProposalExpired(proposal.validUntil, new Date())) return null

  const [recipient, issuer] = await Promise.all([
    findLiveRecipientContext(proposal),
    getProposalIssuer()
  ])

  if (!recipient) return null

  return {
    id: proposal.id,
    projectId: proposal.projectId,
    number: proposal.number,
    status: proposal.status,
    currency: proposal.currency,
    totalCents: Number(proposal.totalCents),
    respondents: await listClientRecipientIdentities(recipient.clientId),
    issuerName: issuer.issuer.name,
    locale: issuer.locale
  }
}

// The index on `proposals.public_token` finds the candidate row; `matchesPublicToken` is what
// actually admits it. The compare runs on every call, against a decoy when the lookup missed, so a
// miss and a hit spend the same work here and the branch cannot be timed apart. The decoy is the
// length of a real token and cannot collide with one — `randomBytes(32)` would have to return 32
// zero bytes to encode as 43 zeros.
async function findProposalByPublicToken(token: string): Promise<ProposalRow | null> {
  const proposal = await database.query.proposals.findFirst({
    where: and(eq(proposals.publicToken, token), isNull(proposals.deletedAt))
  })

  const tokenMatches = matchesPublicToken(token, proposal?.publicToken ?? PUBLIC_TOKEN_MISS_DECOY)

  if (!proposal || !tokenMatches) return null

  return proposal
}

// A public proposal needs a live client behind it: the OTP flow checks the responder's address
// against that client's own address and its live contacts, so a proposal whose client has been
// soft-deleted has nobody who may answer it and its link goes down. A project-level proposal
// additionally needs its project live — soft-deleting the project retires the work, and the client
// must not keep a working URL to it.
async function findLiveRecipientContext(
  proposal: ProposalRow
): Promise<ProposalRecipientContext | null> {
  if (proposal.projectId) {
    const rows = await database
      .select({
        preparedForLabel: projects.name,
        clientId: clients.id
      })
      .from(projects)
      .innerJoin(clients, eq(clients.id, projects.clientId))
      .where(
        and(
          eq(projects.id, proposal.projectId),
          isNull(projects.deletedAt),
          isNull(clients.deletedAt)
        )
      )
      .limit(1)

    return rows[0] ?? null
  }

  if (!proposal.clientId) return null

  const client = await database.query.clients.findFirst({
    where: and(eq(clients.id, proposal.clientId), isNull(clients.deletedAt)),
    columns: { id: true, name: true }
  })

  if (!client) return null

  return { preparedForLabel: client.name, clientId: client.id }
}

async function getProposalIssuer(): Promise<ProposalIssuerContext> {
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
