# DR-0018: Time tracking and expenses

- **Status:** Shipped
- **Date:** 2026-08-06
- **Verdict:** Complete with known gaps
- **Decisions:** ADR-0017
- **Supersedes:** —
- **Reconstructed:** yes

## What

A start/stop timer and manual time entries against projects and tasks with a resolved hourly rate,
and expenses with categories, receipts and a re-billable flag with markup.

## Why

These are the two places a freelancer's money leaks. Unlogged hours are unbilled hours, and an
expense nobody recorded is one the client never reimburses. They are one record rather than two
because they are the same capability from the product's side: capture what a piece of work cost
while it is happening, so it can be billed later.

## Scope

Included: a running timer with a database-backed running state, manual entries, duration arithmetic,
the hourly rate precedence chain, billable and unbilled marking, aggregation by project and client;
expenses with configurable categories, receipt uploads, the re-billable flag with markup, and CSV
export for an accountant.

Excluded: conversion into invoice line items. The columns exist — `line_items.source_time_entry_id`
and `source_expense_id` — and no application path writes them. The excluded half is named here
rather than left implied, because both `README.md` and the architecture describe the conversion as
though it ships.

## How

The hourly rate is resolved through a precedence chain — entry, then task, then project, then
client, then the instance default — in `resolveHourlyRate.ts` as a pure service. It is a service
rather than a query fallback chain because the same precedence has to hold for a running timer, a
manual entry and any later billing path, and three copies would eventually disagree.

Only one timer runs at a time, enforced by a partial index on the running state rather than by the
mutation checking first. The index is the structural form of the rule: a check-then-write can race
with itself, an index cannot.

`expenseRebilling.ts` computes the re-billed amount including markup as a pure function, so the
number a client would be charged is derivable and testable without an invoice existing.

## Evidence

- `features/timeTracking/services/resolveHourlyRate.ts`, `timeEntryDuration.ts`,
  `aggregateBillableHours.ts`
- `features/expenses/services/expenseRebilling.ts`, `buildExpenseCsvRows.ts`, `summarizeExpenses.ts`
- `database/schema/timeEntries.ts` — the running-timer index; `database/schema/expenses.ts`
- `features/settings/invoicing/` — the instance default hourly rate; `database/schema/clients.ts` —
  the client default
- `app/(dashboard)/time/`, `app/(dashboard)/expenses/`
- `docs/architecture/adr/0017-polymorphic-line-items.md`

## Verification

Service tests cover the rate precedence chain including every fallback level, duration arithmetic,
billable aggregation, re-billing markup and CSV row construction. Integration tests cover the
mutations and queries for both features against a real Postgres, including the single-running-timer
constraint. Schema tests pin the validation contracts.

Not covered: the conversion path, because it does not exist. `.agents/rules/testing.md`'s canonical
end-to-end flow 3 — time entry to invoice to sent to paid — therefore has no Playwright spec.

## Known gaps

Neither unbilled time nor a re-billable expense can become an invoice line item.
`line_items.source_time_entry_id` and `source_expense_id` are written only by the demo seeder, and
`invoiced_in_id` is written only by the retainer branch of recurring generation.
