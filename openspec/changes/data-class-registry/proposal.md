# data-class-registry

## Product position

R12-1 (accepted as a recommendation with the R12 answers, owner decisions phase 2) makes a
data-class registry a Layer 0 one-way door: every column declares a data class from a closed list
and a subject link, and erasure, export, retention, AI exclusion and the BI schema read it. GAP-11
records the gap: no column declares a class, so none of those can be derived from the schema.

Who gains: the owner and operators, eventually, through an erasure plan, retention rules and AI/BI
gates that cover every column, because a new column cannot land unclassified. Contributors gain a
test that stops them at the schema change. That is cheaper than finding the column again in a
privacy review. Why now: it is the first entry of the backlog, and every later Layer 0 change adds
tables (`legal-entities`, `parties`, `issuance-series`, `audit-principal-shape`). With the registry
in place first, each of them classifies its own columns. Without it, each adds to a backlog of
unclassified columns.

Grounding:

- R12-1 (`docs/ai/results/phase-3/R12-data-lifecycle.md` section 5): the closed list (fiscal
  document, ledger, supporting voucher, correspondence, contract evidence, party master, contact
  point, prospect, candidate, HR, consent evidence, suppression, operational log, security log,
  audit, file) and the subject link (which party or principal the column identifies, or none).
- R12 section 2.3: the retention ranges the classes must carry later; R12-2: the erasure plan walks
  the registry per subject (delete, pseudonymize, retain, held); R12-9 step 1: the registry is a
  precondition of the squash.
- R12 answers: R12-Q1 (fiscal classes kept indefinitely without a profile), R12-Q5 (free-text
  mentions listed for review, which needs free-text columns to be known), R12-Q8 (no database is
  upgraded across the squash).
- C12 carried recommendations: C12-1 (erasure by class), C12-3 (audit rows carry ids only), C12-4
  (squash rule split, owned by `migration-squash`).
- R11-9 and R11-Q8: custom fields carry a `data_class` of `normal`, `personal`, `sensitive` or
  `secret` (secret refused), and BI views exclude `sensitive` columns by default. `scope.md` Group 7
  names client notes, HR and banking as sensitive classes and credentials as always excluded.
- The pattern to generalise: `apps/web/features/dataExport/__tests__/manifest.integration.test.ts`
  walks every Drizzle table in `@/database/schema` and fails on a table or column the export
  manifest does not name. `apps/web/scripts/core/domainData/inventory.ts` does the same per table
  for seed, reset, trash and retention, and `encryptedColumn()` keeps a self-maintaining registry of
  encrypted columns.

## Scope

- In:
  - A registry module beside the schema that declares, for every column of every table exported by
    `@/database/schema`, a data class from the closed list (as amended by open question 1) and a
    subject link (open question 5). The declaration form is open question 2.
  - A test on the manifest-test pattern that fails on any table or column missing from the registry,
    on any registry entry naming a table or column that does not exist, and on any subject link
    whose path does not resolve in the schema.
  - A consistency test between the registry and the export manifest: no column classed as a
    credential is exported (true today: tokens, secrets and the Better Auth tables are excluded).
  - The classification of all 543 columns of today's 38 tables, using the assignments approved under
    open questions 1 to 6.
  - Guidance: the database rule and the architecture map say that a schema change declares its
    columns in the registry, next to the existing export manifest and domain inventory duties.
- Out:
  - Every consumer of the registry: the pseudonymizing erasure (`party-erasure-retention`, R12-2),
    retention rules and disposal (R12-3), legal holds (R12-4), the DSR workflow (R12-5), the AI gate
    (`ai-assistance`), BI views (`reporting-bi`). The export manifest keeps its own allowlist; only
    the consistency test above links the two.
  - Retention durations or anchors per class: a class names a lifecycle; durations come from the
    profiles in R12-3.
  - Custom fields (`custom-fields`, R11-9), which do not exist yet (open question 7).
  - Re-pointing subject links to parties: `parties` does that when it replaces clients, contacts and
    leads (open question 5).
  - Any schema, migration or runtime behaviour change. The domain inventory's `retention` field
    stays as it is until R12-3 replaces it.
  - The squash rule split (C12-4), owned by `migration-squash`.

## Capabilities touched

