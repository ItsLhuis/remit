import { beforeEach, describe, expect, test, vi } from "vitest"

import {
  EmailDeliveryError,
  mapNodemailerError,
  mapResendError,
  sendTransactionalEmail,
  type EmailDeliveryErrorCode
} from "../transactional"

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  resendSend: vi.fn(),
  sendMail: vi.fn(),
  closeTransport: vi.fn(),
  createTransport: vi.fn()
}))

vi.mock("@/lib/config/env", () => ({
  env: { BETTER_AUTH_URL: "https://remit.example.com" }
}))

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn() }
}))

vi.mock("@/database", () => ({
  database: { query: { settings: { findFirst: mocks.findFirst } } }
}))

vi.mock("../services/isEmailConfigured", () => ({
  isEmailConfigured: (settings: Record<string, unknown> | null) => {
    if (!settings) return false

    if (settings.emailProvider === "smtp") {
      return Boolean(
        settings.smtpHost && settings.smtpPort && settings.smtpUser && settings.smtpPass
      )
    }

    if (settings.emailProvider === "resend") return Boolean(settings.resendApiKey)

    return false
  }
}))

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mocks.resendSend }
  }
}))

vi.mock("nodemailer", () => ({
  default: { createTransport: mocks.createTransport }
}))

const smtpRow = {
  businessName: "Acme Studio",
  emailProvider: "smtp",
  smtpHost: "smtp.example.com",
  smtpPort: 587,
  smtpUser: "mailer@example.com",
  smtpPass: "smtp-secret",
  smtpSecure: false,
  resendApiKey: null,
  emailFromName: "Acme",
  emailFromAddress: "billing@example.com"
}

const resendRow = {
  businessName: "Acme Studio",
  emailProvider: "resend",
  smtpHost: null,
  smtpPort: null,
  smtpUser: null,
  smtpPass: null,
  smtpSecure: false,
  resendApiKey: "re_test_secret",
  emailFromName: "Acme",
  emailFromAddress: "billing@example.com"
}

beforeEach(() => {
  vi.clearAllMocks()

  mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail, close: mocks.closeTransport })
  mocks.sendMail.mockResolvedValue({ messageId: "smtp-message-id" })
  mocks.resendSend.mockResolvedValue({ data: { id: "resend-message-id" }, error: null })
})

describe("sendTransactionalEmail not configured", () => {
  test("throws not_configured when no settings row exists", async () => {
    mocks.findFirst.mockResolvedValue(undefined)

    await expect(
      sendTransactionalEmail({ to: "to@example.com", subject: "Hi", text: "Body" })
    ).rejects.toMatchObject({ code: "not_configured" satisfies EmailDeliveryErrorCode })
  })
})

describe("sendTransactionalEmail via SMTP", () => {
  test("builds a nodemailer transport from the decrypted settings and sends the message", async () => {
    mocks.findFirst.mockResolvedValue(smtpRow)

    await sendTransactionalEmail({
      to: "to@example.com",
      subject: "Hello",
      text: "Body",
      html: "<p>Body</p>"
    })

    expect(mocks.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.example.com",
        port: 587,
        secure: false,
        auth: { user: "mailer@example.com", pass: "smtp-secret" }
      })
    )
    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '"Acme" <billing@example.com>',
        to: "to@example.com",
        subject: "Hello",
        text: "Body",
        html: "<p>Body</p>"
      })
    )
    expect(mocks.closeTransport).toHaveBeenCalledOnce()
  })

  test("maps an EAUTH failure to smtp_auth and never leaks the password", async () => {
    mocks.findFirst.mockResolvedValue(smtpRow)
    mocks.sendMail.mockRejectedValueOnce(
      Object.assign(new Error("Invalid login"), { code: "EAUTH" })
    )

    await expect(
      sendTransactionalEmail({ to: "to@example.com", subject: "Hello", text: "Body" })
    ).rejects.toMatchObject({ code: "smtp_auth" satisfies EmailDeliveryErrorCode })
    expect(mocks.closeTransport).toHaveBeenCalledOnce()
  })
})

describe("sendTransactionalEmail via Resend", () => {
  test("sends through the Resend SDK without an idempotency key by default", async () => {
    mocks.findFirst.mockResolvedValue(resendRow)

    await sendTransactionalEmail({ to: "to@example.com", subject: "Hello", text: "Body" })

    expect(mocks.resendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '"Acme" <billing@example.com>',
        to: "to@example.com",
        subject: "Hello",
        text: "Body"
      }),
      {}
    )
  })

  test("forwards the idempotency key for real document sends", async () => {
    mocks.findFirst.mockResolvedValue(resendRow)

    await sendTransactionalEmail({
      to: "to@example.com",
      subject: "Hello",
      text: "Body",
      idempotencyKey: "invoice/123"
    })

    expect(mocks.resendSend).toHaveBeenCalledWith(expect.any(Object), {
      idempotencyKey: "invoice/123"
    })
  })

  test("maps a returned Resend error object to a delivery code", async () => {
    mocks.findFirst.mockResolvedValue(resendRow)
    mocks.resendSend.mockResolvedValueOnce({
      data: null,
      error: { name: "invalid_api_key", message: "API key is invalid" }
    })

    await expect(
      sendTransactionalEmail({ to: "to@example.com", subject: "Hello", text: "Body" })
    ).rejects.toMatchObject({ code: "resend_auth" satisfies EmailDeliveryErrorCode })
  })

  test("maps a thrown Resend transport error to provider_failed", async () => {
    mocks.findFirst.mockResolvedValue(resendRow)
    mocks.resendSend.mockRejectedValueOnce(new Error("network down"))

    await expect(
      sendTransactionalEmail({ to: "to@example.com", subject: "Hello", text: "Body" })
    ).rejects.toMatchObject({ code: "provider_failed" satisfies EmailDeliveryErrorCode })
  })
})

