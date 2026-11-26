# Backlog

The single register of what comes next and of every known gap. `next-step` reads it;
`tests/docs/openspec.test.ts` checks it.

## Next

Ordered; the first entry is next. Each entry is a change name and one line.

1. `data-class-registry` - every column declares a data class from the closed list and a subject
   link; a test fails on any unclassified column (R12-1).
2. `spike-better-auth` - prove on the installed 1.7 a second instance for external contacts, OIDC
   and SAML SSO, SCIM role projection, passkeys with required user verification and the
   `auth_method` stamp (FR4, R9-1).
3. `spike-job-queue` - BullMQ with an outbox relay against pg-boss enqueuing in the business
   transaction: relay lag, open-source group concurrency, a Redis-free instance (R11-Q2, R11-2,
   R11-3, C13-6).
4. `audit-principal-shape` - principal types on every audit row, ordered sequence and transaction
   id, ids only with no referential actions, an asynchronous sealer with checkpoints anchored
   outside the database (R9-6, R13-2, C12-3, C13-7).
5. `money-precision` - Remit-owned ISO 4217 table, bigint minor units, `numeric` scales for
   quantities, unit prices, FX, tax rates and UoM factors, one exact rounding primitive replacing
   `Math.round` in the money rule (FR2, R8 R-1, R-2).
6. `legal-entities` - entities with settings split from the singleton, `entity_id` with composite
   keys that include the future partition key, a mandatory entity predicate (X1, R9-4, C7-9).
7. `parties` - parties, roles, contact points, addresses, tax identifiers, party accounts and
   relationships replace clients, contacts and leads, with deals on pipelines (D4, R2-1 to R2-3,
   R2-10 steps 1-7).
8. `issuance-series` - series per entity and document type, numbers claimed at issuance, immutable
   issued snapshots behind triggers no migration may disable (D6, R5-2, R12-10).
9. `ledger-books` - first ledger schema: accounts, roles, journals, entries and lines carrying the
   book column, with `ledger_books` primary, tax and IFRS (D2, R7-1, R7-Q4).
10. `migration-squash` - fresh baseline after every one-way door, hand-written schema SQL appended
    unchanged, data corrections dropped, CI schema-equivalence check, every database rebuilt;
    scheduled by the owner (D11, R12-9, C12-4).
11. `spike-pdf-rendering` - P1 Chromium plus an in-worker conformance step against P2 Gotenberg 9 on
    real templates, scored by veraPDF for PDF/A-3 and PDF/UA-1 (FR5, R4-8, R4-Q8).
12. `spike-fiscal-issuer` - provider-neutral fiscal-issuer adapter with InvoiceXpress as its first
    instance: pending issue, idempotency, provider number, ATCUD, QR and PDF (D13, N4, R14-1,
    R14-2).
13. `scope-text-amendments` - apply the accepted text amendments to rules, AGENTS.md and the
    architecture docs: C5-1, C5-2, C5-5, C6-1, C6-3, C6-6, C7-1, C7-3, C7-4, C11-1, C11-2, C12-1,
    C12-2, C12-7, C4-2, C4-5, C3-6, the Group 1 and 4 repo conflicts, D1's meaning of instance on
    shared fleet services (C9-1, FR3), the bulk email stream rule (C10-4, R10-5), the 7.8 EAA text
    (C13-2), the MFA policy wording (C9-2 to C9-4, R9-3) and the licence (AGPL-3.0, MIT for
    `packages/sdk`) in the docs.
14. `country-neutrality-check` - CI fails on a country code or country rule in `packages/core` (N2).
15. `contract-signing-sessions` - one link per signer, emailed code, document hash and consent
    version on the signature row, replacing the shared signing link (R4-3, R4-Q1).
16. `migration-discipline` - expand and contract, `lock_timeout`, a lint on generated SQL and
    concurrent index builds, written into the database rule (R13-6).
17. `accessibility-gate` - axe in Playwright on every route and dialog state, keyboard E2E for
    primary flows, the current findings fixed, the house standard of WCAG 2.2 AA plus 2.4.13 Focus
    Appearance and 44 px mobile targets through the design gate (R13-3, R13-Q4).
