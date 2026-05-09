import net, { type Socket } from "node:net"
import tls from "node:tls"

import { database } from "@/database"

import { env } from "@/lib/env"
import { logger } from "@/lib/logger"

import { isEmailConfigured } from "@/features/settings"

export type TransactionalEmail = {
  to: string
  subject: string
  text: string
  html?: string
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

type SmtpResponse = {
  code: number
  message: string
}

type PendingResponse = {
  resolve: (response: SmtpResponse) => void
  reject: (error: Error) => void
  lines: string[]
}

const SMTP_TIMEOUT_MS = 15_000

export async function sendTransactionalEmail(email: TransactionalEmail): Promise<void> {
  const settings = await getEmailSettings()

  if (!settings || !isEmailConfigured(settings)) {
    logger.warn(
      { action: "sendTransactionalEmail", provider: settings?.emailProvider ?? null },
      "Transactional email delivery is not configured"
    )

    throw new Error("Email delivery is not configured")
  }

  if (settings.emailProvider === "smtp") {
    await sendWithSmtp(getSmtpConfig(settings), email)
    return
  }

  if (settings.emailProvider === "resend") {
    await sendWithResend(getResendConfig(settings), email)
    return
  }

  throw new Error("Email delivery is not configured")
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
    throw new Error("Email delivery is not configured")
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
  if (!settings.resendApiKey) throw new Error("Email delivery is not configured")

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
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: config.from,
      to: [email.to],
      subject: email.subject,
      text: email.text,
      ...(email.html ? { html: email.html } : {})
    })
  })

  if (response.ok) return

  logger.error(
    { action: "sendTransactionalEmail", provider: "resend", status: response.status },
    "Transactional email delivery failed"
  )

  throw new Error("Email delivery failed")
}

async function sendWithSmtp(config: SmtpConfig, email: TransactionalEmail): Promise<void> {
  let client = await connectSmtp(config)

  try {
    await client.read([220])
    let ehlo = await client.command(`EHLO ${getSmtpClientName()}`, [250])

    if (!config.secure) {
      if (!ehlo.message.includes("STARTTLS")) {
        throw new Error("SMTP server does not support STARTTLS")
      }

      await client.command("STARTTLS", [220])
      client = await client.upgradeToTls(config.host)
      ehlo = await client.command(`EHLO ${getSmtpClientName()}`, [250])
    }

    await client.command(`AUTH PLAIN ${encodeAuthPlain(config.username, config.password)}`, [235])
    await client.command(`MAIL FROM:<${config.fromAddress}>`, [250])
    await client.command(`RCPT TO:<${email.to}>`, [250, 251])
    await client.command("DATA", [354])
    await client.writeData(buildSmtpMessage(config.from, email))
    await client.read([250])
    await client.command("QUIT", [221])
  } catch (error) {
    logger.error(
      { action: "sendTransactionalEmail", provider: "smtp", err: error },
      "Transactional email delivery failed"
    )

    throw new Error("Email delivery failed")
  } finally {
    client.close()
  }
}

async function connectSmtp(config: SmtpConfig): Promise<SmtpClient> {
  const socket = config.secure
    ? await connectTlsSocket(config.host, config.port)
    : await connectTcpSocket(config.host, config.port)

  return new SmtpClient(socket)
}

function connectTcpSocket(host: string, port: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port }, () => resolve(socket))

    socket.setTimeout(SMTP_TIMEOUT_MS)
    socket.once("error", reject)
    socket.once("timeout", () => reject(new Error("SMTP connection timed out")))
  })
}

function connectTlsSocket(host: string, port: number): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port, servername: host }, () => resolve(socket))

    socket.setTimeout(SMTP_TIMEOUT_MS)
    socket.once("error", reject)
    socket.once("timeout", () => reject(new Error("SMTP connection timed out")))
  })
}

class SmtpClient {
  private buffer = ""
  private pending: PendingResponse | null = null

