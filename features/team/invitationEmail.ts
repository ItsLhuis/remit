import { eq } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { logger } from "@/lib/logger"

import { escapeHtml } from "@/lib/utils"

import { database } from "@/database"
import { emailLogs } from "@/database/schema"

import { sendTransactionalEmail } from "@/features/email/server"

import { type AssignableRole } from "./schemas"

export type InvitationEmail = {
  to: string
  role: AssignableRole
  organizationName: string
  inviterName: string
  link: string
}

// `document_type` stays null because an invitation is not one of that enum's documents; the row
// exists so the email history in `/settings/email` accounts for every message the instance sent,
// invitations included. The link carries the invitation id, which is the bearer credential for
// `/invite/[invitationId]` — it reaches the recipient's inbox and nothing else. It is never written
// to `email_logs`, to a log line, or to `audit_logs`.
export async function sendInvitationEmail(email: InvitationEmail): Promise<boolean> {
  const subject = t("settings.team.email.subject", { organization: email.organizationName })
  const intro = t("settings.team.email.intro", {
    inviter: email.inviterName,
    organization: email.organizationName,
    role: t(`settings.team.roles.${email.role}`)
  })
  const cta = t("settings.team.email.cta")
  const outro = t("settings.team.email.outro")

  const [log] = await database
    .insert(emailLogs)
    .values({
      recipientEmail: email.to,
      subject,
      status: "pending"
    })
    .returning({ id: emailLogs.id })

  try {
    await sendTransactionalEmail({
      to: email.to,
      subject,
      text: `${intro}\n\n${cta}: ${email.link}\n\n${outro}`,
      html: [
        `<p>${escapeHtml(intro)}</p>`,
        `<p><a href="${escapeHtml(email.link)}">${escapeHtml(cta)}</a></p>`,
        `<p>${escapeHtml(outro)}</p>`
      ].join("\n")
    })
  } catch (error) {
    logger.error(
      { action: "sendInvitationEmail", recipientEmail: email.to, err: error },
      "Invitation email delivery failed"
    )

    if (log) {
      await database
        .update(emailLogs)
        .set({
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "unknown"
        })
        .where(eq(emailLogs.id, log.id))
    }

    return false
  }

  if (log) {
    await database
      .update(emailLogs)
      .set({ status: "sent", sentAt: new Date() })
      .where(eq(emailLogs.id, log.id))
  }

  return true
}
