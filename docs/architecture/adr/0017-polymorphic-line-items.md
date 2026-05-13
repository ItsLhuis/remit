# ADR-0017: Polymorphic line items via mutually-exclusive parent FKs

- **Status:** Accepted
- **Date:** 2026-05-13

## Context

Line items appear on proposals, invoices, and credit notes. They share the same core data: position,
description, quantity, unit price cents, discounts, tax snapshot, totals, and source links to time
entries or expenses.

`database/schema/lineItems.ts` includes nullable `proposalId`, `invoiceId`, and `creditNoteId`
foreign keys plus `chk_line_items_parent`, which enforces that exactly one document parent is
present. `sourceTimeEntryId` and `sourceExpenseId` remain optional provenance links rather than
line-item parents.

The schema also keeps per-parent position uniqueness with partial unique indexes. That preserves
ordering within each document type without duplicating the line item schema.

## Decision

Line items belong to exactly one parent, represented by mutually exclusive nullable foreign keys to
proposal, invoice, or credit note and enforced by a database check constraint.

## Consequences

### Positive

- Shared line item behavior and constraints live in one table and one service model.
- Foreign key integrity is preserved for every supported parent type.

### Negative

- The table contains nullable parent columns, and application code must handle parent-specific paths
  carefully.
- Adding another line-item parent requires a schema migration, new index, and updated check
  constraint.

## Alternatives considered

### Separate line item tables

Proposal, invoice, and credit note line items could each have their own table. This was rejected
because the columns, constraints, and calculation rules are largely shared and would drift.

### Type discriminator with generic parent id

A `parentType` plus `parentId` pair would avoid nullable columns. It was rejected because PostgreSQL
could not enforce normal foreign keys to all possible parent tables.
