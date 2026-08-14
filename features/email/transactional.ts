import nodemailer from "nodemailer"

import { Resend } from "resend"

import { logger } from "@/lib/logger"

import { env } from "@/lib/config/env"

import { database } from "@/database"

import { isEmailConfigured } from "./services/isEmailConfigured"

// One shape for both adapters, because nodemailer and Resend happen to accept the same three fields.
// `content` is the bytes rather than a path or a URL on purpose: a path would make the mail adapter
// reach into storage, and a URL would hand the provider a link to fetch — which for a document PDF
// means publishing it (`security.md`).
export type EmailAttachment = {
  filename: string
  content: Buffer
  contentType: string
}

export type TransactionalEmail = {
  to: string
  subject: string
  text: string
  html?: string
  attachments?: readonly EmailAttachment[]
  idempotencyKey?: string
}

export type EmailDeliveryErrorCode =
  | "not_configured"
  | "provider_failed"
  | "resend_auth"
  | "resend_rejected"
  | "smtp_auth"
  | "smtp_connection"
  | "smtp_timeout"
  | "smtp_tls"

export class EmailDeliveryError extends Error {
  constructor(
    readonly code: EmailDeliveryErrorCode,
    message = code
  ) {
    super(message)
    this.name = "EmailDeliveryError"
  }
}

type EmailSettings = {
  businessName: string | null
  emailProvider: string | null
  smtpHost: string | null
  smtpPort: number | null
  smtpUser: string | null
  smtpPass: string | null
  smtpSecure: boolean
  resendApiKey: string | null
  emailFromName: string | null
  emailFromAddress: string | null
}

type SmtpConfig = {
  host: string
  port: number
  username: string
  password: string
  secure: boolean
  from: string
  fromAddress: string
}

type ResendConfig = {
  apiKey: string
  from: string
}

const SMTP_TIMEOUT_MS = 15_000

export async function sendTransactionalEmail(email: TransactionalEmail): Promise<void> {
  const settings = await getEmailSettings()

  if (!settings || !isEmailConfigured(settings)) {
    logger.warn(
      { action: "sendTransactionalEmail", provider: settings?.emailProvider ?? null },
      "Transactional email delivery is not configured"
    )

    throw new EmailDeliveryError("not_configured")
  }

  if (settings.emailProvider === "smtp") {
    await sendWithSmtp(getSmtpConfig(settings), email)

    return
  }

  if (settings.emailProvider === "resend") {
    await sendWithResend(getResendConfig(settings), email)

    return
  }

  throw new EmailDeliveryError("not_configured")
}

async function getEmailSettings(): Promise<EmailSettings | null> {
  return (
    (await database.query.settings.findFirst({
      columns: {
        businessName: true,
        emailProvider: true,
        smtpHost: true,
        smtpPort: true,
        smtpUser: true,
        smtpPass: true,
        smtpSecure: true,
        resendApiKey: true,
        emailFromName: true,
        emailFromAddress: true
      }
    })) ?? null
  )
}

function getSmtpConfig(settings: EmailSettings): SmtpConfig {
  if (!settings.smtpHost || !settings.smtpPort || !settings.smtpUser || !settings.smtpPass) {
    throw new EmailDeliveryError("not_configured")
  }

  const fromAddress = settings.emailFromAddress || settings.smtpUser

  return {
    host: settings.smtpHost,
    port: settings.smtpPort,
    username: settings.smtpUser,
    password: settings.smtpPass,
    secure: settings.smtpSecure,
    fromAddress,
    from: formatAddress(getFromName(settings), fromAddress)
  }
}

function getResendConfig(settings: EmailSettings): ResendConfig {
  if (!settings.resendApiKey) throw new EmailDeliveryError("not_configured")

  const fromAddress = settings.emailFromAddress || getDefaultFromAddress()

  return {
    apiKey: settings.resendApiKey,
    from: formatAddress(getFromName(settings), fromAddress)
  }
}

function getFromName(settings: EmailSettings): string {
  return settings.emailFromName || settings.businessName || "Remit"
}

function getDefaultFromAddress(): string {
  const host = new URL(env.BETTER_AUTH_URL).hostname

  return `no-reply@${host}`
}