  constructor(private socket: Socket) {
    this.socket.setEncoding("utf8")
    this.socket.on("data", (chunk) => this.handleData(chunk.toString("utf8")))
    this.socket.on("error", (error) => this.pending?.reject(error))
    this.socket.on("timeout", () => this.pending?.reject(new Error("SMTP response timed out")))
  }

  async command(command: string, expectedCodes: number[]): Promise<SmtpResponse> {
    this.socket.write(`${command}\r\n`)

    return this.read(expectedCodes)
  }

  read(expectedCodes: number[]): Promise<SmtpResponse> {
    return new Promise((resolve, reject) => {
      this.pending = {
        resolve: (response) => {
          if (!expectedCodes.includes(response.code)) {
            reject(new Error(`SMTP command failed with status ${response.code}`))
            return
          }

          resolve(response)
        },
        reject,
        lines: []
      }
    })
  }

  writeData(message: string): Promise<void> {
    this.socket.write(`${dotStuff(message)}\r\n.\r\n`)

    return Promise.resolve()
  }

  upgradeToTls(host: string): Promise<SmtpClient> {
    return new Promise((resolve, reject) => {
      this.socket.removeAllListeners("data")
      this.socket.removeAllListeners("error")
      this.socket.removeAllListeners("timeout")

      const secureSocket = tls.connect({ socket: this.socket, servername: host }, () => {
        resolve(new SmtpClient(secureSocket))
      })

      secureSocket.setTimeout(SMTP_TIMEOUT_MS)
      secureSocket.once("error", reject)
      secureSocket.once("timeout", () => reject(new Error("SMTP TLS upgrade timed out")))
    })
  }

  close(): void {
    this.socket.destroy()
  }

  private handleData(chunk: string): void {
    const pending = this.pending

    if (!pending) return

    this.buffer += chunk

    let lineEnd = this.buffer.indexOf("\r\n")

    while (lineEnd >= 0) {
      const line = this.buffer.slice(0, lineEnd)
      this.buffer = this.buffer.slice(lineEnd + 2)
      pending.lines.push(line)

      const match = /^(\d{3})([ -])/.exec(line)

      if (match?.[2] === " ") {
        const code = Number(match[1])
        const response = { code, message: pending.lines.join("\n") }

        this.pending = null
        pending.resolve(response)
        return
      }

      lineEnd = this.buffer.indexOf("\r\n")
    }
  }
}

function getSmtpClientName(): string {
  return new URL(env.BETTER_AUTH_URL).hostname
}

function encodeAuthPlain(username: string, password: string): string {
  return Buffer.from(`\0${username}\0${password}`, "utf8").toString("base64")
}

function buildSmtpMessage(from: string, email: TransactionalEmail): string {
  const headers = [
    `From: ${from}`,
    `To: ${email.to}`,
    `Subject: ${encodeHeader(email.subject)}`,
    "MIME-Version: 1.0"
  ]

  if (!email.html) {
    return [
      ...headers,
      'Content-Type: text/plain; charset="UTF-8"',
      "",
      normalizeBody(email.text)
    ].join("\r\n")
  }

  const boundary = `remit-${crypto.randomUUID()}`

  return [
    ...headers,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    normalizeBody(email.text),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "",
    normalizeBody(email.html),
    `--${boundary}--`
  ].join("\r\n")
}

function dotStuff(message: string): string {
  return normalizeBody(message)
    .split("\r\n")
    .map((line) => (line.startsWith(".") ? `.${line}` : line))
    .join("\r\n")
}

function normalizeBody(value: string): string {
  return value.replace(/\r?\n/g, "\r\n")
}

function formatAddress(name: string, address: string): string {
  return `"${sanitizeHeader(name).replace(/"/g, '\\"')}" <${sanitizeHeader(address)}>`
}

function encodeHeader(value: string): string {
  const sanitized = sanitizeHeader(value)

  if (/^[\x20-\x7E]*$/.test(sanitized)) return sanitized

  return `=?UTF-8?B?${Buffer.from(sanitized, "utf8").toString("base64")}?=`
}

function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]/g, " ").trim()
}
