# DR-0039: Report PDF export

- **Status:** Shipped
- **Date:** 2026-09-08
- **Verdict:** Complete with known gaps
- **Decisions:** ADR-0007, ADR-0009, ADR-0019, ADR-0022, ADR-0023
- **Supersedes:** —

## What

Every report can be exported as a paginated PDF, rendered in the worker and downloaded through a
credentialed route.

## Why

Reports shipped with a CSV export and nothing else. `README.md` promised "CSV and PDF export" until
the documentation reconciliation removed the unbuilt half, and `features/reports/` contained no PDF
path at all — the string "pdf" appeared nowhere in it. The renderer that every document PDF already
travels through (`lib/pdf/`, ADR-0022) had no reader outside the five document kinds, so a report a
freelancer wanted to hand an accountant existed only as a spreadsheet.

## Scope

Included: a `report_exports` row per request, a `report.pdf.render` job that renders in the worker,
the A4 document as a pure service, a credentialed download route, and the export control on the
reports page with its in-flight and failure states.

Excluded, deliberately:

- **A report `template_type`.** The templates editor is a free-canvas block editor for fixed-height
  documents; a report is a variable-length data table whose page count depends on its rows. Adding a
  type would drag in the editor, the merge variables, the seed data and the export manifest to gain
  customisation of a table nobody styles.
- **A history surface.** Unlike a data export, a report PDF is derived from live data and is stale
  the moment anything changes, so listing past ones would offer stale artifacts as if they were
  current. The row exists for the job and the download, not for browsing.
- **Extending `DocumentPdfKind`.** That union names documents that carry a `pdf_upload_id`, and
  `findDocumentPdf` resolves each one through its own table; a report has no row to point back at,
  so a `report` member would be a case that union could not answer.
- **An `uploads` row for the artifact.** Storing it in the `documents` bucket would make every
  report PDF travel inside a data export as though it were a business record, and would need a
  second rule to keep them out.
- **A `filename` column.** The name is `report` plus `created_at`, both already on the row.

## How

The delivery shape is the `data_exports` shape, scaled down: a row, a job, a polled status, an
object in the credentialed exports bucket, and one route out. The three questions that settle it
answer differently from a data export in one place each. The artifact is **transient** — asking
again is cheaper than keeping it, which is why there is no history and no `uploads` row. It **is**
audit-logged, because the same rows leaving as a PDF are the same disclosure the CSV export already
records. It does **not** appear in a data export: the `report_exports` row travels as an instance
table, its `storage_key` is excluded like `data_exports.storage_key`, and the object stays out
because nothing in `uploads` points at it.

The load-bearing decision is that pagination is computed in a pure service rather than left to the
browser. `renderHtmlToPdf` exposes no header or footer template — its signature is HTML plus a page
size — and Chromium implements no CSS page counter, so "Page 3 of 7" cannot come from the renderer.
`services/reportDocumentPages.ts` measures the rows against a fixed geometry instead and emits one
`<section class="page">` per printed page, each with its own repeated `<thead>` and its own footer.
That yields the page numbers, the repeating header, and the guarantee that no row is ever split,
from one place a test can assert without launching a browser. The price is that every row occupies
exactly `REPORT_ROW_HEIGHT_PX`, so the document's CSS clamps a wrapping label to two lines inside
that height; the CSS constants and the pagination constants are the same constants, and a change to
one without the other overflows a page silently.

The report query travels on the row rather than in the job payload, so a re-delivered job renders
the same report, and it is re-parsed at the job boundary rather than trusted. That boundary is
weaker than it looks: the value is jsonb another process wrote, its dates come back as ISO strings,
and nothing in the column constrains the report vocabulary. `storedReportQuerySchema` therefore
differs from the request schema in both directions — the dates coerce, and the report deliberately
does _not_ fall back to the default, because rendering a report nobody asked for and calling it
ready is worse than failing.

`formatReportCell` became a shared service in the same change. `reportTable.ts` had always said a
cell carries its kind because "the same number has to reach a locale-aware renderer and a
machine-readable CSV column"; the PDF is the third reader of that same rendering, and three copies
of one money format is a defect a reader has to reconcile.

