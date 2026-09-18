import { describe, expect, test } from "vitest"

import { parseErrorTrackingDsn } from "../dsn"

describe("parseErrorTrackingDsn", () => {
  test("reads a Sentry DSN into its envelope endpoint and public key", () => {
    const target = parseErrorTrackingDsn(
      "https://0123456789abcdef0123456789abcdef@sentry.example.com/42"
    )

    expect(target).toEqual({
      envelopeUrl: "https://sentry.example.com/api/42/envelope/",
      publicKey: "0123456789abcdef0123456789abcdef"
    })
  })

  test("keeps a port, a path prefix and plain HTTP for a receiver on the local network", () => {
    const target = parseErrorTrackingDsn("http://abc123@glitchtip.lan:8000/errors/7")

    expect(target?.envelopeUrl).toBe("http://glitchtip.lan:8000/errors/api/7/envelope/")
  })

  test("drops a legacy secret rather than keeping it", () => {
    const target = parseErrorTrackingDsn("https://public123:secret456@sentry.example.com/1")

    expect(target).toEqual({
      envelopeUrl: "https://sentry.example.com/api/1/envelope/",
      publicKey: "public123"
    })
    expect(JSON.stringify(target)).not.toContain("secret456")
  })

  test.each([
    ["no public key", "https://sentry.example.com/1"],
    ["a project id that is not a number", "https://abc@sentry.example.com/my-project"],
    ["no project id", "https://abc@sentry.example.com/"],
    ["a query string", "https://abc@sentry.example.com/1?debug=true"],
    ["a protocol other than HTTP", "ftp://abc@sentry.example.com/1"],
    ["something that is not a URL", "not a dsn"]
  ])("refuses a DSN with %s", (_label, value) => {
    expect(parseErrorTrackingDsn(value)).toBeNull()
  })
})