18. `job-queues` - the spike's queue with a queue per workload class, per-queue concurrency,
    fairness groups and one explicit pool size per process (D12, R13-7, R13-8).
19. `command-layer-outbox` - one typed command registry behind app, API and jobs, each command
    writing its outbox rows and idempotency record in its own transaction (D7, R11-1, R11-2, R11-4).
20. `observability-tracing` - W3C trace context through requests, jobs and outbox rows, trace ids in
    logs, OTLP export off by default, Prometheus kept, example alerts and dashboard documented, no
    bundled observability stack (8.4, R13-9, R13-Q8).
21. `authorization-catalog` - code-defined permission catalog, custom roles, scoped assignments with
    `can()` and its SQL twin, separation of duties as data (D3, R9-2, R9-3, C6-5).
22. `mfa-policy` - MFA policy layer, passkeys as a factor, step-up on flagged permissions, SSO trust
    (Group 5 MFA policy, R9-5).
23. `approval-engine` - one approval engine with levels, thresholds, delegation and different
    principals per level (R6-14, R6-Q7).
24. `tax-engine` - tax regimes, codes, dated rates, exemption reasons and determination rules as
    pack data, withholding and cash-basis VAT, the generic baseline pack (4.5, N1, R8 R-3, R-5 to
    R-7).
25. `fx-rates` - insert-only rate table, opt-in ECB source, manual override with reason, FX snapshot
    at issuance (R8 R-4).
26. `document-model` - document types with typed links, line tables per document type and a typed
    template registry replacing the enum (R5-1, C6-7, R4-10).
27. `invoice-corrections` - credit and debit notes, late fees and interest as separate documents,
    cancellation only where a pack allows (D6, R5-3, R5-Q11).
28. `ledger-posting` - posting rules as versioned data inside the issuing command, generic chart,
    opening balances, periods, locks and close, the statutory-books setting (R7-2 to R7-4, R7-Q3).
29. `payments-allocation` - provider-neutral payment layer, allocation across invoices, customer
    credit, refunds, disputes and payouts (R5-9 to R5-12, R5-Q2, R5-Q3).
30. `en16931-peppol-base` - issued snapshot satisfying EN 16931 with UBL and CII serializers, the
    first curated pack (N3, R8 R-8).
31. `fiscal-issuer-portugal` - production O2 issuance for Portuguese entities and the PT pack data
    (D13, R14-2, R14-3, R4-Q14).
32. `party-erasure-retention` - pseudonymizing erasure replacing the hard delete, retention rules
    and profiles without the 3650-day cap, legal holds (D8, R12-2 to R12-4, R14-5).
33. `restore-guard` - after a restore close every series, re-enter in recovery series, replay
    erasures and count restores (8.3, R14-4, R12-6).
34. `i18n-json-catalogs` - catalogs as i18next JSON with ICU in `packages/i18n`, types generated
    from the source locale, Weblate-ready; English and European Portuguese first, then French,
    German and Spanish, plus one right-to-left language through the design gate (7.7, R13-11,
    R13-Q7).
35. `intake-submissions` - X2 intake endpoints with unconfirmed records and the X2 rule in the
    security and routes rules (X2, R2-7).
36. `party-dedup-consent` - duplicate queue and merge, consent per person and purpose, suppression
    per address, tax-ID validation through VIES (R2-4, R2-5, R2-Q6).
37. `notifications-engine` - notification catalog, layered preferences, per-user read state,
    delivery from the outbox, localised at delivery (6.5, R10-9 to R10-11).
38. `outbound-email-streams` - Remit-owned message ids and threads, separate transactional and bulk
    streams, one suppression list (R10-5).
39. `projects-time` - projects without a client, members, `own` and `project` scopes, non-project
    time, two durations, cost rates and rounding (R3-16 steps 1-2, R3-Q1, R3-Q2, R3-Q7).