- `data-classification` (new, `openspec/specs/data-classification/spec.md`). There is no capability
  spec for data export or erasure yet; this one states the registry invariant that they will build
  on (open question 8).

## Spec impact

- Added: "Every column declares a data class and a subject link"; "A credential column never travels
  in an export".
- Modified: none.
- Removed: none.
- Unchanged behaviour that must survive: the export archive's content (same tables and columns), the
  domain inventory's seed, reset, trash and retention decisions, and every runtime path. The
  registry is read only by tests in this change.

## Column check against the R12-1 list

I checked each column of the 38 tables (543 columns, read from the Drizzle schema objects) against
the sixteen classes. Most columns fit a class directly: clients and client contacts (party master,
contact point), leads (prospect), invoices and credit notes (fiscal document), payments and expenses
(supporting voucher), contracts and signatures (contract evidence), audit logs (audit), activity,
webhook delivery, data and report export records and object deletions (operational log), sessions'
IP and user agent, two-factor lock state and token last use (security log), and uploads (file).

These fit no class (counts leave out the structural columns of finding 1):

| Category                          | Columns                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Count |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Credentials and bearer tokens     | `accounts`: `account_id`, `provider_id`, `access_token`, `refresh_token`, `id_token`, `access_token_expires_at`, `refresh_token_expires_at`, `scope`, `password`; `sessions.token`; `two_factors`: `secret`, `backup_codes`; `verifications`: `identifier`, `value`, `expires_at`; `api_tokens`: `token_hash`, `token_prefix`; `webhook_endpoints.secret`; `settings`: `stripe_secret_key`, `stripe_webhook_secret`, `smtp_pass`, `resend_api_key`, `backup_s3_access_key`, `backup_s3_secret_key`; `proposal_otps.code_hash`; `public_token` on `invoices`, `proposals`, `contracts`; `clients.portal_token`                                                                                                                                                                                                                                                                                                                                                                 | 29    |
| Instance and integration settings | `settings`: `default_currency`, `default_locale`, `default_timezone`, `payment_terms_days`, `proposal_validity_days`, `default_notes_invoice`, `default_invoice_footer`, `default_notes_proposal`, the four `*_prefix` and four `next_*_number` columns, `number_padding_width`, the six `late_fee_*` columns, `retention_trash_days`, `retention_financial_days`, `default_hourly_rate_cents`, `stripe_publishable_key`, `email_provider`, `smtp_host`, `smtp_port`, `smtp_user`, `smtp_secure`, `email_from_name`, `email_from_address`, `reminder_before_due_days`, `reminder_after_due_days`, `backup_destination`, `backup_cadence`, the three `backup_retention_*` columns, `backup_s3_bucket`, `backup_s3_region`, `backup_s3_endpoint`, `mcp_enabled`; all of `tax_rates` and `templates`; `webhook_endpoints` (except `secret`); `api_tokens` `name`, `scopes`, `created_by_user_id`, `expires_at`, `revoked_at`; `organizations` `name`, `slug`, `logo`, `metadata` | 71    |
| Principals (workforce users)      | `users`: `name`, `email`, `email_verified`, `image`, `two_factor_enabled`, `must_change_password`; `members`: `user_id`, `organization_id`, `role`; `invitations`: `email`, `organization_id`, `inviter_id`, `role`, `status`, `expires_at`. HR is the nearest class, but a freelancer's own account is not an HR record                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 15    |
| The instance's own business       | `settings`: the twelve `business_*` columns (name, email, phone, website, tax ID, logo, address), `payment_iban`, `payment_bank_name`, `payment_instructions`. Party master would fit if the own business were a party, which it is not until `legal-entities` and `parties` land                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 15    |
| Work records                      | `projects`: `name`, `description`, `status`, `currency`, `budget_cents`, `hourly_rate_cents`, `start_date`, `end_date`; `tasks`: `title`, `description`, `status`, `priority`, `due_at`, `completed_at`, `position`, `hourly_rate_cents`; `time_entries`: `started_at`, `ended_at`, `duration_seconds`, `billable`, `hourly_rate_override_cents`, `hourly_rate_snapshot_cents`, `description`, `source`, `user_id`, `invoiced_in_id`; `recurring_invoices`: `name`, `status`, `cadence`, `cadence_day`, `next_run_at`, `last_run_at`, `end_after_count`, `end_by_date`, `occurrences_generated`, `auto_send`, `currency`, `line_items_blueprint`, `included_hours`, `overage_rate_cents`, `notes`. R12 places time and attendance under HR (R3 packs); a freelancer's billable time is not attendance                                                                                                                                                                         | 41    |
| Quotes and proposals              | `proposals`: `number`, `status`, `currency`, the discount, subtotal, tax and total columns (seven), `valid_until`, `notes`, `issued_at`, `locked_at`, `responded_at`, `responded_ip`, `rejection_reason`. A sent proposal is correspondence (German commercial letters), an accepted one is contract evidence, and in Portugal a customer-facing quote is a fiscal document (D13): the class depends on the state and the entity                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 17    |
| Recipient engagement tracking     | `invoices`: `first_viewed_at`, `last_viewed_at`, `view_count`, `last_reminder_sent_at`; `proposals`: `first_viewed_at`, `last_viewed_at`, `view_count`. These are behavioural data about the recipient, not document content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 7     |

