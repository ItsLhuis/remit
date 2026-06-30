# ADR-0022: Headless-browser PDF rendering (Puppeteer/Playwright)

- **Status:** Accepted
- **Date:** 2026-06-30

## Context

Invoices, proposals, contracts, and credit notes all produce PDFs: invoice and proposal PDFs are
attached to outbound email (`email_logs.pdf_attached`), signed contract PDFs are stored as uploads
(`contract_signatures.signed_pdf_upload_id`), and the templates editor (block-based content with a
live preview) must render a PDF that matches what the user composed. Three rendering engines are
candidate options: a headless browser (Puppeteer/Playwright), `react-pdf`, and `pdfmake`.

The templates feature is a Figma-like, block-based, WYSIWYG editor with an in-app live preview. The
decisive criterion is fidelity: the rendered PDF must match the editor preview, and the block model
already serializes naturally to HTML/CSS. `react-pdf` constrains layout to its own CSS subset, and
`pdfmake` introduces a third representation distinct from both the editor and the preview, forcing
the block model to be serialized twice and risking divergence between preview and output.

## Decision

PDFs are rendered by a headless Chromium browser driven by Puppeteer/Playwright. Document HTML is
produced from the same block model and template renderer that powers the in-app preview, then
printed to PDF by the headless browser. The renderer that turns blocks + merge data into HTML stays
a pure service (no IO); only the print-to-PDF step performs IO and is invoked from the job/worker
layer (see ADR-0023), never inline in a request handler.

Chromium is a build/runtime dependency of the application image. PDF generation runs as a background
job rather than synchronously in a server action, so cold-start and memory cost never block a user
request.

## Consequences

### Positive

- The editor preview and the rendered PDF share one HTML/CSS path, so what the user composes is what
  they get.
- Full CSS fidelity (web fonts, flexbox/grid, page breaks) with no renderer-specific layout subset.
- The block-to-HTML renderer remains a pure, unit-testable service per ADR-0007.

### Negative

- Chromium is a heavy dependency in the Docker image (size and memory footprint).
- A misconfigured headless browser is a remote-content/SSRF risk surface; rendering runs only on
  trusted, server-generated HTML with external resource loading disabled.
- PDF generation must be asynchronous (a job), adding a dependency on the job layer (ADR-0023).

## Alternatives considered

### `react-pdf`

Lightweight, no browser dependency, but its CSS subset cannot reproduce the block editor's layout
faithfully, so the preview and the PDF would diverge. Rejected on fidelity.

### `pdfmake`

Very lightweight and programmatic, but introduces a third document representation distinct from the
editor's block model and the HTML preview, doubling the serialization surface and the divergence
risk. Rejected on fidelity and maintenance cost.
