# ADR-0007: Pure business logic in `services/` — no framework imports

- **Status:** Accepted
- **Date:** 2026-05-13

## Context

[Architecture: Business logic layer, The services pattern](../ARCHITECTURE.md#the-services-pattern)
defines `features/<feature>/services/` as the home for non-trivial calculations, state transitions,
validations, and transformations. `.agents/rules/architecture.md` makes the rule concrete: services
must not import Next.js, React, Drizzle, the database, or IO modules.

Server actions and queries are thin orchestrators. They validate input, call services for branching
business logic, persist through Drizzle, emit events, and return the standard action shape.

The codebase is intentionally structured so that core business logic can move to `packages/core`
when a CLI tool, worker, or SDK needs it. That extraction path only works if services are not tied
to the current web framework.

## Decision

Business logic lives in pure functions under `features/<feature>/services/`. These functions accept
their dependencies as input data and do not import framework, database, or IO modules.

## Consequences

### Positive

- Service tests run quickly without database connections, framework mocks, or network stubs.
- Calculations and state transitions are reviewable without understanding request lifecycle code.

### Negative

- Orchestrators must gather and pass more explicit input data into services.
- Some behavior is split across service and mutation files, which can feel indirect for very small
  changes.

## Alternatives considered

### Put logic inside server actions

This would reduce file count and indirection. It was rejected because actions would become hard to
test and would bind business rules to Next.js delivery mechanics.

### Repository-backed domain objects

Domain classes with repositories could centralize behavior and persistence. They were rejected for
now because Remit benefits more from simple pure functions and Drizzle's typed query layer than from
a heavier object model.
