# restructure-reference-docs — tasks

Each task is one commit whose body contains `Change: restructure-reference-docs, task <n>`. Tick the
box in the same commit. A ticked box is a claim; `next-step` checks it against `git log`.

Every task: spec impact none (owner decision 13). Every sentence a task writes or keeps in a
document names a file that verifies it, and was verified against that file before writing. No text
describes a former state, a migration of documents, a replacement or a removed document; history
lives in git. Outside `docs/`, `openspec/`, guidance files, `README.md`, `.github/` text and
`scripts/**/README.md`, a diff is comment-only or a new test. At every commit `pnpm lint`,
`pnpm typecheck`, `pnpm exec vitest run tests/docs` and `pnpm exec prettier --check` on the staged
files pass; after it, the touched files are grepped for `ADR`, `delivery record`, `migrat`,
`formerly`, `legacy`, `previously`, `no longer`, `used to`, `replaces`, `superseded`, `evolution`,
and each hit is removed or justified in the commit body as present behaviour.

- [x] 1. Reviewer present-tense line and GAP-4
  - Do: add one line to the quality checklist in `.agents/agents/reviewer.md` (owner decision 10):
    nothing in the diff describes a former state, a migration, a replacement or a removed document;
    repository files describe the present and history lives in git. Follow
    `.agents/skills/write-skill/SKILL.md`; `.claude/agents/reviewer.md` stays a pointer that
    `tests/docs/agentFiles.test.ts` accepts. In `.github/CONTRIBUTING.md` and
    `.github/PULL_REQUEST_TEMPLATE.md`, say the migration history may be squashed before v1 when the
    owner schedules it (`AGENTS.md` owner decision 3). Remove the GAP-4 row from
    `openspec/backlog.md`.
  - Done when: the reviewer prompt carries the line; neither `.github` file says the history is
    never squashed; `openspec/backlog.md` has no GAP-4; `tests/docs` pass.
  - Verify:
    `git grep -q "former state" -- .agents/agents/reviewer.md && ! git grep -q "GAP-4" -- openspec/backlog.md && ! git grep -qiE "never squashed|was not squashed" -- .github && pnpm exec vitest run tests/docs`

- [x] 2. Kept prose-only rules, migration rule and token minter
  - Do: write each kept rule of owner decision 5 as one statement in its owning file
    (`.agents/rules/security.md`, `database.md`, `errors.md`, `architecture.md`, `routes.md`); the
    `scripts/README.md` rule waits for task 5 and the schema-comment rules for task 3. Owner
    decision 11: in `AGENTS.md` (Hard rules and the `database/` line of the directory map) and the
    Migrations section of `.agents/rules/database.md`, never edit generated migration output;
    hand-written SQL migrations exist only for what Drizzle cannot express, each states why in its
    header, and a squash must recreate them unchanged. In `security.md`, the public-token section
    names `mintPublicToken` in `lib/publicToken.ts` as the one minter in place of the inline
    `randomBytes(32)` example. G2: replace the encrypted-field list with a pointer to the
    `encryptedColumn(` calls in `database/schema/`; name the real Better Auth sign-in and sign-up
    routes (verify in `lib/auth/` and `app/api/auth/[...all]/route.ts`); the routing-state pointer
    changes in task 7. Write no dropped rule (owner decision 5) and no two-release rule.
  - Done when: every kept rule reads as one statement; no rule lists encrypted columns; the token
    section names `mintPublicToken`; `AGENTS.md` and `database.md` state the hand-written migration
    rule; always-loaded context (`AGENTS.md` + `CLAUDE.md`) stays within budget; each new statement
    was checked against the file it names.
  - Verify:
    `git grep -q "mintPublicToken" -- .agents/rules/security.md && git grep -q "encryptedColumn(" -- .agents/rules/security.md && ! git grep -q "smtpPass" -- .agents/rules/security.md && git grep -qi "hand-written" -- AGENTS.md .agents/rules/database.md && git grep -q "/api/v2" -- .agents/rules/routes.md && pnpm exec vitest run tests/docs`

