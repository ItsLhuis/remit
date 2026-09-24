# Coverage completion

- **Status:** Shipped
- **Date:** 2026-09-23
- **Verdict:** Complete
- **Decisions:** —
- **Supersedes:** —

## What

The tests `.agents/rules/testing.md` promises and the suite did not have: services branch coverage
held above its gate by CI, every translation proven a valid ICU message, the host upgrade script
exercised, and three flows driven end to end — the setup wizard's recovery codes, a backup
configured from its settings page, and a scheduled backup run by the worker.

## Why

`vitest.config.ts` has declared a 90% branch threshold for `features/**/services/**` since the
services layer existed, and it has been enforced nowhere: CI's unit job runs `pnpm test`, never
`pnpm test:coverage`, and the services sat at 86% branch coverage through several deliveries that
each recorded the shortfall. Whole files of money arithmetic — the discount conversions that decide
what a line is charged — had no test at all.

Nothing parsed the English locale's messages, so a malformed ICU plural or select would reach the
screen as a raw string, or as an error, only when the one screen that renders it was opened.
`scripts/host/upgrade.sh`, the command an operator runs against a production instance, had no test,
though its safety — no upgrade without a backup, nothing run in a dry run — is exactly what an edit
could silently break.

Three canonical paths stopped short of their user-visible end. Flow 1 stopped at the TOTP QR step,
on the stale reasoning that a browser cannot read a QR image, although the page prints the manual
entry secret beside it; the recovery codes an owner must save were never seen by a test. No
end-to-end test configured a backup and took one, and the scheduled backup sweep was proven only
against a worker running inside the integration suite, never against the production worker process.

## Scope

Included: behaviour tests for the services whose uncovered branches carry behaviour; the coverage
gate in CI; an ICU validity test over every locale; a test of `upgrade.sh` through a stubbed
`docker`; flow 1 through TOTP verification to the recovery codes; an end-to-end spec that configures
a backup on `/settings/backup` and runs one; an end-to-end spec that runs the scheduled sweep
through the spawned production worker; whatever those tests prove wrong inside the surfaces they
exercise.

Excluded: any threshold lowered or exclusion widened, and product behaviour outside the surfaces the
new tests exercise — a defect found beyond them is recorded rather than fixed here.

## How

**Coverage from the branches, not the percentage.** Each service file's uncovered branches were read
before any test was written, and each test names a behaviour those branches implement. The largest
single gaps were whole files: the invoice and credit note discount conversions between the form, the
three database columns and the totals service had never run in a test, including the rule that a
half-filled discount — a kind with no value — is stored as no discount rather than as a shape the
check constraint refuses. The rest were the legacy block migrations (structured headers, footers,
notes and terms becoming text; the data blocks a document now fills itself being dropped; the
container depth limit; a column box's children laid out along its gap; an unreadable child dropped
without its siblings), the plain-text rendering an email body uses, the editor's own render path
that leaves a container's children out, and IBAN validation and masking, which had no test file.

Two kinds of uncovered branch were left alone and reported rather than reached by a contorted input.
In `features/settings/payment/services/iban.ts`, `getIbanCharacterValue`'s null return and its
caller's check are unreachable: the shape test before them admits only letters and digits. In
`features/templates/services/normalizeBlocks.ts`, `migrateAbsoluteBlocks`'s `?? 0` on `x` and `y`
exists for the optional stored-layout type, since that generation is chosen only when every row has
both.

**The gate.** CI's unit job runs `pnpm test:coverage` in place of `pnpm test`. A second coverage job
was rejected: it would run the whole suite twice on every push, and two runs of one suite can
disagree when a test is flaky. The threshold is unchanged and fails the job when it is not met.

