# DR-0020: Dashboard and reports

- **Status:** Shipped
- **Date:** 2026-08-18
- **Verdict:** Complete with known gaps
- **Decisions:** ADR-0007
- **Supersedes:** —
- **Reconstructed:** yes

## What

The dashboard overview — KPI tiles, a cashflow chart, receivables ageing, attention items and recent
activity — and the reports surface aggregating revenue, time, expenses and tax with CSV export.

## Why

Everything else in Remit records one thing at a time. Neither the freelancer's own question — am I
ahead or behind this quarter — nor their accountant's — what was the tax by rate last year — can be
answered by opening records one by one. They are one record because they are the same capability
read at two distances: the dashboard answers "how am I doing" at a glance, reports answer "show me
the numbers" with filters.

## Scope

Included: dashboard period selection, revenue and delta summaries, receivables and their ageing,
expense spend, invoice lifecycle counts, lead pipeline, top clients, unbilled work, upcoming
invoices and schedules, attention items, a twelve-month cashflow series; reports covering revenue by
client, project, month and tax rate, time by project and billable status, expenses by category, a
tax summary by rate, a filterable window, and CSV export.

Excluded: PDF export of a report. `README.md` describes "CSV and PDF export"; only CSV exists. Also
excluded: a stored aggregate or materialised view — every number is computed at read time, because a
cached total that disagrees with the records is worse than a slower page.

## How

The whole surface is pure services over rows, per ADR-0007: sixteen dashboard services and eight
report services take plain query results and return the shapes the UI renders. That is why fifteen
dashboard service test files and seven report ones can run in milliseconds with no database and no
mocking, and it is the clearest payoff of the purity rule in the repository.

Money stays in integer minor units through the aggregation and is formatted only at the boundary.
Currency totals are kept per currency rather than summed across them, because adding EUR to USD
produces a number that is wrong in a way nobody notices.

Report windows are computed with explicit UTC construction rather than local dates, so a report run
from a different time zone covers the same period.

## Evidence

- `features/dashboard/services/` — sixteen modules including `buildCashflowSeries.ts`,
  `summarizeReceivablesAging.ts`, `summarizeUnbilledWork.ts`, `selectAttentionItems.ts`,
  `currencyTotals.ts`, `dashboardPeriod.ts`
- `features/dashboard/queries.ts`, `features/dashboard/signalQueries.ts`
- `features/reports/services/` — `aggregateRevenue.ts`, `aggregateTaxBuckets.ts`,
  `aggregateTimeByProject.ts`, `aggregateExpensesByCategory.ts`, `reportWindow.ts`,
  `buildReportCsvRows.ts`, `reportTable.ts`
- `app/(dashboard)/page.tsx`, `app/(dashboard)/reports/`
- `lib/utils/format.ts` — the shared locale-aware formatters
- `docs/architecture/adr/0007-pure-services.md`

## Verification

Fifteen dashboard service test files and seven report service test files cover the aggregation,
bucketing, period arithmetic, currency separation and CSV row construction, including empty and
single-row edge cases. Date-dependent tests run against a frozen clock.

Not covered by an automated test: the rendered charts. Chart components are lazily loaded and
verified by eye; the series they consume are what carries the test coverage.

## Known gaps

Reports export CSV only. `README.md` promises PDF export and `features/reports/` contains no PDF
path, although the rendering pipeline it would use exists.