- [x] 2a. Task 2 review findings
  - Do: in `.agents/rules/security.md`, make the portal rule one non-contradictory statement (it
    writes no record besides a rate-limit trip audit); make the TOTP rule a rule for code whose
    explanation claims no more than the code does (Better Auth's `/api/auth/two-factor/disable` is
    not refused by `app/api/auth/[...all]/route.ts`; `proxy.ts` sends a session without an enrolled
    factor back to `/setup`); make the rate-limit sentence true about where each limit lives
    (`lib/auth/index.ts` `rateLimit`, `proxy.ts`, route modules such as
    `app/(public)/s/[token]/page.tsx`); cite `database/schema/attachments.ts` having no proposal or
    contract parent rather than `chk_attachments_parent`. In `.agents/rules/database.md`, the
    project-and-client rule asks for a backfill only when the table already holds rows, and cites
    `0002` for the composite foreign key it adds.
  - Done when: each statement is true against the file it names and stays one statement.
  - Verify:
    `git grep -q "two-factor/disable" -- .agents/rules/security.md && git grep -q "already holds rows" -- .agents/rules/database.md && pnpm exec vitest run tests/docs`

- [x] 3a. Review findings of tasks 2a and 3
  - Do: in `.agents/rules/security.md` the recovery-code limit comes from the Better Auth two-factor
    plugin's `/two-factor/` rule (read
    `node_modules/better-auth/dist/plugins/two-factor/index.mjs`), every other Better Auth route
    from the `rateLimit` default in `lib/auth/index.ts`. In `.agents/rules/database.md` the
    "hand-written, as 0002 shows" note belongs to the composite foreign key, not to
    `uq_projects_id_client_id`; drop the backfill clause's unanchored claim or keep it as a
    requirement without a citation. In `database/schema/auditLogs.ts` the comment names the UPDATE,
    DELETE and TRUNCATE triggers of `drizzle/migrations/0001_insert_only_guards.sql` (comment-only).
    In `lib/audit/__tests__/auditLogsInsertOnly.integration.test.ts` the two rejection tests are
    named `<behavior> when <condition>` per `.agents/rules/testing.md`.
  - Done when: each statement is true against the file it names; the integration test passes.
  - Verify:
    `git grep -q "UPDATE" -- database/schema/auditLogs.ts && pnpm exec vitest run --config vitest.integration.config.ts lib/audit/__tests__/auditLogsInsertOnly.integration.test.ts && pnpm exec vitest run tests/docs`

- [x] 3. Schema facts and the `audit_logs` guard test
  - Do: add facts F1-F5 of the proposal as comments in `database/schema/proposals.ts`,
    `timeEntries.ts` (or `lineItems.ts`), `invoices.ts` and `templates.ts`, each verified against
    the code that writes the column; F5 states that built-in layouts live in code and are never
    seeded as template rows and `is_system` has no writer. F6: state nothing in `emailLogs.ts` (the
    claim is unenforced). H1: if `templates.ts` needs a note on how a stored `box`, `divider` or
    `spacer` block reads back today, write only that, verified in `features/templates/`. Re-point
    the eight code comments that cite `SCHEMA.md` (listed in the proposal) to the schema file or
    service that holds the fact. Add `lib/audit/__tests__/auditLogsInsertOnly.integration.test.ts`
    (not under `database/`) in the shape of
    `features/contracts/__tests__/signedPdfGuard.integration.test.ts`: INSERT succeeds; UPDATE and
    DELETE are refused by the trigger from `drizzle/migrations/0001_insert_only_guards.sql`.
    Comments are the only `database/` edits; no logic, no SQL.
  - Done when: F1-F5 read as comments next to their columns; no code comment cites `SCHEMA.md`; the
    new test passes against the test database and fails if the trigger is dropped (reason about it
    or check it on a scratch copy of the test database).
  - Verify:
    `! git grep -q "SCHEMA.md" -- features lib && pnpm exec vitest run --config vitest.integration.config.ts lib/audit/__tests__/auditLogsInsertOnly.integration.test.ts`

