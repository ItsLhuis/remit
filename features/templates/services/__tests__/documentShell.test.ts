import { describe, expect, test } from "vitest"

import { buildDocumentShell } from "../documentShell"

describe("buildDocumentShell", () => {
  test("sizes the CSS page box to the same dimensions it reports to the caller", () => {
    const shell = buildDocumentShell({ body: "<div></div>", type: "invoice", heightPx: 1400 })

    expect(shell.html).toContain(`@page{size:${shell.widthPx}px ${shell.heightPx}px;margin:0}`)
    expect(shell.heightPx).toBe(1400)
  })

  test("uses the narrower page width for an email template", () => {
    const document = buildDocumentShell({ body: "", type: "invoice", heightPx: 100 })
    const email = buildDocumentShell({ body: "", type: "email_invoice_send", heightPx: 100 })

    expect(email.widthPx).toBeLessThan(document.widthPx)
  })

  test("embeds the rendered body verbatim", () => {
    const body = '<div style="position:absolute">Invoice</div>'

    expect(buildDocumentShell({ body, type: "invoice", heightPx: 100 }).html).toContain(body)
  })

  // The renderer aborts every non-`data:` request, so a shell that reached for a hosted font or
  // stylesheet would degrade silently instead of failing. This is the assertion that catches one
  // being added.
  test("references no external resource", () => {
    const html = buildDocumentShell({ body: "", type: "contract", heightPx: 100 }).html

    expect(html).not.toMatch(/https?:\/\//)
    expect(html).not.toContain("@import")
  })
})
