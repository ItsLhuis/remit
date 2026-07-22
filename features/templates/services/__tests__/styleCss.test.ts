import { describe, expect, test } from "vitest"

import { DEFAULT_PAGE_SETTINGS } from "../canvasLayout"
import { blockStyleToCss, pageStyleToCss } from "../styleCss"

describe("blockStyleToCss", () => {
  test("returns an empty string for an absent style", () => {
    expect(blockStyleToCss(undefined)).toBe("")
  })

  test("maps every style property to its CSS declaration", () => {
    const css = blockStyleToCss({
      padding: { top: 8, right: 16, bottom: 8, left: 16 },
      backgroundColor: "#f8fafc",
      borderWidth: 1,
      borderColor: "#e2e8f0",
      borderRadius: 8,
      fontFamily: "serif",
      fontSize: 12,
      fontWeight: "600",
      textColor: "#0f172a",
      textAlign: "right",
      lineHeight: 1.5
    })

    expect(css).toBe(
      "padding:8px 16px 8px 16px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-family:Georgia, 'Times New Roman', serif;font-size:12px;font-weight:600;color:#0f172a;text-align:right;line-height:1.5"
    )
  })

  test("omits the border when the width is zero and falls back to the hairline color", () => {
    expect(blockStyleToCss({ borderWidth: 0, borderColor: "#123456" })).toBe("")
    expect(blockStyleToCss({ borderWidth: 2 })).toBe("border:2px solid #e2e8f0")
  })
})

describe("pageStyleToCss", () => {
  test("emits the relatively positioned document page at its computed height", () => {
    const css = pageStyleToCss("invoice", DEFAULT_PAGE_SETTINGS, 1123)

    expect(css).toContain("position:relative")
    expect(css).toContain("width:794px")
    expect(css).toContain("height:1123px")
    expect(css).toContain("font-family:'DM Sans', system-ui, sans-serif")
    expect(css).toContain("font-size:14px")
  })

  test("emits the email-safe width at the same absolute page shape", () => {
    const css = pageStyleToCss("email_invoice_send", DEFAULT_PAGE_SETTINGS, 480)

    expect(css).toContain("width:600px")
    expect(css).toContain("height:480px")
  })
})