- [x] 4. Operator runbooks: deployment, metrics, upgrade, backup
  - Do: move ARCHITECTURE.md "Docker-first deployment model" into `docs/deploy/README.md`; "Health
    and status" and "What an operator can observe" into `docs/operations/METRICS.md`; "Updates" into
    `docs/operations/UPGRADE.md` without the two-release rule (owner decision 6). Write
    `docs/operations/BACKUP.md` from "Backup and restore": the `backup.run.sweep` schedule at 01:00
    UTC and how `backup_cadence` decides a backup night, the single backup lock, the destination
    test, hosted mode, the dashboard banner, retention pruning, and the backup-test procedure that
    `INSTALL.md` and `linux-host.md` promise; an execution statement (what `features/backups/` tests
    and `tests/e2e/scheduledBackup.spec.ts` execute; a real destination bucket is not executed).
    Verify every operational claim against `features/backups/`, `lib/backups/`,
    `lib/jobs/schedules.ts` and `scripts/core/backup/`. `ARCHITECTURE.md` itself changes in task 7.
  - Done when: each runbook carries its section; `BACKUP.md` exists and every claim names its file;
    every backticked path in the touched runbooks exists (script); links resolve.
  - Verify:
    `test -f docs/operations/BACKUP.md && git grep -q "backup.run.sweep" -- docs/operations/BACKUP.md && ! git grep -qi "two releases" -- docs/operations && pnpm exec vitest run tests/docs`

- [x] 4a. Review findings of task 4
  - Do: in `docs/operations/BACKUP.md` the Execution section says `.github/workflows/install.yml`
    runs the backup command "with the local destination" (it only checks a backup can be written
    into the data directory) and that `tests/e2e/scheduledBackup.spec.ts` drives the dashboard (it
    opens `/settings/backup`); the scratch-restore cleanup `rm -rf` of the chowned data directory
    needs root; "`scripts/host/upgrade.sh` runs this command before every upgrade" omits the
    `--skip-backup` plus `REMIT_ALLOW_UPGRADE_WITHOUT_BACKUP=1` double opt-out
    (`scripts/host/upgrade.sh`, `docs/operations/UPGRADE.md`).
  - Done when: each statement is true against the file it names.
  - Verify:
    `git grep -q "REMIT_ALLOW_UPGRADE_WITHOUT_BACKUP" -- docs/operations/BACKUP.md && pnpm exec vitest run tests/docs`

- [x] 5. CLI contract next to the scripts
  - Do: `git mv docs/architecture/operations/CLI-CONTRACT.md scripts/README.md` and shrink it to
    naming, promotion criteria, execution context, the upgrade boundary rule of owner decision 5
    (the app container never mounts the Docker socket, upgrade runs on the host, there is no
    `remit:upgrade` script) and key-rotation semantics; flags point to each command's `--help`
    (`scripts/core/*/args.ts`). Fix O3 (read `Dockerfile`) and O4 (read `features/backups/jobs.ts`
    and the lock modules). No "no placeholder scripts" prose. Re-point every inbound link
    (`README.md`, `docs/README.md`, `docs/operations/INSTALL.md`, `docs/operations/RESTORE.md`, the
    links in `docs/architecture/ARCHITECTURE.md`, the `scripts/core/seedDemo/plan.ts` comment) and
    `tests/docs/demoSeeding.test.ts`. Add `tests/docs/packaging.test.ts`: the `remit:*` keys in
    `package.json`, the entries in `tsup.scripts.config.ts` and the `COPY` lines in `Dockerfile`
    agree. If it reveals a real disagreement, change none of the three: stop and report.
  - Done when: `scripts/README.md` holds the contract and no file cites `CLI-CONTRACT`; the
    packaging test passes; every backticked path and every `pnpm` command in `scripts/README.md`
    exists.
  - Verify:
    `test -f scripts/README.md && ! git grep -q "CLI-CONTRACT" -- ':!openspec' && pnpm exec vitest run tests/docs`

