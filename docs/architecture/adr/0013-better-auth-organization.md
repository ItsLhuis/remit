# ADR-0013: Better Auth organization plugin for multi-user role storage

- **Status:** Accepted
- **Date:** 2026-05-13

## Context

[Architecture: Multi-user model](../ARCHITECTURE.md#10-multi-user-model) layers light multi-user
access onto the single-instance model. There is one Remit organization per instance, every
authenticated user is a member of it, and roles are limited to `owner`, `accountant`, and
`assistant`.

The Better Auth organization plugin integration requires Remit to mirror the installed plugin's
schema contract for organizations, members, invitations, session active organization state, roles,
and invitation lifecycle. Runtime code manages this state through Better Auth APIs rather than
direct writes to plugin-owned tables.

The goal is multi-user role storage and invitations without introducing `tenantId` columns or
building a parallel authentication schema.

## Decision

Remit uses the Better Auth organization plugin as the storage and API layer for multi-user roles,
membership, invitations, and active organization state, constrained to one organization per
instance.

## Consequences

### Positive

- Remit inherits invitation and membership behavior from the authentication system.
- Domain tables remain free of tenant scoping while sessions still carry active role context.

### Negative

- Remit must track Better Auth plugin schema and API changes during upgrades.
- The plugin includes multi-organization concepts that Remit intentionally does not expose.

## Alternatives considered

### Custom membership tables

Remit could define its own `members` and `invitations` tables. It was rejected because that would
duplicate Better Auth responsibilities and increase the risk of session and role drift.

### Add organization foreign keys to domain tables

This would make every record explicitly belong to an organization. It was rejected because a Remit
instance has exactly one business dataset, and the extra key would reintroduce tenant-style queries.
