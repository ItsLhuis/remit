# DR-0009: Instance settings surface

- **Status:** Shipped
- **Date:** 2026-08-04
- **Verdict:** Complete with known gaps
- **Decisions:** ADR-0016
- **Supersedes:** —
- **Reconstructed:** yes

## What

The settings pages that configure the instance: the account profile, the business identity,
invoicing defaults and numbering, payment credentials, tax rates, security, appearance and the
system health view.

## Why

Remit's documents carry a business name, an address, a tax number, a currency, an invoice number
format and a payment instruction. Every one of those is per-instance and none of them belongs in an
environment variable, because the person who changes them is the freelancer rather than the operator
of the container. A settings row is also what lets the product ship with no configuration at all and
still produce a correct first invoice.

## Scope

Included: business profile and locale, invoicing defaults covering numbering sequences, default
currency, default hourly rate, payment terms and footer text, payment credentials for Stripe and the
bank IBAN, tax rates as a managed collection, the account profile with avatar, the security page,
the appearance page, and the system health page.

Excluded: hosting configuration. Anything the container operator sets — database URL, storage
backend, encryption key, base URL — lives in validated environment variables in `lib/config/env.ts`
and was deliberately moved out of the database, because configuration the app needs before it can
read the database cannot live in the database. Also excluded: a generic settings-section
abstraction, refused because the pages differ in submit behaviour, result handling and no-op
semantics, and the shared part would have been scaffolding only.

## How

Every write is a server action per ADR-0016, not an API route. The pages that touch money or
credentials — invoicing and payment — additionally require the owner role, because an assistant who
can create drafts should not be able to change where money is paid.

Settings live in one wide `settings` row rather than a key-value table. That trades flexibility for
the compiler: a typed column is checked, a `settings.get("defualt_currency")` is not.

Tax rates are their own table rather than a settings column, because they are a collection with a
lifecycle — created, edited, soft-deleted, referenced by historical line items that must keep the
rate they were issued under.

## Evidence

- `features/settings/business/`, `features/settings/invoicing/`, `features/settings/payment/`,
  `features/settings/profile/`, `features/settings/security/`, `features/settings/appearance/`,
  `features/settings/tax-rates/`
- `database/schema/settings.ts`, `database/schema/taxRates.ts`
- `lib/config/env.ts` — the hosting configuration that is deliberately not in settings
- `app/(dashboard)/settings/` — the route segments, including the owner-role guards
- `docs/architecture/adr/0016-server-actions-canonical.md`

## Verification

Integration tests cover the mutations for business, invoicing, payment, profile and tax rates
against a real Postgres, and `features/settings/__tests__/listSettings.integration.test.ts` covers
the combined read. Schema tests pin the validation contracts. Component tests cover the email and
payment forms and the TOTP reconfigure dialog.
`features/settings/payment/__tests__/queries.integration.test.ts` covers the read that decides
whether the public invoice page offers card payment.

Not covered: that a settings value actually reaches every document that should carry it. That
correspondence is exercised indirectly through the document render tests rather than directly.

## Known gaps

Backup policy has no settings page. Ten of the thirteen `settings.backup_*` columns —
`backup_destination`, `backup_cadence`, the three retention columns and the five S3 credential
columns — are settable only by SQL, while `docs/architecture/ARCHITECTURE.md` places backup policy
in the settings surface and `docs/architecture/operations/CLI-CONTRACT.md` tells an operator the
remote credentials are "saved in `/settings/backup`". There is no `app/(dashboard)/settings/backup`
route. The remaining three columns — `backup_last_success_at`, `backup_last_failure_at` and
`backup_last_failure_reason` — are written by the backup command and read by the health dashboard,
so they are wired end to end.

`settings.backup_cadence` has no consumer at all: nothing schedules a backup.