- [x] 6. Archive contract next to the archive code
  - Do: `git mv docs/architecture/specs/BACKUP-ARCHIVE.md scripts/core/archive/README.md` and shrink
    it to the forward-compatibility promise and the destination table, pointing to
    `scripts/core/archive/header.ts` and `scripts/core/restore/manifestSchema.ts` for the layout.
    Re-point `scripts/core/restore/manifestSchema.ts`, `lib/backups/destination.ts`, `README.md`,
    `docs/README.md`, `docs/operations/INSTALL.md`, `docs/operations/RESTORE.md`,
    `scripts/README.md` and the links in `ARCHITECTURE.md`.
  - Done when: no file cites `BACKUP-ARCHIVE`; the kept text agrees with `header.ts`,
    `manifestSchema.ts` and their tests; links resolve.
  - Verify:
    `test -f scripts/core/archive/README.md && ! git grep -q "BACKUP-ARCHIVE" -- ':!openspec' && pnpm exec vitest run tests/docs scripts/core/archive`

- [x] 7. The architecture map
  - Do: rewrite `docs/architecture/ARCHITECTURE.md` to the proposal's map outline, at most 20 KB,
    resolving A1-A19 and H1; each surviving section is one principle plus the named file that
    verifies it. Draft in the scratch folder, check with a script that every backticked path exists,
    then commit once. Re-point every code comment the proposal lists under Layout to a section title
    of the map, never a number. In `.agents/rules/security.md`, point the routing-state reference at
    the map's section (G2). Re-point every other citation of an `ARCHITECTURE.md` section title that
    the map drops (`git grep -n "ARCHITECTURE.md"`).
  - Done when: the map is at most 20,000 bytes; every backticked path in it exists; no comment cites
    a numbered or missing section; links resolve.
  - Verify:
    `test $(wc -c < docs/architecture/ARCHITECTURE.md) -le 20000 && ! git grep -qE "ARCHITECTURE\.md[^)]*§|ARCHITECTURE\.md,? (section )?[0-9]" && pnpm exec vitest run tests/docs`

- [x] 7a. Review findings of task 7
  - Do: in `docs/architecture/ARCHITECTURE.md` fix the statements the code contradicts: an export
    excludes secret and credential columns and sends `clients.notes` as the deliberate exception
    (`features/dataExport/services/exportManifest.ts`, `database/schema/clients.ts`); the export
    manifest is enforced when each row is serialised (`projectExportRow`,
    `features/dataExport/__tests__/manifest.integration.test.ts`); the private `documents` bucket is
    served by `app/api/attachments/[id]` and `app/api/documents/[type]/[id]`, and the public token
    routes deliver documents; error reports leave from the places that call `reportError`, including
    `scripts/core/worker/crash.ts`. Where a cited section does not state the fact the citing text
    relies on, either state the fact in the map or re-point the citation: `.github/SECURITY.md`
    (encryption algorithm, token strength, constant-time comparison, mandatory TOTP, append-only
    audit log, security headers), the comment at `lib/securityHeaders.ts` (why no public route is
    framable), `features/backups/queries.ts` (dashboard banner). Restore, as short statements each
    naming its file and only if no rule, test or lint states it: the invoice number is permanent and
    never reused; a project cannot be re-parented once it carries financial records
    (`ON UPDATE RESTRICT` in `drizzle/migrations/0002_document_parent_agreement.sql`); the
    recurring-invoice retainer branch also stamps `invoicedInId`
    (`features/recurringInvoices/jobs.ts`); settlement re-decides under the invoice lock when a
    credit note is issued, withdrawn or restored, and a zero outstanding settles only on a positive
    total; a locked proposal refuses every edit and send path and a correction is a new proposal
    (`features/proposals/`). Verify each against code before writing. Keep the map at most 20,000
    bytes. Task 9's Verify line gains the `:!openspec` exclusion (already edited in this task's
    `tasks.md` change).
  - Done when: each statement is true against the file it names; the map is within budget.
  - Verify:
    `test $(wc -c < docs/architecture/ARCHITECTURE.md) -le 20000 && ! git grep -q "every encrypted column" -- docs/architecture/ARCHITECTURE.md && pnpm exec vitest run tests/docs`

