import { and, eq, isNull } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { logger } from "@/lib/logger"

import { env } from "@/lib/config/env"

import { database } from "@/database"
import { contracts, uploads } from "@/database/schema"

import { sendDocumentEmail } from "@/features/email/server"

import { renderEmailTemplate } from "@/features/templates/server"

import { buildContractDocumentData } from "./documentData"

// Chained behind `contract.pdf.render` so the PDF this attaches already exists (see the ordering
// note in `lib/jobs/types.ts`).
export async function sendContractEmail(payload: { contractId: string }): Promise<void> {
  const document = await buildContractDocumentData(payload.contractId)

  // No recipient is not a failure to retry — the client simply has no email on file.
  if (!document?.recipientEmail) {
    logger.warn(
      { action: "sendContractEmail", contractId: payload.contractId },
      "Contract email skipped: no recipient"
    )

    return
  }

  // A revoked public link leaves the mail with nowhere to point, and minting a replacement here
  // would silently undo the withdrawal the owner asked for. Skipping is the only honest outcome, and
  // it is not a failure to retry either (ADR-0029).
  if (!document.publicToken) {
    logger.warn(
      { action: "sendContractEmail", contractId: payload.contractId },
      "Contract email skipped: public link revoked"
    )

    return
  }

  const [attachment, body] = await Promise.all([
    getContractPdfAttachment(payload.contractId),
    renderEmailTemplate({
      templateType: "email_contract_send",
      renderData: document.renderData,
      fallbackSubject: t("documentEmails.contractSent.subject", {
        number: document.number,
        businessName: document.businessName
      }),
      fallbackText: t("documentEmails.contractSent.body", {
        clientName: document.recipientName,
        number: document.number,
        url: `${env.NEXT_PUBLIC_APP_URL}/c/${document.publicToken}`,
        businessName: document.businessName
      })
    })
  ])

  await sendDocumentEmail({
    documentType: "contract",
    documentId: payload.contractId,
    recipientEmail: document.recipientEmail,
    recipientName: document.recipientName,
    occasion: "sent",
    subject: body.subject,
    text: body.text,
    html: body.html,
    attachment
  })
}

async function getContractPdfAttachment(contractId: string) {
  const [row] = await database
    .select({ filename: uploads.filename, storageKey: uploads.path })
    .from(contracts)
    .innerJoin(uploads, eq(contracts.pdfUploadId, uploads.id))
    .where(and(eq(contracts.id, contractId), isNull(contracts.deletedAt)))
    .limit(1)

  return row ?? null
}
