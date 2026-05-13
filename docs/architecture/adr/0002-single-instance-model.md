# ADR-0002: Single-instance model is structural

- **Status:** Accepted
- **Date:** 2026-05-13

## Context

Remit is self-hosted by default.
[Architecture: Design philosophy](../ARCHITECTURE.md#2-design-philosophy) defines data ownership and
single-instance simplicity as core design principles: the instance owns the domain dataset, and
users inside the instance differ by role rather than by tenant.

[Architecture: Multi-user model](../ARCHITECTURE.md#10-multi-user-model) explains how light
multi-user access is layered on top of this model. Better Auth organization membership stores roles,
but domain tables remain instance-scoped. The model is meant to support an owner, accountant, or
assistant working on the same business records, not separate customer workspaces inside one
database.

The Hosted offering preserves the same shape by isolating each customer in a dedicated instance.
That keeps self-hosting and Hosted mode on the same schema and avoids a separate hosted-only data
model.

## Decision

Domain entities have no `tenantId` column. Remit is structurally a single-instance application, with
multi-user access represented by roles on the one instance organization rather than tenant scoping
in domain queries.

## Consequences

### Positive

- Every domain query is simpler and avoids an entire class of missing-tenant-filter bugs.
- The same schema works for self-hosted installs and Hosted per-instance deployments.

### Negative

- A shared-database, many-customer Hosted platform is not possible without a later architecture
  change.
- Hosted operations must provision and monitor more isolated instances instead of packing tenants
  into one database.

## Alternatives considered

### `tenantId` on every domain table

This would support shared-database multi-tenancy. It was rejected because it adds tenant filtering
to every query for a product whose primary deployment model is one business per instance.

### PostgreSQL row-level security

RLS could enforce tenant isolation in the database. It was rejected because it still requires tenant
keys throughout the schema and would make self-hosted debugging and migrations harder for little
benefit in the chosen deployment model.
