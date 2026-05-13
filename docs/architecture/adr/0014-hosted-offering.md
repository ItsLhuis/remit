# ADR-0014: Hosted offering as per-instance isolation, not row-level tenancy

- **Status:** Accepted
- **Date:** 2026-05-13

## Context

Remit is open-source and self-hostable first.
[Architecture: Hosted offering](../ARCHITECTURE.md#18-hosted-offering) documents that a managed
Hosted product may exist alongside self-hosting for users who do not want to operate their own
infrastructure.

The same section makes one architectural commitment: one customer equals one isolated Remit
instance. Each Hosted customer gets the same Docker image, schema, database shape, and file volume
that a self-hoster uses.

This decision supports [Architecture: Design philosophy](../ARCHITECTURE.md#2-design-philosophy) and
[Architecture: Multi-user model](../ARCHITECTURE.md#10-multi-user-model): domain entities carry no
`tenantId`, and light multi-user access is implemented through roles inside the one instance
organization.

## Decision

The Hosted offering uses per-instance isolation for each customer. Remit will not implement Hosted
as row-level multi-tenancy inside a shared application database.

## Consequences

### Positive

- Self-hosted and Hosted deployments run the same application model and schema.
- Customer isolation does not depend on every domain query carrying correct tenant filters.

### Negative

- Hosted operations need provisioning, routing, backup, and monitoring per customer instance.
- Infrastructure density is lower than a shared-database multi-tenant SaaS.

## Alternatives considered

### Shared database with `tenantId`

This is a common SaaS model and can be operationally efficient. It was rejected because it would
contradict the single-instance schema and add tenant checks to every domain path.

### Separate hosted fork

A hosted-only codebase could optimize for SaaS operations. It was rejected because it would split
security, migration, and feature work from the open-source application.