## Evidence

- Schema and migration: `database/schema/reportExports.ts`, `report_export_status` in
  `database/schema/enums.ts`, `drizzle/migrations/0006_many_jean_grey.sql`, documented as SCHEMA.md
  section 28.
- Pure document: `features/reports/services/reportDocument.ts` and
  `features/reports/services/reportDocumentPages.ts`, tested in
  `features/reports/services/__tests__/reportDocument.test.ts` and
  `.../reportDocumentPages.test.ts`.
- Render path: `features/reports/pdfRenderJob.ts` (`renderReportPdf`), registered in
  `features/reports/jobs.ts`, catalogued as `report.pdf.render` in `lib/jobs/types.ts`, loaded by
  `scripts/core/worker/loadWorkerFeatureModules.ts` and declared in `.fallowrc.json`.
- Request and poll: `features/reports/pdfExport.ts`, gated by `requireReportExport` in
  `features/reports/mutationContext.ts` (extracted from `mutations.ts`, which now shares it).
- Download: `app/api/report-exports/[id]/route.ts`, backed by `getReportExportArtifact` in
  `features/reports/queries.ts`.
- Surface: `features/reports/hooks/useReportPdfExport.ts`,
  `features/reports/components/ReportsPage/ReportFilters.tsx` and `.../ReportsPage.tsx`.
- Integration tests: `features/reports/__tests__/pdfExport.integration.test.ts`,
  `features/reports/__tests__/pdfRenderJob.integration.test.ts`,
  `app/api/report-exports/[id]/__tests__/route.integration.test.ts`.
- Registrations a new table needs: `scripts/core/domainData/inventory.ts`,
  `features/dataExport/services/exportInstanceTables.ts`, `features/dataExport/queries.ts`.

## Verification

`pnpm typecheck`, `pnpm lint` (zero errors; the two `max-lines` warnings are pre-existing in
`features/templates`), `pnpm test` (2164 passed), `pnpm test:integration` (774 passed) and
`pnpm build` all pass, and the build lists `/api/report-exports/[id]` without pulling Chromium into
the Next.js graph. react-doctor and fallow report nothing against `features/reports`;
`features/**/services/**` coverage for this feature is 98.79% statements, 93.75% branches, 100%
lines.

The paged layout was verified against a real Chromium: the same launch flags and `page.pdf` options
`lib/pdf/renderPdf.ts` uses were driven over three documents — an empty report, a single-page
report, and a 120-row two-currency report — and the printed page count matched the count the pure
service computed in every case (1/1, 1/1, 4/4). Rendered pages were inspected as images: the
document states its report, business, date range, filters, generated timestamp and row count;
figures are right-aligned with tabular numerals in the group's currency; each page repeats the table
header and carries "Page n of m"; a currency heading never sits alone above a page break; and the
per-currency total row follows its own rows.

Not covered: the flow was **not** run end to end through Redis, MinIO and the real worker, and no
file was opened in a desktop PDF reader — the render was exercised through the same Chromium API the
worker uses, not through the queue. The keyboard-only path and the screen-reader announcement were
implemented against the rules but not manually exercised.

## Known gaps

- `report_exports` rows and their stored objects accumulate; nothing purges them. `data_exports` has
  the same property and the retention sweep covers neither.
- A figure wider than its column is clipped rather than shrunk. The figure font already steps down
  on a report with five or more numeric columns, which holds a six-figure amount; an instance
  invoicing in the millions on the widest report would lose digits.
- A row label longer than two lines at the row height is clipped. The CSV export carries the full
  label.
- The download route gates on role, not on who requested the export: any owner or accountant may
  fetch any report export, which is the same population that may generate one.
- `features/**/services/**` branch coverage across the repository is 85.34%, below the 90% threshold
  configured in `vitest.config.ts`. Every directory under it is one this work did not touch, and
  `.github/workflows/ci.yml` runs `pnpm test`, never `pnpm test:coverage`, so the threshold is not
  enforced anywhere today.
