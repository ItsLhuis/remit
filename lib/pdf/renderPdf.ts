import { launch, type Browser, type Page } from "puppeteer-core"

import { env } from "@/lib/config/env"

// The IO half of ADR-0022, and the only place in the repository that touches a browser. Blocks and
// merge data become HTML in a pure service (`features/templates/services/renderTemplate.ts`); this
// file only prints that HTML. It runs in the worker process (ADR-0023) and never in a request.
//
// The trust boundary is here rather than in the caller. ADR-0022 records a misconfigured renderer as
// an SSRF surface, so this function is written to be incapable of reaching the network at all: every
// request is aborted, offline mode is set, JavaScript is disabled, and the document arrives as a
// string through `setContent` rather than as a URL the browser would fetch. A caller cannot opt out
// of any of that, because none of it is a parameter. Images must already be `data:` URIs — resolved
// server-side by the caller — since a remote `<img src>` is aborted here and renders as nothing.

export type RenderPdfInput = {
  html: string
  widthPx: number
  heightPx: number
}

const PAGE_LOAD_TIMEOUT_MS = 30_000

export async function renderHtmlToPdf({
  html,
  widthPx,
  heightPx
}: RenderPdfInput): Promise<Buffer> {
  const browser = await launchBrowser()

  try {
    const page = await browser.newPage()

    await isolatePage(page)

    await page.setContent(html, { waitUntil: "load", timeout: PAGE_LOAD_TIMEOUT_MS })

    // One page sized to the whole canvas rather than paginated A4. `getPageHeight` already returns
    // the document's full height, and the editor preview is a single continuous canvas, so slicing
    // it into paper pages here is the one thing that would make the PDF stop matching the preview —
    // which is the fidelity criterion ADR-0022 chose a browser for in the first place.
    const pdf = await page.pdf({
      width: `${widthPx}px`,
      height: `${heightPx}px`,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    })

    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}

// Launched per render and closed in a `finally`, rather than kept alive between jobs. A pooled
// browser would save roughly a second of startup on an operation that already runs in the
// background, and would cost a process that can wedge or leak across an instance that renders a
// handful of documents a day (ADR-0002). Worker concurrency is 1, so there is never a second render
// waiting on this one.
async function launchBrowser(): Promise<Browser> {
  const executablePath = env.REMIT_CHROMIUM_PATH

  // Not boot-fatal in `lib/config/env.ts`, unlike every other required variable: only the worker
  // image ships Chromium, and making it mandatory would stop the web application starting over a
  // binary it never runs. The failure surfaces here instead, on the one code path that needs it.
  if (!executablePath) {
    throw new Error(
      "REMIT_CHROMIUM_PATH is not set: the worker image must provide a Chromium executable to render PDFs"
    )
  }

  return await launch({
    executablePath,
    headless: true,
    args: [
      // Chromium's own sandbox needs privileges the worker container deliberately does not have, and
      // it defends against untrusted web content — a threat that does not exist on this path. What
      // this browser renders is a string this repository generated, with scripting off and every
      // request aborted, so the sandbox is guarding a document that can neither fetch nor execute.
      // Removing any of those three properties makes this argument wrong.
      "--no-sandbox",
      "--disable-setuid-sandbox",
      // Containers default to a 64MB /dev/shm, which Chromium exhausts on a tall document and then
      // crashes rather than degrades.
      "--disable-dev-shm-usage",
      "--disable-gpu"
    ]
  })
}

async function isolatePage(page: Page): Promise<void> {
  await page.setJavaScriptEnabled(false)
  await page.setOfflineMode(true)

  await page.setRequestInterception(true)

  // Belt and braces with `setOfflineMode` above, and deliberately not a URL allowlist: an allowlist
  // is a decision that has to stay correct as templates change, while "nothing leaves this process"
  // cannot rot. `data:` is what the caller inlines its images as, and aborting it would blank every
  // logo.
  page.on("request", (request) => {
    if (request.url().startsWith("data:")) {
      void request.continue()

      return
    }

    void request.abort()
  })
}