async function sendWithResend(config: ResendConfig, email: TransactionalEmail): Promise<void> {
  const resend = new Resend(config.apiKey)

  let data: { id: string } | null
  let error: { name: string; message: string } | null

  try {
    ;({ data, error } = await resend.emails.send(
      {
        from: config.from,
        to: email.to,
        subject: email.subject,
        text: email.text,
        ...(email.html ? { html: email.html } : {}),
        ...(email.attachments?.length ? { attachments: toProviderAttachments(email) } : {})
      },
      email.idempotencyKey ? { idempotencyKey: email.idempotencyKey } : {}
    ))
  } catch (cause) {
    logger.error(
      { action: "sendTransactionalEmail", provider: "resend", err: cause },
      "Transactional email delivery failed"
    )

    throw new EmailDeliveryError("provider_failed")
  }

  if (!error && data) return

  const code = mapResendError(error?.name)

  logger.error(
    { action: "sendTransactionalEmail", provider: "resend", resendErrorName: error?.name, code },
    "Transactional email delivery failed"
  )

  throw new EmailDeliveryError(code)
}

async function sendWithSmtp(config: SmtpConfig, email: TransactionalEmail): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.username, pass: config.password },
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS
  })

  try {
    await transporter.sendMail({
      from: config.from,
      to: email.to,
      subject: email.subject,
      text: email.text,
      ...(email.html ? { html: email.html } : {}),
      ...(email.attachments?.length ? { attachments: toProviderAttachments(email) } : {})
    })
  } catch (error) {
    const code = mapNodemailerError(error)

    logger.error(
      { action: "sendTransactionalEmail", provider: "smtp", code, err: error },
      "Transactional email delivery failed"
    )

    throw new EmailDeliveryError(code)
  } finally {
    transporter.close()
  }
}

export function mapResendError(name: string | undefined): EmailDeliveryErrorCode {
  switch (name) {
    case "missing_api_key":
    case "invalid_api_key":
    case "restricted_api_key":
    case "invalid_access":
      return "resend_auth"
    case "validation_error":
    case "missing_required_field":
    case "invalid_parameter":
    case "invalid_from_address":
    case "invalid_to_address":
    // An attachment over the provider's size limit. It is a rejection of this message rather than a
    // transport fault, so a retry with the same payload would fail identically.
    case "invalid_attachment":
      return "resend_rejected"
    case undefined:
      return "provider_failed"
    default:
      return "provider_failed"
  }
}

export function mapNodemailerError(error: unknown): EmailDeliveryErrorCode {
  const code = getErrorCode(error)

  switch (code) {
    case "EAUTH":
    case "ENOAUTH":
      return "smtp_auth"
    case "ETIMEDOUT":
      return "smtp_timeout"
    case "ETLS":
    case "EREQUIRETLS":
      return "smtp_tls"
    case "ECONNECTION":
    case "ESOCKET":
    case "EDNS":
      return "smtp_connection"
    case "EENVELOPE":
    case "EMESSAGE":
      return "provider_failed"
    case null:
      return "smtp_connection"
    default:
      return "smtp_connection"
  }
}

function getErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null

  const code = (error as { code: unknown }).code

  return typeof code === "string" ? code : null
}

// Both providers accept the same field names, so this is a widening rather than a translation. It is
// still a function rather than a spread at each call site: a caller must not be able to pass a
// `path` or a `contentId` through by accident, and building the array here is what keeps the two
// adapters sending byte-identical attachments.
function toProviderAttachments(
  email: TransactionalEmail
): { filename: string; content: Buffer; contentType: string }[] {
  return (email.attachments ?? []).map((attachment) => ({
    filename: attachment.filename,
    content: attachment.content,
    contentType: attachment.contentType
  }))
}

function formatAddress(name: string, address: string): string {
  return `"${sanitizeHeader(name).replace(/"/g, '\\"')}" <${sanitizeHeader(address)}>`
}

// Stripping CR and LF is header-injection defence, not cosmetics: the from name and address come
// from operator-editable settings, and a newline inside a header value lets the rest of the string
// be interpreted as additional headers (a Bcc, a forged Reply-To) by the receiving MTA.
function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]/g, " ").trim()
}