Total: 195 columns fit no class. Five further findings are not "no class", but the registry has to
answer them:

1. **Structural columns.** `id`, `created_at`, `updated_at`, `deleted_at`, positions and foreign
   keys have no class of their own; they take the class of their row (open question 2).
2. **Row-dependent classes (40 columns).** All 22 columns of `line_items` belong to a proposal,
   invoice or credit note depending on which parent key is set. The 10 columns of `attachments`
   follow a client, project, invoice or expense. The 8 columns of `uploads` follow whatever row
   references the file (an invoice PDF is a fiscal document, a receipt a supporting voucher, an
   avatar party master, the logo instance identity). So `file` names a storage kind, not a lifecycle
   (open question 3). Contracts in `draft` are not yet contract evidence.
3. **Two classes fit.** `email_logs` (recipient, subject, status, provider message id, error) is
   either correspondence (evidence that a document or reminder was sent, six years in Germany) or an
   operational log (months). The retention differs by years (open question 6).
4. **Indeterminate subject.** `activity_logs.message_args`, `audit_logs.metadata`,
   `webhook_deliveries.payload`, `webhook_deliveries.attempts`, `report_exports.filters`,
   `contracts.blocks` and `templates.blocks` are JSONB that may name any party; no foreign-key path
   leads to the subject (open question 5).
5. **A second axis the list does not carry.** `clients.notes` and `clients.name` share the party
   master class, yet only the notes are "sensitive" in `scope.md` Group 7; `payment_iban` is
   banking, sensitive under any class. R11-9 calls `normal`, `personal`, `sensitive`, `secret` a
   "data class" too. Lifecycle (what erasure and retention need) and sensitivity (what AI, BI and
   MCP need) are different axes, and the free-text columns R12-Q5 needs (`notes`, `description`,
   `reason`, `title` on fifteen tables) are a third attribute (open question 4).

## Open questions

The run was unattended, so every question below waits for the owner. Each lists options and a
recommended answer.

1. **The closed list has no class for 195 columns.** Options: (a) add five classes: `credential`,
   `configuration`, `principal`, `work record`, `quote`; (b) map them onto existing classes
   (credentials to security log, configuration to operational log, principals to HR, work records to
   supporting voucher, quotes to correspondence), keeping sixteen classes but merging retention
   periods that differ; (c) one `not personal data` escape class, which also lets a real personal
   column through unreviewed. **Recommended: (a).** Each new class has its own lifecycle:
   credentials are never exported and are destroyed with their principal, configuration lives with
   the instance, principals follow the workforce lifecycle (R9 offboarding), work records follow the
   project, quotes follow their own state (question 3). Engagement tracking gets no class of its
   own: it goes under operational log with the recipient as subject. The own business identity is
   question 6.
2. **Per column or per table?** Options: (a) every column declares its own class and subject, about
   543 entries, mostly repeating the table's class on ids and timestamps; (b) a class per table
   only: cheap, but it cannot tell `clients.email` (contact point) or `clients.portal_token`
   (credential) from `clients.name`, which is the failure R12-1's "would change if" names; (c) a
   table declares a default class and subject, and every column is still named, either as inheriting
   the default or with its own class. **Recommended: (c).** The test still fails on an unnamed
   column, so a new column never inherits silently (the export manifest already lists every column
   by name). An override is visible where it differs.
