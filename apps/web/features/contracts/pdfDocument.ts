import { and, eq, isNull } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { escapeHtml } from "@/lib/utils"

import { inlineStorageAssets } from "@/lib/pdf"

import { database } from "@/database"
import { clients, contracts, contractSignatures, projects } from "@/database/schema"

import { buildDocumentShell, type DocumentShell } from "@/features/templates"

import { renderContractDocument } from "./publicDocument"
import { type ContractRenderClient } from "./services"

// The PDF worker's entry into the contract document, and deliberately a thin wrapper over
// `publicDocument.ts` rather than a second layout. A signer reads the HTML that file produces and
// then receives a PDF of what they signed; if the two were built separately they could drift, and
// the drift would only be visible on the executed copy.
//
// Two documents come out of here. `buildContractPdfDocument` is the contract as sent.
// `buildSignedContractPdfDocument` is the same document with the signature record appended, which is
// what `contract_signatures.signed_pdf_upload_id` points at.

export async function buildContractPdfDocument(contractId: string): Promise<DocumentShell | null> {
  const document = await renderContractPdfBody(contractId)

  if (!document) return null

  return buildDocumentShell({
    body: document.html,
    type: "contract",
    heightPx: document.height
  })
}

export async function buildSignedContractPdfDocument(
  contractId: string,
  signatureId: string
): Promise<DocumentShell | null> {
  const [document, signature] = await Promise.all([
    renderContractPdfBody(contractId),
    getSignature(contractId, signatureId)
  ])

  if (!document || !signature) return null

  const signatureHtml = renderSignatureBlock(signature, document.height)

  return buildDocumentShell({
    body: document.html + signatureHtml,
    type: "contract",
    // The signature block is appended below the contract's own page box, so the document grows by
    // exactly its height. Leaving the height unchanged would print the block off the single page
    // this renderer produces, which is the one way the executed copy could silently lose the record
    // that makes it executed.
    heightPx: document.height + SIGNATURE_BLOCK_HEIGHT
  })
}

type ContractSignatureRecord = {
  signerName: string
  signerEmail: string
  ipAddress: string
  signedAt: Date
}

const SIGNATURE_BLOCK_HEIGHT = 160

async function renderContractPdfBody(contractId: string) {
  const contract = await database.query.contracts.findFirst({
    where: and(eq(contracts.id, contractId), isNull(contracts.deletedAt))
  })

  if (!contract) return null

  const [instance, client] = await Promise.all([
    database.query.settings.findFirst(),
    getContractClient(contract.clientId, contract.projectId)
  ])

  return await renderContractDocument(contract, client, {
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
    locale: instance?.defaultLocale ?? "en",
    transformAssets: inlineStorageAssets
  })
}

async function getContractClient(
  clientId: string | null,
  projectId: string | null
): Promise<ContractRenderClient | null> {
  const resolvedClientId = clientId ?? (await getProjectClientId(projectId))

  if (!resolvedClientId) return null

  const client = await database.query.clients.findFirst({
    where: and(eq(clients.id, resolvedClientId), isNull(clients.deletedAt))
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

// Scoped to the contract as well as the signature id: a payload naming a signature that belongs to a
// different contract must find nothing rather than stamp one contract's PDF with another's signer.
async function getSignature(
  contractId: string,
  signatureId: string
): Promise<ContractSignatureRecord | null> {
  const signature = await database.query.contractSignatures.findFirst({
    columns: { signerName: true, signerEmail: true, ipAddress: true, signedAt: true },
    where: and(
      eq(contractSignatures.id, signatureId),
      eq(contractSignatures.contractId, contractId)
    )
  })

  return signature ?? null
}

// Authored markup rather than a template block, because it records what the renderer was given
// rather than what the owner designed — a signer must not be able to restyle the evidence of their
// own signature away. Every value is escaped: the name and email come from a public form, and the
// user agent and IP from the request that submitted it.
function renderSignatureBlock(signature: ContractSignatureRecord, offsetTop: number): string {
  const rows = [
    [t("contracts.pdfSignature.signerName"), signature.signerName],
    [t("contracts.pdfSignature.signerEmail"), signature.signerEmail],
    [t("contracts.pdfSignature.signedAt"), signature.signedAt.toISOString()],
    [t("contracts.pdfSignature.ipAddress"), signature.ipAddress]
  ]

  const cells = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:2px 12px 2px 0;color:#64748b">${escapeHtml(label ?? "")}</td>` +
        `<td style="padding:2px 0">${escapeHtml(value ?? "")}</td></tr>`
    )
    .join("")

  return (
    `<div style="position:absolute;left:48px;top:${offsetTop + 24}px;right:48px;` +
    `font-size:12px;border-top:1px solid #e2e8f0;padding-top:12px">` +
    `<div style="font-weight:600;margin-bottom:8px">${escapeHtml(t("contracts.pdfSignature.title"))}</div>` +
    `<table style="border-collapse:collapse">${cells}</table>` +
    `</div>`
  )
}
