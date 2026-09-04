import { and, eq, isNull } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { logger } from "@/lib/logger"

import { formatCurrency } from "@/lib/utils"

import { env } from "@/lib/config/env"

import { database } from "@/database"
import { proposals, uploads } from "@/database/schema"

import { sendDocumentEmail } from "@/features/email/server"

import { renderEmailTemplate } from "@/features/templates/server"

import { buildProposalDocumentData } from "./documentData"

// Chained behind `proposal.pdf.render` so the PDF this attaches already exists (see the ordering
// note in `lib/jobs/types.ts`).
export async function sendProposalEmail(payload: { proposalId: string }): Promise<void> {
  const document = await buildProposalDocumentData(payload.proposalId)

  // No recipient is not a failure to retry — the client simply has no email on file.
  if (!document?.recipientEmail) {
    logger.warn(
      { action: "sendProposalEmail", proposalId: payload.proposalId },
      "Proposal email skipped: no recipient"
    )

    return
  }

  // A revoked public link leaves the mail with nowhere to point, and minting a replacement here
  // would silently undo the withdrawal the owner asked for. Skipping is the only honest outcome, and
  // it is not a failure to retry either (ADR-0029).
  if (!document.publicToken) {
    logger.warn(
      { action: "sendProposalEmail", proposalId: payload.proposalId },
      "Proposal email skipped: public link revoked"
    )

    return
  }

  const [attachment, body] = await Promise.all([
    getProposalPdfAttachment(payload.proposalId),
    renderEmailTemplate({
      templateType: "email_proposal_send",
      renderData: document.renderData,
      fallbackSubject: t("documentEmails.proposalSent.subject", {
        number: document.number,
        businessName: document.businessName
      }),
      fallbackText: t("documentEmails.proposalSent.body", {
        clientName: document.recipientName,
        number: document.number,
        amount: formatCurrency(document.totalCents, document.currency, document.locale),
        url: `${env.NEXT_PUBLIC_APP_URL}/p/${document.publicToken}`,
        businessName: document.businessName
      })
    })
  ])

  await sendDocumentEmail({
    documentType: "proposal",
    documentId: payload.proposalId,
    recipientEmail: document.recipientEmail,
    recipientName: document.recipientName,
    occasion: "sent",
    subject: body.subject,
    text: body.text,
    html: body.html,
    attachment
  })
}

async function getProposalPdfAttachment(proposalId: string) {
  const [row] = await database
    .select({ filename: uploads.filename, storageKey: uploads.path })
    .from(proposals)
    .innerJoin(uploads, eq(proposals.pdfUploadId, uploads.id))
    .where(and(eq(proposals.id, proposalId), isNull(proposals.deletedAt)))
    .limit(1)

  return row ?? null
}
