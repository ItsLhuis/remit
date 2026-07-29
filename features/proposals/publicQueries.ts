import { and, eq, isNull } from "drizzle-orm"

import { database } from "@/database"
import { clients, projects, proposals } from "@/database/schema"

import { listProposalLineItems, toProposalDetailLineItem } from "./queries"
import { publicProposalTokenSchema } from "./schemas"
import { canTransitionProposalStatus, isProposalExpired } from "./services"
import { matchesPublicToken } from "./services/publicProposalToken"
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

type ProjectContextRow = {
  projectName: string
  clientName: string
  clientEmail: string
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

  const [project, rows, issuer] = await Promise.all([
    findLiveProjectContext(proposal.projectId),
    listProposalLineItems(proposal.id),
    getProposalIssuer()
  ])

  if (!project) return null

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
    projectName: project.projectName,
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

  const [project, issuer] = await Promise.all([
    findLiveProjectContext(proposal.projectId),
    getProposalIssuer()
  ])

  if (!project) return null

  return {
    id: proposal.id,
    projectId: proposal.projectId,
    number: proposal.number,
    status: proposal.status,
    currency: proposal.currency,
    totalCents: Number(proposal.totalCents),
    recipientEmail: project.clientEmail,
    recipientName: project.clientName,
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

// A proposal is only reachable through a live project owned by a live client. Soft-deleting either
// must take the public link down with it, otherwise the client keeps a working URL to a document
// the freelancer has already retired.
async function findLiveProjectContext(projectId: string): Promise<ProjectContextRow | null> {
  const rows = await database
    .select({
      projectName: projects.name,
      clientName: clients.name,
      clientEmail: clients.email
    })
    .from(projects)
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt), isNull(clients.deletedAt)))
    .limit(1)

  return rows[0] ?? null
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