describe("mapResendError", () => {
  test("maps auth-related Resend error names to resend_auth", () => {
    expect(mapResendError("invalid_api_key")).toBe("resend_auth")
    expect(mapResendError("missing_api_key")).toBe("resend_auth")
    expect(mapResendError("restricted_api_key")).toBe("resend_auth")
  })

  test("maps validation Resend error names to resend_rejected", () => {
    expect(mapResendError("validation_error")).toBe("resend_rejected")
    expect(mapResendError("invalid_to_address")).toBe("resend_rejected")
  })

  test("maps unknown Resend error names to provider_failed", () => {
    expect(mapResendError("rate_limit_exceeded")).toBe("provider_failed")
    expect(mapResendError(undefined)).toBe("provider_failed")
  })
})

describe("mapNodemailerError", () => {
  test("maps SMTP error codes onto the delivery taxonomy", () => {
    expect(mapNodemailerError({ code: "EAUTH" })).toBe("smtp_auth")
    expect(mapNodemailerError({ code: "ENOAUTH" })).toBe("smtp_auth")
    expect(mapNodemailerError({ code: "ETIMEDOUT" })).toBe("smtp_timeout")
    expect(mapNodemailerError({ code: "ETLS" })).toBe("smtp_tls")
    expect(mapNodemailerError({ code: "EREQUIRETLS" })).toBe("smtp_tls")
    expect(mapNodemailerError({ code: "ECONNECTION" })).toBe("smtp_connection")
    expect(mapNodemailerError({ code: "ESOCKET" })).toBe("smtp_connection")
    expect(mapNodemailerError({ code: "EDNS" })).toBe("smtp_connection")
    expect(mapNodemailerError({ code: "EENVELOPE" })).toBe("provider_failed")
    expect(mapNodemailerError({ code: "EMESSAGE" })).toBe("provider_failed")
  })

  test("falls back to smtp_connection for unknown or missing codes", () => {
    expect(mapNodemailerError({ code: "EUNKNOWN" })).toBe("smtp_connection")
    expect(mapNodemailerError(new Error("boom"))).toBe("smtp_connection")
    expect(mapNodemailerError(null)).toBe("smtp_connection")
  })

  test("constructs an EmailDeliveryError with the resolved code", () => {
    const error = new EmailDeliveryError(mapNodemailerError({ code: "EAUTH" }))

    expect(error.code).toBe("smtp_auth")
    expect(error.name).toBe("EmailDeliveryError")
  })
})

describe("sendTransactionalEmail with attachments", () => {
  const attachment = {
    filename: "INV-0001.pdf",
    content: Buffer.from("%PDF-1.4", "latin1"),
    contentType: "application/pdf"
  }

  test("passes the attachment bytes to nodemailer", async () => {
    mocks.findFirst.mockResolvedValue(smtpRow)

    await sendTransactionalEmail({
      to: "to@example.com",
      subject: "Invoice",
      text: "Body",
      attachments: [attachment]
    })

    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ attachments: [attachment] })
    )
  })

  test("passes the attachment bytes to Resend", async () => {
    mocks.findFirst.mockResolvedValue(resendRow)

    await sendTransactionalEmail({
      to: "to@example.com",
      subject: "Invoice",
      text: "Body",
      attachments: [attachment]
    })

    expect(mocks.resendSend).toHaveBeenCalledWith(
      expect.objectContaining({ attachments: [attachment] }),
      expect.anything()
    )
  })

  // The key is omitted entirely rather than sent empty, because nodemailer treats an empty array as
  // a multipart message with no parts and some MTAs reject it.
  test("omits the attachments key when there are none", async () => {
    mocks.findFirst.mockResolvedValue(smtpRow)

    await sendTransactionalEmail({ to: "to@example.com", subject: "Hi", text: "Body" })

    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.not.objectContaining({ attachments: expect.anything() })
    )
  })

  // `email_logs.pdf_attached` may only be written from a send that returned, so a rejected
  // attachment has to surface as a throw the caller can see rather than a silently dropped part.
  test("throws a rejection code when the provider refuses the attachment", async () => {
    mocks.findFirst.mockResolvedValue(resendRow)
    mocks.resendSend.mockResolvedValue({ data: null, error: { name: "invalid_attachment" } })

    await expect(
      sendTransactionalEmail({
        to: "to@example.com",
        subject: "Invoice",
        text: "Body",
        attachments: [attachment]
      })
    ).rejects.toMatchObject({ code: "resend_rejected" satisfies EmailDeliveryErrorCode })
  })
})