40. `business-calendar` - one working-time service with work schedules and holidays as data (R3-15).
41. `timesheets` - timesheets per person and week with approval steps, lock with grace and adjusting
    entries (R3-6, R3-Q5, R3-Q6).
42. `calendar-model` - iCalendar-compatible events, invitations and ICS feeds in and out, with the
    money-and-dates rule amended (R3-12, R3-13 K1-K3, C3-5).
43. `booking-pages` - booking pages on intake, slot holds, a per-host lock, emailed-code manage
    links (R3-14, R3-Q10, R3-Q11).
44. `catalog-pricing` - products, bundles and kits, variants, UoM, price lists with most-specific
    rules and snapshots (2.1, R5-6, C6-6).
45. `block-editor` - one block schema and registry with per-surface allowlists (R10-7).
46. `proposal-revisions` - immutable revisions sharing the number, option groups and recorded
    selection (R4-1, R4-Q4, R4-Q5).
47. `signature-requests` - several signers, order, reminders, expiry, counter-signature, evidence
    log, assurance A1-A6 and sealing (R4-2, R4-4, R4-5, R4-7, C4-6, C4-7).
48. `pdf-conformance` - the spike's renderer with conformance stage, pagination, fonts per locale
    and veraPDF in CI (R4-8, R4-9, R4-Q9, R4-Q10).
49. `sales-orders` - orders with versions, fulfilment, returns, deposits and progress billing (R5-4,
    R5-5).
50. `subscriptions` - plans with versions, proration, billed periods, usage metering and revenue
    schedules (R5-7, R5-8, R5-Q4, R5-Q5).
51. `dunning` - dunning policies as data with reminders by default (R5-13, R5-Q11).
52. `sepa-files` - pain.001 and pain.008 with mandates held encrypted for own-bank collection
    (R5-14, C5-1, R5-Q7).
53. `bank-reconciliation` - bank accounts, camt.053/052/054, CSV, OFX, MT940 and BAI2 import,
    reconciliation engine (R7-9, R7-11, C7-3).
54. `chart-packs-year-end` - chart packs PT SNC and generic then FR, DE, ES, the year-end pack
    (R7-5, R7-6, R7-Q7).
55. `procurement` - purchase requests and orders, receipts, vendor bills frozen at posting, matching
    and holds, payables (R6-1 to R6-5).
56. `expenses` - expense items as the unit of approval, mileage and per-diem packs, opt-in OCR (R6-6
    to R6-8).
57. `inventory` - insert-only stock moves, valuation layer, reservations, lots and serials, reorder
    rules, kits (R6-9 to R6-12, R6-16).
58. `file-library` - document library on per-type link tables, grants with expiry, malware scanning
    state machine (6.1, R10-2, R10-3).
59. `inbound-email` - one inbound pipeline with aliases per consumer and verified provider
    signatures (X4, R10-4).
60. `portal-accounts` - external principals, access rows and assurance tiers for client and supplier
    portals (D5, R10-1, R6-15).
61. `hosted-checkout` - catalog and checkout with webhook-confirmed completion in a separate process
    (2.4, R5-16, C5-2).
62. `support-ticketing` - tickets, queues, SLAs on the business calendar, ticket time drawn from
    retainers (6.4, R10-6, R10-8).
63. `knowledge-base` - internal wiki and public help center on the block editor (6.2).
64. `marketing-campaigns` - segments, campaigns and sequences on the party model and the bulk stream
    (6.6, R2-8).
65. `public-api-v2` - OAuth provider, scope grammar, cursor pagination, deprecation headers, OpenAPI
    (R11-5, R11-6, C11-5).
66. `webhooks-v2` - outbox-driven webhooks with a 27-hour retry schedule and subscription API
    (R11-7, R11-Q3).
67. `mcp-write-tools` - MCP tools generated from commands, tier 3 off and confirmed per call
    (R11-Q6).
68. `custom-fields` - typed custom fields with data classes and custom objects (R11-9).
69. `search-read-model` - one permission-filtered Postgres search read model and command palette
    (7.3, R11-10).
