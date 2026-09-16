# DR-0049 — Install verification pass

- **Status:** Shipped
- **Date:** 2026-09-16
- **Verdict:** Complete with known gaps
- **Decisions:** ADR-0040
- **Supersedes:** —

## What

The three gates DR-0048 shipped without running — the Playwright suite, `react-doctor` and `fallow`,
and the interactive branch of `scripts/host/install.sh` — were run against that commit, and the
three defects they found were fixed.

## Why

[DR-0048](0048-one-command-install.md) changed the upload path, the storage path, the proxy matcher,
the environment schema and a browser hook, and then sealed with its Verification section naming what
it could not check: the Playwright suite was not run, the structural gates were declared
inapplicable because the stage expected to ship a shell script, and the interactive key
acknowledgement had no terminal to run on. A gate that is skipped is not a gate that passed, and the
branch that shows `REMIT_ENCRYPTION_KEY` once and writes `.env` only after the operator types its
last six characters back is the one place in the product where losing the answer is unrecoverable.

## Scope

Included: running each gate against the shipped commit, classifying every failure as a defect or an
environment artefact, fixing the defects in the code the gates named, and pinning the anonymous
storage route's key guard with tests.

Excluded, with reasons:

- **Findings outside the code DR-0048 touched.** `fallow` and `react-doctor` both report a backlog
  the repository already tracks at `warn`; this pass reports it and changes none of it.
- **`proxy.ts`'s cognitive complexity**, which `fallow` ranks second among its refactoring targets.
  DR-0048 only removed code from that file and added two matcher exclusions; the state machine's
  complexity predates it, and splitting it is a redesign rather than a verification.
- **Migrating the development database.** It is five migrations behind, which is an environment
  fact, not a repository one, and applying migrations to somebody's database is their decision.
- **Publishing the two images.** Still the operator's, exactly as DR-0048 left it.

## How

Three defects, each from a different gate.

`fallow` reported `@aws-sdk/s3-request-presigner` as a dependency nothing imports. ADR-0040 removed
the presigning client when browsers stopped talking to object storage directly, and the package was
left behind in `package.json`; nothing in the repository references it or `getSignedUrl`.

`fallow`'s health pass ranked `app/api/storage/[...key]/route.ts`'s `GET` as its highest change-risk
score in the changed code — complexity with no covering test. The route is anonymous and its key
pattern is the only thing between a caller and a key the upload route never minted, so the guard is
now pinned by `app/api/storage/__tests__/storage-route.test.ts`. The refusal cases were checked
against a route with the guard forced off: all five fail there and pass with it, so they assert the
guard rather than the shape of the response.

`react-doctor` reported an array scan inside the upload loop in `hooks/useFileUpload.ts`, which is
now a `Set` built once before the loop. It also reported the `await` inside that loop, which is
deliberate and argued at the loop itself — sequential uploads are what keep progress bars
meaningful, leave a mid-batch failure's earlier files stored, and let the caller's persistence for
one file finish before the next starts — so that one is a recorded reason in `doctor.config.ts`
beside the repository's other argued overrides, not a code change.

The interactive install needed a terminal the session did not have. `install.sh` gates its questions
on `[ -t 0 ]`, so a pipe cannot reach them; the run was driven through a Windows pseudo-console,
which Git Bash reports as a tty, with the answers typed into it and the key read back out of what
the installer printed.

## Evidence

- Dependency removal: `package.json`, `pnpm-lock.yaml`; `lib/storage/s3.ts` holds the only S3 client
  and presigns nothing.
- Storage route coverage: `app/api/storage/__tests__/storage-route.test.ts` (inline serving and its
  headers, opaque download for an unadmitted type, missing object, four refused key shapes, the
  length ceiling, and the logged server error).
- Upload hook: `hooks/useFileUpload.ts`'s `allowedMimeTypes`; `doctor.config.ts`'s
  `hooks/useFileUpload.ts` override for `react-doctor/async-await-in-loop`.
- Gates and configuration they ran against: `doctor.config.ts`, `.fallowrc.json`,
  `playwright.config.ts`.

## Verification

`pnpm lint` reports 0 errors and the same 2 `max-lines` warnings DR-0048 recorded in
`features/templates`. `pnpm typecheck` and `pnpm format:check` pass. `pnpm test` passes 2,414 tests
in 269 files, up from DR-0048's 2,404 in 268 by the ten new storage-route tests.

`pnpm test:e2e` was run against a production build of this commit (`pnpm build`, then the server on
port 3100) rather than `next dev`, because that is what the E2E workflow runs against and because
`next dev` compiles a route inside the first test that asks for it. It passes: 26 passed, 1 skipped,
exit 0. The skip is `auth.spec.ts`'s registration test, which skips itself on an instance that
already has an owner — the correct outcome on a development database, and the reason flow 1 of
`.agents/rules/testing.md` is only fully exercised on a fresh instance. No spec skipped for a
missing mail sink or an unreachable Redis; both were running, so the proposal and recurring-invoice
flows ran in full.

The suite was run three times before that result, and the first two runs' failures were all
environmental rather than regressions: a cold `next dev` compiling the editor route under six
parallel workers rendered `notFound()` for templates that existed, and at six workers on this host
`proposalToPaid.spec.ts` exceeded its budget waiting for a sheet to open. Each failing spec passes
alone, and the whole suite passes at two workers, which is what a two-core CI runner allocates.

`react-doctor` scored 89/100 with 0 errors and 28 warnings before the fixes and 91/100 with 26 after
them, and no remaining warning falls in the code DR-0048 changed. `fallow` reports no unused
dependency and no unused export in that code, and no longer ranks the storage route at all; it still
exits 1 on the repository's standing advisory backlog (dead code in vendored `components/ui`
primitives, clone groups, health thresholds), which is the state `.fallowrc.json` deliberately keeps
visible.

The interactive install was run in a scratch directory holding only `docker-compose.yml`, `deploy/`
and `scripts/host/`, against locally built images with `--no-pull --image-tag`. Answering the key
confirmation wrongly three times refused each answer, exited non-zero, and left no `.env`, no
container and no volume. Answering it correctly wrote `.env`, started the five containers, reached a
healthy app, and `/` answered 307 to `/register`, which answered 200; the key the installer printed
is byte-for-byte the key `.env` holds, compared without either value being printed. Re-running
interactively over that install said the answers passed as options are ignored, left `.env`
byte-identical by SHA-256, and started the stack again.

Not verified: the images are still unpublished, so nothing exercised a `docker compose pull`; no
publicly issued ACME certificate was obtained; macOS was not tested; and the E2E and Install
workflows have still never run on GitHub.

## Known gaps

- **On Windows through Git Bash the `.env` mode is not what the installer sets.** `chmod 600` is a
  no-op against NTFS there, so the file reads `0644`; its real protection is the directory's ACL.
  The Install workflow asserts `600` on Linux, which is the platform the deployment targets.
- **The development database this ran against is five migrations behind**, so `webhook_endpoints`
  does not exist and every webhook emission logs a failed query. The handlers catch it, which is why
  the suite is unaffected, but no spec covered a webhook delivery on this run.
- **The E2E suite is not safe at the default worker count on a large host.** Playwright allocates
  one worker per two cores, and above two workers the canvas specs and the longest flow starve each
  other against a single application process. Nothing pins a ceiling.
- **Flow 1 of `.agents/rules/testing.md` skips on any instance that already has an owner**, so a
  local run never covers registration. Only a fresh instance does.