**Translations.** The ICU test builds every value in every locale with `intl-messageformat` exactly
as `i18next-icu` does at runtime — `ignoreTag` included, so a message carrying `<0>`-style
placeholders is judged the way it renders — and names each value that does not parse. It matters
because the plugin turns a parse failure into the raw string on screen: nothing else would report
one. `intl-messageformat` is now a declared dependency rather than a peer pnpm installed implicitly,
so the test and the runtime cannot resolve different parsers; fallow is told to ignore it because
its only import in the application is inside `i18next-icu`, where static analysis does not look.
Plural, select, nested and number messages the locale already uses are pinned through the runtime
`t()` as well.

**The upgrade script.** `upgrade.sh` runs under `bash` with a stub `docker` first on `PATH` that
records each invocation and answers as a healthy host would; the backup command appends a new
archive to the list the script's in-container `ls` reads, so the test sees exactly what an operator
would. The order asserted is backup, pull, then `up -d`, which is the migrating step — the app
container's entrypoint applies pending migrations when it is recreated. The test showed the script
printing rollback guidance, and claiming its backup had completed, when the prerequisite check or
the backup itself failed before anything had changed; it now says nothing was changed, and keeps the
rollback guidance for failures from the pull onwards.

**Flow 1** now enrols TOTP through the wizard: it reads the manual-entry secret the verify step
prints, answers with a code generated from it, and asserts the recovery codes, the count beside
them, and that Continue stays disabled until the owner acknowledges saving them. Owner provisioning
still exists for an owner left registered but not enrolled, and its comment says so.

**Backups end to end.** Both specs use the local destination. In the e2e stack `REMIT_DATA_DIR` is
the directory `docker-compose.yml` bind-mounts into the app and worker containers, so an archive
written by either container, or by the test process itself, lands where the spec can list it — which
a bucket inside the stack's MinIO would not be, since the runner cannot resolve its host name. The
settings spec drives `/settings/backup`, saves a changed cadence, tests the destination, runs
`pnpm remit:backup --yes` the way the page tells the owner to, and asserts the page's last-success
line and the new archive. The schedule spec dates the last success two nights back on a daily
cadence, enqueues `backup.run.sweep` through the real `enqueueJob` against the spawned production
worker, and asserts one archive, the success on the page and one scheduled entry in the audit trail;
a second delivery of the same night changes none of the three. Both restore the backup columns and
remove the archives they took, and skip with a reason on an instance backing up to a remote
destination, whose credentials a test must not hold.

`pg_dump` is the one dependency a backup has outside Node. The e2e workflow installs the
distribution's PostgreSQL client on the runner, which is at least as new as the stack's
PostgreSQL 16. It also creates the data directory before Compose starts: a missing bind-mount source
is created by the daemon as root, and neither the containers nor the runner — both uid 1001 — could
then write an archive into it. A host without `pg_dump` skips both specs with a reason.

Asserting the backup settings page showed its cadence help claiming nothing ran backups
automatically, which has not been true since the nightly schedule shipped; it now describes the
schedule.

## Evidence

