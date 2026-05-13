# ADR-0004: Closed feature modules with ESLint enforcement

- **Status:** Accepted
- **Date:** 2026-05-13

## Context

[Architecture: Module boundaries, Feature module shape](../ARCHITECTURE.md#feature-module-shape)
defines each domain feature under `features/<feature>/` as a closed module with components, hooks,
services, queries, mutations, schemas, events, and public barrels. The rule file
`.agents/rules/architecture.md` repeats the same shape and specifies which code is safe to export
from `index.ts` and `server.ts`.

ESLint boundary rules enforce this shape. Features may consume another feature only through its
public barrel, while service files are forbidden from importing Next.js, React, Drizzle, the
database, queries, or mutations.

The roadmap spans many domains: leads, clients, projects, proposals, contracts, invoices, payments,
credit notes, reporting, and operations. Without enforced boundaries, small direct imports between
features would accumulate into hidden coupling.

## Decision

Remit uses closed feature modules with ESLint-enforced import boundaries. Cross-feature imports go
through public feature barrels, and pure services remain isolated from framework and IO imports.

## Consequences

### Positive

- Feature internals can change without silently breaking other domains.
- The codebase remains ready for future extraction into packages if a second artifact appears.

### Negative

- Adding or moving shared behavior often requires explicit barrel exports.
- ESLint configuration becomes part of the architecture and must be maintained when directories
  change.

## Alternatives considered

### Convention-only boundaries

Relying on review discipline would be cheaper at first. It was rejected because boundary violations
are easy to miss and become expensive only after many features depend on them.

### Technical layers instead of feature modules

A structure grouped by `components`, `services`, and `queries` would feel familiar. It was rejected
because Remit's change pressure is domain-oriented, so feature locality matters more than layer
locality.
