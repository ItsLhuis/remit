import { describe, expect, test } from "vitest"

import { WEBHOOK_URL_MAX_LENGTH } from "../../schemas"
import { evaluateWebhookUrl } from "../webhookUrl"

describe("webhook URL evaluation", () => {
  test("accepts an HTTPS URL on a public host and does not open private addresses", () => {
    const evaluation = evaluateWebhookUrl("https://hooks.example.com/remit?source=invoices", [])

    expect(evaluation.ok).toBe(true)
    expect(evaluation.ok && evaluation.allowPrivate).toBe(false)
  })

  test("refuses plain HTTP to a host the operator did not allowlist", () => {
    expect(evaluateWebhookUrl("http://hooks.example.com/remit", [])).toEqual({
      ok: false,
      reason: "scheme"
    })
  })

  test("admits plain HTTP and private addresses for an allowlisted host, matched case-insensitively", () => {
    const evaluation = evaluateWebhookUrl("http://N8N.lan:5678/webhook", ["n8n.lan"])

    expect(evaluation.ok).toBe(true)
    expect(evaluation.ok && evaluation.allowPrivate).toBe(true)
  })

  test.each([["ftp://example.com/x"], ["file:///etc/passwd"], ["javascript:alert(1)"]])(
    "refuses the non-HTTP scheme in %s",
    (url) => {
      const evaluation = evaluateWebhookUrl(url, [])

      expect(evaluation.ok).toBe(false)
    }
  )

  test("refuses a URL that embeds credentials", () => {
    expect(evaluateWebhookUrl("https://user:pass@example.com/hook", [])).toEqual({
      ok: false,
      reason: "credentials"
    })
  })

  test.each([
    ["https://127.0.0.1/hook"],
    ["https://10.0.0.8/hook"],
    ["https://[::1]/hook"],
    ["https://169.254.169.254/latest/meta-data"]
  ])("refuses the private IP literal in %s before any request", (url) => {
    expect(evaluateWebhookUrl(url, [])).toEqual({ ok: false, reason: "address" })
  })

  test("admits an allowlisted private IP literal", () => {
    const evaluation = evaluateWebhookUrl("http://192.168.1.20:8080/hook", ["192.168.1.20"])

    expect(evaluation.ok).toBe(true)
  })

  test("refuses a string that is not a URL", () => {
    expect(evaluateWebhookUrl("not a url", [])).toEqual({ ok: false, reason: "invalid" })
  })

  test("refuses a URL longer than the stored limit", () => {
    const url = `https://example.com/${"a".repeat(WEBHOOK_URL_MAX_LENGTH)}`

    expect(evaluateWebhookUrl(url, [])).toEqual({ ok: false, reason: "too_long" })
  })
})
