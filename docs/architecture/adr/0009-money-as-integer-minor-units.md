# ADR-0009: Money stored as integer minor units — no floating-point

- **Status:** Accepted
- **Date:** 2026-05-13

## Context

Remit performs financial calculations for proposals, invoices, payments, credit notes, taxes,
discounts, expenses, and reports.
[Architecture: Data layer, Money storage in depth](../ARCHITECTURE.md#money-storage-in-depth) calls
out the risk of IEEE 754 floating-point arithmetic in currency calculations.

The schema stores money values as `bigint` minor units on entities and line items. For EUR and USD,
one minor unit is one cent; currencies with different decimal exponents use that currency's ISO 4217
minor-unit scale. Currency is stored as an ISO 4217 code on the parent entity, and display
formatting uses `Intl.NumberFormat` with that currency code.

Freelancers need totals that reconcile exactly with invoices and payments. Rounding mistakes are not
cosmetic; they create accounting disputes and undermine trust in generated documents.

## Decision

Money amounts are stored as integer minor units in `bigint` columns. Remit does not store currency
amounts as floating-point values.

## Consequences

### Positive

- Addition, subtraction, and comparison of money values are exact integer operations.
- Database constraints can enforce non-negative totals without decimal precision ambiguity.

### Negative

- Currencies or calculations requiring sub-minor-unit precision need explicit rounding rules before
  storage.
- TypeScript code must preserve safe integer ranges when Drizzle maps `bigint` columns into runtime
  values.

## Alternatives considered

### Floating-point numbers

Floats are easy to use in JavaScript. They were rejected because tiny representation errors can
change tax and total calculations in user-visible documents.

### SQL `numeric`

`numeric` can represent decimal money accurately in PostgreSQL. It was rejected as the default
storage shape because application code would still need careful decimal handling, while integer
minor units keep service logic simpler and more predictable.
