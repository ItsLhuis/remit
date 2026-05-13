# ADR-0001: No cookies for routing state

- **Status:** Accepted
- **Date:** 2026-05-13

## Context

Remit has a first-run path, an authenticated application path, and mandatory setup steps before the
dashboard is available. `proxy.ts` enforces this by checking whether any user exists, reading the
active Better Auth session, reading the business profile from `settings`, and checking TOTP state on
the session.

[Architecture: Security architecture, Routing state rule](../ARCHITECTURE.md#routing-state-rule)
defines the same state machine: no user redirects to `/register`, no active session redirects to
`/login`, incomplete business profile or missing TOTP redirects to `/setup`, and a complete setup
allows the dashboard. The rule explicitly says that no routing decision is stored in cookies.

Self-hosted deployments make stale local state common: users may restore backups, rotate secrets, or
recover accounts through CLI tools. Cookies would survive those operations in browsers while the
database and session state changed underneath them.

## Decision

Authentication and onboarding routing state is derived only from the database and the active Better
Auth session. Remit will not store setup, onboarding, or authorization routing state in cookies.

## Consequences

### Positive

- Routing has one source of truth and follows restored database state.
- Client-controlled or stale cookie values cannot bypass setup, login, or TOTP gates.

### Negative

- Middleware performs database and session reads for protected navigation.
- If the database or auth session lookup is unavailable, routing cannot fall back to cached browser
  state.

## Alternatives considered

### Cookie-backed setup flags

A signed cookie could record that setup is complete and avoid a settings lookup. It was rejected
because restore, CLI recovery, and TOTP enrollment changes must take effect immediately across all
browsers.

### Client-side route guards

React-side guards could redirect after hydration. They were rejected because protected content could
briefly render or be fetched before the guard runs, and public token routes need server-side
security headers.
