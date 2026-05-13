# ADR-0011: Single Next.js app until a second artefact requires its own build

- **Status:** Accepted
- **Date:** 2026-05-13

## Context

[Architecture: Design philosophy](../ARCHITECTURE.md#2-design-philosophy) says to defer what is not
yet certain. [Architecture: Module boundaries](../ARCHITECTURE.md#5-module-boundaries) and
[Architecture: Business logic layer](../ARCHITECTURE.md#6-business-logic-layer) still structure
features and services so future package extraction is mechanical: closed feature boundaries,
framework-free services, and explicit public barrels.

Today Remit has one deployable artifact: the Next.js application. The Docker image, setup flow,
database migrations, CLI scripts, and self-hosting documentation all orbit that application.

A monorepo may become appropriate when a second artifact appears, such as a worker, CLI distributed
outside the image, plugin SDK, or documentation app that must share core business logic.

## Decision

Remit remains a single Next.js application until a second artifact requires its own build,
versioning, or release lifecycle.

## Consequences

### Positive

- Tooling, dependency management, and self-hosted builds stay simple.
- Architectural boundaries still prepare the codebase for later extraction without paying monorepo
  overhead now.

### Negative

- Future extraction will still require package setup, import moves, and release workflow work.
- Developers must keep boundaries clean without package-level compiler isolation.

## Alternatives considered

### Monorepo from the start

A monorepo would make future package boundaries explicit immediately. It was rejected because there
is only one artifact today, so the extra workspace, build, and publishing complexity would not buy
enough.

### Extract `packages/core` now

Moving services into a package now would enforce purity strongly. It was rejected because feature
domains are still evolving and premature extraction would slow ordinary application work.
