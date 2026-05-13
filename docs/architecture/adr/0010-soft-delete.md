# ADR-0010: Soft delete by default — hard delete after retention window

- **Status:** Accepted
- **Date:** 2026-05-13

## Context

Remit stores business records that may be needed for legal, tax, contractual, or client support
reasons after a user removes them from the active workspace.
[Architecture: Security architecture, Data export and deletion](../ARCHITECTURE.md#data-export-and-deletion)
defines GDPR-aligned export and deletion behavior, including restorable domain entities and hard
delete after a configurable retention period.

Domain tables such as clients, projects, proposals, invoices, line items, tax rates, and templates
use `deletedAt` through the shared `softDelete` helper. Insert-only logs, uploads, and auth tables
are treated differently because their lifecycle is not the same as editable domain data.

The model must balance user recovery, financial record retention, and eventual erasure.

## Decision

Domain entities use soft delete by default through nullable `deletedAt`. Hard delete is available
only after the configured retention window and with explicit confirmation for destructive cascades.

## Consequences

### Positive

- Users can restore accidentally deleted business records.
- Financial and client records can remain available during retention periods needed for operations
  or compliance.

### Negative

- Queries must consistently exclude soft-deleted rows from normal views.
- Data volume grows until retention cleanup runs, and erasure requests require careful hard-delete
  workflows.

## Alternatives considered

### Immediate hard delete

Immediate deletion is simple and minimizes retained data. It was rejected because accidental
deletion of invoices, clients, or project records would be difficult or impossible to recover.

### Archive tables

Moving deleted rows to parallel archive tables would keep active queries smaller. It was rejected
because every domain would need duplicate schema, migrations, and restore logic.
