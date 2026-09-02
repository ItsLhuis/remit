# DR-0031: Delivery records and the documentation surface

- **Status:** Shipped
- **Date:** 2026-09-01
- **Verdict:** Complete
- **Decisions:** —
- **Supersedes:** —

## What

`docs/delivery/` — the record of what was built, why, how and how it was verified — with its
conventions, a backfill covering everything shipped so far, a consistency test, and the community
health files the repository was missing.

## Why

Remit documented a great deal and remembered almost nothing. Twenty-eight ADRs recorded decisions,
`ARCHITECTURE.md` and `SCHEMA.md` recorded the present, and `docs/operations/` recorded procedures.
Nothing recorded what was delivered, when, why, or with what result.

The sharpest evidence was operational: `remit:backup`, `remit:restore` and
`remit:rotate-encryption-key` are substantial, security-critical surfaces. An ADR, a runbook and
code exist for each. No record said what was built, what it covers, how it was verified, or what was
knowingly left open. That information existed once and was gone.

The second gap was outward-facing. `.github/` held only workflows: a security-forward product
published no vulnerability disclosure path, and `docs/` had no entry point at all.

## Scope

Included: the record format and its lifecycle, the index, thirty backfilled records, a documentation
test, the delivery-record rule in `AGENTS.md`, a pointer from `ARCHITECTURE.md`, `SECURITY.md`,
`CONTRIBUTING.md`, a bug report issue template, and `docs/README.md` as a question router.

Also included: the documentation surface the repository was missing — a code of conduct, a
pull-request template, issue templates for bugs and features with the blank-issue routes they need,
a browsable index inside `docs/architecture/adr/`, and an installation runbook that takes a machine
with Docker on it to an instance the reader is logged into.

Also included: three corrections the backfill surfaced, each a place where a document or a
configuration disagreed with the code, and one missing test it found. Reading every capability
against its source is what finds these, and repairing them where the fix was small and certain is
part of the same pass rather than a separate errand — a record that reported them and left them
would have been a list of things to forget.

The surface is complete rather than sized to today's traffic. A document written only once it is
needed is written under pressure, by whoever is dealing with the thing that made it needed; a
repository with one maintainer and no contributors still benefits from having the answer ready
before the first contributor arrives, and costs nothing for it in the meantime. The one thing this
rules out is a document that describes something the code does not do, which is a different failure
and is governed by the present-tense rule.

Excluded, and both are exclusions of content rather than of documents:

- **A changed-file list or change log inside any record.** `git log` answers both, always
  accurately, and a Markdown copy of it is wrong within a month.
- **Per-platform deployment guides.** The installation runbook documents the Docker Compose path,
  which is the one that exists. A guide for a platform whose steps have never been run would be
  fiction, and the honest form of that content is a guide written against a tested deployment.

## How

The distinction the whole design rests on: an ADR records the choice, a record records the delivery,
`ARCHITECTURE.md` records the result. A record cites an ADR and never restates it.

A sealed record is immutable, like an ADR, and **Known gaps** in particular is never updated — it is
what was true on the day, and whoever closes a gap writes their own record. An editable record
becomes a second `ARCHITECTURE.md` that drifts from the first and loses the only property that makes
it worth keeping. Later work on a capability is a new record carrying `Supersedes:`, and the index
carries which is current.

An in-progress record is committed rather than held back, because it doubles as the resumption
marker for work that stopped mid-flight — the signal this repository previously had no way of
leaving.

The unit is the capability, not the work session and not the feature module. The backfill reflects
that: the template editor is one record rather than seven, proposals and their public acceptance are
one rather than three, and time tracking and expenses are one because they are the same capability
read from the product's side.

`Reconstructed: yes` marks a record built after the fact from commits, code, ADRs and runbooks.
Where reasoning could not be recovered, the record says so; no rationale was invented.

The test mechanises only what rots — index correspondence in both directions, contiguous numbering,
the required sections, the seal condition, `Supersedes` resolution, and the absence of gitignored
paths. Prose quality and whether a reference actually supports its claim are deliberately left to
review.

The three corrections, and why each was in scope rather than deferred:

- **`AGENTS.md` and `.agents/rules/auth.md` named auth modules that do not exist** — `lib/auth.ts`,
  `lib/authClient.ts`, `lib/session.ts` against the real `lib/auth/index.ts`, `lib/auth/client.ts`
  and `lib/auth/session.ts`. `auth.md`'s `paths` frontmatter was broken by the same drift:
  `lib/auth*.ts` matches no file under `lib/auth/`, so the rule attached to none of the modules it
  governs. These files instruct every future contributor, human or agent, and a rule that scopes
  itself to nothing fails silently.