3. **Classes that depend on the row** (`line_items`, `attachments`, `uploads`, proposal and contract
   states). Options: (a) the strictest class the row can have (every line item a fiscal document),
   which over-retains draft proposal lines for years; (b) a discriminator column with a class per
   value; (c) `inherits from parent through <foreign key>`: the class resolves per row from the
   parent, and for `uploads` from the referencing column, with the state-dependent rule (draft,
   sent, accepted, entity fiscal regime) stated on the parent table. **Recommended: (c).** The test
   checks that every named foreign key exists. Resolution per row belongs to the erasure and
   retention changes that read it, and `file` stays a storage marker for uploads, not a lifecycle.
4. **Sensitivity and free text.** Options: (a) declare two more attributes per column in this
   change: `sensitivity` (`normal`, `personal`, `sensitive`, `secret`, matching R11-9) and a
   `freeText` flag; (b) derive sensitivity from the lifecycle class (fails on `clients.notes` and
   `payment_iban`); (c) leave both to `ai-assistance`, `reporting-bi` and `party-erasure-retention`,
   each then walking all columns again. **Recommended: (a).** R12-1 says AI exclusion and BI read
   this registry, and one review of each column costs less than three. Custom-field definitions
   later use the same two attributes (question 7).
5. **Subject links before `parties` exists.** Options: (a) point at today's tables (`clients`,
   `client_contacts`, `leads`, `users`) and let `parties` rewrite them; (b) a stable subject kind
   (`party`, `principal`, `none`, plus `indirect` for JSONB and free text that may name anyone) and
   the foreign-key path from the row to the subject's row, which today ends at `clients`,
   `client_contacts`, `leads` or `users`; (c) reorder the backlog so `parties` lands first, which
   leaves the five intervening changes without a registry. **Recommended: (b).** The kind survives
   the parties refactor, and the path is checked against the schema, so `parties` cannot drop a
   table without re-pointing the links that end there. `indirect` columns go to the manual-review
   list in the erasure plan, which is R12-Q5's answer for mentions.
6. **Column assignments that need an owner call.** (a) `email_logs`: correspondence (recommended: it
   is the only evidence that a reminder or document was sent, which late fees and claims rely on) or
   operational log. (b) `time_entries`: work record (recommended; attendance records arrive with
   R3's workforce packs under HR) or HR. (c) The own business identity in `settings`: party master
   with subject `none` (recommended: the controller's own data is not a data subject's, even for a
   sole trader whose business name is their own name; `legal-entities` turns it into an entity), or
   configuration. (d) `payments`: supporting voucher (recommended; there is no ledger yet, D2's
   ledger gets `ledger` when it lands) or ledger.
7. **Custom fields do not exist yet.** Options: (a) add an unused `classified per definition` marker
   for future JSONB columns now; (b) nothing in code; the spec's Known limits states that custom
   fields are not covered, and `custom-fields` extends the registry so that each definition carries
   a lifecycle class and the question 4 attributes, with its JSONB column marked as classified per
   definition. **Recommended: (b).** An unused marker is speculative code (AGENTS.md hard rules).
   The custom-fields entry in the backlog already names data classes, so the duty is recorded where
   the work happens.
8. **How the registry survives the migration squash, and where it is specified.** Options for
   storage: (a) a TypeScript module beside `apps/web/database/schema/`, tested against the Drizzle
   schema objects; (b) Postgres `COMMENT ON COLUMN` in a hand-written migration, which Drizzle does
   not generate, so every schema change needs hand-written SQL and the squash must carry it; (c) a
   registry table, which restore, import and reset then have to treat as data. **Recommended: (a).**
   The registry holds no database state, so the squash (R12-9) cannot lose it. The baseline is
   generated from the same schema the registry test reads, and R12-Q8 means no database is upgraded
   across it. R12-9 step 1 still applies: the class list is the one-way door, and it should be
   settled before the baseline. For the specification: a new `data-classification` capability spec
   with the two requirements above (recommended), or only a database-rule line and an architecture
   map entry, because no user-facing behaviour changes.

## Gate 1

pending
