import { and, eq, isNull } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { database } from "@/database"
import { type contracts, templates } from "@/database/schema"

import {
  getPageHeight,
  getPageWidth,
  normalizePageSettings,
  renderTemplate,
  type TemplatePageSettings
} from "@/features/templates"
import { resolveTemplateAssets, toTemplateEditorData } from "@/features/templates/server"

import { toContractBlocks } from "./queries"
import { type ContractStatus } from "./schemas"
import {
  buildContractRenderData,
  hasContractContent,
  type ContractRenderBusiness,
  type ContractRenderClient
} from "./services"
import { type PublicContractDocument } from "./types"

// Turning a stored contract into the HTML a reader sees, split out of `publicQueries.ts` because it
// answers a different question: that file decides whether a token may see the contract at all, this
// one renders the contract it decided to show. The signed-PDF worker (ADR-0022) renders the same
// document, so this is the seam it will reuse rather than a second layout of its own.

export type ContractDocumentContext = {
  business: ContractRenderBusiness
  locale: string
}

type ContractRow = typeof contracts.$inferSelect

// The same pure renderer that powers the editor preview, so the signer reads the document in the
// layout it will be executed in. Contracts snapshot `blocks` at draft time but not page settings,
// so those come from the linked template and fall back to the defaults when it is gone — a contract
// issued from a template with custom margins re-flows if that template is later re-styled, which is
// the price of the column the contracts table does not carry.
export async function renderContractDocument(
  contract: ContractRow,
  client: ContractRenderClient | null,
  context: ContractDocumentContext
): Promise<PublicContractDocument | null> {
  const blocks = toContractBlocks(contract.blocks, contract.id)

  if (!hasContractContent(blocks)) return null

  const [pageSettings, assets] = await Promise.all([
    getContractPageSettings(contract.templateId),
    resolveTemplateAssets(blocks)
  ])

  const html = renderTemplate({
    blocks,
    renderData: buildContractRenderData({
      contract: {
        number: contract.number,
        title: contract.title,
        effectiveFrom: contract.effectiveFrom,
        effectiveUntil: contract.effectiveUntil,
        issuedAt: contract.issuedAt,
        terminationReason: contract.terminationReason
      },
      client,
      business: context.business,
      statusLabel: getContractStatusLabel(contract.status),
      locale: context.locale
    }),
    type: "contract",
    format: "html",
    pageSettings,
    assets
  })

  return {
    html,
    width: getPageWidth("contract"),
    height: getPageHeight(blocks, "contract", pageSettings)
  }
}

async function getContractPageSettings(templateId: string | null): Promise<TemplatePageSettings> {
  if (!templateId) return normalizePageSettings(null)

  const row = await database.query.templates.findFirst({
    where: and(eq(templates.id, templateId), isNull(templates.deletedAt))
  })

  return row ? toTemplateEditorData(row).pageSettings : normalizePageSettings(null)
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
