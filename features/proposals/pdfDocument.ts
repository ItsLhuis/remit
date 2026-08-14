import { and, asc, eq, isNull } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { inlineStorageAssets } from "@/lib/pdf"

import { database } from "@/database"
import { clients, lineItems, projects, proposals, templates } from "@/database/schema"

import {
  buildDocumentShell,
  getPageHeight,
  renderTemplate,
  type DocumentShell
} from "@/features/templates"
import { resolveTemplateAssets, toTemplateEditorData } from "@/features/templates/server"

import { type ProposalStatus } from "./schemas"
import {
  buildProposalRenderData,
  type ProposalRenderClient,
  type ProposalRenderLineItem
} from "./services"

// Turns a stored proposal into the HTML the PDF worker prints, mirroring
// `features/invoices/pdfDocument.ts`. Server-only: it reads the database and object storage, and
// hands a pure renderer everything it needs as arguments (ADR-0007).
//
// Like an invoice and unlike a contract, a proposal snapshots no blocks of its own, so the document
// is composed from the template it points at — which is why the rendered PDF is the snapshot (see
// `pdf_upload_id` in `database/schema/proposals.ts`).

export async function buildProposalPdfDocument(proposalId: string): Promise<DocumentShell | null> {
  const proposal = await database.query.proposals.findFirst({
    where: and(eq(proposals.id, proposalId), isNull(proposals.deletedAt))
  })

  if (!proposal) return null

  const [instance, client, items, template] = await Promise.all([
    database.query.settings.findFirst(),
    getProposalClient(proposal.projectId),
    getProposalLineItems(proposalId),
    getProposalTemplate(proposal.templateId)
  ])

  if (!template) return null

  const editorData = toTemplateEditorData(template)
  // Inlined as `data:` URIs, not left as storage paths: `lib/pdf/renderPdf.ts` aborts every request
  // that is not a data URI, so a path here renders as a missing image rather than a logo.
  const assets = await inlineStorageAssets(await resolveTemplateAssets(editorData.blocks))
  const locale = instance?.defaultLocale ?? "en"

  const html = renderTemplate({
    blocks: editorData.blocks,
    renderData: buildProposalRenderData({
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
    }),
    type: "proposal",
    format: "html",
    pageSettings: editorData.pageSettings,
    assets
  })

  return buildDocumentShell({
    body: html,
    type: "proposal",
    heightPx: getPageHeight(editorData.blocks, "proposal", editorData.pageSettings)
  })
}

// Always through the project: `proposals.project_id` is NOT NULL, so unlike an invoice there is no
// direct-to-client shape to fall back to.
async function getProposalClient(projectId: string): Promise<ProposalRenderClient | null> {
  const project = await database.query.projects.findFirst({
    columns: { clientId: true },
    where: eq(projects.id, projectId)
  })

  if (!project?.clientId) return null

  const client = await database.query.clients.findFirst({
    where: and(eq(clients.id, project.clientId), isNull(clients.deletedAt))
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

// The proposal's own template, or the instance default for the type. An instance with neither has
// nothing to render, and the caller reports that rather than inventing a layout.
async function getProposalTemplate(templateId: string | null) {
  if (templateId) {
    const template = await database.query.templates.findFirst({
      where: and(eq(templates.id, templateId), isNull(templates.deletedAt))
    })

    if (template) return template
  }

  return await database.query.templates.findFirst({
    where: and(
      eq(templates.type, "proposal"),
      eq(templates.isDefault, true),
      isNull(templates.deletedAt)
    )
  })
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
