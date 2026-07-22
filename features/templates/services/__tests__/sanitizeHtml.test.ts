import { describe, expect, test } from "vitest"

import { sanitizeTemplateHtml, toPlainText } from "../sanitizeHtml"

describe("sanitizeTemplateHtml with the authored profile", () => {
  test("strips script tags and event handler attributes", () => {
    const dirty = '<p onclick="steal()">Hi</p><script>alert(1)</script>'

    const clean = sanitizeTemplateHtml(dirty)

    expect(clean).toBe("<p>Hi</p>")
  })

  test("rejects javascript: and data: link schemes", () => {
    const dirty = '<a href="javascript:alert(1)">x</a><a href="data:text/html,hi">y</a>'

    const clean = sanitizeTemplateHtml(dirty)

    expect(clean).not.toContain("javascript:")
    expect(clean).not.toContain("data:")
  })

  test("strips img tags entirely so images exist only through the image block", () => {
    const dirty = '<p>Logo</p><img src="https://evil.example/x.png" alt="x" />'

    const clean = sanitizeTemplateHtml(dirty)

    expect(clean).toBe("<p>Logo</p>")
  })

  test("strips style attributes so authored HTML cannot inject CSS", () => {
    const dirty = '<div style="position:fixed;top:0">x</div>'

    const clean = sanitizeTemplateHtml(dirty)

    expect(clean).toBe("<div>x</div>")
  })

  test("keeps the formatting whitelist and merge tokens intact", () => {
    const dirty = "<p><strong>Total:</strong> {{invoice.total}}</p>"

    const clean = sanitizeTemplateHtml(dirty)

    expect(clean).toBe(dirty)
  })
})

describe("sanitizeTemplateHtml with the document profile", () => {
  test("keeps the absolute renderer's layout styles and drops everything else", () => {
    const dirty =
      '<div style="position:relative;left:8px;top:16px;width:240px;height:96px;overflow:hidden;float:left;z-index:99;display:flex">x</div>'

    const clean = sanitizeTemplateHtml(dirty, { profile: "document" })

    expect(clean).toContain("position:relative")
    expect(clean).toContain("left:8px")
    expect(clean).toContain("top:16px")
    expect(clean).toContain("width:240px")
    expect(clean).toContain("height:96px")
    expect(clean).toContain("overflow:hidden")
    expect(clean).not.toContain("display:flex")
    expect(clean).not.toContain("float")
    expect(clean).not.toContain("z-index")
  })

  test("keeps only whitelisted position values", () => {
    const dirty = '<div style="position:fixed;left:0">x</div>'

    const clean = sanitizeTemplateHtml(dirty, { profile: "document" })

    expect(clean).not.toContain("position:fixed")
  })

  test("keeps the table emission set on table elements", () => {
    const dirty =
      '<table style="width:100%;border-collapse:collapse"><thead><tr><th style="padding:4px 8px;border:1px solid #e2e8f0;text-align:left;vertical-align:top">H</th></tr></thead><tbody><tr><td style="padding:4px 8px;border:1px solid #e2e8f0;text-align:left;vertical-align:top">C</td></tr></tbody></table>'

    const clean = sanitizeTemplateHtml(dirty, { profile: "document" })

    expect(clean).toContain("<table")
    expect(clean).toContain("border-collapse:collapse")
    expect(clean).toContain("vertical-align:top")
    expect(clean).toContain("<th")
    expect(clean).toContain("<td")
  })

  test("keeps block style properties only with whitelisted value shapes", () => {
    const dirty =
      '<div style="background-color:#f8fafc;border:1px solid #e2e8f0;font-weight:600;color:red;background-color:url(evil)">x</div>'

    const clean = sanitizeTemplateHtml(dirty, { profile: "document" })

    expect(clean).toContain("background-color:#f8fafc")
    expect(clean).toContain("border:1px solid #e2e8f0")
    expect(clean).toContain("font-weight:600")
    expect(clean).not.toContain("color:red")
    expect(clean).not.toContain("url(")
  })

  test("keeps the ellipse shape's border-radius:50%", () => {
    const dirty = '<div style="border-radius:50%">x</div>'

    const clean = sanitizeTemplateHtml(dirty, { profile: "document" })

    expect(clean).toContain("border-radius:50%")
  })

  test("keeps only the three whitelisted font stacks", () => {
    const allowed = "<div style=\"font-family:'DM Sans', system-ui, sans-serif\">x</div>"
    const rejected = '<div style="font-family:Comic Sans MS">x</div>'

    expect(sanitizeTemplateHtml(allowed, { profile: "document" })).toContain("DM Sans")
    expect(sanitizeTemplateHtml(rejected, { profile: "document" })).not.toContain("Comic Sans")
  })

  test("admits exactly the emitted rotate() transform form and nothing else", () => {
    const emitted = '<div style="transform:rotate(45.5deg)">x</div>'
    const wholeDegrees = '<div style="transform:rotate(359deg)">x</div>'
    const outOfRange = '<div style="transform:rotate(360deg)">x</div>'
    const negative = '<div style="transform:rotate(-15deg)">x</div>'
    const matrix = '<div style="transform:matrix(1,0,0,1,10,10)">x</div>'
    const translate = '<div style="transform:translate(10px,10px)">x</div>'

    expect(sanitizeTemplateHtml(emitted, { profile: "document" })).toContain(
      "transform:rotate(45.5deg)"
    )
    expect(sanitizeTemplateHtml(wholeDegrees, { profile: "document" })).toContain(
      "transform:rotate(359deg)"
    )
    expect(sanitizeTemplateHtml(outOfRange, { profile: "document" })).not.toContain("transform")
    expect(sanitizeTemplateHtml(negative, { profile: "document" })).not.toContain("transform")
    expect(sanitizeTemplateHtml(matrix, { profile: "document" })).not.toContain("matrix")
    expect(sanitizeTemplateHtml(translate, { profile: "document" })).not.toContain("translate")
  })

  test("keeps renderer-generated images but still strips scripts", () => {
    const dirty =
      '<img src="uploads/templates/a.png" alt="Logo" style="width:100%;height:100%;object-fit:contain" /><script>alert(1)</script>'

    const clean = sanitizeTemplateHtml(dirty, { profile: "document" })

    expect(clean).toContain("<img")
    expect(clean).toContain("object-fit:contain")
    expect(clean).not.toContain("<script")
  })
})

describe("toPlainText", () => {
  test("strips markup and restores raw text characters", () => {
    expect(toPlainText("<p>A &amp; B &lt;Co&gt;</p>")).toBe("A & B <Co>")
  })
})
