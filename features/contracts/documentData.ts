import { and, eq, isNull } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { database } from "@/database"
import { clients, contracts, projects } from "@/database/schema"

import { getClientDocumentRecipient } from "@/features/clients/server"

import { type TemplateRenderData } from "@/features/templates"

import { type ContractStatus } from "./schemas"
import { buildContractRenderData, type ContractRenderClient } from "./services"

// The contract's merge data for its outbound email. It is assembled here rather than reused from
// `publicDocument.ts` because that file answers a different question — it renders the contract body
// a signer reads, and needs blocks, page settings and inlined assets to do it. The email needs only
// the values, so it gathers them directly instead of paying for a document render it would discard.

export type ContractDocumentData = {
  renderData: TemplateRenderData
  number: string
  publicToken: string
  businessName: string
  recipientEmail: string | null
  recipientName: string
}

export async function buildContractDocumentData(
  contractId: string
): Promise<ContractDocumentData | null> {
  const contract = await database.query.contracts.findFirst({
    where: and(eq(contracts.id, contractId), isNull(contracts.deletedAt))
  })

  if (!contract) return null

  const clientId = contract.clientId ?? (await getProjectClientId(contract.projectId))

  const [instance, client, recipient] = await Promise.all([
    database.query.settings.findFirst(),
    getContractClient(clientId),
    getClientDocumentRecipient(clientId)
  ])

  const renderData = buildContractRenderData({
    contract: {
      number: contract.number,
      title: contract.title,
      effectiveFrom: contract.effectiveFrom,
      effectiveUntil: contract.effectiveUntil,
      issuedAt: contract.issuedAt,
      terminationReason: contract.terminationReason
    },
    client,
    business: {
      name: instance?.businessName ?? null,
      email: instance?.businessEmail ?? null,
      phone: instance?.businessPhone ?? null,
      website: instance?.businessWebsite ?? null,
      taxId: instance?.businessTaxId ?? null,
      addressLine1: instance?.businessAddressLine1 ?? null,
      addressLine2: instance?.businessAddressLine2 ?? null,
      city: instance?.businessCity ?? null,
      state: instance?.businessState ?? null,
      postalCode: instance?.businessPostalCode ?? null,
      country: instance?.businessCountry ?? null
    },
    statusLabel: getContractStatusLabel(contract.status),
    locale: instance?.defaultLocale ?? "en"
  })

  return {
    renderData,
    number: contract.number,
    publicToken: contract.publicToken,
    businessName: instance?.businessName ?? "Remit",
    // The envelope address only. `renderData` still names the client, because the document is issued
    // to the company; where it is delivered is a separate question, answered by the client's primary
    // contact when it has one and by `clients.email` otherwise (ADR-0027).
    recipientEmail: recipient?.email ?? null,
    recipientName: recipient?.name ?? ""
  }
}

async function getContractClient(clientId: string | null): Promise<ContractRenderClient | null> {
  if (!clientId) return null

  const client = await database.query.clients.findFirst({
    where: and(eq(clients.id, clientId), isNull(clients.deletedAt))
  })

  if (!client) return null

  return {
    name: client.name,
    email: client.email,
    phone: client.phone,
    website: client.website,
    taxId: client.taxId,
    addressLine1: client.addressLine1,
    addressLine2: client.addressLine2,
    city: client.city,
    state: client.state,
    postalCode: client.postalCode,
    country: client.country,
    currency: client.currency
  }
}

async function getProjectClientId(projectId: string | null): Promise<string | null> {
  if (!projectId) return null

  const project = await database.query.projects.findFirst({
    columns: { clientId: true },
    where: eq(projects.id, projectId)
  })

  return project?.clientId ?? null
}

function getContractStatusLabel(status: ContractStatus): string {
  switch (status) {
    case "draft":
      return t("contracts.status.draft")
    case "sent":
      return t("contracts.status.sent")
    case "signed":
      return t("contracts.status.signed")
    case "expired":
      return t("contracts.status.expired")
    case "terminated":
      return t("contracts.status.terminated")
  }
}
