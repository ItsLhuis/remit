# ADR-0018: No telemetry or analytics by default

- **Status:** Accepted
- **Date:** 2026-05-13

## Context

[Architecture: Design philosophy](../ARCHITECTURE.md#2-design-philosophy) states that data ownership
and privacy are non-negotiable. No feature or convenience trade-off justifies sending user data to
third parties without explicit opt-in configuration.

[Architecture: Infrastructure and deployment](../ARCHITECTURE.md#13-infrastructure-and-deployment)
applies that principle to deployment: all data is stored in the PostgreSQL instance owned and
operated by the user, and no analytics, telemetry, or usage data leaves the instance without
explicit configuration. Error tracking is opt-in through the deployment-owned `SENTRY_DSN`
environment variable.

Remit may contain confidential client names, amounts, project notes, invoice metadata, and business
operational patterns. Even "anonymous" telemetry can leak sensitive shape and timing information in
a self-hosted business tool.

## Decision

Remit sends no analytics, usage telemetry, or update-check data outside the instance unless the
operator explicitly configures that integration. Error tracking is disabled unless `SENTRY_DSN` is
set. Prometheus metrics are local pull-based operational data and are exposed only when protected by
the deployment-owned `REMIT_METRICS_TOKEN`.

## Consequences

### Positive

- The default deployment aligns with privacy, NDA, and GDPR expectations for self-hosted users.
- Operators can run Remit in restricted or offline environments without hidden outbound traffic.
- Sentry and metrics remain available for operators who deliberately configure them.

### Negative

- Maintainers receive less product usage data and fewer automatic crash reports.
- Support and debugging rely more on user-provided logs and explicitly configured observability.

## Alternatives considered

### Anonymous telemetry by default

Anonymous metrics could help product decisions and reliability work. It was rejected because
anonymization is hard to guarantee and default outbound traffic undermines the self-hosted promise.

### Bundled error tracking

A preconfigured Sentry-like service would improve crash visibility. It was rejected because error
events can include sensitive context unless the operator deliberately configures and accepts that
risk.

### Public metrics without an explicit token

Prometheus metrics are useful operational signals, but route names, status codes, job timings, and
queue depth can reveal business activity. Exposing them without `REMIT_METRICS_TOKEN` was rejected;
an unset token means metrics should remain unavailable rather than public.