- [x] 8. Delete `SCHEMA.md`
  - Do: delete `docs/architecture/SCHEMA.md` and `tests/docs/schema.test.ts`; update the references
    that remain (`AGENTS.md` directory map, `.agents/rules/comments.md`, `README.md` Architecture,
    `docs/README.md`).
  - Done when: no file outside `openspec/changes/` mentions `SCHEMA.md`.
  - Verify:
    `test ! -f docs/architecture/SCHEMA.md && ! git grep -q "SCHEMA.md" -- ':!openspec' && pnpm exec vitest run tests/docs`

- [x] 9. Operator documents
  - Do: fix O1 in `docs/deploy/README.md`, `linux-host.md` and `nginx.md` (verify the fallback in
    `features/invoices/pdfRenderJob.ts` and `emailJob.ts`); fix O2 (point to the backup-test
    procedure in `BACKUP.md`). Add the execution statements the proposal lists under "Operator
    documents": what automation executes each procedure and what stays unexecuted (the interactive
    install, Caddy and ACME, the manual install, external S3, rollback, the Prometheus scrape, a
    real backup bucket, every deploy guide). Owner decision 8 for the two Tested guides: name the
    commit of each run when the guide or its git history records it, otherwise say it is not
    recorded, and mark the corrected step as not re-executed. Fold `docs/deploy/raspberry-pi.md`
    into an "arm64 hosts" section of `linux-host.md` and delete it (owner decision 4).
  - Done when: no document claims a missing PDF or the string
    `Invoice PDF skipped: no template to render`; no document says `RESTORE.md` tests a backup;
    every operator document says what was executed; no file cites `raspberry-pi.md`.
  - Verify:
    `test ! -f docs/deploy/raspberry-pi.md && ! git grep -q "no template to render" -- ':!openspec' && ! git grep -q "raspberry-pi.md" -- ':!openspec' && pnpm exec vitest run tests/docs`

- [ ] 10. Routing
  - Do: delete `docs/README.md`. Update `README.md` (Documentation and Architecture to the routing
    list in the proposal; drop the placeholder-scripts sentence), `AGENTS.md` (directory map with
    G1: no `(setup)` group, the groups are `(auth) (dashboard) (editor) (public)`; References names
    the architecture map; a short Gotchas list pointing to `scripts/README.md`,
    `scripts/core/archive/README.md`, the runbooks in `docs/operations/`, and the
    `docs/operations/UPGRADE.md` path that `features/health/services/releaseLinks.ts` and
    `scripts/host/install.sh` build in), `.github/CONTRIBUTING.md`, `.github/SECURITY.md`,
    `.github/ISSUE_TEMPLATE/feature_request.yml`, `.agents/rules/comments.md` and
    `.agents/skills/write-spec/SKILL.md` (links only). Extend `tests/docs/links.test.ts` to
    `scripts/**/README.md`, `README.md` and to every `*.md` repository path that a code comment,
    `AGENTS.md` or a rule cites. Always-loaded context grows by at most 600 bytes net over its size
    before this change (9,601 bytes).
  - Done when: `docs/README.md` is gone and nothing cites it; every route in the proposal's routing
    list exists; the extended link test passes and fails on a planted broken citation.
  - Verify:
    `test ! -f docs/README.md && ! git grep -q "docs/README.md" -- ':!openspec' && ! git grep -q "(setup)" -- AGENTS.md && pnpm exec vitest run tests/docs`

- [ ] 11. Verify the change
  - Do: measure `docs/` against the proposal; confirm the map is at most 20 KB; grep for
    `SCHEMA.md`, `CLI-CONTRACT`, `BACKUP-ARCHIVE`, `docs/README.md`, `raspberry-pi.md` and numbered
    `ARCHITECTURE.md` sections; run the present-tense grep over every file the change touched; run
    `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`. Record the measurements in
    this task's commit body; fix nothing here (findings become new tasks).
  - Done when: every check passes or is reported as not run with its reason.
  - Verify: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`