70. `reporting-bi` - saved and scheduled reports, the privileged `reporting` schema and Parquet
    (7.2, R11-11, C11-1).
71. `import-export` - importers with dry run and batch undo, versioned export schema, round-trip CI
    test (R11-12, R12-7, R1-5, R1-6, R12-Q9).
72. `workflows` - declarative workflows as service principals with versions and waitpoints (7.1,
    R11-8).
73. `dsr-workflow` - data-subject request cases with deadlines and subject packages, GDPR and UK
    first (R12-5, R12-Q10).
74. `ai-assistance` - AI adapter with data-class gate, proposals only and an `ai_calls` log (7.10,
    R11-13, C11-4).
75. `people-leave` - people as party roles with employments and a leave ledger with privacy layers
    (R3-8, R3-9).
76. `capacity` - work schedules, allocations, tentative states and a daily read model (R3-7).
77. `project-planning` - dependencies, milestones, recurrence, templates and timeline (R3-2, R3-3).
78. `calendar-provider-sync` - CalDAV, Google and Microsoft sync with setup guides (X3, R3-13
    K4-K6).
79. `payroll-export` - generic payroll export with mapping and journal import (5.2, R3-11).
80. `recruitment` - openings, applications on the pipeline engine, scorecards and offers (R3-10,
    R2-9).
81. `performance-reviews` - reviews and goals (5.1).
82. `fixed-assets` - asset register per book with schedules, disposals and revaluation (4.3, R7-12).
83. `budgets-forecast` - versioned budgets, controls at approval points and cash-flow forecast (4.4,
    R7-14).
84. `fx-revaluation` - revaluation runs and a reporting currency computed at report time (R7-8,
    R7-Q11).
85. `intercompany-consolidation` - mirrored intercompany documents and consolidation runs (4.6,
    R7-15).
86. `bank-feeds` - provider-neutral feed adapter, EBICS first (R7-10, C7-2, C7-11).
87. `leases` - lease register, IFRS 16 engine when an IFRS reporter needs it (R7-13, R7-Q13).
88. `country-packs-fr-de-es-it` - curated packs for France, Germany, Spain and Italy in N3 order
    (N3, R1-7).
89. `e-invoicing-transmission` - one transmission adapter for Peppol access points and national
    platforms (R5-18).
90. `pwa-shell` - manifest, service worker and push, with the read cache of the offline set (7.9,
    R13-10 step 1, R13-Q5).
91. `offline-sync` - offline operation queue for time, expenses and receipts on the API; operations
    the server rejects go to a needs-attention list (R13-10 step 2, R13-Q5).
92. `backup-pitr` - WAL archiving behind a tool-neutral adapter with monthly drills, on
    automatically when a remote destination is configured in the agency and large-company presets,
    an option in the freelancer preset (8.3, R13-5, R13-Q2).
93. `high-availability` - two app containers for rolling restarts and a read-replica path; hosted
    availability published as monthly objectives (99.5 % freelancer, 99.9 % agency, 99.95 %
    dedicated large-company), not a contractual SLA with credits until hosted customers exist (8.3,
    R13-6, L15, R13-Q1).
94. `control-plane` - `apps/control-plane` provisioning instances on shared fleet services (5.4,
    R9-7, R9-8).
95. `hosted-billing` - hosted plans and meters billed from a Remit instance (5.5, R9-9).
96. `hosted-offboarding` - Data Act notice, transition, retrieval and the legal archive package
    (R12-8, R12-Q7).
97. `docs-site` - documentation site on Fumadocs (8.8, R13-12).
98. `storefront-connectors` - Shopify, WooCommerce and Amazon order connectors (R5-17).
99. `native-apps` - Expo (React Native) `apps/mobile` signing in to any instance by URL, after the
    PWA and the writable API, through the design gate (7.9, R13-10 step 3, R13-Q6).
100. `resource-booking` - rooms and equipment booking and automatic scheduling by dependencies (1.6,
     R3-16 step 14).

## Gaps

