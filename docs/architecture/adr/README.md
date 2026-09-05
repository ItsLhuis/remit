# Architecture Decision Records

Each record captures one decision: the context it was taken in, the decision itself, its
consequences, and the alternatives that were rejected. A record that has shipped against code is
immutable — a later change creates a new record that supersedes it, and never rewrites this one.

The same table is carried in
[ARCHITECTURE.md section 20](../ARCHITECTURE.md#20-architecture-decision-records), which is where a
reader arriving from the architecture document finds it. `tests/docs/adr.test.ts` asserts the two
agree, so neither can drift from the other or from the files on disk.

What was subsequently _built_ against these decisions is recorded separately, one sealed record per
capability, in [`docs/delivery/`](../../delivery/README.md).

| ADR                                             | Title                                                                       | Status   |
| ----------------------------------------------- | --------------------------------------------------------------------------- | -------- |
| [0001](0001-no-cookie-routing.md)               | No cookies for routing state                                                | Accepted |
| [0002](0002-single-instance-model.md)           | Single-instance model is structural                                         | Accepted |
| [0003](0003-mandatory-totp.md)                  | Mandatory TOTP — no opt-out                                                 | Accepted |
| [0004](0004-feature-module-structure.md)        | Closed feature modules with ESLint enforcement                              | Accepted |
| [0005](0005-encryption-at-rest.md)              | AES-256-GCM encryption via Drizzle column helper                            | Accepted |
| [0006](0006-internal-event-bus.md)              | Typed in-process event bus for cross-feature effects                        | Accepted |
| [0007](0007-pure-services.md)                   | Pure business logic in `services/` — no framework imports                   | Accepted |
| [0008](0008-email-adapters.md)                  | SMTP and Resend as interchangeable adapter implementations                  | Accepted |
| [0009](0009-money-as-integer-minor-units.md)    | Money stored as integer minor units — no floating-point                     | Accepted |
| [0010](0010-soft-delete.md)                     | Soft delete by default — hard delete after retention window                 | Accepted |
| [0011](0011-monorepo-deferred.md)               | Single Next.js app until a second artefact requires its own build           | Accepted |
| [0012](0012-password-reset-paths.md)            | Password reset via email when available, CLI fallback otherwise             | Accepted |
| [0013](0013-better-auth-organization.md)        | Better Auth organization plugin for multi-user role storage                 | Accepted |
| [0014](0014-hosted-offering.md)                 | Hosted offering as per-instance isolation, not row-level tenancy            | Accepted |
| [0015](0015-i18next-typed-keys.md)              | i18next + ICU with TypeScript-typed message keys                            | Accepted |
| [0016](0016-server-actions-canonical.md)        | Server actions as canonical write path; API routes for public/webhooks only | Accepted |
| [0017](0017-polymorphic-line-items.md)          | Polymorphic line items via mutually-exclusive parent FKs                    | Accepted |
| [0018](0018-no-telemetry.md)                    | No telemetry or analytics by default                                        | Accepted |
| [0019](0019-storage-backend-adapters.md)        | Storage backend as swappable adapter — local FS by default, S3/R2/B2 opt-in | Accepted |
| [0020](0020-operational-cli-contract.md)        | Operational CLI contract                                                    | Accepted |
| [0021](0021-encryption-key-rotation.md)         | Encryption key rotation                                                     | Accepted |
| [0022](0022-pdf-rendering-engine.md)            | Headless-browser PDF rendering (Puppeteer/Playwright)                       | Accepted |
| [0023](0023-job-scheduling-bullmq-redis.md)     | Background jobs and scheduling via BullMQ + Redis                           | Accepted |
| [0024](0024-template-editor-canvas.md)          | Template editor — free collision-aware page-clamped canvas                  | Accepted |
| [0025](0025-instance-data-reset-scope.md)       | Instance data reset — domain data versus instance state                     | Accepted |
| [0026](0026-document-parentage.md)              | Document parentage — optional project, agreeing client, composite key       | Accepted |
| [0027](0027-contact-identity.md)                | Contact identity — delivery target and acceptance identity, never an entity | Accepted |
| [0028](0028-attachments-and-visual-identity.md) | Attachments — one table, one foreign key per parent, private bucket         | Accepted |
| [0029](0029-public-token-lifecycle.md)          | Public token lifecycle — one minter, and revocation as an absent token      | Accepted |
| [0030](0030-client-portal-exposure.md)          | Client portal exposure — an index, and never a signing link                 | Accepted |
