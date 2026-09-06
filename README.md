<img src="public/logo.png" width="80" height="80" />

# Remit

**Remit** is an open-source, self-hostable business management platform built for independent
freelancers — own your data, own your workflow, no subscriptions required.

## Why Remit

Most invoicing and project tools are SaaS: monthly fees, your client data on someone else's servers,
and lock-in to a vendor that can change pricing or shut down at any time. Remit is built for
freelancers who want full control: run it on your own server, own everything, encrypted at rest, and
never depend on a third party for the data that runs your business.

Running an instance on somebody else's behalf takes no application change and no shared database:
one customer is one isolated instance, running the same image and the same schema a self-hoster
runs. **Self-hosting is the first-class deployment model.**

Self-hosting is Docker Compose. The repository ships production, development and test Compose
assets, the password-reset recovery CLI, encrypted local and S3-compatible backups, destructive-safe
local and remote restores, encryption key rotation, deterministic demo-data seeding and its matching
instance data reset, and the host-side upgrade script and runbook.

## Principles

Remit is built around a small number of non-negotiable principles. Every feature decision is weighed
against these.

- **Data ownership and privacy first.** Sensitive credentials are encrypted at rest. Email and
  payment providers are pluggable adapters that you choose — never forced. Designed so that data
  covered by an NDA never has to leave your infrastructure.
- **Single-instance simplicity.** One Remit instance is one freelance business. No multi-tenancy, no
  per-seat pricing logic, no organisation hierarchy in the base model. Light multi-user support
  (accountant, assistant) is layered on top.
- **Self-hosting is part of the product.** Docker Compose deployment, health checks, local and
  S3-compatible backup and restore, encryption key rotation, operational recovery, and host-side
  upgrades are built and documented as product surfaces, not afterthoughts.
- **Modular by construction.** Each feature is a closed module with explicitly enforced boundaries.
  Business logic is pure and testable, decoupled from Next.js and Drizzle. The codebase is
  structured to scale to a multi-year roadmap without architectural debt.

## What Remit covers

The complete money lifecycle of an independent professional, from first contact to paid invoice.

```
Lead ──► Client ──► Project ──► Proposal ──► Contract
                       │                         │
                       ├── Time Entries          │
                       ├── Expenses              │
                       └── Tasks                 │
                                ▼                ▼
                             Invoice ◄───────────┘
                                │
                                ├── Payments (manual or Stripe)
                                └── Credit Notes
```

Any subset of this workflow is valid. Skip the proposal stage, invoice directly from a client, track
time without billing it — Remit adapts to the workflow you actually have.

## Features

**Lead pipeline.** Pre-client contacts with stages (New → Contacted → Qualified → Proposal Sent →
Won/Lost), source tracking, and one-click conversion to client.

**Clients & projects.** Complete client profiles with billing details, internal notes (encrypted),
and multi-currency support. Projects associate to clients with status, budget, and date tracking.
Lightweight task system with kanban view inside each project.

**Time tracking.** Built-in start/stop timer attached to projects and tasks, plus manual entry.
Hourly rate precedence: entry → task → project → client → instance default. Billable and unbilled
hours are tracked per project and surfaced on the dashboard. Select unbilled entries and bill them
onto a new draft invoice or an existing one, as one line per entry, per task, or per project, priced
from the rate each entry was logged at.

**Expenses.** Manual entry with receipt attachments, free-text categories that autocomplete from the
ones you have already used, and a re-billable flag with a markup percentage. Re-billable expenses
bill onto an invoice the same way time does, one line each, at the marked-up amount. CSV export for
accountants.

**Proposals.** Per-project proposals with line items (description, quantity, unit price, per-item
discount, tax). Lifecycle: Draft → Sent → Accepted → Rejected. Public token URL with OTP-secured
acceptance flow. One-click conversion to invoice on acceptance, or to a contract draft for signing.

