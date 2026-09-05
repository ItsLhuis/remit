# Remit — Database schema

> Table-by-table description of the schema in `database/schema/`. Every column, its type,
> nullability, default, and the constraints and indexes the table carries. It contains no Drizzle
> code; the Drizzle files are the schema, written using the conventions in `database.md`, and this
> document describes them.
>
> A column exists here if and only if it exists there, and `tests/docs/schema.test.ts` fails the
> build when the two disagree in either direction. A column with no reader or no writer is a fact
> about the schema and is recorded as one, in the Notes cell, rather than left to read as though
> something used it.
>
> Schema changes and the passage here that describes them land in the same change.

---

## Table of contents

1. [Conventions](#1-conventions)
2. [Universal helpers](#2-universal-helpers)
3. [Auth tables (better-auth)](#3-auth-tables-better-auth)
4. [Organization tables (better-auth organization plugin)](#4-organization-tables-better-auth-organization-plugin)
5. [Audit logs](#5-audit-logs)
6. [Activity logs](#6-activity-logs)
7. [Settings](#7-settings)
8. [Tax rates](#8-tax-rates)
9. [Templates](#9-templates)
10. [Uploads](#11-uploads)
11. [Email logs](#12-email-logs)
12. [Leads](#13-leads)
13. [Clients](#14-clients)
14. [Projects](#15-projects)
15. [Tasks](#16-tasks)
16. [Time entries](#17-time-entries)
17. [Expenses](#18-expenses)
18. [Proposals](#19-proposals)
19. [Proposal OTPs](#20-proposal-otps)
20. [Contracts](#21-contracts)
21. [Contract signatures](#22-contract-signatures)
22. [Recurring invoices](#23-recurring-invoices)
23. [Invoices](#24-invoices)
24. [Line items](#25-line-items)
25. [Payments](#26-payments)
26. [Credit notes](#27-credit-notes)
27. [Data exports](#27-data-exports)
28. [Attachments](#28-attachments)
29. [Enum reference](#29-enum-reference)

---

## 1. Conventions

These apply to every table unless explicitly overridden.

- **Primary key.** `uuid`, generated with `defaultRandom()`. Column name `id`.
- **Naming.** Tables use `snake_case` plural names. Rare collective nouns may remain as-is when they
  are substantially more natural than the plural form (for example `settings`). Columns use
  `snake_case` in the database and are exposed as `camelCase` in TypeScript by Drizzle.
- **Timestamps.** Every table has `created_at` and `updated_at`, both `timestamptz`, both
  `NOT NULL DEFAULT now()`. `updated_at` is auto-bumped on UPDATE via the `timestamps` helper.
- **Soft delete.** Domain tables have `deleted_at` (`timestamptz`, nullable), via the `softDelete`
  helper. Tables explicitly noted as **insert-only** (audit logs, OTPs) and infrastructure tables
  (auth) do not have `deleted_at`.
- **Foreign keys.** Default to `ON DELETE CASCADE`. Exceptions explicitly noted.
- **Money.** `bigint` storing the smallest currency unit (cents for EUR/USD). Column names use the
  `_cents` suffix in the v1 schema, but the semantic contract is integer minor units for the parent
  entity's ISO 4217 currency. The currency code is on the parent entity, not on each money column.
- **Tenant scoping.** Domain tables have **no `tenant_id`**. Ownership is implicit to the instance.
  Multi-user is implemented via the organization plugin; the organization scopes membership and
  roles, not domain queries.
- **Encrypted fields.** Sensitive credentials use the `encryptedColumn()` helper. AES-256-GCM at
  rest, transparent decrypt on read.

---

## 2. Universal helpers

Defined once in `database/schema/helpers.ts`:

- **`timestamps`** — adds `created_at` and `updated_at` with the conventions above.
- **`softDelete`** — adds `deleted_at` (nullable). Default queries filter `deleted_at IS NULL`.
- **`encryptedColumn(name)`** — declares a `text` column whose value is AES-256-GCM-encrypted at
  rest. The master key comes from `REMIT_ENCRYPTION_KEY`.

---

## 3. Auth tables (better-auth)

Owned by better-auth core. Schemas follow the upstream library; the columns below are the ones Remit
relies on. Table names are plural `snake_case` via Better Auth `modelName` overrides. **No
timestamps helper** here — better-auth manages its own timestamp shape.

### `users`

| Column               | Type        | Null | Default             | Notes                                                        |
| -------------------- | ----------- | ---- | ------------------- | ------------------------------------------------------------ |
| id                   | uuid        | no   | `gen_random_uuid()` | PK                                                           |
| name                 | text        | no   |                     |                                                              |
| email                | text        | no   |                     | Unique                                                       |
| email_verified       | boolean     | no   | `false`             |                                                              |
| image                | text        | yes  |                     |                                                              |
| two_factor_enabled   | boolean     | yes  | `false`             | Required for authenticated app access once setup is complete |
| must_change_password | boolean     | no   | `false`             | Remit-owned recovery flag set by the CLI/admin reset flow    |
| created_at           | timestamptz | no   | `now()`             |                                                              |
| updated_at           | timestamptz | no   | `now()` (autobump)  |                                                              |

### `sessions`

| Column                 | Type        | Null | Default            | Notes                                                                                                                                                           |
| ---------------------- | ----------- | ---- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                     | text        | no   |                    | PK (better-auth-managed)                                                                                                                                        |
| user_id                | uuid        | no   |                    | FK → `users.id` (cascade)                                                                                                                                       |
| token                  | text        | no   |                    | Unique                                                                                                                                                          |
| expires_at             | timestamptz | no   |                    |                                                                                                                                                                 |
| ip_address             | text        | yes  |                    |                                                                                                                                                                 |
| user_agent             | text        | yes  |                    |                                                                                                                                                                 |
| active_organization_id | uuid        | yes  |                    | Added by the Better Auth organization plugin. **No FK** — the plugin declares this field with no `references`, and the installed version is the schema contract |
| created_at             | timestamptz | no   | `now()`            |                                                                                                                                                                 |
| updated_at             | timestamptz | no   | `now()` (autobump) |                                                                                                                                                                 |

Index: `sessions_user_id_idx` on `user_id`.

### `accounts`

OAuth/credential accounts as managed by better-auth. Schema unchanged from upstream.

| Column                   | Type        | Null | Default            | Notes                                  |
| ------------------------ | ----------- | ---- | ------------------ | -------------------------------------- |
| id                       | text        | no   |                    | PK (better-auth-managed)               |
| account_id               | text        | no   |                    | Provider account identifier            |
| provider_id              | text        | no   |                    | Provider identifier, e.g. `credential` |
| user_id                  | uuid        | no   |                    | FK → `users.id` (cascade)              |
| access_token             | text        | yes  |                    | OAuth access token                     |
| refresh_token            | text        | yes  |                    | OAuth refresh token                    |
| id_token                 | text        | yes  |                    | OAuth/OpenID Connect ID token          |
| access_token_expires_at  | timestamptz | yes  |                    |                                        |
| refresh_token_expires_at | timestamptz | yes  |                    |                                        |
| scope                    | text        | yes  |                    | OAuth scopes                           |
| password                 | text        | yes  |                    | Better Auth credential password hash   |
| created_at               | timestamptz | no   | `now()`            |                                        |
| updated_at               | timestamptz | no   | `now()` (autobump) |                                        |

Index: `accounts_user_id_idx` on `user_id`.

### `verifications`

Email verification and password reset tokens as managed by better-auth.

| Column     | Type        | Null | Default            | Notes                    |
| ---------- | ----------- | ---- | ------------------ | ------------------------ |
| id         | text        | no   |                    | PK (better-auth-managed) |
| identifier | text        | no   |                    | Token lookup identifier  |
| value      | text        | no   |                    | Verification token value |
| expires_at | timestamptz | no   |                    |                          |
| created_at | timestamptz | no   | `now()`            |                          |
| updated_at | timestamptz | no   | `now()` (autobump) |                          |

Index: `verifications_identifier_idx` on `identifier`.

### `two_factors`

| Column                    | Type        | Null | Default | Notes                                                                                                                           |
| ------------------------- | ----------- | ---- | ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| id                        | text        | no   |         | PK                                                                                                                              |
| user_id                   | uuid        | no   |         | FK → `users.id` (cascade)                                                                                                       |
| secret                    | text        | no   |         | Encrypted at rest                                                                                                               |
| backup_codes              | text        | no   |         | Better Auth-managed encrypted payload containing the current list of backup codes                                               |
| verified                  | boolean     | yes  | `true`  | Declared by the installed Better Auth two-factor plugin, and the installed version is the schema contract. Remit never reads it |
| failed_verification_count | integer     | yes  | `0`     | Plugin-owned lockout counter, same contract as `verified`                                                                       |
| locked_until              | timestamptz | yes  |         | Plugin-owned lockout expiry, same contract as `verified`                                                                        |

Indexes: `two_factors_user_id_idx` on `user_id`, `two_factors_secret_idx` on `secret`.

Remit uses Better Auth **backup codes** in `two_factors.backup_codes` only to complete the sign-in
flow when the authenticator app is unavailable. Password reset is handled either by email reset
links (when SMTP is configured) or by CLI/admin reset on self-hosted installs.

---

## 4. Organization tables (better-auth organization plugin)

Used in **degenerate single-org-per-instance mode**. Exactly one row in `organizations` per Remit
instance, created automatically during `/setup`. Every authenticated user is a member. Field names
and lifecycle rules follow the Better Auth organization plugin contract; Remit constrains the
allowed business roles at the application boundary.

### `organizations`

| Column     | Type        | Null | Default             | Notes                                  |
| ---------- | ----------- | ---- | ------------------- | -------------------------------------- |
| id         | uuid        | no   | `gen_random_uuid()` | PK                                     |
| name       | text        | no   |                     | Mirrors `settings.business_name`       |
| slug       | text        | no   |                     | Required by Better Auth. Unique        |
| logo       | text        | yes  |                     |                                        |
| metadata   | text        | yes  |                     | JSON serialized as text by Better Auth |
| created_at | timestamptz | no   | `now()`             |                                        |

Index: unique `organization_slug_idx` on `slug`.

### `members`

Maps a user to a role within the (single) organization.

| Column          | Type        | Null | Default             | Notes                                                                                  |
| --------------- | ----------- | ---- | ------------------- | -------------------------------------------------------------------------------------- |
| id              | uuid        | no   | `gen_random_uuid()` | PK                                                                                     |
| user_id         | uuid        | no   |                     | FK → `users.id` (cascade)                                                              |
| organization_id | uuid        | no   |                     | FK → `organizations.id` (cascade)                                                      |
| role            | text        | no   |                     | Better Auth role string. Remit constrains values to `owner \| accountant \| assistant` |
| created_at      | timestamptz | no   | `now()`             |                                                                                        |

Indexes: `member_user_id_idx`, `member_organization_id_idx`, unique `member_user_organization_idx`
on `(user_id, organization_id)`.

Constraint: at most one member with role `owner` per organization. Enforced via partial unique index
`uq_member_owner_per_org` on `organization_id` where `role = 'owner'`.

### `invitations`

Pending invitation as created by an owner.

| Column          | Type        | Null | Default             | Notes                                                                              |
| --------------- | ----------- | ---- | ------------------- | ---------------------------------------------------------------------------------- |
| id              | uuid        | no   | `gen_random_uuid()` | PK                                                                                 |
| email           | text        | no   |                     |                                                                                    |
| organization_id | uuid        | no   |                     | FK → `organizations.id` (cascade)                                                  |
| inviter_id      | uuid        | no   |                     | FK → `users.id` (cascade). Required by Better Auth; `SET NULL` is not valid here   |
| role            | text        | no   |                     | Better Auth role string. Remit UI offers `accountant \| assistant` for invitations |
| status          | text        | no   | `'pending'`         | Better Auth lifecycle: `pending \| accepted \| rejected \| canceled`               |
| expires_at      | timestamptz | no   |                     | 48 hours from creation by default, unless overridden in plugin config              |
| created_at      | timestamptz | no   | `now()`             |                                                                                    |

Indexes: `invitation_email_idx`, `invitation_organization_id_idx`, `invitation_status_idx`.

---

## 5. Audit logs

Security-facing, append-only. No UPDATE or DELETE operation ever runs against this table.

### `audit_logs`

| Column             | Type        | Null | Default             | Notes                                                   |
| ------------------ | ----------- | ---- | ------------------- | ------------------------------------------------------- |
| id                 | uuid        | no   | `gen_random_uuid()` | PK                                                      |
| event              | text        | no   |                     | Event name, e.g. `auth.login.succeeded`                 |
| actor_user_id      | uuid        | yes  |                     | FK → `users.id` (set null) — actor may be deleted later |
| actor_role         | enum        | yes  |                     | `owner \| accountant \| assistant`                      |
| target_entity_type | text        | yes  |                     | E.g. `invoice`, `client`, `settings`                    |
| target_entity_id   | uuid        | yes  |                     |                                                         |
| metadata           | jsonb       | yes  |                     | Free-form, never includes secrets                       |
| ip_address         | text        | yes  |                     |                                                         |
| user_agent         | text        | yes  |                     |                                                         |
| created_at         | timestamptz | no   | `now()`             |                                                         |

Indexes: `audit_logs_event_created_at_idx` on `(event, created_at DESC)`, `audit_logs_actor_idx` on
`actor_user_id`, `audit_logs_target_idx` on `(target_entity_type, target_entity_id)`.

**No `updated_at`. No `deleted_at`.** Database-level enforcement: a trigger that raises on UPDATE or
DELETE provides defense in depth.

---

## 6. Activity logs

User-facing event history. Editable via UI. Stores **message keys**, not rendered strings, so the
log re-renders correctly when the user changes locale.

### `activity_logs`

| Column       | Type        | Null | Default             | Notes                                             |
| ------------ | ----------- | ---- | ------------------- | ------------------------------------------------- |
| id           | uuid        | no   | `gen_random_uuid()` | PK                                                |
| entity_type  | enum        | no   |                     | `client \| project \| proposal \| invoice \| ...` |
| entity_id    | uuid        | no   |                     |                                                   |
| action       | text        | no   |                     | `created`, `sent`, `paid`, etc.                   |
| message_key  | text        | no   |                     | Reference into the `Translations` type            |
| message_args | jsonb       | yes  |                     | ICU parameters for the message                    |
| read_at      | timestamptz | yes  |                     |                                                   |
| created_at   | timestamptz | no   | `now()`             |                                                   |

Indexes: `activity_logs_created_at_idx` on `created_at DESC`, `activity_logs_entity_idx` on
`(entity_type, entity_id)`, `activity_logs_unread_idx` on `id` where `read_at IS NULL`.

**No `updated_at`. No `deleted_at`.** Editing means delete + insert at the application level.

---

## 7. Settings

Single-row instance configuration. Exists exactly once per instance.

### `settings`

| Group            | Column                     | Type             | Null | Notes                                                                                                                                                                                    |
| ---------------- | -------------------------- | ---------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|                  | id                         | uuid             | no   | PK                                                                                                                                                                                       |
| Business profile | business_name              | text             | yes  |                                                                                                                                                                                          |
|                  | business_email             | text             | yes  |                                                                                                                                                                                          |
|                  | business_phone             | text             | yes  |                                                                                                                                                                                          |
|                  | business_website           | text             | yes  |                                                                                                                                                                                          |
|                  | business_tax_id            | text             | yes  |                                                                                                                                                                                          |
|                  | business_logo_upload_id    | uuid             | yes  | FK → `uploads.id` (set null)                                                                                                                                                             |
|                  | business_address_line1     | text             | yes  |                                                                                                                                                                                          |
|                  | business_address_line2     | text             | yes  |                                                                                                                                                                                          |
|                  | business_city              | text             | yes  |                                                                                                                                                                                          |
|                  | business_state             | text             | yes  |                                                                                                                                                                                          |
|                  | business_postal_code       | text             | yes  |                                                                                                                                                                                          |
|                  | business_country           | text             | yes  | ISO 3166-1 alpha-2                                                                                                                                                                       |
| Locale           | default_currency           | varchar(3)       | no   | Default `'EUR'`. ISO 4217.                                                                                                                                                               |
|                  | default_locale             | text             | no   | Default `'en'`. BCP 47 locale tag. Controls number/date formatting and document language in generated PDFs and emails. Not the app UI language — that is handled by i18next client-side. |
|                  | default_timezone           | text             | no   | Default `'UTC'`. IANA tz name.                                                                                                                                                           |
| Invoicing        | payment_terms_days         | integer          | no   | Default `30`. 0–365                                                                                                                                                                      |
|                  | proposal_validity_days     | integer          | no   | Default `30`. ≥ 0                                                                                                                                                                        |
|                  | default_notes_invoice      | text             | yes  |                                                                                                                                                                                          |
|                  | default_invoice_footer     | text             | yes  | Default footer copied into new invoice drafts.                                                                                                                                           |
|                  | default_notes_proposal     | text             | yes  |                                                                                                                                                                                          |
|                  | invoice_prefix             | text             | no   | Default `'INV-'`. Printable ASCII, max 24 characters.                                                                                                                                    |
|                  | proposal_prefix            | text             | no   | Default `'PROP-'`                                                                                                                                                                        |
|                  | contract_prefix            | text             | no   | Default `'CTR-'`                                                                                                                                                                         |
|                  | credit_note_prefix         | text             | no   | Default `'CN-'`                                                                                                                                                                          |
|                  | next_invoice_number        | integer          | no   | Default `1`. ≥ 1                                                                                                                                                                         |
|                  | next_proposal_number       | integer          | no   | Default `1`. ≥ 1                                                                                                                                                                         |
|                  | next_contract_number       | integer          | no   | Default `1`. ≥ 1                                                                                                                                                                         |
|                  | next_credit_note_number    | integer          | no   | Default `1`. ≥ 1                                                                                                                                                                         |
|                  | number_padding_width       | integer          | no   | Default `4`. 1–10                                                                                                                                                                        |
| Time tracking    | default_hourly_rate_cents  | bigint           | yes  | Last rung of the time-entry rate precedence ladder. Null = no instance rate configured; deliberately not defaulted. ≥ 0 if not null.                                                     |
| Payments         | payment_iban               | text (encrypted) | yes  |                                                                                                                                                                                          |
|                  | payment_bank_name          | text             | yes  |                                                                                                                                                                                          |
|                  | payment_instructions       | text             | yes  |                                                                                                                                                                                          |
|                  | stripe_publishable_key     | text             | yes  |                                                                                                                                                                                          |
|                  | stripe_secret_key          | text (encrypted) | yes  |                                                                                                                                                                                          |
|                  | stripe_webhook_secret      | text (encrypted) | yes  |                                                                                                                                                                                          |
|                  | stripe_test_connection_at  | timestamptz      | yes  | Last successful test                                                                                                                                                                     |
| Email            | email_provider             | enum             | yes  | `smtp \| resend`                                                                                                                                                                         |
|                  | smtp_host                  | text             | yes  |                                                                                                                                                                                          |
|                  | smtp_port                  | integer          | yes  |                                                                                                                                                                                          |
|                  | smtp_user                  | text             | yes  |                                                                                                                                                                                          |
|                  | smtp_pass                  | text (encrypted) | yes  |                                                                                                                                                                                          |
|                  | smtp_secure                | boolean          | no   | Default `true`                                                                                                                                                                           |
|                  | resend_api_key             | text (encrypted) | yes  |                                                                                                                                                                                          |
|                  | email_from_name            | text             | yes  |                                                                                                                                                                                          |
|                  | email_from_address         | text             | yes  |                                                                                                                                                                                          |
|                  | email_test_send_at         | timestamptz      | yes  | Last successful test                                                                                                                                                                     |
| Reminders        | reminder_before_due_days   | integer[]        | no   | Default `[3, 0]`. Days before/at due_at to send.                                                                                                                                         |
|                  | reminder_after_due_days    | integer[]        | no   | Default `[7, 14, 30]`. Days after due_at to send.                                                                                                                                        |
| Backups          | backup_destination         | enum             | no   | Default `'local'`. `local \| s3 \| r2 \| b2`                                                                                                                                             |
|                  | backup_cadence             | enum             | no   | Default `'daily'`. `daily \| weekly`                                                                                                                                                     |
|                  | backup_retention_daily     | integer          | no   | Default `7`                                                                                                                                                                              |
|                  | backup_retention_weekly    | integer          | no   | Default `4`                                                                                                                                                                              |
|                  | backup_retention_monthly   | integer          | no   | Default `12`                                                                                                                                                                             |
|                  | backup_s3_bucket           | text             | yes  |                                                                                                                                                                                          |
|                  | backup_s3_region           | text             | yes  |                                                                                                                                                                                          |
|                  | backup_s3_endpoint         | text             | yes  | For R2/B2/MinIO                                                                                                                                                                          |
|                  | backup_s3_access_key       | text (encrypted) | yes  |                                                                                                                                                                                          |
|                  | backup_s3_secret_key       | text (encrypted) | yes  |                                                                                                                                                                                          |
|                  | backup_last_success_at     | timestamptz      | yes  |                                                                                                                                                                                          |
|                  | backup_last_failure_at     | timestamptz      | yes  |                                                                                                                                                                                          |
|                  | backup_last_failure_reason | text             | yes  |                                                                                                                                                                                          |
|                  | created_at, updated_at     | timestamptz      | no   | Standard `timestamps`                                                                                                                                                                    |

The three `backup_last_*` columns are written by `remit:backup` and read by `/settings/system`. The
ten backup policy columns above them — destination, cadence, the three retention counts and the five
S3-compatible credential columns — are read by `scripts/core/backup/` and written by nothing: no
settings surface edits them, so an operator either takes the defaults or sets them directly.
`backup_cadence` is read by nothing at all, because no scheduler consumes it.

Constraints (named):

- `chk_settings_email_provider` — `email_provider` is null or in (`smtp`, `resend`).
- `chk_settings_payment_terms_days` — `>= 0 AND <= 365`.
- `chk_settings_proposal_validity_days` — `>= 0`.
- `chk_settings_invoice_prefix` — printable ASCII and length `<= 24`.
- `chk_settings_next_invoice_number` — `>= 1`.
- `chk_settings_next_proposal_number` — `>= 1`.
- `chk_settings_next_contract_number` — `>= 1`.
- `chk_settings_next_credit_note_number` — `>= 1`.
- `chk_settings_number_padding_width` — `>= 1 AND <= 10`.
- `chk_settings_default_hourly_rate` —
  `default_hourly_rate_cents IS NULL OR default_hourly_rate_cents >= 0`.

No FK to `user` — settings are instance-scoped, not user-scoped.

---

## 8. Tax rates

### `tax_rates`

| Column     | Type          | Null | Default             | Notes                    |
| ---------- | ------------- | ---- | ------------------- | ------------------------ |
| id         | uuid          | no   | `gen_random_uuid()` | PK                       |
| name       | text          | no   |                     | E.g. "IVA 23%"           |
| percentage | numeric(5, 2) | no   |                     | 0–100                    |
| is_default | boolean       | no   | `false`             | At most one per instance |

Standard `timestamps` and `softDelete`.

Constraints:

- `chk_tax_rates_percentage` — `>= 0 AND <= 100`.

Indexes:

- Partial **unique** index `uq_tax_rates_default` where `is_default = true AND deleted_at IS NULL` —
  guarantees at most one default tax rate.

---

## 9. Templates

Block-based PDF and email templates.

### `templates`

| Column        | Type    | Null | Default             | Notes                                                      |
| ------------- | ------- | ---- | ------------------- | ---------------------------------------------------------- |
| id            | uuid    | no   | `gen_random_uuid()` | PK                                                         |
| type          | enum    | no   |                     | See enum reference                                         |
| name          | text    | no   |                     |                                                            |
| description   | text    | yes  |                     |                                                            |
| subject       | text    | yes  |                     | Email subject for `email_*` types; null for document types |
| blocks        | jsonb   | no   | `'[]'::jsonb`       | Block-based content; shape and invariants in ADR-0024      |
| page_settings | jsonb   | no   | `'{}'::jsonb`       | Margins, default font family, base font size (ADR-0024)    |
| is_default    | boolean | no   | `false`             | At most one default per type                               |
| is_system     | boolean | no   | `false`             | True for built-in templates the user cannot delete         |

Standard `timestamps` and `softDelete`.

Indexes:

- `templates_type_idx` on `type`.
- Partial **unique** index `uq_templates_default_per_type` on `type` where
  `is_default = true AND deleted_at IS NULL`.

Template enum types include: `invoice`, `proposal`, `contract`, `credit_note`, plus email
counterparts `email_invoice_send`, `email_proposal_send`, `email_contract_send`,
`email_payment_receipt`, `email_overdue_reminder`, `email_recurring_generated`. See enum reference.

The `blocks` jsonb holds the block array whose full shape and invariants live in ADR-0024. Each
block is `{ id, type, content, layout, hidden, locked, name?, rotation?, constraints?, style? }`,
and the write-path union is six types: `text | image | table | shape | frame | group`. Content per
type: `text` `{ html }`; `image` `{ source, uploadId, alt }`; `table` `{ source, columns, rows }`;
`shape` `{ variant: "rectangle" | "ellipse" | "line" }` (a vector leaf whose appearance comes from
`style`); `frame` `{ clip, children }` where children are **absolutely positioned** blocks (the full
union, bounded to two container levels — `FRAME_MAX_DEPTH = 2` — by a depth walk on the write path);
`group` `{ children }`. Top-level array order is the **z-order** (a later block paints on top);
overlap is legal.

A `group` is the second container type and differs from a `frame` deliberately: it carries **no
`style` and no `clip`**, and it never authors an independent size — its `layout` rectangle is always
re-derived as the bounding union of its children, so a child can never overflow it and clipping
would be meaningless. It exists only to bind an existing selection together; the add-block palette
never offers one (`AddableBlockType` excludes it), and it is created solely by grouping a selection.
Resizing a group scales its members through the shared set-scale primitive. Both container types
count toward `FRAME_MAX_DEPTH`.

`rotation` is an optional **sibling of `layout`** (never a `layout` field): degrees in `[0, 360)`,
clockwise in the page's y-down space, non-integer allowed, about the rect's own center. Absent is
the canonical spelling of "not rotated" — a rotation of exactly 0 is stripped on write, absent stays
absent through normalization, and readers apply `?? 0`; the stored-read schema rejects out-of-range
values. The stored geometry stays rect + rotation, nothing else. A `group` **never carries the
field** (its schema shape omits it): rotating a grouped selection rotates each child about the
shared center, and the group's `layout` re-derives as the union of its children's **rotated AABBs**.
The renderer emits exactly `transform:rotate(<n>deg)` for nonzero rotation (the sanitizer whitelists
that form and nothing else — never `matrix(...)`); a rotation-free document renders byte-identically
to one produced before the field existed.

`name` is an optional author-supplied label on any block, used by the layers panel and the rename
action. Absent means the panel falls back to the block type's own label, so a document that never
renamed a block stores nothing.

`constraints` is optional on any block and is `{ horizontal, vertical }`, each one of
`start | end | center | stretch | scale`. It is read only when the block is a **frame child** and
the frame is resized, which reflows the child per its constraints. Group and multi-selection resize
scale members proportionally and ignore constraints by design.

A block's `x`/`y` accept negative values at the schema level (the coordinate bound is symmetric).
This is required so that a **container child** can sit partially outside its frame, which then clips
or shows the overflow. The floor-at-0 that applies to a **top-level** block is enforced one layer up
by `validateLayout` (`services/canvasLayout.ts`), which knows the template type and page margins the
schema cannot see; every interactive path clamps a top-level block into the page bounds before it
commits, so that check is a backstop against malformed data rather than a normal-path outcome. Block
`width`/`height` carry no grid-multiple constraint — proportional set scaling cannot preserve both
member proportions and grid-multiple sizes, so grid alignment is the editor's default snap behavior,
not a storage invariant. Table column widths stay grid-aligned (they are never set-scaled).

The following are content-schema semantics worth noting at the storage layer, and **all are
content-schema concerns only — no database migration, and the jsonb column shape is unchanged**: the
block taxonomy moved from `text | image | divider | spacer | table | box` to
`text | image | table | shape | frame | group` (a stored `box` reads back as a `frame` with its flex
children laid out absolute, a `divider` as a `line` shape, a `spacer` is dropped); and a `text`
block's stored `height` is authored on both axes but the editor raises it to a content-height floor,
still persisted as a concrete whole-cell value, so the stored rectangle shape is identical. The read
path (`storedBlockSchema`) stays tolerant of every prior stored generation, including the retired
`box`/`divider`/`spacer` shapes.

---

## 10. Uploads

S3-compatible file storage records.

### `uploads`

| Column          | Type        | Null | Default             | Notes                                               |
| --------------- | ----------- | ---- | ------------------- | --------------------------------------------------- |
| id              | uuid        | no   | `gen_random_uuid()` | PK                                                  |
| filename        | text        | no   |                     | Original filename                                   |
| path            | text        | no   |                     | Unique. Storage path or S3 key                      |
| bucket          | enum        | no   | `'public'`          | `public \| documents` — which store resolves `path` |
| mime_type       | text        | no   |                     |                                                     |
| size_bytes      | bigint      | no   |                     | `> 0`. Measured server-side from the stored object  |
| checksum_sha256 | text        | no   |                     | Lowercase hex SHA-256 of the stored object          |
| created_at      | timestamptz | no   | `now()`             |                                                     |

Constraints:

- `chk_uploads_size_bytes` — `> 0`.
- `chk_uploads_checksum_sha256` — 64 lowercase hex characters.

Indexes:

- Unique on `path`.
- `uploads_checksum_sha256_idx` on `checksum_sha256`.

**No `updated_at`. No `deleted_at`.** Uploads are immutable; deletion is a hard delete (and removes
the underlying file).

`size_bytes` and `checksum_sha256` are both measured from the stored object by
`lib/storage/verifyUploadedObject.ts` after the client's `PUT` completes, never taken from the
client that uploaded it: a presigned `PUT` proves nothing about what was actually written. The
checksum exists so `pnpm remit:restore` can tell a truncated or substituted object from an intact
one, which the size alone cannot.

A `documents` row must never be handed to `resolveStorageUrl`, which builds a public URL and would
mislead the caller into thinking a private object is reachable. Private objects are served through a
credentialed route — `app/api/attachments/[id]/route.ts` for attachments.

Every reference to `uploads` is `on delete set null` **except `attachments.upload_id`**, which is
`NOT NULL` and cascades: an invoice or an expense outlives its file, an attachment does not. See
[section 28](#28-attachments) and [ADR-0028](adr/0028-attachments-and-visual-identity.md).

---

## 11. Email logs

Outbound email send records.

### `email_logs`

| Column              | Type        | Null | Default             | Notes                                                      |
| ------------------- | ----------- | ---- | ------------------- | ---------------------------------------------------------- |
| id                  | uuid        | no   | `gen_random_uuid()` | PK                                                         |
| document_type       | enum        | yes  |                     | `proposal \| invoice \| contract` (null for system emails) |
| document_id         | uuid        | yes  |                     | Polymorphic to the document referenced                     |
| template_id         | uuid        | yes  |                     | FK → `templates.id` (set null)                             |
| recipient_email     | text        | no   |                     |                                                            |
| recipient_name      | text        | yes  |                     |                                                            |
| subject             | text        | no   |                     |                                                            |
| status              | enum        | no   | `'pending'`         | `pending \| sent \| failed`                                |
| pdf_attached        | boolean     | no   | `false`             |                                                            |
| sent_at             | timestamptz | yes  |                     |                                                            |
| error_message       | text        | yes  |                     |                                                            |
| provider            | enum        | yes  |                     | `smtp \| resend` — actual provider used                    |
| provider_message_id | text        | yes  |                     | Provider-side message id when available                    |
| created_at          | timestamptz | no   | `now()`             |                                                            |

Indexes:

- `email_logs_document_idx` on `(document_type, document_id)`.
- `email_logs_status_idx` on `status`.
- `email_logs_created_at_idx` on `created_at DESC`.

**No `updated_at`. No `deleted_at`.** Email logs are insert-only after their final state.

---

## 12. Leads

Pre-client contacts in the sales pipeline.

### `leads`

| Column                 | Type        | Null | Default             | Notes                                  |
| ---------------------- | ----------- | ---- | ------------------- | -------------------------------------- |
| id                     | uuid        | no   | `gen_random_uuid()` | PK                                     |
| first_name             | text        | yes  |                     |                                        |
| last_name              | text        | yes  |                     |                                        |
| company                | text        | yes  |                     |                                        |
| email                  | text        | no   |                     |                                        |
| phone                  | text        | yes  |                     |                                        |
| source                 | text        | yes  |                     | E.g. `website`, `referral`, `linkedin` |
| status                 | enum        | no   | `'new'`             | See enum reference                     |
| notes                  | text        | yes  |                     |                                        |
| converted_at           | timestamptz | yes  |                     | Set when lead is converted to client   |
| converted_to_client_id | uuid        | yes  |                     | FK → `clients.id` (set null)           |
| lost_reason            | text        | yes  |                     |                                        |

Standard `timestamps` and `softDelete`.

Indexes: `leads_email_idx`, `leads_status_idx`, `leads_created_at_idx` on `created_at DESC`.

---

## 13. Clients

### `clients`

| Column                    | Type             | Null | Default             | Notes                                                                                                                                                                                                                                                  |
| ------------------------- | ---------------- | ---- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| id                        | uuid             | no   | `gen_random_uuid()` | PK                                                                                                                                                                                                                                                     |
| name                      | text             | no   |                     |                                                                                                                                                                                                                                                        |
| email                     | text             | no   |                     |                                                                                                                                                                                                                                                        |
| phone                     | text             | yes  |                     |                                                                                                                                                                                                                                                        |
| website                   | text             | yes  |                     |                                                                                                                                                                                                                                                        |
| tax_id                    | text             | yes  |                     |                                                                                                                                                                                                                                                        |
| address_line1             | text             | yes  |                     |                                                                                                                                                                                                                                                        |
| address_line2             | text             | yes  |                     |                                                                                                                                                                                                                                                        |
| city                      | text             | yes  |                     |                                                                                                                                                                                                                                                        |
| state                     | text             | yes  |                     |                                                                                                                                                                                                                                                        |
| postal_code               | text             | yes  |                     |                                                                                                                                                                                                                                                        |
| country                   | text             | yes  |                     | ISO 3166-1 alpha-2                                                                                                                                                                                                                                     |
| currency                  | varchar(3)       | yes  |                     | Override of `settings.default_currency` for this client's documents                                                                                                                                                                                    |
| locale                    | text             | yes  |                     | Override of `settings.default_locale` for this client's documents. BCP 47 locale tag. Null = use instance default.                                                                                                                                     |
| default_hourly_rate_cents | bigint           | yes  |                     | Default rate for time entries on this client's projects. Null = no negotiated rate, which is distinct from a rate of 0. ≥ 0 if not null.                                                                                                               |
| notes                     | text (encrypted) | yes  |                     | NDA-sensitive; opt-in encryption at column level                                                                                                                                                                                                       |
| portal_token              | text             | yes  |                     | Unique where not null. The bearer credential for `/s/[token]`, minted on demand by `rotateClientPortalLink` and read by `getClientPortal`. Null is both "no portal yet" and "portal revoked" — one state (ADR-0029) — and `softDeleteClient` clears it |
| image_upload_id           | uuid             | yes  |                     | FK → `uploads.id` (set null). Logo or photo — a Remit client is either. Public bucket                                                                                                                                                                  |

Standard `timestamps` and `softDelete`.

Indexes: `clients_name_idx`, `clients_email_idx`, `clients_active_idx` on `id` where
`deleted_at IS NULL`, unique `clients_portal_token_idx` on `portal_token` where
`portal_token IS NOT NULL`.

Constraints:

- `chk_clients_default_hourly_rate` —
  `default_hourly_rate_cents IS NULL OR default_hourly_rate_cents >= 0`.

### `client_contacts`

The people at a client. A sub-record of `clients`, not a navigable entity of its own: no route, no
feature module, no top-level list, and no other table carries a `contact_id`. `clients.email` and
`clients.phone` remain the billing default and the fallback; these rows exist because when the
freelancer bills a company, the person who approves the proposal, the person who signs the contract,
and the person in finance who pays are three different people.

| Column     | Type    | Null | Default             | Notes                                                            |
| ---------- | ------- | ---- | ------------------- | ---------------------------------------------------------------- |
| id         | uuid    | no   | `gen_random_uuid()` | PK                                                               |
| client_id  | uuid    | no   |                     | FK → `clients.id` (cascade)                                      |
| name       | text    | no   |                     |                                                                  |
| email      | text    | no   |                     | Mirrors `clients.email`: a contact exists to be written to       |
| phone      | text    | yes  |                     |                                                                  |
| role       | text    | yes  |                     | Free text, e.g. `Finance`, `Signatory`. Deliberately not an enum |
| is_primary | boolean | no   | `false`             |                                                                  |

Standard `timestamps` and `softDelete`.

Indexes: `client_contacts_client_id_idx`, `client_contacts_email_idx`, unique
`uq_client_contacts_primary` on `client_id` where `is_primary = true AND deleted_at IS NULL` — the
structural form of "at most one primary contact per client", in the same shape as
`time_entries_running_timer_idx`. Soft-deleting the primary frees the slot for its replacement.

CRUD lives in `features/clients` — reads in `contactQueries.ts`, writes in `mutations.ts` — and is
surfaced by the Contacts tab of the client workspace. Promotion is demote-then-promote inside one
transaction, so the losing side of two concurrent promotions arrives as a unique violation on
`uq_client_contacts_primary` and leaves as a translated message rather than a driver error.

A contact carries two capabilities over its own client's documents and no others
([ADR-0027](adr/0027-contact-identity.md)). It is the **delivery target**: every send path resolves
the recipient through `getClientDocumentRecipient`, which returns the live primary contact when
there is one and `clients.email` otherwise, and stores nothing on the document —
`email_logs.recipient_email` is the record of where each send actually went. It is also an
**acceptance identity**: the proposal OTP flow matches against `clients.email` plus every live
contact of that same client (`features/proposals/publicResponse.ts`'s `matchProposalRespondent`),
issues the code to the matched address alone, and never admits a soft-deleted contact or a contact
of a different client.

---

## 14. Projects

### `projects`

| Column            | Type       | Null | Default             | Notes                                         |
| ----------------- | ---------- | ---- | ------------------- | --------------------------------------------- |
| id                | uuid       | no   | `gen_random_uuid()` | PK                                            |
| client_id         | uuid       | no   |                     | FK → `clients.id` (cascade)                   |
| name              | text       | no   |                     |                                               |
| description       | text       | yes  |                     |                                               |
| status            | enum       | no   | `'active'`          | See enum reference                            |
| budget_cents      | bigint     | yes  |                     | ≥ 0 if not null                               |
| currency          | varchar(3) | yes  |                     | Override of client/instance default           |
| start_date        | date       | yes  |                     |                                               |
| end_date          | date       | yes  |                     | ≥ start_date if both not null                 |
| hourly_rate_cents | bigint     | yes  |                     | Default rate for time entries on this project |

Standard `timestamps` and `softDelete`.

Constraints:

- `chk_projects_budget` — `budget_cents IS NULL OR budget_cents >= 0`.
- `chk_projects_dates` — `end_date IS NULL OR start_date IS NULL OR end_date >= start_date`.
- `chk_projects_hourly_rate` — `hourly_rate_cents IS NULL OR hourly_rate_cents >= 0`.

Indexes: `projects_client_id_idx`, `projects_status_idx`, `projects_active_idx` on `id` where
`deleted_at IS NULL`, unique `uq_projects_id_client_id` on `(id, client_id)`.

`uq_projects_id_client_id` is not a domain rule of its own — `id` is already unique. It exists
because the five `fk_<table>_project_client` composite foreign keys reference that pair, and
Postgres requires a unique index on a referenced column list. See
[ADR-0026](adr/0026-document-parentage.md).

**A project cannot be re-parented once it has financial records.** Every composite key carries
`ON UPDATE RESTRICT`, so changing `projects.client_id` while an invoice, expense, contract,
recurring schedule, or proposal points at the project is refused by the database.
`features/projects/mutations.ts`'s `updateProject` refuses it first, with a translated message, so
the raw foreign-key error never reaches a user.

---

## 15. Tasks

Lightweight task system inside projects.

### `tasks`

| Column            | Type        | Null | Default             | Notes                                                 |
| ----------------- | ----------- | ---- | ------------------- | ----------------------------------------------------- |
| id                | uuid        | no   | `gen_random_uuid()` | PK                                                    |
| project_id        | uuid        | no   |                     | FK → `projects.id` (cascade)                          |
| title             | text        | no   |                     |                                                       |
| description       | text        | yes  |                     | Markdown                                              |
| status            | enum        | no   | `'todo'`            | `backlog \| todo \| in_progress \| done \| cancelled` |
| priority          | enum        | no   | `'normal'`          | `low \| normal \| high \| urgent`                     |
| due_at            | timestamptz | yes  |                     |                                                       |
| completed_at      | timestamptz | yes  |                     |                                                       |
| position          | integer     | no   | `0`                 | Manual ordering within the project                    |
| hourly_rate_cents | bigint      | yes  |                     | Override for time entries on this task                |

Standard `timestamps` and `softDelete`.

Constraints:

- `chk_tasks_hourly_rate` — `hourly_rate_cents IS NULL OR hourly_rate_cents >= 0`. The second rung
  of the rate-precedence ladder in `features/timeTracking/services/resolveHourlyRate.ts`, bounded
  like `clients`, `projects`, and `time_entries` are.

Indexes: `tasks_project_id_idx`, `tasks_status_idx`, `tasks_due_at_idx` on `due_at` where
`due_at IS NOT NULL`.

---

## 16. Time entries

### `time_entries`

| Column                     | Type        | Null | Default             | Notes                                                              |
| -------------------------- | ----------- | ---- | ------------------- | ------------------------------------------------------------------ |
| id                         | uuid        | no   | `gen_random_uuid()` | PK                                                                 |
| project_id                 | uuid        | no   |                     | FK → `projects.id` (cascade)                                       |
| task_id                    | uuid        | yes  |                     | FK → `tasks.id` (set null)                                         |
| user_id                    | uuid        | yes  |                     | FK → `users.id` (set null) — who logged the time                   |
| started_at                 | timestamptz | no   |                     |                                                                    |
| ended_at                   | timestamptz | yes  |                     | Null while a timer is running                                      |
| duration_seconds           | integer     | yes  |                     | Computed when ended_at is set; ≥ 0                                 |
| billable                   | boolean     | no   | `true`              |                                                                    |
| hourly_rate_override_cents | bigint      | yes  |                     | Per-entry rate the user typed; top rung of the precedence ladder   |
| hourly_rate_snapshot_cents | bigint      | no   |                     | Resolved at log time via the rate precedence rule, then frozen     |
| description                | text        | yes  |                     |                                                                    |
| source                     | enum        | no   | `'timer'`           | `timer \| manual`                                                  |
| invoiced_in_id             | uuid        | yes  |                     | FK → `invoices.id` (set null) — the invoice that billed this entry |

Standard `timestamps` and `softDelete`.

Constraints:

- `chk_time_entries_duration` — `duration_seconds IS NULL OR duration_seconds >= 0`.
- `chk_time_entries_ended` —
  `(ended_at IS NULL AND duration_seconds IS NULL) OR (ended_at IS NOT NULL AND duration_seconds IS NOT NULL AND ended_at >= started_at)`.
- `chk_time_entries_rate` — `hourly_rate_snapshot_cents >= 0`.
- `chk_time_entries_rate_override` —
  `hourly_rate_override_cents IS NULL OR hourly_rate_override_cents >= 0`.

Rate precedence: `entry → task → project → client → settings`, resolved by
`features/timeTracking/services/resolveHourlyRate.ts` and snapshotted onto
`hourly_rate_snapshot_cents` at log time. A rate of `0` at any level is a set rate and stops the
fallthrough; only `NULL` falls through. When no level carries a rate the snapshot is `0` and the
resolved source is `"none"` — no default is invented.

**`invoiced_in_id` is the canonical "this was billed, on that invoice" link**, and the one the
`time_entries_unbilled_idx` and `expenses_unbilled_rebillable_idx` partial indexes rely on.
`line_items.source_time_entry_id` and `line_items.source_expense_id` are optional per-line
provenance, not a mirror of it: `features/recurringInvoices/jobs.ts` writes the first and not the
second, so the two are not interchangeable and neither may be derived from the other. Nothing
enforces this — there is no constraint and no trigger, because the flow that would write both does
not exist yet.

Indexes: `time_entries_project_id_idx`, `time_entries_task_id_idx`, `time_entries_user_id_idx`,
`time_entries_started_at_idx` on `started_at DESC`, `time_entries_unbilled_idx` on `project_id`
where `invoiced_in_id IS NULL AND billable = true`, unique `time_entries_running_timer_idx` on
`user_id` where `ended_at IS NULL AND deleted_at IS NULL` — the structural form of the
one-running-timer-per-user rule.

---

## 17. Expenses

### `expenses`

| Column            | Type          | Null | Default             | Notes                                                     |
| ----------------- | ------------- | ---- | ------------------- | --------------------------------------------------------- |
| id                | uuid          | no   | `gen_random_uuid()` | PK                                                        |
| project_id        | uuid          | yes  |                     | Part of `fk_expenses_project_client` (see below)          |
| client_id         | uuid          | yes  |                     | FK → `clients.id` (set null); required when project_id is |
| amount_cents      | bigint        | no   |                     | ≥ 0                                                       |
| currency          | varchar(3)    | no   |                     | ISO 4217                                                  |
| category          | text          | no   |                     | Free-form category, with sensible defaults proposed in UI |
| description       | text          | no   |                     |                                                           |
| spent_at          | date          | no   |                     |                                                           |
| receipt_upload_id | uuid          | yes  |                     | FK → `uploads.id` (set null)                              |
| rebillable        | boolean       | no   | `false`             |                                                           |
| markup_percentage | numeric(5, 2) | yes  |                     | Optional markup to apply when re-billing                  |
| invoiced_in_id    | uuid          | yes  |                     | FK → `invoices.id` (set null)                             |

Standard `timestamps` and `softDelete`.

Constraints:

- `chk_expenses_project_requires_client` — `project_id IS NULL OR client_id IS NOT NULL`.
- `chk_expenses_amount` — `amount_cents >= 0`.
- `chk_expenses_markup` —
  `markup_percentage IS NULL OR (markup_percentage >= 0 AND markup_percentage <= 1000)`.

`expenses` deliberately has **no** parent check to pair with `chk_expenses_project_requires_client`:
both columns null is legitimate here — a bank fee belongs to nobody — which is why there is no
`chk_expenses_parent` sibling to `chk_invoices_parent`. `features/expenses/mutations.ts`'s
`resolveExpenseScope` keeps its own agreement check because it produces a better message than the
database can.

Foreign key: `fk_expenses_project_client` on `(project_id, client_id)` →
`projects (id, client_id) ON DELETE SET NULL (project_id) ON UPDATE RESTRICT`, added in migration
`0002_document_parent_agreement.sql`. See [ADR-0026](adr/0026-document-parentage.md).

Indexes: `expenses_project_id_idx`, `expenses_client_id_idx`, `expenses_spent_at_idx` on
`spent_at DESC`, `expenses_unbilled_rebillable_idx` on `project_id` where
`invoiced_in_id IS NULL AND rebillable = true`.

---

## 18. Proposals

### `proposals`

| Column                      | Type          | Null | Default             | Notes                                                                                                                                                                                                               |
| --------------------------- | ------------- | ---- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                          | uuid          | no   | `gen_random_uuid()` | PK                                                                                                                                                                                                                  |
| project_id                  | uuid          | yes  |                     | Part of `fk_proposals_project_client` (see below) — null for client-level proposals                                                                                                                                 |
| client_id                   | uuid          | yes  |                     | FK → `clients.id` (set null). Required whenever project_id is set                                                                                                                                                   |
| template_id                 | uuid          | yes  |                     | FK → `templates.id` (set null)                                                                                                                                                                                      |
| pdf_upload_id               | uuid          | yes  |                     | FK → `uploads.id` (set null). Written once by the `proposal.pdf.render` job and never regenerated: the stored object _is_ the record of what the client was sent                                                    |
| number                      | text          | no   |                     | Unique. E.g. `PROP-0001`                                                                                                                                                                                            |
| status                      | enum          | no   | `'draft'`           | See enum reference                                                                                                                                                                                                  |
| currency                    | varchar(3)    | no   | `'EUR'`             |                                                                                                                                                                                                                     |
| discount_type               | enum          | yes  |                     | `percentage \| fixed`                                                                                                                                                                                               |
| discount_percentage         | numeric(5, 2) | yes  |                     | Set when `discount_type = 'percentage'`                                                                                                                                                                             |
| discount_amount_cents       | bigint        | yes  |                     | Set when `discount_type = 'fixed'`                                                                                                                                                                                  |
| subtotal_cents              | bigint        | no   | `0`                 | ≥ 0                                                                                                                                                                                                                 |
| discount_amount_total_cents | bigint        | no   | `0`                 | Computed total discount in cents; ≥ 0                                                                                                                                                                               |
| tax_amount_cents            | bigint        | no   | `0`                 | ≥ 0                                                                                                                                                                                                                 |
| total_cents                 | bigint        | no   | `0`                 | ≥ 0                                                                                                                                                                                                                 |
| valid_until                 | date          | yes  |                     | Used to compute `expired` status                                                                                                                                                                                    |
| notes                       | text          | yes  |                     |                                                                                                                                                                                                                     |
| public_token                | text          | yes  |                     | Unique. Anonymous access via `/p/[token]`. Minted with a CSPRNG at draft creation and never surfaced to any read model, URL, log, or audit entry until `issued_at` is set; null once the link is revoked (ADR-0029) |
| first_viewed_at             | timestamptz   | yes  |                     |                                                                                                                                                                                                                     |
| last_viewed_at              | timestamptz   | yes  |                     |                                                                                                                                                                                                                     |
| view_count                  | integer       | no   | `0`                 | ≥ 0                                                                                                                                                                                                                 |
| issued_at                   | timestamptz   | yes  |                     | Set when transitioning to `sent`                                                                                                                                                                                    |
| locked_at                   | timestamptz   | yes  |                     | Set when accepted; immutable thereafter                                                                                                                                                                             |
| responded_at                | timestamptz   | yes  |                     | Set on accept or reject                                                                                                                                                                                             |
| responded_ip                | text          | yes  |                     |                                                                                                                                                                                                                     |
| rejection_reason            | text          | yes  |                     |                                                                                                                                                                                                                     |

Standard `timestamps` and `softDelete`.

Conversion to an invoice or a contract is recorded on the produced document, not here:
`invoices.proposal_id` and `contracts.proposal_id` are the single source of truth for "this came
from that proposal". A mirrored `converted_to_*_id` column on `proposals` would store the same fact
twice, with nothing keeping the two sides in agreement.

A proposal hangs off a project or off a client, exactly as a contract does — it is the earliest
document a freelancer produces, so requiring the later entity to exist first contradicted
[Architecture: What Remit is](ARCHITECTURE.md#1-what-remit-is). `project_id` was `NOT NULL` with
`ON DELETE CASCADE` until [ADR-0026](adr/0026-document-parentage.md), so deleting a project
destroyed the accepted proposal a signed contract and an issued invoice both pointed at.

Constraints:

- `chk_proposals_parent` — `project_id IS NOT NULL OR client_id IS NOT NULL`. Worded identically to
  `chk_contracts_parent`.
- `chk_proposals_project_requires_client` — `project_id IS NULL OR client_id IS NOT NULL`.
- `chk_proposals_discount_shape` — exactly one of `discount_percentage` / `discount_amount_cents` is
  set when `discount_type` is set; both null when `discount_type` is null.
- `chk_proposals_discount_percentage` — null or `>= 0 AND <= 100`.
- `chk_proposals_discount_amount` — null or `>= 0`.
- `chk_proposals_totals` — all four computed money fields are `>= 0`.
- `chk_proposals_view_count` — `>= 0`.
- `chk_proposals_response` — when `status` is `accepted` or `rejected`, `responded_at` and
  `responded_ip` are non-null.

Foreign key: `fk_proposals_project_client` on `(project_id, client_id)` →
`projects (id, client_id) ON DELETE SET NULL (project_id) ON UPDATE RESTRICT`, added in migration
`0002_document_parent_agreement.sql`. See [ADR-0026](adr/0026-document-parentage.md).

Indexes: `proposals_project_id_idx`, `proposals_client_id_idx`, `proposals_template_id_idx`,
`proposals_status_idx`, unique `proposals_public_token_idx` on `public_token`.

---

## 19. Proposal OTPs

OTPs for the public proposal acceptance flow at `/p/[token]`.

### `proposal_otps`

| Column         | Type        | Null | Default             | Notes                         |
| -------------- | ----------- | ---- | ------------------- | ----------------------------- |
| id             | uuid        | no   | `gen_random_uuid()` | PK                            |
| proposal_id    | uuid        | no   |                     | FK → `proposals.id` (cascade) |
| action         | enum        | no   |                     | `accept \| reject`            |
| code_hash      | text        | no   |                     | bcrypt hash of OTP            |
| email          | text        | no   |                     | Recipient                     |
| expires_at     | timestamptz | no   |                     |                               |
| attempts       | integer     | no   | `0`                 | 0–5                           |
| used_at        | timestamptz | yes  |                     |                               |
| invalidated_at | timestamptz | yes  |                     |                               |
| created_at     | timestamptz | no   | `now()`             |                               |

Constraints:

- `chk_proposal_otps_attempts` — `>= 0 AND <= 5`.
- `chk_proposal_otps_used_invalidated` — not both `used_at` and `invalidated_at` set.

Indexes: `proposal_otps_proposal_id_idx`, `proposal_otps_active_idx` on `proposal_id` where
`used_at IS NULL AND invalidated_at IS NULL`.

**No `updated_at`. No `deleted_at`.**

---

## 20. Contracts

Vinculative documents distinct from proposals, with e-signature.

### `contracts`

| Column             | Type        | Null | Default             | Notes                                                           |
| ------------------ | ----------- | ---- | ------------------- | --------------------------------------------------------------- |
| id                 | uuid        | no   | `gen_random_uuid()` | PK                                                              |
| project_id         | uuid        | yes  |                     | Part of `fk_contracts_project_client` — null for client-level   |
| client_id          | uuid        | yes  |                     | FK → `clients.id` (set null). Required when project_id is set   |
| proposal_id        | uuid        | yes  |                     | FK → `proposals.id` (set null) — when generated from a proposal |
| template_id        | uuid        | yes  |                     | FK → `templates.id` (set null)                                  |
| pdf_upload_id      | uuid        | yes  |                     | FK → `uploads.id` (set null). Written once, never regenerated   |
| number             | text        | no   |                     | Unique                                                          |
| title              | text        | no   |                     |                                                                 |
| status             | enum        | no   | `'draft'`           | See enum reference                                              |
| blocks             | jsonb       | no   | `'[]'::jsonb`       | Block-based content snapshot at send time                       |
| public_token       | text        | yes  |                     | Unique. Anonymous signing via `/c/[token]`. Null once revoked   |
| issued_at          | timestamptz | yes  |                     |                                                                 |
| effective_from     | date        | yes  |                     |                                                                 |
| effective_until    | date        | yes  |                     |                                                                 |
| terminated_at      | timestamptz | yes  |                     |                                                                 |
| termination_reason | text        | yes  |                     |                                                                 |

Standard `timestamps` and `softDelete`.

Constraints:

- `chk_contracts_parent` — at least one of `project_id` or `client_id` is set.
- `chk_contracts_project_requires_client` — `project_id IS NULL OR client_id IS NOT NULL`.
- `chk_contracts_dates` —
  `effective_until IS NULL OR effective_from IS NULL OR effective_until >= effective_from`.

Foreign key: `fk_contracts_project_client` on `(project_id, client_id)` →
`projects (id, client_id) ON DELETE SET NULL (project_id) ON UPDATE RESTRICT`, added in migration
`0002_document_parent_agreement.sql`. See [ADR-0026](adr/0026-document-parentage.md).

Indexes: `contracts_project_id_idx`, `contracts_client_id_idx`, `contracts_proposal_id_idx`,
`contracts_status_idx`, unique `contracts_public_token_idx`, unique
`contracts_proposal_id_unique_idx` on `proposal_id` where
`proposal_id IS NOT NULL AND deleted_at IS NULL`.

---

## 21. Contract signatures

Audit trail of contract signings.

### `contract_signatures`

| Column               | Type        | Null | Default             | Notes                                               |
| -------------------- | ----------- | ---- | ------------------- | --------------------------------------------------- |
| id                   | uuid        | no   | `gen_random_uuid()` | PK                                                  |
| contract_id          | uuid        | no   |                     | FK → `contracts.id` (cascade)                       |
| signer_name          | text        | no   |                     | Typed full name                                     |
| signer_email         | text        | no   |                     |                                                     |
| consent_text         | text        | no   |                     | Snapshot of consent text shown at signing           |
| ip_address           | text        | no   |                     |                                                     |
| user_agent           | text        | no   |                     |                                                     |
| signed_pdf_upload_id | uuid        | yes  |                     | FK → `uploads.id` (set null) — generated signed PDF |
| signed_at            | timestamptz | no   | `now()`             |                                                     |
| created_at           | timestamptz | no   | `now()`             |                                                     |

Indexes: `contract_signatures_contract_id_idx`.

**No `updated_at`. No `deleted_at`.** Insert-only.

---

## 22. Recurring invoices

Schedules that auto-generate invoices.

### `recurring_invoices`

| Column                | Type       | Null | Default             | Notes                                                           |
| --------------------- | ---------- | ---- | ------------------- | --------------------------------------------------------------- |
| id                    | uuid       | no   | `gen_random_uuid()` | PK                                                              |
| client_id             | uuid       | no   |                     | FK → `clients.id` (cascade)                                     |
| project_id            | uuid       | yes  |                     | Part of `fk_recurring_invoices_project_client` (see below)      |
| template_id           | uuid       | yes  |                     | FK → `templates.id` (set null)                                  |
| name                  | text       | no   |                     |                                                                 |
| status                | enum       | no   | `'active'`          | `active \| paused \| completed \| cancelled`                    |
| cadence               | enum       | no   |                     | `weekly \| monthly \| quarterly \| yearly`                      |
| cadence_day           | integer    | yes  |                     | Day of month (1-31) for monthly+, day of week for weekly        |
| next_run_at           | date       | no   |                     |                                                                 |
| last_run_at           | date       | yes  |                     |                                                                 |
| end_after_count       | integer    | yes  |                     | Stop after N occurrences. Mutually exclusive with end_by_date   |
| end_by_date           | date       | yes  |                     |                                                                 |
| occurrences_generated | integer    | no   | `0`                 | ≥ 0                                                             |
| auto_send             | boolean    | no   | `false`             | If true, generate as `sent`; if false, as `draft`               |
| currency              | varchar(3) | no   | `'EUR'`             |                                                                 |
| line_items_blueprint  | jsonb      | no   | `'[]'::jsonb`       | Snapshot of line items to populate each invoice                 |
| included_hours        | integer    | yes  |                     | Retainer pool. Null = not a retainer                            |
| overage_rate_cents    | bigint     | yes  |                     | Rate after pool is exhausted; required if included_hours is set |
| notes                 | text       | yes  |                     |                                                                 |

Standard `timestamps` and `softDelete`.

Constraints:

- `chk_recurring_invoices_project_requires_client` — `project_id IS NULL OR client_id IS NOT NULL`.
  Redundant against the `NOT NULL` on `client_id` today, and declared anyway so every dual-parent
  table states the same rule rather than one of them relying on a column that could be relaxed.
- `chk_recurring_invoices_end_condition` — at most one of `end_after_count` and `end_by_date` is
  set.
- `chk_recurring_invoices_retainer` —
  `(included_hours IS NULL AND overage_rate_cents IS NULL) OR (included_hours >= 0 AND overage_rate_cents >= 0)`.

Foreign key: `fk_recurring_invoices_project_client` on `(project_id, client_id)` →
`projects (id, client_id) ON DELETE SET NULL (project_id) ON UPDATE RESTRICT`, added in migration
`0002_document_parent_agreement.sql`. See [ADR-0026](adr/0026-document-parentage.md).

Indexes: `recurring_invoices_client_id_idx`, `recurring_invoices_status_idx`,
`recurring_invoices_next_run_at_idx` on `next_run_at` where `status = 'active'`.

---

## 23. Invoices

### `invoices`

| Column                      | Type            | Null | Default             | Notes                                                                                   |
| --------------------------- | --------------- | ---- | ------------------- | --------------------------------------------------------------------------------------- |
| id                          | uuid            | no   | `gen_random_uuid()` | PK                                                                                      |
| project_id                  | uuid            | yes  |                     | Part of `fk_invoices_project_client` — null for ad-hoc client invoices                  |
| client_id                   | uuid            | yes  |                     | FK → `clients.id` (set null). Always required when project_id is set                    |
| proposal_id                 | uuid            | yes  |                     | FK → `proposals.id` (set null) — when generated from a proposal                         |
| recurring_invoice_id        | uuid            | yes  |                     | FK → `recurring_invoices.id` (set null) — when generated from a schedule                |
| template_id                 | uuid            | yes  |                     | FK → `templates.id` (set null)                                                          |
| pdf_upload_id               | uuid            | yes  |                     | FK → `uploads.id` (set null). Written once, never regenerated                           |
| number                      | text            | no   |                     | Unique. E.g. `INV-0042`                                                                 |
| status                      | enum            | no   | `'draft'`           | See enum reference                                                                      |
| currency                    | varchar(3)      | no   | `'EUR'`             |                                                                                         |
| exchange_rate               | numeric(20, 10) | yes  |                     | Snapshot when currency differs from instance default                                    |
| discount_type               | enum            | yes  |                     | `percentage \| fixed`                                                                   |
| discount_percentage         | numeric(5, 2)   | yes  |                     |                                                                                         |
| discount_amount_cents       | bigint          | yes  |                     |                                                                                         |
| subtotal_cents              | bigint          | no   | `0`                 | ≥ 0                                                                                     |
| discount_amount_total_cents | bigint          | no   | `0`                 | ≥ 0                                                                                     |
| tax_amount_cents            | bigint          | no   | `0`                 | ≥ 0                                                                                     |
| total_cents                 | bigint          | no   | `0`                 | ≥ 0                                                                                     |
| amount_paid_cents           | bigint          | no   | `0`                 | Sum of `payments.amount_cents`. Maintained by app.                                      |
| issue_date                  | date            | yes  |                     |                                                                                         |
| due_date                    | date            | yes  |                     | Used for overdue detection. ≥ issue_date if both set.                                   |
| paid_at                     | timestamptz     | yes  |                     | Set when status transitions to `paid`                                                   |
| late_fee_cents              | bigint          | yes  |                     | Read by the PDF merge variable `invoice.lateFee` and the data export. No code writes it |
| notes                       | text            | yes  |                     |                                                                                         |
| public_token                | text            | yes  |                     | Unique. Anonymous access via `/i/[token]`. Null once revoked                            |
| first_viewed_at             | timestamptz     | yes  |                     |                                                                                         |
| last_viewed_at              | timestamptz     | yes  |                     |                                                                                         |
| view_count                  | integer         | no   | `0`                 | ≥ 0                                                                                     |
| last_reminder_sent_at       | timestamptz     | yes  |                     |                                                                                         |

Standard `timestamps` and `softDelete`.

Constraints:

- `chk_invoices_parent` — `project_id IS NOT NULL OR client_id IS NOT NULL`.
- `chk_invoices_project_requires_client` — `project_id IS NULL OR client_id IS NOT NULL`.
- `chk_invoices_discount_shape` — same shape as proposals.
- `chk_invoices_discount_percentage` — null or `>= 0 AND <= 100`.
- `chk_invoices_discount_amount` — null or `>= 0`.
- `chk_invoices_totals` — all four computed money fields are `>= 0`.
- `chk_invoices_amount_paid` — `amount_paid_cents >= 0 AND amount_paid_cents <= total_cents`.
- `chk_invoices_dates` — `due_date IS NULL OR issue_date IS NULL OR due_date >= issue_date`.
- `chk_invoices_view_count` — `>= 0`.
- `chk_invoices_late_fee` — `late_fee_cents IS NULL OR late_fee_cents >= 0`.

`invoices.client_id` is a deliberate denormalisation, not a value to be derived by joining through
`project_id`: an invoice is a financial record that must survive its project, and a join would lose
the client the moment the project row went away.

Foreign key: `fk_invoices_project_client` on `(project_id, client_id)` →
`projects (id, client_id) ON DELETE SET NULL (project_id) ON UPDATE RESTRICT`, added in migration
`0002_document_parent_agreement.sql`. See [ADR-0026](adr/0026-document-parentage.md).

**Note for whoever builds the retention purge ([ADR-0010](adr/0010-soft-delete.md)).** A client hard
delete cascades its projects away and nulls `invoices.client_id`, which leaves an ad-hoc invoice
with both parents null and fails `chk_invoices_parent`. It predates the composite parent keys rather
than being caused by them, and no hard-delete path exists in the codebase. The purge has to order
its writes so the invoices go before the client, or resolve the parent first.

Indexes: `invoices_project_id_idx`, `invoices_client_id_idx`, `invoices_proposal_id_idx`,
`invoices_recurring_invoice_id_idx`, `invoices_template_id_idx`, `invoices_status_idx`,
`invoices_due_date_idx` on `due_date`, unique `invoices_public_token_idx`.

---

## 24. Line items

Polymorphic — belongs to a proposal, invoice, or credit note via mutually-exclusive FKs (see
[ADR-0017](adr/0017-polymorphic-line-items.md)).

### `line_items`

| Column                  | Type           | Null | Default             | Notes                                           |
| ----------------------- | -------------- | ---- | ------------------- | ----------------------------------------------- |
| id                      | uuid           | no   | `gen_random_uuid()` | PK                                              |
| proposal_id             | uuid           | yes  |                     | FK → `proposals.id` (cascade)                   |
| invoice_id              | uuid           | yes  |                     | FK → `invoices.id` (cascade)                    |
| credit_note_id          | uuid           | yes  |                     | FK → `credit_notes.id` (cascade)                |
| tax_rate_id             | uuid           | yes  |                     | FK → `tax_rates.id` (set null)                  |
| position                | integer        | no   |                     | Manual ordering within the parent               |
| description             | text           | no   |                     |                                                 |
| unit                    | text           | yes  |                     | E.g. `hour`, `unit`, `day`                      |
| quantity                | numeric(10, 2) | no   |                     | `> 0`                                           |
| unit_price_cents        | bigint         | no   |                     | ≥ 0                                             |
| discount_type           | enum           | yes  |                     | `percentage \| fixed`                           |
| discount_percentage     | numeric(5, 2)  | yes  |                     |                                                 |
| discount_amount_cents   | bigint         | yes  |                     |                                                 |
| tax_percentage_snapshot | numeric(5, 2)  | no   | `0`                 | Captured at line creation; immutable thereafter |
| subtotal_cents          | bigint         | no   | `0`                 | ≥ 0                                             |
| tax_amount_cents        | bigint         | no   | `0`                 | ≥ 0                                             |
| total_cents             | bigint         | no   | `0`                 | ≥ 0                                             |
| source_time_entry_id    | uuid           | yes  |                     | FK → `time_entries.id` (set null) — provenance  |
| source_expense_id       | uuid           | yes  |                     | FK → `expenses.id` (set null) — provenance      |

Standard `timestamps` and `softDelete`.

Constraints:

- `chk_line_items_parent` — exactly one of `proposal_id`, `invoice_id`, and `credit_note_id` is set.
- `chk_line_items_discount_shape` — same shape as proposals.
- `chk_line_items_discount_percentage` — null or `>= 0 AND <= 100`.
- `chk_line_items_discount_amount` — null or `>= 0`.
- `chk_line_items_quantity` — `> 0`.
- `chk_line_items_unit_price` — `>= 0`.
- `chk_line_items_tax_percentage` — `>= 0 AND <= 100`.
- `chk_line_items_totals` — `>= 0` for all three.

Indexes: `line_items_proposal_id_idx`, `line_items_invoice_id_idx`, `idx_line_items_credit_note_id`,
`line_items_tax_rate_id_idx`, `line_items_source_time_entry_id_idx`,
`line_items_source_expense_id_idx`, unique partial `uq_line_items_proposal_position` on
`(proposal_id, position)` where `proposal_id IS NOT NULL`, unique partial
`uq_line_items_invoice_position` on `(invoice_id, position)` where `invoice_id IS NOT NULL`, unique
partial `uq_line_items_credit_note_position` on `(credit_note_id, position)` where
`credit_note_id IS NOT NULL`.

---

## 25. Payments

Records of money received against an invoice. An invoice may have multiple payments (partial-payment
support).

### `payments`

| Column                   | Type        | Null | Default             | Notes                                                |
| ------------------------ | ----------- | ---- | ------------------- | ---------------------------------------------------- |
| id                       | uuid        | no   | `gen_random_uuid()` | PK                                                   |
| invoice_id               | uuid        | no   |                     | FK → `invoices.id` (cascade)                         |
| method                   | enum        | no   |                     | `bank_transfer \| stripe \| cash \| other`           |
| amount_cents             | bigint      | no   |                     | `> 0`                                                |
| currency                 | varchar(3)  | no   |                     | Should match invoice.currency in normal cases        |
| paid_at                  | timestamptz | no   | `now()`             |                                                      |
| reference                | text        | yes  |                     | Bank transaction reference, Stripe payment intent id |
| stripe_payment_intent_id | text        | yes  |                     | Set for Stripe payments                              |
| notes                    | text        | yes  |                     |                                                      |

Standard `timestamps` and `softDelete`.

Constraints:

- `chk_payments_amount` — `> 0`.

Indexes: `payments_invoice_id_idx`, `payments_paid_at_idx` on `paid_at DESC`, unique
`payments_stripe_payment_intent_idx` on `stripe_payment_intent_id` where
`stripe_payment_intent_id IS NOT NULL`.

---

## 26. Credit notes

Adjustments against an existing invoice. Own numbering sequence.

### `credit_notes`

| Column           | Type        | Null | Default             | Notes                        |
| ---------------- | ----------- | ---- | ------------------- | ---------------------------- |
| id               | uuid        | no   | `gen_random_uuid()` | PK                           |
| invoice_id       | uuid        | no   |                     | FK → `invoices.id` (cascade) |
| pdf_upload_id    | uuid        | yes  |                     | FK → `uploads.id` (set null) |
| number           | text        | no   |                     | Unique. E.g. `CN-0001`       |
| reason           | text        | yes  |                     |                              |
| currency         | varchar(3)  | no   |                     |                              |
| subtotal_cents   | bigint      | no   | `0`                 | ≥ 0                          |
| tax_amount_cents | bigint      | no   | `0`                 | ≥ 0                          |
| total_cents      | bigint      | no   | `0`                 | ≥ 0                          |
| issued_at        | timestamptz | no   | `now()`             |                              |

Standard `timestamps` and `softDelete`.

Constraints:

- `chk_credit_notes_totals` — all three money fields are `>= 0`.

Indexes: `credit_notes_invoice_id_idx`, unique `credit_notes_number_idx`.

Line items for credit notes reuse the `line_items` table via the nullable `credit_note_id` FK. The
Line items section above is the authoritative definition of that three-parent polymorphic shape.

---

## 27. Data exports

One row per export requested from `/settings/data`, and the only durable record that an archive
exists. The archive itself is assembled by the `data_export.assemble` job (ADR-0023) in the worker
process and stored in the credentialed exports bucket, never in the public runtime bucket.

### `data_exports`

| Column               | Type        | Null | Default             | Notes                                           |
| -------------------- | ----------- | ---- | ------------------- | ----------------------------------------------- |
| id                   | uuid        | no   | `gen_random_uuid()` | PK                                              |
| scope                | enum        | no   |                     | `instance \| client`                            |
| client_id            | uuid        | yes  |                     | FK → `clients.id` (set null). Client scope only |
| status               | enum        | no   | `'pending'`         | `pending \| running \| ready \| failed`         |
| progress             | integer     | no   | `0`                 | 0–100, written by the job                       |
| started_at           | timestamptz | yes  |                     | Set when the job claims the row                 |
| completed_at         | timestamptz | yes  |                     | Set on `ready` and on `failed`                  |
| failure_reason       | text        | yes  |                     | Stable reason code, never a raw error message   |
| requested_by_user_id | uuid        | yes  |                     | FK → `users.id` (set null)                      |
| filename             | text        | yes  |                     | ASCII slug, e.g. `remit-export-instance-…​.zip` |
| storage_key          | text        | yes  |                     | Object key in the exports bucket                |
| size_bytes           | bigint      | yes  |                     | ≥ 0                                             |
| entry_count          | integer     | yes  |                     | Files inside the archive                        |

Standard `timestamps`. No `softDelete`: an export either has an archive behind it or it does not,
and hiding a row would leave its object in the exports bucket with nothing pointing at it.

Constraints:

- `chk_data_exports_progress` — `progress BETWEEN 0 AND 100`.
- `chk_data_exports_size_bytes` — `size_bytes IS NULL OR size_bytes >= 0`.
- `chk_data_exports_scope_client` — an `instance` export names no client. The `client` side is
  deliberately unconstrained because `client_id` goes null when the exported client is deleted.

Indexes: `idx_data_exports_status`, `idx_data_exports_created_at`, `idx_data_exports_client_id`.

`client_id` is `set null` rather than `cascade` because the archive outlives the client it covers —
that is the point of an offboarding export — and the `data_export.requested` audit entry keeps the
client id permanently.

Which tables and columns reach an archive is defined by the manifest in
`features/dataExport/services/exportManifest.ts`; see
[ARCHITECTURE.md, Data export and deletion](ARCHITECTURE.md#data-export-and-deletion) for the
inclusion and exclusion policy.

---

## 28. Attachments

Many files per record, for the four entities that carry them in v1: clients, projects, invoices and
expenses. Every attachment object lives in the private `documents` bucket and is served only through
`app/api/attachments/[id]/route.ts`; nothing here is reachable from a public token route. See
[ADR-0028](adr/0028-attachments-and-visual-identity.md).

### `attachments`

| Column              | Type | Null | Default             | Notes                                          |
| ------------------- | ---- | ---- | ------------------- | ---------------------------------------------- |
| id                  | uuid | no   | `gen_random_uuid()` | PK                                             |
| client_id           | uuid | yes  |                     | FK → `clients.id` (cascade)                    |
| project_id          | uuid | yes  |                     | FK → `projects.id` (cascade)                   |
| invoice_id          | uuid | yes  |                     | FK → `invoices.id` (cascade)                   |
| expense_id          | uuid | yes  |                     | FK → `expenses.id` (cascade)                   |
| upload_id           | uuid | no   |                     | FK → `uploads.id` (cascade). Unique            |
| title               | text | yes  |                     | Caption, ≤ 200 chars. Null = show the filename |
| uploaded_by_user_id | uuid | yes  |                     | FK → `users.id` (set null)                     |

Standard `timestamps`. No `softDelete`: removing an attachment deletes the row, the `uploads` row
and the stored object, because a user who removes a file expects it gone rather than hidden while
the object stays readable to anyone holding its key.

Constraints:

- `chk_attachments_parent` — exactly one of `client_id`, `project_id`, `invoice_id`, `expense_id` is
  set, in the same shape as `chk_line_items_parent`. This is what makes "an attachment belongs to
  precisely one record the requester can be checked against" structural rather than conventional.
- `chk_attachments_title` — `title IS NULL OR length(title) <= 200`.

Indexes: one per parent foreign key, `attachments_uploaded_by_user_id_idx`, and
`uq_attachments_upload_id` — **unique**, because removing an attachment deletes its `uploads` row,
so two attachments sharing one upload would make removing either destroy both.

The parent foreign keys cascade rather than setting null: an attachment whose parent is gone has no
record left to authorize a reader against, so it must not survive it.

Limits are enforced on the server — in `features/attachments/` and the presign route, not only in
the client: 25 MB per file, 20 files per record, 100 MB total per record, and a mime allowlist that
excludes archives and SVG.

---

## 29. Enum reference

All enum types declared in `database/schema/enums.ts`.

| Enum name                  | Values                                                                                                                                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `member_role`              | `owner`, `accountant`, `assistant`                                                                                                                                                                   |
| `lead_status`              | `new`, `contacted`, `qualified`, `proposal_sent`, `won`, `lost`                                                                                                                                      |
| `project_status`           | `active`, `completed`, `on_hold`, `cancelled`                                                                                                                                                        |
| `task_status`              | `backlog`, `todo`, `in_progress`, `done`, `cancelled`                                                                                                                                                |
| `task_priority`            | `low`, `normal`, `high`, `urgent`                                                                                                                                                                    |
| `time_entry_source`        | `timer`, `manual`                                                                                                                                                                                    |
| `proposal_status`          | `draft`, `sent`, `accepted`, `rejected`                                                                                                                                                              |
| `proposal_action`          | `accept`, `reject`                                                                                                                                                                                   |
| `contract_status`          | `draft`, `sent`, `signed`, `expired`, `terminated`                                                                                                                                                   |
| `invoice_status`           | `draft`, `sent`, `paid`                                                                                                                                                                              |
| `recurring_invoice_status` | `active`, `paused`, `completed`, `cancelled`                                                                                                                                                         |
| `recurring_cadence`        | `weekly`, `monthly`, `quarterly`, `yearly`                                                                                                                                                           |
| `payment_method`           | `bank_transfer`, `stripe`, `cash`, `other`                                                                                                                                                           |
| `email_provider`           | `smtp`, `resend`                                                                                                                                                                                     |
| `email_status`             | `pending`, `sent`, `failed`                                                                                                                                                                          |
| `discount_type`            | `percentage`, `fixed`                                                                                                                                                                                |
| `entity_type`              | `client`, `project`, `proposal`, `invoice`, `contract`, `task`, `time_entry`, `expense`, `payment`                                                                                                   |
| `document_type`            | `proposal`, `invoice`, `contract`                                                                                                                                                                    |
| `template_type`            | `invoice`, `proposal`, `contract`, `credit_note`, `email_invoice_send`, `email_proposal_send`, `email_contract_send`, `email_payment_receipt`, `email_overdue_reminder`, `email_recurring_generated` |
| `storage_bucket`           | `public`, `documents`                                                                                                                                                                                |
| `backup_destination`       | `local`, `s3`, `r2`, `b2`                                                                                                                                                                            |
| `backup_cadence`           | `daily`, `weekly`                                                                                                                                                                                    |
| `data_export_scope`        | `instance`, `client`                                                                                                                                                                                 |
| `data_export_status`       | `pending`, `running`, `ready`, `failed`                                                                                                                                                              |

`overdue` and `partially_paid` for invoices are **computed**, not stored. The stored value remains
`sent` until the invoice is fully paid; the application surfaces `overdue` when `due_date < now()`
and `paid_at IS NULL`, and `partially_paid` when
`amount_paid_cents > 0 AND amount_paid_cents < total_cents`.

`member_role` is the app-owned role enum, used by `audit_logs.actor_role`. Better Auth's
organization-plugin tables (`member.role`, `invitation.role`, `invitation.status`) are stored as
`text` to match the plugin contract.

`entity_type` and the activity feed do not line up in either direction, and both halves matter to
anyone extending the feed. `features/activityLog/events.ts` writes eight of its nine values and
never writes `task`. The four domain nouns it cannot hold at all — a lead, a credit note, a
recurring invoice and a client contact — are why none of those appear in the feed; admitting one
needs a migration that adds the value.

---

_When this schema is implemented, this document and the corresponding Drizzle code are the single
source of truth. ADRs document the *why* of structural decisions; this document captures the *what*.
Both are updated when the schema evolves._