Every gap has exactly one owner: a change name from Next or `openspec/changes/`, `owner` (needs an
owner decision), or `accepted` (a known limit kept on purpose).

| Id     | Gap                                                                                                                                                                                                                                                                | Owner                       |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| GAP-1  | `tools/git-guard/classify.mjs` misses a push hidden behind a git alias (`git -c alias.p=push p`, or an alias set with `git config alias.*`), `Invoke-Expression`/`iex` bodies and `cmd /c` bodies. Agents may not edit their own guards, so the fix is the owner's | accepted                    |
| GAP-2  | The Claude deny `git config core.hooksPath*` also refuses reading the value, because prefix rules cannot tell a read from a write; the guard hook already distinguishes them                                                                                       | accepted                    |
| GAP-3  | Claude path-scoped rule globs are not anchored to the repository root: `scripts/**` (comments) and `tests/**` (testing) also match a nested `scripts/` or `tests/` folder in any package. Harmless today; revisit if a pointer's scope matters                     | accepted                    |
| GAP-4  | An app exposed without a proxy that overwrites `X-Forwarded-For` lets a caller choose the address keying every address-based limit and audit window                                                                                                                | accepted                    |
| GAP-6  | First-time enrolment keeps a race in Better Auth's `enable`: a tab that reads an unverified row while another tab's `verify-totp` marks it verified carries `verified: true` onto a new, unproven secret; it needs two requests of one user within milliseconds    | owner                       |
| GAP-7  | The reconfigure hold cannot tell a missing session from a failed session read, so a transient read failure on `enable` for a verified user reaches Better Auth's handler, which replaces the factor                                                                | owner                       |
| GAP-8  | Money helpers divide by 100 for every currency and multiply floats: currencies whose exponent is not 2 are wrong and 0.29 × 50 cents rounds to 14; the money rule prescribes `Math.round`                                                                          | `money-precision`           |
| GAP-9  | `audit_logs.actor_user_id` declares `ON DELETE SET NULL` on an insert-only table, so deleting a user can never succeed; audit ids are random UUIDs with no order                                                                                                   | `audit-principal-shape`     |
| GAP-10 | Audit rows are written inline and chained by an asynchronous sealer with checkpoints anchored outside the database (R13-Q3, C13-1); whether ledger and signature evidence reuse the same sealer and checkpoint primitive is open                                   | `audit-principal-shape`     |
| GAP-11 | No column declares a data class, so erasure, export, retention, AI exclusion and the BI schema cannot be derived from the schema                                                                                                                                   | `data-class-registry`       |
| GAP-12 | One settings singleton holds one global invoice series; a draft claims its number and an issued invoice can be soft-deleted                                                                                                                                        | `issuance-series`           |
| GAP-13 | A payment belongs to one invoice and `chk_invoices_amount_paid` refuses overpayments                                                                                                                                                                               | `payments-allocation`       |
| GAP-14 | A late fee changes the total of an issued invoice instead of being its own document                                                                                                                                                                                | `invoice-corrections`       |
| GAP-15 | Contract signing uses one shared link, so any holder of the link can sign as any signer                                                                                                                                                                            | `contract-signing-sessions` |
| GAP-16 | `apps/web/features/clients/forget.ts` hard-deletes a client; retention settings are capped at 3650 days, shorter than ten years counted from year end                                                                                                              | `party-erasure-retention`   |
| GAP-17 | A restore rewinds series counters and brings back erased data, and issuance is not blocked afterwards                                                                                                                                                              | `restore-guard`             |
| GAP-18 | A webhook delivery is lost when the process stops between commit and the in-process handler                                                                                                                                                                        | `command-layer-outbox`      |
| GAP-19 | One queue at worker concurrency 1: a 2,000-invoice render run blocks every other job for about 13 minutes; the app holds 30 idle database connections                                                                                                              | `job-queues`                |
| GAP-20 | Migrations run in the container entrypoint of the only app container: each recreate is a 3.5 s outage plus migration time, and no index is built concurrently                                                                                                      | `migration-discipline`      |
| GAP-21 | axe finds six rule failures (including `button-name` and `color-contrast`) and no accessibility check runs in E2E                                                                                                                                                  | `accessibility-gate`        |
| GAP-22 | The translation catalog is a TypeScript object (`apps/web/lib/i18n/locales/en.tsx`) that Weblate cannot edit                                                                                                                                                       | `i18n-json-catalogs`        |
| GAP-23 | No correlation ids, traces or OTLP export; metrics are pull-only                                                                                                                                                                                                   | `observability-tracing`     |
| GAP-24 | Recovery point is 24 hours or 7 days with no point-in-time recovery                                                                                                                                                                                                | `backup-pitr`               |
| GAP-25 | Activity feed read state is instance-wide, not per user                                                                                                                                                                                                            | `notifications-engine`      |
| GAP-26 | Lead notes are stored in plaintext while client notes are encrypted                                                                                                                                                                                                | `parties`                   |
| GAP-27 | Dashboard totals are per currency with no reporting currency                                                                                                                                                                                                       | `fx-revaluation`            |
| GAP-28 | A project needs a client and a time entry needs a project                                                                                                                                                                                                          | `projects-time`             |
| GAP-29 | No web app manifest or service worker                                                                                                                                                                                                                              | `pwa-shell`                 |
| GAP-30 | The role of Redis is undecided: R9 wants instances without it, R13 keeps rate limits in it for several app processes, R10 needs a realtime transport (`LISTEN/NOTIFY` or Redis pub/sub)                                                                            | `spike-job-queue`           |
| GAP-31 | Better Auth 1.7 coverage of the R11 OAuth provider, `mcp` and `cimd` plugins on the workforce instance only is unproven                                                                                                                                            | `spike-better-auth`         |
| GAP-32 | InvoiceXpress API coverage (invoices, credit notes, receipts, transport documents, idempotent creation) and qualified seals on its PDFs are unverified                                                                                                             | `spike-fiscal-issuer`       |
| GAP-55 | First Peppol access point and first national platform (R5-Q10, R8 question 5)                                                                                                                                                                                      | owner                       |
| GAP-56 | Second payroll provider (API) by first markets (R3-Q12)                                                                                                                                                                                                            | owner                       |
| GAP-57 | Whether the hosted offering brokers one bank-aggregator contract (R7-Q8)                                                                                                                                                                                           | owner                       |
| GAP-58 | Commercial check: InvoiceXpress or fiskaly terms and per-document price, passed into the hosted price corridor (D13, R1 C-7)                                                                                                                                       | owner                       |
| GAP-59 | Commercial check: trust service providers that accept small self-hosted customers for hash signing, including one covering Portuguese state identity (R4-Q3)                                                                                                       | owner                       |
| GAP-60 | Commercial check: Enable Banking terms for small self-hosted businesses (R7-Q8)                                                                                                                                                                                    | owner                       |
| GAP-61 | OCR: cloud provider price and accuracy against a local model are unmeasured (R6-8, R6-Q11)                                                                                                                                                                         | `expenses`                  |
| GAP-62 | Which gateway payment pages publish accessibility conformance is unknown (R13-4)                                                                                                                                                                                   | `hosted-checkout`           |
| GAP-63 | VIES API details are unconfirmed (R2-Q6)                                                                                                                                                                                                                           | `party-dedup-consent`       |
| GAP-64 | Which public-holiday dataset may be redistributed is unknown (R3-15)                                                                                                                                                                                               | `business-calendar`         |
| GAP-65 | Adviser: DL 28/2019 art. 4(1) reading, provider liability split, and whether Remit's PDF may coexist as a marked copy (D13, R14 question 5)                                                                                                                        | owner                       |
| GAP-66 | Adviser: running an AGPL-3.0 engine as a separate service and inside a shared render pool (R4-Q8, C4-9)                                                                                                                                                            | owner                       |
| GAP-67 | Adviser: signature evidence kept to the contract class end, and whether a self-issued seal misleads (C4-8, R4-7)                                                                                                                                                   | owner                       |
| GAP-68 | Adviser: D8 reworded to erase, pseudonymize, restrict and dispose; HMAC values of erased emails and tax IDs as personal data; retention rows per jurisdiction (C12-1, R12-Q6, R12-3)                                                                               | owner                       |
| GAP-69 | Adviser: EU Data Act arts. 25, 29 and 31 (30-day retrieval as minimum or maximum) and minimum durations in the hosted terms (R12-Q7, C12-8)                                                                                                                        | owner                       |
| GAP-70 | Adviser: the EAA binds customers selling to consumers; whether portal payment of an existing invoice is covered (C13-2, R13-4)                                                                                                                                     | owner                       |
| GAP-71 | Adviser: sensitive absence types, working-time packs, pay transparency and AI Act duties in recruitment, candidate retention, labour cost posting (R3-Q3, R3-Q14, C3-10, R2-9, R3-4)                                                                               | owner                       |
| GAP-72 | Adviser: revenue recognition granularity, deposit VAT point, late-payment compensation and interest as pack data (R5-Q12, R5-5, R5-3)                                                                                                                              | owner                       |
| GAP-73 | Adviser: LIFO for a US tax book, sequential registration of received invoices, backdated valuation corrections, drop-shipping VAT chain, mileage rate data (C6-1, R6-2, R6-10, R6-16, R6-7)                                                                        | owner                       |
| GAP-74 | Adviser: redistribution of DATEV SKR charts (R7-Q7)                                                                                                                                                                                                                | owner                       |
| GAP-75 | Adviser: jurisdictions mandating stricter separation of duties (R9-3)                                                                                                                                                                                              | owner                       |
| GAP-76 | Adviser: consent basis for B2B email per jurisdiction and how long unconfirmed intake may be kept (R2-5, R2-7)                                                                                                                                                     | owner                       |
| GAP-77 | Adviser: whether a listed AI use falls under AI Act Annex III (R11-13)                                                                                                                                                                                             | owner                       |
| GAP-78 | Adviser: e-invoicing mandate dates per country and the Portuguese qualified-seal date (OE2027) re-checked each budget year (R1-7, R14-6)                                                                                                                           | owner                       |
| GAP-79 | Adviser: the licence (AGPL-3.0 for app, worker and control-plane, MIT for `packages/sdk`) is reviewed before external pull requests are accepted; CLA versus DCO stays open until then (R1-7)                                                                      | owner                       |
| GAP-80 | Adviser: OSS registration and B2C VAT for hosted pricing by seats and resources without a merchant of record (R9-6)                                                                                                                                                | owner                       |
| GAP-81 | Adviser: attribution for packs seeded from gobl regime data under Apache-2.0 (R8-6)                                                                                                                                                                                | owner                       |
| GAP-82 | Adviser: retention duties for issued documents through the hosted suspension stages up to termination (R9-7)                                                                                                                                                       | owner                       |
| GAP-83 | Adviser: contacts cannot turn off payment reminders as contractual communication (R10-10, R5-13)                                                                                                                                                                   | owner                       |
| GAP-84 | The export of each product in the R1-5 importer waves is unverified (R1-4)                                                                                                                                                                                         | `import-export`             |
| GAP-85 | No rule lists what a new workspace package joins (Dockerfile manifest copies, root `typecheck`, coverage include, changelog `SHIPPED_ROOTS`, ESLint and `.claude/rules` globs, Vitest `maxWorkers`) or the worker's `apps/web` boundary; `architecture.md` should  | owner                       |
| GAP-86 | `apps/worker` depends on `@remit/web` through its `exports` map, one application on another rather than a shared package, until `job-queues`, `command-layer-outbox` or a `packages/db` change moves what the worker needs out of `apps/web`                       | `job-queues`                |
| GAP-87 | `apps/web/tsup.scripts.config.ts` builds the `remit:*` and `migrate` bundles the image runs, but the changelog gate's `SHIPPED_FILES` does not name it, so a change to it needs no release note                                                                    | owner                       |
