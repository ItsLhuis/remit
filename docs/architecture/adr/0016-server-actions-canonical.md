# ADR-0016: Server actions as canonical write path; API routes for public/webhooks only

- **Status:** Accepted
- **Date:** 2026-05-13

## Context

[Architecture: API surface](../ARCHITECTURE.md#12-api-surface) defines the application API surface.
Server actions in `features/<feature>/mutations.ts` are the canonical write path for authenticated
application interactions.

API routes are reserved for cases that need an HTTP endpoint independent of the React application
interaction model: anonymous token routes, Stripe webhooks, health checks, and token-protected
metrics. Public API work may be added later with explicit scoped API tokens and generated
documentation.

This separation keeps ordinary form submissions close to feature modules while preserving route
handlers for externally invoked or anonymous surfaces.

## Decision

Server actions are the canonical write path for Remit application interactions. API routes exist
only for public or anonymous token routes, webhooks, health checks, metrics, and future explicitly
justified public APIs.

## Consequences

### Positive

- Authenticated writes share the same validation, service, persistence, event, and audit pattern.
- The externally reachable HTTP surface remains small and easier to secure.

### Negative

- Non-React consumers cannot automatically reuse every application write path as a REST endpoint.
- Server actions couple the primary UI workflow to Next.js conventions.

## Alternatives considered

### REST API for every write

A full internal REST API would be familiar and externally reusable. It was rejected because it would
duplicate validation and orchestration paths before Remit has a public API requirement.

### tRPC or GraphQL

Typed RPC or GraphQL could provide a single API layer. They were rejected because the App Router and
server actions already cover the authenticated UI, while public routes need simpler explicit HTTP
contracts.
