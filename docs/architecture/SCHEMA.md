# Remit — Database schema

> Authoritative table-by-table specification of the final schema. Describes every column, its type,
> nullability, default, and the constraints/indexes the table carries. Does not contain Drizzle code
> — implementation translates this specification into `database/schema/*.ts` files using the
> conventions in `database.md` and the Drizzle documentation (consult Context7 if needed for the
> exact API of the Drizzle version in use).
>
> This document and `ARCHITECTURE.md` together are the technical contract for the schema. When a new
> feature requires schema changes, both are updated as part of the work.

---

## Table of contents

1. [Conventions](#1-conventions)
2. [Universal helpers](#2-universal-helpers)
3. [Auth tables (better-auth)](#3-auth-tables-better-auth)
4. [Organization tables (better-auth organization plugin)](#4-organization-tables-better-auth-organization-plugin)
5. [Audit log](#5-audit-log)
6. [Activity log](#6-activity-log)
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
27. [Enum reference](#28-enum-reference)

---

## 1. Conventions

These apply to every table unless explicitly overridden.

- **Primary key.** `uuid`, generated with `defaultRandom()`. Column name `id`.
- **Naming.** Tables `snake_case` plural. Columns `snake_case` in the database, exposed as
  `camelCase` in TypeScript by Drizzle.
- **Timestamps.** Every table has `created_at` and `updated_at`, both `timestamptz`, both
  `NOT NULL DEFAULT now()`. `updated_at` is auto-bumped on UPDATE via the `timestamps` helper.
- **Soft delete.** Domain tables have `deleted_at` (`timestamptz`, nullable), via the `softDelete`
  helper. Tables explicitly noted as **insert-only** (audit log, OTPs) and infrastructure tables
  (auth) do not have `deleted_at`.
- **Foreign keys.** Default to `ON DELETE CASCADE`. Exceptions explicitly noted.
- **Money.** `bigint` storing the smallest currency unit (cents for EUR/USD). The ISO 4217 currency
  code is on the parent entity, not on each money column.
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
relies on. **No timestamps helper** here — better-auth manages its own timestamp shape.

### `user`

| Column             | Type        | Null | Default             | Notes                                                        |
| ------------------ | ----------- | ---- | ------------------- | ------------------------------------------------------------ |
| id                 | uuid        | no   | `gen_random_uuid()` | PK                                                           |
| name               | text        | no   |                     |                                                              |
| email              | text        | no   |                     | Unique                                                       |
| email_verified     | boolean     | no   | `false`             |                                                              |
| image              | text        | yes  |                     |                                                              |
| two_factor_enabled | boolean     | yes  | `false`             | Required for authenticated app access once setup is complete |
| created_at         | timestamptz | no   | `now()`             |                                                              |
| updated_at         | timestamptz | no   | `now()` (autobump)  |                                                              |

### `session`

| Column                 | Type        | Null | Default            | Notes                                                                           |
| ---------------------- | ----------- | ---- | ------------------ | ------------------------------------------------------------------------------- |
| id                     | text        | no   |                    | PK (better-auth-managed)                                                        |
| user_id                | uuid        | no   |                    | FK → `user.id` (cascade)                                                        |
| token                  | text        | no   |                    | Unique                                                                          |
| expires_at             | timestamptz | no   |                    |                                                                                 |
| ip_address             | text        | yes  |                    |                                                                                 |
| user_agent             | text        | yes  |                    |                                                                                 |
| active_organization_id | uuid        | yes  |                    | FK → `organization.id` (set null). Added by the Better Auth organization plugin |
| created_at             | timestamptz | no   | `now()`            |                                                                                 |
| updated_at             | timestamptz | no   | `now()` (autobump) |                                                                                 |

Index: `session_user_id_idx` on `user_id`.

### `account`

OAuth/credential accounts as managed by better-auth. Schema unchanged from upstream. Index on
`user_id`.

### `verification`

Email verification and password reset tokens as managed by better-auth. Index on `identifier`.

### `two_factor`

| Column       | Type | Null | Notes                                                                             |
| ------------ | ---- | ---- | --------------------------------------------------------------------------------- |
| id           | text | no   | PK                                                                                |
| user_id      | uuid | no   | FK → `user.id` (cascade)                                                          |
| secret       | text | no   | Encrypted at rest                                                                 |
| backup_codes | text | no   | Better Auth-managed encrypted payload containing the current list of backup codes |

Index on `user_id`.

Remit uses Better Auth **backup codes** in `two_factor.backup_codes` only to complete the sign-in
flow when the authenticator app is unavailable. Password reset is handled either by email reset
links (when SMTP is configured) or by CLI/admin reset on self-hosted installs.

---

## 4. Organization tables (better-auth organization plugin)

Used in **degenerate single-org-per-instance mode**. Exactly one row in `organization` per Remit
instance, created automatically during `/setup`. Every authenticated user is a member. Field names
and lifecycle rules follow the Better Auth organization plugin contract; Remit constrains the
allowed business roles at the application boundary.

### `organization`

| Column     | Type        | Null | Default             | Notes                                  |
| ---------- | ----------- | ---- | ------------------- | -------------------------------------- |
| id         | uuid        | no   | `gen_random_uuid()` | PK                                     |
| name       | text        | no   |                     | Mirrors `settings.business_name`       |
| slug       | text        | no   |                     | Required by Better Auth. Unique        |
| logo       | text        | yes  |                     |                                        |
| metadata   | text        | yes  |                     | JSON serialized as text by Better Auth |
| created_at | timestamptz | no   | `now()`             |                                        |

### `member`

Maps a user to a role within the (single) organization.

| Column          | Type        | Null | Default             | Notes                                                                                  |
| --------------- | ----------- | ---- | ------------------- | -------------------------------------------------------------------------------------- |
| id              | uuid        | no   | `gen_random_uuid()` | PK                                                                                     |
| user_id         | uuid        | no   |                     | FK → `user.id` (cascade)                                                               |
| organization_id | uuid        | no   |                     | FK → `organization.id` (cascade)                                                       |
| role            | text        | no   |                     | Better Auth role string. Remit constrains values to `owner \| accountant \| assistant` |
| created_at      | timestamptz | no   | `now()`             |                                                                                        |

Indexes: `member_user_id_idx`, `member_organization_id_idx`. Unique on `(user_id, organization_id)`.

Constraint: at most one member with role `owner` per organization. Enforced via partial unique index
`uq_member_owner_per_org` on `organization_id` where `role = 'owner'`.

### `invitation`

Pending invitation as created by an owner.

| Column          | Type        | Null | Default             | Notes                                                                              |
| --------------- | ----------- | ---- | ------------------- | ---------------------------------------------------------------------------------- |
| id              | uuid        | no   | `gen_random_uuid()` | PK                                                                                 |
| email           | text        | no   |                     |                                                                                    |
| organization_id | uuid        | no   |                     | FK → `organization.id` (cascade)                                                   |
| inviter_id      | uuid        | no   |                     | FK → `user.id`. Required by Better Auth; `SET NULL` is not valid for this column   |
| role            | text        | no   |                     | Better Auth role string. Remit UI offers `accountant \| assistant` for invitations |
| status          | text        | no   | `'pending'`         | Better Auth lifecycle: `pending \| accepted \| rejected \| canceled`               |
| expires_at      | timestamptz | no   |                     | 48 hours from creation by default, unless overridden in plugin config              |
| created_at      | timestamptz | no   | `now()`             |                                                                                    |

Indexes: `invitation_email_idx`, `invitation_organization_id_idx`, `invitation_status_idx`.

---

## 5. Audit log

Security-facing, append-only. No UPDATE or DELETE operation ever runs against this table.

### `audit_log`

| Column             | Type        | Null | Default             | Notes                                                  |
| ------------------ | ----------- | ---- | ------------------- | ------------------------------------------------------ |
| id                 | uuid        | no   | `gen_random_uuid()` | PK                                                     |
| event              | text        | no   |                     | Event name, e.g. `auth.login.succeeded`                |
| actor_user_id      | uuid        | yes  |                     | FK → `user.id` (set null) — actor may be deleted later |
| actor_role         | enum        | yes  |                     | `owner \| accountant \| assistant`                     |
| target_entity_type | text        | yes  |                     | E.g. `invoice`, `client`, `settings`                   |
| target_entity_id   | uuid        | yes  |                     |                                                        |
| metadata           | jsonb       | yes  |                     | Free-form, never includes secrets                      |
| ip_address         | text        | yes  |                     |                                                        |
| user_agent         | text        | yes  |                     |                                                        |
| created_at         | timestamptz | no   | `now()`             |                                                        |

Indexes: `audit_log_event_created_at_idx` on `(event, created_at DESC)`, `audit_log_actor_idx` on
`actor_user_id`, `audit_log_target_idx` on `(target_entity_type, target_entity_id)`.

**No `updated_at`. No `deleted_at`.** Database-level enforcement: a trigger that raises on UPDATE or
DELETE provides defense in depth.

---

## 6. Activity log

User-facing event history. Editable via UI. Stores **message keys**, not rendered strings, so the
log re-renders correctly when the user changes locale.

### `activity_log`

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

Indexes: `activity_log_created_at_idx` on `created_at DESC`, `activity_log_entity_idx` on
`(entity_type, entity_id)`, `activity_log_unread_idx` on `id` where `read_at IS NULL`.

**No `updated_at`. No `deleted_at`.** Editing means delete + insert at the application level.

---

## 7. Settings

Single-row instance configuration. Exists exactly once per instance.

### `settings`

| Group            | Column                     | Type             | Null | Notes                                               |
| ---------------- | -------------------------- | ---------------- | ---- | --------------------------------------------------- |
|                  | id                         | uuid             | no   | PK                                                  |
| Business profile | business_name              | text             | yes  |                                                     |
|                  | business_email             | text             | yes  |                                                     |
|                  | business_phone             | text             | yes  |                                                     |
|                  | business_website           | text             | yes  |                                                     |
|                  | business_tax_id            | text             | yes  |                                                     |
|                  | business_logo_upload_id    | uuid             | yes  | FK → `uploads.id` (set null)                        |
|                  | business_address_line1     | text             | yes  |                                                     |
|                  | business_address_line2     | text             | yes  |                                                     |
|                  | business_city              | text             | yes  |                                                     |
|                  | business_state             | text             | yes  |                                                     |
|                  | business_postal_code       | text             | yes  |                                                     |
|                  | business_country           | text             | yes  | ISO 3166-1 alpha-2                                  |
| Locale           | default_currency           | varchar(3)       | no   | Default `'EUR'`. ISO 4217.                          |
|                  | default_locale             | text             | no   | Default `'en'`                                      |
|                  | default_timezone           | text             | no   | Default `'UTC'`. IANA tz name.                      |
| Invoicing        | payment_terms_days         | integer          | no   | Default `30`. ≥ 0                                   |
|                  | proposal_validity_days     | integer          | no   | Default `30`. ≥ 0                                   |
|                  | default_notes_invoice      | text             | yes  |                                                     |
|                  | default_notes_proposal     | text             | yes  |                                                     |
|                  | invoice_prefix             | text             | no   | Default `'INV-'`                                    |
|                  | proposal_prefix            | text             | no   | Default `'PROP-'`                                   |
|                  | credit_note_prefix         | text             | no   | Default `'CN-'`                                     |
|                  | next_invoice_number        | integer          | no   | Default `1`. ≥ 1                                    |
|                  | next_proposal_number       | integer          | no   | Default `1`. ≥ 1                                    |
|                  | next_credit_note_number    | integer          | no   | Default `1`. ≥ 1                                    |
|                  | number_padding_width       | integer          | no   | Default `4`. 1–10                                   |
| Payments         | payment_iban               | text (encrypted) | yes  |                                                     |
|                  | payment_bank_name          | text             | yes  |                                                     |
|                  | payment_instructions       | text             | yes  |                                                     |
|                  | stripe_publishable_key     | text             | yes  |                                                     |
|                  | stripe_secret_key          | text (encrypted) | yes  |                                                     |
|                  | stripe_webhook_secret      | text (encrypted) | yes  |                                                     |
|                  | stripe_test_connection_at  | timestamptz      | yes  | Last successful test                                |
| Email            | email_provider             | enum             | yes  | `smtp \| resend`                                    |
|                  | smtp_host                  | text             | yes  |                                                     |
|                  | smtp_port                  | integer          | yes  |                                                     |
|                  | smtp_user                  | text             | yes  |                                                     |
|                  | smtp_pass                  | text (encrypted) | yes  |                                                     |
|                  | smtp_secure                | boolean          | no   | Default `true`                                      |
|                  | resend_api_key             | text (encrypted) | yes  |                                                     |
|                  | email_from_name            | text             | yes  |                                                     |
|                  | email_from_address         | text             | yes  |                                                     |
|                  | email_test_send_at         | timestamptz      | yes  | Last successful test                                |
| Reminders        | reminder_before_due_days   | integer[]        | no   | Default `[3, 0]`. Days before/at due_at to send.    |
|                  | reminder_after_due_days    | integer[]        | no   | Default `[7, 14, 30]`. Days after due_at to send.   |
| Hosting          | base_url                   | text             | yes  |                                                     |
|                  | sentry_dsn                 | text             | yes  |                                                     |
|                  | metrics_token              | text (encrypted) | yes  | Bearer token for `/api/metrics`                     |
|                  | hosted_mode                | boolean          | no   | Default `false`. True only when `REMIT_HOSTED_MODE` |
| Backups          | backup_destination         | enum             | no   | Default `'local'`. `local \| s3 \| r2 \| b2`        |
|                  | backup_cadence             | enum             | no   | Default `'daily'`. `daily \| weekly`                |
|                  | backup_retention_daily     | integer          | no   | Default `7`                                         |
|                  | backup_retention_weekly    | integer          | no   | Default `4`                                         |
|                  | backup_retention_monthly   | integer          | no   | Default `12`                                        |
|                  | backup_s3_bucket           | text             | yes  |                                                     |
|                  | backup_s3_region           | text             | yes  |                                                     |
|                  | backup_s3_endpoint         | text             | yes  | For R2/B2/MinIO                                     |
|                  | backup_s3_access_key       | text (encrypted) | yes  |                                                     |
|                  | backup_s3_secret_key       | text (encrypted) | yes  |                                                     |
|                  | backup_last_success_at     | timestamptz      | yes  |                                                     |
|                  | backup_last_failure_at     | timestamptz      | yes  |                                                     |
|                  | backup_last_failure_reason | text             | yes  |                                                     |
|                  | created_at, updated_at     | timestamptz      | no   | Standard `timestamps`                               |

Constraints (named):

- `chk_settings_email_provider` — `email_provider` is null or in (`smtp`, `resend`).
- `chk_settings_payment_terms_days` — `>= 0`.
- `chk_settings_proposal_validity_days` — `>= 0`.
- `chk_settings_next_invoice_number` — `>= 1`.
- `chk_settings_next_proposal_number` — `>= 1`.
- `chk_settings_next_credit_note_number` — `>= 1`.
- `chk_settings_number_padding_width` — `>= 1 AND <= 10`.

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

| Column      | Type    | Null | Default             | Notes                                                      |
| ----------- | ------- | ---- | ------------------- | ---------------------------------------------------------- |
| id          | uuid    | no   | `gen_random_uuid()` | PK                                                         |
| type        | enum    | no   |                     | See enum reference                                         |
| name        | text    | no   |                     |                                                            |
| description | text    | yes  |                     |                                                            |
| subject     | text    | yes  |                     | Email subject for `email_*` types; null for document types |
| blocks      | jsonb   | no   | `'[]'::jsonb`       | Block-based content                                        |
| is_default  | boolean | no   | `false`             | At most one default per type                               |
| is_system   | boolean | no   | `false`             | True for built-in templates the user cannot delete         |

Standard `timestamps` and `softDelete`.

Indexes:

- `templates_type_idx` on `type`.
- Partial **unique** index `uq_templates_default_per_type` on `type` where
  `is_default = true AND deleted_at IS NULL`.

Template enum types include: `invoice`, `proposal`, `contract`, `credit_note`, plus email
counterparts `email_invoice_send`, `email_proposal_send`, `email_contract_send`,
`email_payment_receipt`, `email_overdue_reminder`, `email_recurring_generated`. See enum reference.

---

## 10. Uploads

S3-compatible file storage records.

### `uploads`

| Column     | Type        | Null | Default             | Notes                          |
| ---------- | ----------- | ---- | ------------------- | ------------------------------ |
| id         | uuid        | no   | `gen_random_uuid()` | PK                             |
| filename   | text        | no   |                     | Original filename              |
| path       | text        | no   |                     | Unique. Storage path or S3 key |
| mime_type  | text        | no   |                     |                                |
| size_bytes | bigint      | no   |                     | `> 0`                          |
| created_at | timestamptz | no   | `now()`             |                                |

Constraints:

- `chk_uploads_size_bytes` — `> 0`.

Indexes:

- Unique on `path`.

**No `updated_at`. No `deleted_at`.** Uploads are immutable; deletion is a hard delete (and removes
the underlying file).

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

| Column        | Type             | Null | Default             | Notes                                            |
| ------------- | ---------------- | ---- | ------------------- | ------------------------------------------------ |
| id            | uuid             | no   | `gen_random_uuid()` | PK                                               |
| name          | text             | no   |                     |                                                  |
| email         | text             | no   |                     |                                                  |
| phone         | text             | yes  |                     |                                                  |
| website       | text             | yes  |                     |                                                  |
| tax_id        | text             | yes  |                     |                                                  |
| address_line1 | text             | yes  |                     |                                                  |
| address_line2 | text             | yes  |                     |                                                  |
| city          | text             | yes  |                     |                                                  |
| state         | text             | yes  |                     |                                                  |
| postal_code   | text             | yes  |                     |                                                  |
| country       | text             | yes  |                     | ISO 3166-1 alpha-2                               |
| currency      | varchar(3)       | yes  |                     | Override of instance default                     |
| notes         | text (encrypted) | yes  |                     | NDA-sensitive; opt-in encryption at column level |
| portal_token  | text             | yes  |                     | Unique. Per-client portal at `/s/[token]`        |

Standard `timestamps` and `softDelete`.

Indexes: `clients_name_idx`, `clients_email_idx`, `clients_active_idx` on `id` where
`deleted_at IS NULL`, unique `clients_portal_token_idx` on `portal_token` where
`portal_token IS NOT NULL`.

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
`deleted_at IS NULL`.

---

## 15. Tasks

Lightweight task system inside projects.

### `tasks`

| Column            | Type        | Null | Default             | Notes                                  |
| ----------------- | ----------- | ---- | ------------------- | -------------------------------------- |
| id                | uuid        | no   | `gen_random_uuid()` | PK                                     |
| project_id        | uuid        | no   |                     | FK → `projects.id` (cascade)           |
| title             | text        | no   |                     |                                        |
| description       | text        | yes  |                     | Markdown                               |
| status            | enum        | no   | `'todo'`            | `todo \| doing \| done`                |
| priority          | enum        | no   | `'normal'`          | `low \| normal \| high \| urgent`      |
| due_at            | timestamptz | yes  |                     |                                        |
| completed_at      | timestamptz | yes  |                     |                                        |
| position          | integer     | no   | `0`                 | Manual ordering within the project     |
| hourly_rate_cents | bigint      | yes  |                     | Override for time entries on this task |

Standard `timestamps` and `softDelete`.

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
| user_id                    | uuid        | yes  |                     | FK → `user.id` (set null) — who logged the time                    |
| started_at                 | timestamptz | no   |                     |                                                                    |
| ended_at                   | timestamptz | yes  |                     | Null while a timer is running                                      |
| duration_seconds           | integer     | yes  |                     | Computed when ended_at is set; ≥ 0                                 |
| billable                   | boolean     | no   | `true`              |                                                                    |
| hourly_rate_snapshot_cents | bigint      | no   |                     | Resolved at log time via the rate precedence rule                  |
| description                | text        | yes  |                     |                                                                    |
| source                     | enum        | no   | `'timer'`           | `timer \| manual`                                                  |
| invoiced_in_id             | uuid        | yes  |                     | FK → `invoices.id` (set null) — the invoice that billed this entry |

Standard `timestamps` and `softDelete`.

Constraints:

- `chk_time_entries_duration` — `duration_seconds IS NULL OR duration_seconds >= 0`.
- `chk_time_entries_ended` —
  `(ended_at IS NULL AND duration_seconds IS NULL) OR (ended_at IS NOT NULL AND duration_seconds IS NOT NULL AND ended_at >= started_at)`.
- `chk_time_entries_rate` — `hourly_rate_snapshot_cents >= 0`.

Indexes: `time_entries_project_id_idx`, `time_entries_task_id_idx`, `time_entries_user_id_idx`,
`time_entries_started_at_idx` on `started_at DESC`, `time_entries_unbilled_idx` on `project_id`
where `invoiced_in_id IS NULL AND billable = true`.

---

## 17. Expenses

### `expenses`

| Column            | Type          | Null | Default             | Notes                                                     |
| ----------------- | ------------- | ---- | ------------------- | --------------------------------------------------------- |
| id                | uuid          | no   | `gen_random_uuid()` | PK                                                        |
| project_id        | uuid          | yes  |                     | FK → `projects.id` (set null)                             |
| client_id         | uuid          | yes  |                     | FK → `clients.id` (set null) — when not tied to a project |
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

- `chk_expenses_amount` — `amount_cents >= 0`.
- `chk_expenses_markup` —
  `markup_percentage IS NULL OR (markup_percentage >= 0 AND markup_percentage <= 1000)`.

Indexes: `expenses_project_id_idx`, `expenses_client_id_idx`, `expenses_spent_at_idx` on
`spent_at DESC`, `expenses_unbilled_rebillable_idx` on `project_id` where
`invoiced_in_id IS NULL AND rebillable = true`.

---

## 18. Proposals

### `proposals`

| Column                      | Type          | Null | Default             | Notes                                     |
| --------------------------- | ------------- | ---- | ------------------- | ----------------------------------------- |
| id                          | uuid          | no   | `gen_random_uuid()` | PK                                        |
| project_id                  | uuid          | no   |                     | FK → `projects.id` (cascade)              |
| template_id                 | uuid          | yes  |                     | FK → `templates.id` (set null)            |
| number                      | text          | no   |                     | Unique. E.g. `PROP-0001`                  |
| status                      | enum          | no   | `'draft'`           | See enum reference                        |
| currency                    | varchar(3)    | no   | `'EUR'`             |                                           |
| discount_type               | enum          | yes  |                     | `percentage \| fixed`                     |
| discount_percentage         | numeric(5, 2) | yes  |                     | Set when `discount_type = 'percentage'`   |
| discount_amount_cents       | bigint        | yes  |                     | Set when `discount_type = 'fixed'`        |
| subtotal_cents              | bigint        | no   | `0`                 | ≥ 0                                       |
| discount_amount_total_cents | bigint        | no   | `0`                 | Computed total discount in cents; ≥ 0     |
| tax_amount_cents            | bigint        | no   | `0`                 | ≥ 0                                       |
| total_cents                 | bigint        | no   | `0`                 | ≥ 0                                       |
| valid_until                 | date          | yes  |                     | Used to compute `expired` status          |
| notes                       | text          | yes  |                     |                                           |
| public_token                | text          | no   |                     | Unique. Anonymous access via `/p/[token]` |
| first_viewed_at             | timestamptz   | yes  |                     |                                           |
| last_viewed_at              | timestamptz   | yes  |                     |                                           |
| view_count                  | integer       | no   | `0`                 | ≥ 0                                       |
| issued_at                   | timestamptz   | yes  |                     | Set when transitioning to `sent`          |
| locked_at                   | timestamptz   | yes  |                     | Set when accepted; immutable thereafter   |
| responded_at                | timestamptz   | yes  |                     | Set on accept or reject                   |
| responded_ip                | text          | yes  |                     |                                           |
| rejection_reason            | text          | yes  |                     |                                           |
| converted_to_invoice_id     | uuid          | yes  |                     | FK → `invoices.id` (set null)             |
| converted_to_contract_id    | uuid          | yes  |                     | FK → `contracts.id` (set null)            |

Standard `timestamps` and `softDelete`.

Constraints:

- `chk_proposals_discount_shape` — exactly one of `discount_percentage` / `discount_amount_cents` is
  set when `discount_type` is set; both null when `discount_type` is null.
- `chk_proposals_discount_percentage` — null or `>= 0 AND <= 100`.
- `chk_proposals_discount_amount` — null or `>= 0`.
- `chk_proposals_totals` — all four computed money fields are `>= 0`.
- `chk_proposals_view_count` — `>= 0`.
- `chk_proposals_response` — when `status` is `accepted` or `rejected`, `responded_at` and
  `responded_ip` are non-null.

Indexes: `proposals_project_id_idx`, `proposals_template_id_idx`, `proposals_status_idx`, unique
`proposals_public_token_idx` on `public_token`.

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
| project_id         | uuid        | yes  |                     | FK → `projects.id` (set null) — null for client-level contracts |
| client_id          | uuid        | yes  |                     | FK → `clients.id` (set null) — for client-level contracts       |
| proposal_id        | uuid        | yes  |                     | FK → `proposals.id` (set null) — when generated from a proposal |
| template_id        | uuid        | yes  |                     | FK → `templates.id` (set null)                                  |
| number             | text        | no   |                     | Unique                                                          |
| title              | text        | no   |                     |                                                                 |
| status             | enum        | no   | `'draft'`           | See enum reference                                              |
| blocks             | jsonb       | no   | `'[]'::jsonb`       | Block-based content snapshot at send time                       |
| public_token       | text        | no   |                     | Unique. Anonymous signing via `/c/[token]`                      |
| issued_at          | timestamptz | yes  |                     |                                                                 |
| effective_from     | date        | yes  |                     |                                                                 |
| effective_until    | date        | yes  |                     |                                                                 |
| terminated_at      | timestamptz | yes  |                     |                                                                 |
| termination_reason | text        | yes  |                     |                                                                 |

Standard `timestamps` and `softDelete`.

Constraints:

- `chk_contracts_parent` — at least one of `project_id` or `client_id` is set.
- `chk_contracts_dates` —
  `effective_until IS NULL OR effective_from IS NULL OR effective_until >= effective_from`.

Indexes: `contracts_project_id_idx`, `contracts_client_id_idx`, `contracts_proposal_id_idx`,
`contracts_status_idx`, unique `contracts_public_token_idx`.

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
| project_id            | uuid       | yes  |                     | FK → `projects.id` (set null)                                   |
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

- `chk_recurring_invoices_end_condition` — at most one of `end_after_count` and `end_by_date` is
  set.
- `chk_recurring_invoices_retainer` —
  `(included_hours IS NULL AND overage_rate_cents IS NULL) OR (included_hours >= 0 AND overage_rate_cents >= 0)`.

Indexes: `recurring_invoices_client_id_idx`, `recurring_invoices_status_idx`,
`recurring_invoices_next_run_at_idx` on `next_run_at` where `status = 'active'`.

---

## 23. Invoices

### `invoices`

| Column                      | Type            | Null | Default             | Notes                                                                    |
| --------------------------- | --------------- | ---- | ------------------- | ------------------------------------------------------------------------ |
| id                          | uuid            | no   | `gen_random_uuid()` | PK                                                                       |
| project_id                  | uuid            | yes  |                     | FK → `projects.id` (set null) — null for ad-hoc client invoices          |
| client_id                   | uuid            | yes  |                     | FK → `clients.id` (set null) — required if project_id is null            |
| proposal_id                 | uuid            | yes  |                     | FK → `proposals.id` (set null) — when generated from a proposal          |
| recurring_invoice_id        | uuid            | yes  |                     | FK → `recurring_invoices.id` (set null) — when generated from a schedule |
| template_id                 | uuid            | yes  |                     | FK → `templates.id` (set null)                                           |
| number                      | text            | no   |                     | Unique. E.g. `INV-0042`                                                  |
| status                      | enum            | no   | `'draft'`           | See enum reference                                                       |
| currency                    | varchar(3)      | no   | `'EUR'`             |                                                                          |
| exchange_rate               | numeric(20, 10) | yes  |                     | Snapshot when currency differs from instance default                     |
| discount_type               | enum            | yes  |                     | `percentage \| fixed`                                                    |
| discount_percentage         | numeric(5, 2)   | yes  |                     |                                                                          |
| discount_amount_cents       | bigint          | yes  |                     |                                                                          |
| subtotal_cents              | bigint          | no   | `0`                 | ≥ 0                                                                      |
| discount_amount_total_cents | bigint          | no   | `0`                 | ≥ 0                                                                      |
| tax_amount_cents            | bigint          | no   | `0`                 | ≥ 0                                                                      |
| total_cents                 | bigint          | no   | `0`                 | ≥ 0                                                                      |
| amount_paid_cents           | bigint          | no   | `0`                 | Sum of `payments.amount_cents`. Maintained by app.                       |
| issue_date                  | date            | yes  |                     |                                                                          |
| due_date                    | date            | yes  |                     | Used for overdue detection. ≥ issue_date if both set.                    |
| paid_at                     | timestamptz     | yes  |                     | Set when status transitions to `paid`                                    |
| late_fee_cents              | bigint          | yes  |                     | Applied for `overdue` invoices                                           |
| notes                       | text            | yes  |                     |                                                                          |
| public_token                | text            | no   |                     | Unique. Anonymous access via `/i/[token]`                                |
| first_viewed_at             | timestamptz     | yes  |                     |                                                                          |
| last_viewed_at              | timestamptz     | yes  |                     |                                                                          |
| view_count                  | integer         | no   | `0`                 | ≥ 0                                                                      |
| last_reminder_sent_at       | timestamptz     | yes  |                     |                                                                          |

Standard `timestamps` and `softDelete`.

Constraints:

- `chk_invoices_parent` — `project_id IS NOT NULL OR client_id IS NOT NULL`.
- `chk_invoices_discount_shape` — same shape as proposals.
- `chk_invoices_discount_percentage` — null or `>= 0 AND <= 100`.
- `chk_invoices_discount_amount` — null or `>= 0`.
- `chk_invoices_totals` — all four computed money fields are `>= 0`.
- `chk_invoices_amount_paid` — `amount_paid_cents >= 0 AND amount_paid_cents <= total_cents`.
- `chk_invoices_dates` — `due_date IS NULL OR issue_date IS NULL OR due_date >= issue_date`.
- `chk_invoices_view_count` — `>= 0`.
- `chk_invoices_late_fee` — `late_fee_cents IS NULL OR late_fee_cents >= 0`.

Indexes: `invoices_project_id_idx`, `invoices_client_id_idx`, `invoices_proposal_id_idx`,
`invoices_recurring_invoice_id_idx`, `invoices_template_id_idx`, `invoices_status_idx`,
`invoices_due_date_idx` on `due_date`, unique `invoices_public_token_idx`.

---

## 24. Line items

Polymorphic — belongs to either a proposal or an invoice via mutually-exclusive FKs (see ADR-0014).

### `line_items`

| Column                  | Type           | Null | Default             | Notes                                           |
| ----------------------- | -------------- | ---- | ------------------- | ----------------------------------------------- |
| id                      | uuid           | no   | `gen_random_uuid()` | PK                                              |
| proposal_id             | uuid           | yes  |                     | FK → `proposals.id` (cascade)                   |
| invoice_id              | uuid           | yes  |                     | FK → `invoices.id` (cascade)                    |
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

- `chk_line_items_parent` — exactly one of `proposal_id` and `invoice_id` is set.
- `chk_line_items_discount_shape` — same shape as proposals.
- `chk_line_items_discount_percentage` — null or `>= 0 AND <= 100`.
- `chk_line_items_discount_amount` — null or `>= 0`.
- `chk_line_items_quantity` — `> 0`.
- `chk_line_items_unit_price` — `>= 0`.
- `chk_line_items_tax_percentage` — `>= 0 AND <= 100`.
- `chk_line_items_totals` — `>= 0` for all three.

Indexes: `line_items_proposal_id_idx`, `line_items_invoice_id_idx`, `line_items_tax_rate_id_idx`,
`line_items_source_time_entry_id_idx`, `line_items_source_expense_id_idx`, unique partial
`uq_line_items_proposal_position` on `(proposal_id, position)` where `proposal_id IS NOT NULL`,
unique partial `uq_line_items_invoice_position` on `(invoice_id, position)` where
`invoice_id IS NOT NULL`.

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

Line items for credit notes reuse the `line_items` table via a third nullable FK `credit_note_id`.
This is a deliberate extension to the polymorphic pattern in the Line items section; the
`chk_line_items_parent` constraint becomes "exactly one of proposal_id, invoice_id, credit_note_id
is set". Update `line_items` accordingly when implementing credit notes.

---

## 27. Enum reference

All enum types declared in `database/schema/enums.ts`.

| Enum name                  | Values                                                                                                                                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `member_role`              | `owner`, `accountant`, `assistant`                                                                                                                                                                   |
| `lead_status`              | `new`, `contacted`, `qualified`, `proposal_sent`, `won`, `lost`                                                                                                                                      |
| `project_status`           | `active`, `completed`, `on_hold`, `cancelled`                                                                                                                                                        |
| `task_status`              | `todo`, `doing`, `done`                                                                                                                                                                              |
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
| `backup_destination`       | `local`, `s3`, `r2`, `b2`                                                                                                                                                                            |
| `backup_cadence`           | `daily`, `weekly`                                                                                                                                                                                    |

`overdue` and `partially_paid` for invoices are **computed**, not stored. The stored value remains
`sent` until the invoice is fully paid; the application surfaces `overdue` when `due_date < now()`
and `paid_at IS NULL`, and `partially_paid` when
`amount_paid_cents > 0 AND amount_paid_cents < total_cents`.

`member_role` remains available for app-owned tables such as `audit_log.actor_role`. Better Auth's
organization-plugin tables (`member.role`, `invitation.role`, `invitation.status`) are stored as
`text` to match the plugin contract.

---

_When this schema is implemented, this document and the corresponding Drizzle code are the single
source of truth. ADRs document the *why* of structural decisions; this document captures the *what*.
Both are updated when the schema evolves._