- **`docs/architecture/operations/CLI-CONTRACT.md` sent an operator to `/settings/backup`**, a route
  that has never existed. It now names the `settings` row's `backup_s3_*` columns, which is where
  the credentials actually are. An operator following a runbook to a 404 is the failure this
  document exists to prevent.
- **`vitest.config.ts`'s two projects were not the exact complements its own comment requires.**
  `scripts/core/**/__tests__/**` was in the `node` project's `include` and missing from the
  `happy-dom` project's `exclude`, so nine operational-script test files ran twice — once under an
  environment they were never written for. The comment predicted this failure mode precisely and the
  configuration had drifted into it anyway.

The backfilled records that describe the first two as gaps are correct as written and were not
edited: a record states what was true on its delivery date, and both drifts were real on theirs.
This is the immutability rule doing its job — the correction is recorded here, in the record dated
the day it happened.

## Evidence

- `docs/delivery/README.md` — the conventions and the index
- `docs/delivery/0001-application-foundation.md` through `docs/delivery/0030-host-side-upgrade.md` —
  the backfill
- `tests/docs/delivery.test.ts`
- `AGENTS.md` — the delivery-record rule
- `docs/architecture/ARCHITECTURE.md` — the pointer beside the ADR index
- `docs/README.md`, `.github/SECURITY.md`, `.github/CONTRIBUTING.md`, `.github/CODE_OF_CONDUCT.md`,
  `.github/PULL_REQUEST_TEMPLATE.md`, `.github/ISSUE_TEMPLATE/bug_report.yml`,
  `feature_request.yml`, `config.yml`
- `docs/architecture/adr/README.md` and the two agreement tests added to `tests/docs/adr.test.ts`
- `docs/operations/INSTALL.md`
- `lib/utils/__tests__/request.test.ts` — a Tier 1 gap found during the backfill and closed
- `AGENTS.md`, `.agents/rules/auth.md` — the corrected `lib/auth/` paths and rule scoping
- `docs/architecture/operations/CLI-CONTRACT.md` — the corrected backup credential location
- `vitest.config.ts` — `scripts/core/**/__tests__/**` added to the `happy-dom` project's `exclude`

## Verification

`tests/docs/delivery.test.ts` passes and was observed failing three ways before it did: a record
absent from the index, a `Status: Shipped` record with an empty `Verification`, and a `Supersedes`
naming a record that does not exist. Each failure was confirmed, reverted, and the suite confirmed
green again. The first of the three fired unprompted during development, on the record that had not
yet been written.

Three records were read cold end to end as a stranger would — one product feature, one operational
surface, and one with no prompt behind it — to confirm each answers what, why, how and how it was
verified without another document open.

The ADR directory index is guarded rather than trusted: `tests/docs/adr.test.ts` gained two tests
asserting that it lists exactly the files on disk and that it agrees with the table in
`ARCHITECTURE.md`. Both were observed failing against a deliberately renamed link and passing again
once it was restored, so the second index cannot drift from the first — which is what makes having
two of them safe.

The `vitest.config.ts` correction was verified by its arithmetic rather than by assertion: a single
`scripts/core` test file reported two test files before the change and one after, and the whole
suite went from 231 files and 2049 tests to 222 and 2003 — exactly the nine duplicated files and
their forty-six duplicated tests, with nothing else lost.

`pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test` and `pnpm build` pass.

Not covered: whether an evidence reference genuinely supports the sentence above it. That is
review's job, and a test that tried would fail on rephrasing.

## Known gaps

The backfilled records are reconstructions. They carry what the repository can still support, and
several say plainly that the reasoning of the day was not recorded anywhere — most often the
specific scope of a decision that predates its ADR.

`app/api/upload/__tests__/upload-routes.test.ts` is flaky under the full suite and the cause is not
known. It failed in roughly two of ten full runs, including once **after** the `vitest.config.ts`
correction, so that correction is not its fix. It passes every time in isolation and every time when
run against only the file whose fixture value the first failure reported.

What is known: the two tests that fail are the first two of the `avatar upload route` block —
`returns a presigned upload URL for an allowed avatar file` and
`returns the presigned upload URL without rewriting its host` — and they fail together. Both resolve
`getSignedUrl` through a mock the block's `beforeEach` sets after `vi.clearAllMocks()`, and the
second layers a `mockResolvedValueOnce` on top of it. Every queued `…Once` in the file appears to be
consumed by the test that queues it, so a leaked queue entry does not explain it on inspection, and
no mechanism has been demonstrated.

It is recorded rather than closed because a guess is not a fix: a test that fails one run in five
will fail in CI, and the next person to touch this file should start from a reproduction rather than
from a theory.