- `vitest.config.ts` (the threshold's enforcement note), `.github/workflows/ci.yml` (unit-tests job)
- `features/invoices/services/__tests__/invoiceDiscount.test.ts`,
  `features/creditNotes/services/__tests__/creditNoteDiscount.test.ts`,
  `features/proposals/services/__tests__/proposalRenderData.test.ts`,
  `features/projects/services/__tests__/toProjectFormData.test.ts`,
  `features/settings/payment/services/__tests__/iban.test.ts`
- `features/templates/services/__tests__/normalizeBlocksLegacy.test.ts`,
  `features/templates/services/__tests__/templateEditorData.test.ts`,
  `features/templates/services/__tests__/renderContext.test.ts`,
  `features/templates/services/__tests__/renderTemplateText.test.ts`,
  `features/templates/services/__tests__/renderTemplate.test.ts`
- `lib/i18n/__tests__/icuMessages.test.ts`, `package.json` (`intl-messageformat`), `.fallowrc.json`
  (`ignoreDependencies`)
- `scripts/host/__tests__/upgrade.test.ts`, `scripts/host/upgrade.sh`'s `instance_changed`
- `tests/e2e/auth.spec.ts`, `tests/e2e/support/ownerProvisioning.ts`,
  `tests/e2e/support/ownerSession.ts`
- `tests/e2e/backupSettings.spec.ts`, `tests/e2e/scheduledBackup.spec.ts`,
  `tests/e2e/support/backupFixture.ts`, `playwright.config.ts` (`flows-backup` project)
- `.github/workflows/e2e.yml` (PostgreSQL client, data directory)
- `lib/i18n/locales/en.tsx`'s `settings.backup.cadenceHelp`, `CHANGELOG.md` (Unreleased, Fixed)

## Verification

Measured first, on a twelve-core Windows host. `pnpm test:coverage` on the unmodified suite passed
all 2,513 tests in 283 files and exited 1 on the services branch threshold: 1,825 of 2,113 branches,
86.37%.

After the change:

- `pnpm test:coverage` twice: 2,582 tests in 293 files, no failure, exit 0. Services branch coverage
  92.76%, 1,960 of 2,113; statements, functions and lines were already above the gate.
- The ICU test, with `activity.feed.pagination`'s closing brace deleted, failed naming
  `en activity.feed.pagination` and `EXPECT_ARGUMENT_CLOSING_BRACE`; with the file restored it
  passed. Every value in the English locale parses.
- `scripts/host/__tests__/upgrade.test.ts`: nine tests pass, each driving the real script through
  `bash`. ShellCheck (the stable image) reports nothing on `scripts/host/*.sh`.
- `pnpm test:integration`: 882 tests in 93 files, no failure, 770s.
- `pnpm vitest run tests/docs` passes.
- `pnpm typecheck` passes. `pnpm lint` reports no errors and only its two standing `max-lines`
  warnings in `features/templates`; the new template tests went into sibling files rather than add
  two more. react-doctor reports no error and none of its 26 standing warnings on a file this change
  touched. fallow reports no finding on a file this change touched once `intl-messageformat` is
  declared as the runtime dependency it is, and still exits 1 on its standing advisory backlog.
- `pnpm build` passes, and `pnpm test:e2e` against the production build on the development stack
  passed 26 with 3 skipped, each for its stated reason: flow 1, because that instance already has an
  owner, and both backup flows, because that host has no `pg_dump`.
- The E2E workflow reproduced locally — its Compose files under an isolated project with the ports
  remapped, the app and worker images built from this change, an empty instance, and the Playwright
  step's environment — passed 29 of 29 with nothing skipped: flow 1 registered the owner, enrolled
  TOTP through the wizard and acknowledged the recovery codes; both backup flows ran. The audit
  trail afterwards held exactly one `cli/backup` and one `worker/backup` completion, and the backups
  directory held no archive, both having been removed by the specs. A second run passed 28, flow 1
  skipping correctly on an instance that now had an owner.
- With the stack's own worker container stopped, so that only the spawned worker consumed the queue,
  the schedule flow passed; with `isBackupDue` forced to answer true it failed on the second
  archive, and passed again restored.

Not covered: the reproduction ran on Docker Desktop, where the Playwright host is Windows and has no
PostgreSQL client, so `pg_dump` there was a shim running the stack database container's own
`pg_dump` 16.15 in place of the runner's; and a Windows bind mount is writable whatever its owner,
so the data-directory ownership the workflow now fixes is reasoned from how the daemon creates a
missing mount source rather than observed. Neither workflow change has run on a GitHub runner, since
nothing was pushed. The `component-reviewer` agent the stage calls for does not exist in this
environment, so no such review ran.

Found and left alone, because it lies outside the tests this change adds: on Windows,
`scripts/core/backup/databaseDump.ts` hands `pg_dump` its arguments through a shell, the call shape
for which Node 24 prints deprecation warning DEP0190 on every backup a Windows host runs.

## Known gaps

None.
