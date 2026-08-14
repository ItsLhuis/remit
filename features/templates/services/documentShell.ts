import { type TemplateType } from "../schemas"

import { getPageWidth } from "./canvasLayout"

// `renderTemplate` returns a positioned `<div>`, not a document: the in-app preview drops it into a
// page that already has a charset, a box model and a font. The PDF renderer has none of that, so
// this builds the shell around it — the one piece of markup in the pipeline that is authored here
// rather than derived from blocks.
//
// It is pure and lives beside the renderer for the reason ADR-0007 gives: the shell decides the
// document's physical size, and a wrong value here is a silently mis-sized PDF that only a human
// looking at the output would catch. Keeping it a pure function makes that assertable.

export type DocumentShellInput = {
  body: string
  type: TemplateType
  heightPx: number
}

export type DocumentShell = {
  html: string
  widthPx: number
  heightPx: number
}

export function buildDocumentShell({ body, type, heightPx }: DocumentShellInput): DocumentShell {
  const widthPx = getPageWidth(type)

  return {
    html: [
      "<!doctype html>",
      '<html><head><meta charset="utf-8" />',
      `<style>${shellCss(widthPx, heightPx)}</style>`,
      "</head><body>",
      body,
      "</body></html>"
    ].join(""),
    widthPx,
    heightPx
  }
}

// `@page` carries the same pixel size the caller passes to `page.pdf`, because Chromium honours the
// CSS page box over the print settings when the two disagree — a mismatch shows up as a hairline
// second page rather than as an error.
//
// The font stack is deliberately local-only. A web font would be a network request, and the renderer
// aborts every one of them (`lib/pdf/renderPdf.ts`), so a remote family would silently fall back
// mid-document instead of failing.
function shellCss(widthPx: number, heightPx: number): string {
  return [
    `@page{size:${widthPx}px ${heightPx}px;margin:0}`,
    "*{box-sizing:border-box}",
    "html,body{margin:0;padding:0}",
    `body{width:${widthPx}px;height:${heightPx}px;`,
    "font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;",
    "-webkit-print-color-adjust:exact;print-color-adjust:exact}"
  ].join("")
}
