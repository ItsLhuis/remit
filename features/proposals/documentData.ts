import { and, asc, eq, isNull } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { database } from "@/database"
import { clients, lineItems, projects, proposals } from "@/database/schema"

import { getClientDocumentRecipient } from "@/features/clients/server"

import { type TemplateRenderData } from "@/features/templates"

import { type ProposalStatus } from "./schemas"
import {
  buildProposalRenderData,
  type ProposalRenderClient,
  type ProposalRenderLineItem
} from "./services"

// One assembly of a proposal's merge data, shared by the PDF builder and the email job, so the
// message cannot disagree with the attachment it carries. See `features/invoices/documentData.ts`
// for the reasoning; this is the same shape for a document that takes no payment.

export type ProposalDocumentData = {
  renderData: TemplateRenderData
  number: string
  currency: string
  locale: string
  totalCents: number
  // Null once the link has been revoked; every caller building a URL has to say what it does then.
  publicToken: string | null
  businessName: string
  templateId: string | null
  recipientEmail: string | null
  recipientName: string
}

export async function buildProposalDocumentData(
  proposalId: string
): Promise<ProposalDocumentData | null> {
  const proposal = await database.query.proposals.findFirst({
    where: and(eq(proposals.id, proposalId), isNull(proposals.deletedAt))
  })

  if (!proposal) return null

  const clientId = proposal.clientId ?? (await getProjectClientId(proposal.projectId))

  const [instance, client, recipient, items] = await Promise.all([
    database.query.settings.findFirst(),
    getProposalClient(clientId),
    getClientDocumentRecipient(clientId),
    getProposalLineItems(proposalId)
  ])

  const locale = instance?.defaultLocale ?? "en"

  const renderData = buildProposalRenderData({
    proposal: {
      number: proposal.number,
      currency: proposal.currency,
      subtotalCents: Number(proposal.subtotalCents),
      discountAmountTotalCents: Number(proposal.discountAmountTotalCents),
      taxAmountCents: Number(proposal.taxAmountCents),
      totalCents: Number(proposal.totalCents),
      validUntil: proposal.validUntil,
      issuedAt: proposal.issuedAt,
      notes: proposal.notes
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
    lineItems: items,
    statusLabel: getProposalStatusLabel(proposal.status),
    locale
  })

  return {
    renderData,
    number: proposal.number,
    currency: proposal.currency,
    locale,
    totalCents: Number(proposal.totalCents),
    publicToken: proposal.publicToken,
    businessName: instance?.businessName ?? "Remit",
    templateId: proposal.templateId,
    // The envelope address only. `renderData` still names the client, because the document is issued
    // to the company; where it is delivered is a separate question, answered by the client's primary
    // contact when it has one and by `clients.email` otherwise (ADR-0027).
    recipientEmail: recipient?.email ?? null,
    recipientName: recipient?.name ?? ""
  }
}

async function getProposalClient(clientId: string | null): Promise<ProposalRenderClient | null> {
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

// Either parent resolves to the same client — `fk_proposals_project_client` keeps the pair in
// agreement — so the stored `client_id` answers directly and the project is only consulted for a
// row written before stage 29's backfill ran.
async function getProjectClientId(projectId: string | null): Promise<string | null> {
  if (!projectId) return null

  const project = await database.query.projects.findFirst({
    columns: { clientId: true },
    where: eq(projects.id, projectId)
  })

  return project?.clientId ?? null
}

async function getProposalLineItems(proposalId: string): Promise<ProposalRenderLineItem[]> {
  const rows = await database
    .select()
    .from(lineItems)
    .where(and(eq(lineItems.proposalId, proposalId), isNull(lineItems.deletedAt)))
    .orderBy(asc(lineItems.position))

  return rows.map((row) => ({
    description: row.description,
    unit: row.unit,
    quantity: row.quantity,
    unitPriceCents: Number(row.unitPriceCents),
    discountType: row.discountType,
    discountPercentage: row.discountPercentage,
    discountAmountCents: row.discountAmountCents === null ? null : Number(row.discountAmountCents),
    taxPercentageSnapshot: row.taxPercentageSnapshot,
    subtotalCents: Number(row.subtotalCents),
    taxAmountCents: Number(row.taxAmountCents),
    totalCents: Number(row.totalCents)
  }))
}

function getProposalStatusLabel(status: ProposalStatus): string {
  switch (status) {
    case "draft":
      return t("proposals.status.draft")
    case "sent":
      return t("proposals.status.sent")
    case "accepted":
      return t("proposals.status.accepted")
    case "rejected":
      return t("proposals.status.rejected")
  }
}
