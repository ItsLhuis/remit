<img src="public/logo.png" width="80" height="80" />

# Remit

**Remit** is an open-source, self-hostable business management platform built for independent
freelancers — own your data, own your workflow, no subscriptions required.

## Why Remit

Most invoicing and project tools are SaaS: monthly fees, your client data on someone else's servers,
and lock-in to a vendor that can change pricing or shut down at any time. Remit is built for
freelancers who want full control: run it on your own server, own everything, encrypted at rest, and
never depend on a third party for the data that runs your business.

A managed Hosted offering exists for users who don't want to run their own infrastructure — same
open-source code, same architecture, just operated for you. Each Hosted customer runs on a dedicated
isolated instance; there is no shared multi-tenant database. **Self-hosting is and remains the
first-class deployment model.**

A single command, everything in Docker, nothing to configure manually beyond the basics.

## Principles

Remit is built around a small number of non-negotiable principles. Every feature decision is weighed
against these.

- **Data ownership and privacy first.** Sensitive credentials are encrypted at rest. Email and
  payment providers are pluggable adapters that you choose — never forced. Designed so that data
  covered by an NDA never has to leave your infrastructure.
- **Single-instance simplicity.** One Remit instance is one freelance business. No multi-tenancy, no
  per-seat pricing logic, no organisation hierarchy in the base model. Light multi-user support
  (accountant, assistant) is layered on top.
- **Self-hosting is part of the product.** One-command install. Encrypted automatic backups.
  In-place upgrades. Health dashboard. Recovery from disaster as a first-class feature, not an
  afterthought.
- **Modular by construction.** Each feature is a closed module with explicitly enforced boundaries.
  Business logic is pure and testable, decoupled from Next.js and Drizzle. The codebase is
  structured to scale to a multi-year roadmap without architectural debt.
- **Open and extensible.** A plugin system enables country-specific fiscal compliance (Portuguese
  ATCUD, Brazilian NFS-e, etc.), AI-assisted drafting, OCR for receipts, and more — without bloating
  the core.

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
Hourly rate precedence: entry → task → project → client → instance default. One-click conversion of
unbilled time entries to invoice line items, grouped by project or task.

**Expenses.** Manual entry with receipt uploads, configurable categories, re-billable flag with
markup, and conversion to invoice line items. CSV export for accountants.

**Proposals.** Per-project proposals with line items (description, quantity, unit price, per-item
discount, tax). Lifecycle: Draft → Sent → Accepted → Rejected. Public token URL with OTP-secured
acceptance flow. One-click conversion to invoice on acceptance, or to a contract draft for signing.

**Contracts and e-signature.** Vinculative documents distinct from proposals. Block-based templates
(NDA, service agreement, retainer agreement). Public signing URL with full audit trail (IP,
user-agent, timestamp, typed full name) and a generated signed PDF.

**Invoices.** Generate manually, from an accepted proposal, from time entries, or from re-billable
expenses. Per-item discounts (percentage or fixed), configurable tax rates, multi-currency with
exchange rate snapshot. Lifecycle: Draft → Sent → Paid → Overdue, with computed `partially_paid`
status when payments are partial. Automatic late-fee logic and configurable reminder cadence.

**Recurring invoices and retainers.** Schedules generate invoices automatically (weekly, monthly,
quarterly, yearly). Retainer model with included hours per period and overage rate. End conditions
by date or count. Invoices generate as `draft` or auto-send.

**Payments.** Manual entry (bank transfer, cash, etc.) and integrated Stripe with hosted checkout
per invoice. Partial payment support — multiple payments per invoice with computed status.

**Credit notes.** Created from existing invoices for corrections or returns. Own numbering sequence.
Required by Portuguese and EU law for invoice corrections.

**Public client portal.** Per-client token at `/s/[token]` aggregating all invoices, proposals,
contracts, and project status into a single read-only view. No account required. Token revocable.

**Dashboard.** KPI tiles (revenue MTD/YTD, outstanding, overdue, expenses, profit), 12-month
cashflow chart, upcoming invoices and proposals, top clients, recent activity.

**Reports.** Revenue by client/project/month/tax rate, time by project/client/billable status,
expenses by category, tax summary by rate. CSV and PDF export.

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

- Mandatory TOTP at setup, with no opt-out. Recovery codes generated at setup as the primary
  password-reset path when SMTP is not configured.
- AES-256-GCM encryption at rest for all sensitive credentials (SMTP, Resend, Stripe, IBAN, client
  notes).
- Append-only security audit log separate from the user-facing activity log — captures every
  authentication event, settings change touching money or security, deletion, export, and public
  token rotation.
- Public token security: 256-bit entropy, constant-time comparison, timing-safe error responses to
  defeat enumeration, `noindex` headers on every public document page.
- Strict HTTP security headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy,
  Permissions-Policy) enforced for every response.
- Rate limiting on every endpoint that processes authentication or a public token.
- GDPR-aligned full data export (every entity, every uploaded file, every PDF) and right-to-be-
  forgotten with a configurable fiscal retention window.

## Self-hosting

```bash
curl -fsSL https://raw.githubusercontent.com/itslhuis/remit/main/scripts/install.sh | bash
```

The install script verifies Docker, prompts for the minimum required configuration (domain, port,
data directory), generates the `.env` with cryptographically secure secrets, pulls the image, and
brings the stack up. Total time from clone to login: under a minute.

Two Docker Compose profiles: a default profile that exposes a port for an existing reverse proxy,
and a `with-proxy` profile that includes Caddy with automatic Let's Encrypt TLS for full HTTPS in
one command.

Beyond install, Remit ships:

- **Encrypted automatic backups** — `pg_dump` plus uploads, AES-256-GCM-encrypted, to local disk,
  S3, R2, or Backblaze B2. Configurable retention (daily, weekly, monthly).
- **One-command upgrades** — `remit:upgrade` snapshots a backup, pulls the new image, runs
  forward-compatible migrations, and restarts. Auto-upgrade is opt-in.
- **Health dashboard** — `/admin/health` shows database connectivity, email/Stripe/storage
  reachability, last successful backup, disk usage, encryption key fingerprint, and update
  availability.
- **CLI tools** — interactive password reset for the lost-everything case, encryption key rotation,
  demo data seeding, and more.

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
- `adr/` — Architecture Decision Records, numbered and immutable.

Coding conventions for the codebase live in [`.claude/rules/`](./.claude/rules/) and are enforced
through ESLint and the test suite.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