**Contracts and e-signature.** Vinculative documents distinct from proposals. Block-based templates
(NDA, service agreement, retainer agreement). Public signing URL with full audit trail (IP,
user-agent, timestamp, typed full name) and a generated signed PDF.

**Invoices.** Generate manually or from an accepted proposal. Per-item discounts (percentage or
fixed), configurable tax rates, multi-currency with exchange rate snapshot. Lifecycle: Draft → Sent
→ Paid, with `overdue` and `partially_paid` computed at read time. Configurable reminder cadence
before and after the due date, sent by a background job.

**Recurring invoices and retainers.** Schedules generate invoices automatically (weekly, monthly,
quarterly, yearly). Retainer model with included hours per period and overage rate. End conditions
by date or count. Invoices generate as `draft` or auto-send.

**Payments.** Manual entry (bank transfer, cash, and others), and card payment by the client from
the invoice's own public link through Stripe-hosted checkout — the amount is the outstanding
balance, derived on the server, and the payment is recorded only by the signed webhook that confirms
it. Partial payment support — multiple payments per invoice with computed status, and a partially
paid invoice is payable for its remainder.

**Credit notes.** Created from existing invoices for corrections or returns. Own numbering sequence.
Required by Portuguese and EU law for invoice corrections.

**Public documents.** Every invoice, proposal and contract carries its own token URL a client opens
without an account: invoices to view and download, proposals to accept or reject behind an emailed
one-time code, contracts to sign with a full audit trail. Every link is rotatable and revocable from
the document it belongs to, without touching the document itself — a revoked link answers exactly
like one that never existed.

**Client portal.** One revocable link per client that lists everything they have been sent —
invoices with what is still outstanding per currency, proposals, contracts and the state of their
projects — with a way through to the invoices and proposals they already hold links to. Read-only:
it writes nothing, shows no internal notes, budgets or rates, and never offers a signing link,
because signing is the one anonymous action with no second factor.

**Dashboard.** KPI tiles (revenue MTD/YTD, outstanding, overdue, expenses, profit), 12-month
cashflow chart, upcoming invoices and proposals, top clients, recent activity.

**Reports.** Revenue by client/project/month/tax rate, time by project/client/billable status,
expenses by category, tax summary by rate. CSV export.

**Templates.** Block-based visual editor for invoice, proposal, contract, credit note, and email
templates. Merge variables, custom branding.

**Email.** Send invoices, proposals, contracts directly to clients. Supports your own SMTP server or
Resend. Configurable email templates per document type with merge variables.

**Multi-user.** Three roles: owner (the instance owner), accountant (read-only with export),
assistant (creates drafts, cannot send or delete). Mandatory TOTP for all roles. Light-touch
implementation that does not compromise the single-instance model.

**Internationalisation.** Full i18n infrastructure with type-safe message keys. English ships first;
adding a locale is purely additive.

## Security

Security is treated as a first-class feature, not a checklist.

- Mandatory TOTP at setup, with no opt-out. Backup codes are generated for second-factor recovery;
  password reset uses email when configured or the `remit:reset-password` operational CLI for
  self-hosted lockout recovery.
- AES-256-GCM encryption at rest for all sensitive credentials (SMTP, Resend, Stripe, IBAN, client
  notes).
- Append-only security audit log separate from the user-facing activity log — captures every
  authentication event, tripped rate limit, settings change touching money or security, deletion,
  data export, and backup or restore run. Enforced insert-only by a database trigger, not by
  convention.
- Public token security: 256-bit entropy from one shared minter, constant-time comparison,
  timing-safe error responses to defeat enumeration, `noindex` headers on every public document
  page, and owner-only rotation and revocation with an audit entry that never records the token.
- Strict HTTP security headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy,
  Permissions-Policy) enforced for every response.
- Rate limiting on every endpoint that processes authentication or a public token.
- GDPR-aligned data export, instance-wide or scoped to one client: every business record, every
  uploaded file and every generated PDF, assembled by a background job into an archive only the
  owner can download. The export is an allowlist of table _and_ column, with a test that fails when
  a new schema column is neither included nor explicitly excluded.

