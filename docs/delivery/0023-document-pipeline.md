# DR-0023: Document pipeline — PDF rendering and email

- **Status:** Shipped
- **Date:** 2026-08-14
- **Verdict:** Complete with known gaps
- **Decisions:** ADR-0022, ADR-0023
- **Supersedes:** —
- **Reconstructed:** yes

## What

The consumer half of the document pipeline: headless-browser PDF rendering for every document type,
document email with the PDF attached, and the public routes that serve a rendered document.

## Why

Five document features had been written as producers — each enqueuing a render job and each
forbidden from rendering inline — and no feature had ever owned the consumer. The job names existed,
the queue accepted them, and nothing anywhere turned one into a PDF. The email templates were the
same shape: `email_*` template types existed and were wired to nothing. A capability that every
stage assumes the previous one built is a capability nobody builds.

## Scope

Included: the renderer over a headless browser, storage and retrieval of rendered PDFs, inlining of
storage assets so the renderer needs no network, document data builders for invoices, proposals,
contracts and credit notes, the document shell and merge-field resolution shared with the template
editor, document email with attachment delivery, the public document routes, and the worker wiring
that loads feature modules so their handlers register.

Excluded: rendering inside the web request. ADR-0022 forbids it and the reason is concrete — a
headless browser in a request handler ties up memory and a process for seconds at a time. Also
excluded: a PDF path for reports, which was not part of this pipeline's scope.

## How

The renderer produces the document from the same template shell the editor edits, so what a
freelancer arranges on the canvas is what the PDF contains. Merge fields resolve against real
document data through one shared resolver rather than one per document type.

`inlineStorageAssets.ts` embeds images before rendering, because the headless browser must not need
credentials or network reachability to the object store — it renders from a self-contained document.

Every render is a job with an entity-scoped id, so a retry cannot produce two PDFs for one document.
The signed contract PDF additionally carries a guard refusing to overwrite an existing one.

Feature modules are imported explicitly in the worker entrypoint. Handler registration happens at
module load, so a worker that never imports a feature silently consumes nothing for it — which is
the failure this pipeline exists to have fixed rather than repeated.

## Evidence

- `lib/pdf/` — `renderPdf.ts`, `storeDocumentPdf.ts`, `findDocumentPdf.ts`, `inlineStorageAssets.ts`
- `features/invoices/pdfRenderJob.ts`, `features/proposals/pdfRenderJob.ts`,
  `features/contracts/pdfRenderJob.ts`, `features/creditNotes/pdfRenderJob.ts`
- `features/invoices/documentData.ts`, `features/proposals/documentData.ts`,
  `features/contracts/documentData.ts`
- `features/email/documentEmail.ts`, `features/templates/emailRendering.ts`,
  `features/templates/services/documentShell.ts`, `mergeFields.ts`
- `app/api/documents/[type]/[id]/route.ts`, `scripts/worker.ts`
- `lib/jobs/types.ts` — the render and email job catalog
- `docs/architecture/adr/0022-pdf-rendering-engine.md`

## Verification

`features/email/__tests__/documentEmail.integration.test.ts` covers attachment delivery.
`features/contracts/__tests__/signedPdfGuard.integration.test.ts` covers the no-overwrite guard.
Document data builders are covered by `documentData.integration.test.ts` in the invoices, proposals
and contracts features. `lib/jobs/__tests__/jobCatalog.integration.test.ts` asserts every job name
in the catalog has a registered handler — the test that exists specifically because five names once
did not.

Not covered by an automated test: the visual fidelity of the produced PDF. Rendering is verified by
eye against the canvas.

## Known gaps

Reports have no PDF path despite `README.md` promising one; the renderer they would use is here.
