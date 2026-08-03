import { and, eq, isNull } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { matchesPublicToken } from "@/lib/publicToken"

import { database } from "@/database"
import { clients, contracts, projects } from "@/database/schema"

import { renderContractDocument } from "./publicDocument"
import { publicContractTokenSchema } from "./schemas"
import {
  resolveContractDisplayStatus,
  type ContractRenderBusiness,
  type ContractRenderClient
} from "./services"
import { type ContractSigningTarget, type PublicContract, type PublicContractIssuer } from "./types"

// The anonymous read side of `/c/[token]`, paired with the write side in `publicSigning.ts`. It
// lives beside `queries.ts` rather than inside it because the public surface answers to a different
// contract — one indivisible "unavailable" result instead of the specific nulls the dashboard reads
// return.

type ContractRow = typeof contracts.$inferSelect

type ContractIssuerContext = {
  issuer: PublicContractIssuer
  business: ContractRenderBusiness
  locale: string
  timeZone: string
}

const PUBLIC_TOKEN_MISS_DECOY = "0".repeat(43)

const CONTRACT_CLIENT_COLUMNS = {
  name: true,
  email: true,
  phone: true,
  website: true,
  taxId: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  state: true,
  postalCode: true,
  country: true,
  currency: true
} as const

// Every unavailable case — malformed token, unknown token, soft-deleted contract, a contract never
// sent, and one already signed, terminated, or past its effective window — returns the same `null`,
// so the page renders one indivisible "unavailable" surface and a caller learns nothing about which
// of those it hit.
export async function getPublicContract(input: unknown): Promise<PublicContract | null> {
  const parsed = publicContractTokenSchema.safeParse(input)

  if (!parsed.success) return null

  const contract = await findSignableContractByToken(parsed.data.token)

  if (!contract?.issuedAt) return null

  const [client, context] = await Promise.all([
    findContractClient(contract),
    getContractIssuerContext()
  ])

  const document = await renderContractDocument(contract, client, context)

  return {
    number: contract.number,
    title: contract.title,
    status: contract.status,
    issuedAt: contract.issuedAt,
    effectiveFrom: contract.effectiveFrom,
    effectiveUntil: contract.effectiveUntil,
    clientName: client?.name ?? "",
    document,
    consentText: getContractConsentText(contract.number, context.issuer.name),
    issuer: context.issuer,
    locale: context.locale,
    timeZone: context.timeZone
  }
}

export async function getContractSigningTarget(
  input: unknown
): Promise<ContractSigningTarget | null> {
  const parsed = publicContractTokenSchema.safeParse(input)

  if (!parsed.success) return null

  const contract = await findSignableContractByToken(parsed.data.token)

  if (!contract?.issuedAt) return null

  const context = await getContractIssuerContext()

  return {
    id: contract.id,
    projectId: contract.projectId,
    clientId: contract.clientId,
    number: contract.number,
    status: contract.status,
    consentText: getContractConsentText(contract.number, context.issuer.name)
  }
}

// The single derivation point for the wording a signer agrees to. Both the page that displays it
// and the route that snapshots it into `contract_signatures.consent_text` call this, so the legal
// record cannot drift from what was on screen — and the client never gets to supply the text.
function getContractConsentText(number: string, issuerName: string): string {
  return t("contracts.public.consent.text", { number, issuer: issuerName })
}

// The unique index on `contracts.public_token` finds the candidate row; `matchesPublicToken` is what
// actually admits it. The compare runs on every call, against a decoy when the lookup missed, so a
// miss and a hit spend the same work here and the branch cannot be timed apart. The decoy is the
// length of a real token and cannot collide with one — `randomBytes(32)` would have to return 32
// zero bytes to encode as 43 zeros.
//
// The display status is what gates availability, not the stored one: a `sent` contract whose
// effective window has already closed reads as `expired` and must be as unreachable as a signed one.
async function findSignableContractByToken(token: string): Promise<ContractRow | null> {
  const contract = await database.query.contracts.findFirst({
    where: and(eq(contracts.publicToken, token), isNull(contracts.deletedAt))
  })

  const tokenMatches = matchesPublicToken(token, contract?.publicToken ?? PUBLIC_TOKEN_MISS_DECOY)

  if (!contract || !tokenMatches) return null

  const displayStatus = resolveContractDisplayStatus(
    contract.status,
    contract.effectiveUntil,
    new Date()
  )

  return displayStatus === "sent" ? contract : null
}

// A contract carries either a client of its own or a project whose client it inherits
// (`chk_contracts_parent`), and both links are `ON DELETE SET NULL`, so a live contract may have
// neither. Unlike a proposal, that does not take the public link down: the document was issued and
// stays signable regardless of what happened to the records around it.
async function findContractClient(contract: ContractRow): Promise<ContractRenderClient | null> {
  if (contract.clientId) {
    const row = await database.query.clients.findFirst({
      where: and(eq(clients.id, contract.clientId), isNull(clients.deletedAt)),
      columns: CONTRACT_CLIENT_COLUMNS
    })

    return row ?? null
  }

  if (!contract.projectId) return null

  const rows = await database
    .select({
      name: clients.name,
      email: clients.email,
      phone: clients.phone,
      website: clients.website,
      taxId: clients.taxId,
      addressLine1: clients.addressLine1,
      addressLine2: clients.addressLine2,
      city: clients.city,
      state: clients.state,
      postalCode: clients.postalCode,
      country: clients.country,
      currency: clients.currency
    })
    .from(projects)
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(and(eq(projects.id, contract.projectId), isNull(clients.deletedAt)))
    .limit(1)

  return rows[0] ?? null
}

async function getContractIssuerContext(): Promise<ContractIssuerContext> {
  const row = await database.query.settings.findFirst({
    columns: {
      businessName: true,
      businessEmail: true,
      businessPhone: true,
      businessWebsite: true,
      businessTaxId: true,
      businessAddressLine1: true,
      businessAddressLine2: true,
      businessCity: true,
      businessState: true,
      businessPostalCode: true,
      businessCountry: true,
      defaultLocale: true,
      defaultTimezone: true
    }
  })

  return {
    issuer: { name: row?.businessName ?? "", email: row?.businessEmail ?? null },
    business: {
      name: row?.businessName ?? null,
      email: row?.businessEmail ?? null,
      phone: row?.businessPhone ?? null,
      website: row?.businessWebsite ?? null,
      taxId: row?.businessTaxId ?? null,
      addressLine1: row?.businessAddressLine1 ?? null,
      addressLine2: row?.businessAddressLine2 ?? null,
      city: row?.businessCity ?? null,
      state: row?.businessState ?? null,
      postalCode: row?.businessPostalCode ?? null,
      country: row?.businessCountry ?? null
    },
    locale: row?.defaultLocale ?? "en",
    timeZone: row?.defaultTimezone ?? "UTC"
  }
}