## Self-hosting

The repository ships Docker Compose assets for production, development, and test Postgres.

The production Compose file exposes the app for an existing reverse proxy and runs PostgreSQL plus
MinIO alongside the app container. The step-by-step path from a machine with Docker on it to an
instance you are logged into is the [installation runbook](./docs/operations/INSTALL.md).

Operational support:

- **Entrypoint migrations** - the app container runs the compiled migration script before starting
  the Next.js server.
- **Health dashboard** - `/settings/system` shows database connectivity, email/Stripe/storage
  reachability, backup destination and success/failure status, disk usage, and the encryption key
  fingerprint.
- **CLI tools** - shipped in-container commands:
  - `pnpm remit:backup` writes an AES-256-GCM encrypted `.remitbak` archive containing
    `pg_dump --format=custom` output and uploads. The archive contract is documented in
    [`docs/architecture/specs/BACKUP-ARCHIVE.md`](./docs/architecture/specs/BACKUP-ARCHIVE.md).
  - `pnpm remit:restore <backup-file>` and remote `remit://<destination>/<key>` restores validate,
    decrypt, snapshot, and replace live data from a `.remitbak` archive. Restore safety details are
    documented in [`docs/operations/RESTORE.md`](./docs/operations/RESTORE.md).
  - `pnpm remit:rotate-encryption-key` rotates Remit-owned encrypted columns and existing
    `.remitbak` archive encryption with a mandatory pre-rotation backup. The rotation contract is
    documented in
    [`docs/architecture/adr/0021-encryption-key-rotation.md`](./docs/architecture/adr/0021-encryption-key-rotation.md).
  - `pnpm remit:reset-password` provides interactive password reset for the lost-everything case.
  - `pnpm remit:seed-demo` creates deterministic demo data for screenshots, screencasts, and local
    demo deployments, with presets and capped numeric overrides.
  - `pnpm remit:reset-data` is its inverse: it empties the instance's domain data in one transaction
    while the account, organization, settings, tax rates, templates, and audit trail survive. The
    scope is documented in
    [`docs/architecture/adr/0025-instance-data-reset-scope.md`](./docs/architecture/adr/0025-instance-data-reset-scope.md).
- **Host-side upgrades** - `bash scripts/host/upgrade.sh` snapshots a backup, pulls images, restarts
  the compose project, and waits for `/api/health`. The operator runbook is
  [`docs/operations/UPGRADE.md`](./docs/operations/UPGRADE.md). Per ADR-0020, upgrade is host-side:
  no `remit:upgrade` package script, no Docker socket mount.
- **Operational command contract** - new `remit:*` scripts follow
  [`docs/architecture/operations/CLI-CONTRACT.md`](./docs/architecture/operations/CLI-CONTRACT.md)
  and [ADR-0020](./docs/architecture/adr/0020-operational-cli-contract.md). No placeholder package
  scripts ship.

## Stack

Next.js 16 (App Router) · TypeScript (strict) · React 19 · Drizzle ORM · PostgreSQL · better-auth
with TOTP and organization plugins · Tailwind CSS v4 · shadcn/ui · Zod · react-hook-form · i18next ·
pino · Vitest · Playwright.

## Architecture

Detailed system architecture, design philosophy, security model, and the final database schema are
documented in [`docs/architecture/`](./docs/architecture/):

- [`ARCHITECTURE.md`](./docs/architecture/ARCHITECTURE.md) — system architecture, principles, domain
  model, multi-user model, hosted offering, all major decisions.
- [`SCHEMA.md`](./docs/architecture/SCHEMA.md) — authoritative table-by-table specification of every
  column, constraint, and index in the database.
- [`adr/`](./docs/architecture/adr) — Architecture Decision Records, numbered and immutable.

Coding conventions for the codebase live in [`.agents/rules/`](./.agents/rules/) and are enforced
through ESLint and the test suite.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
