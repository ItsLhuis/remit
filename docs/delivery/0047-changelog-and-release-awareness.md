# DR-0047 — Changelog and release awareness

- **Status:** Shipped
- **Date:** 2026-09-15
- **Verdict:** Complete with known gaps
- **Decisions:** ADR-0018, ADR-0020
- **Supersedes:** —

## What

A hand-written `CHANGELOG.md` that the release commands keep in step with the version, and a
`/settings/system` version strip that points an owner at it and at the upgrade runbook, with no
update check.

## Why

ARCHITECTURE.md once said that the changelog "is published in the repository and surfaced in
`/settings/system` when an update is available". Neither half existed: the repository had no
changelog, and the page rendered the running version with nothing beside it. The documentation
reconciliation (DR-0032) removed the sentence because it was untrue. An operator could learn that a
release existed only by visiting the repository on purpose, and could not learn what a release
changed, including a migration that runs the moment its container starts.

## Scope

Included: `CHANGELOG.md` in Keep a Changelog form with an operator-facing entry vocabulary; the
version bump commands promoting its Unreleased section and refusing an empty one; a check in the
image workflow that a published `v*` tag has a dated changelog section; changelog and upgrade
runbook links on `/settings/system`; tests for the version comparison, the promotion and the links;
and the documentation of the result.

Excluded, with reasons:

- **An update check of any kind.** ADR-0018 forbids outbound traffic the operator has not
  configured, no tagged release or GitHub release has ever been published for a check to compare
  against, and an opt-in check would add a setting, a cache, a schedule and a privacy surface to
  answer a question the operator can answer by reading the changelog.
- **Reconstructed history.** Remit has never published a tagged release, and a history rebuilt from
  commit subjects would be a document nobody verified.
- **A changelog requirement on every pull request.** Most changes are invisible to an operator, and
  a gate that demands an entry for each would fill the file with noise.
- **A self-service upgrade action.** ADR-0020 keeps upgrade orchestration on the host.

## How

The changelog is written by hand for the operator, not generated from commits. Commitlint already
enforces Conventional Commits, but a commit log answers how the code changed, while the reader of
this file is deciding whether to upgrade. Each release opens with **Upgrade notes**, a heading added
in front of Keep a Changelog's six, which names every migration applied on container start and any
action required. A release with none says so in one line, so the absence is stated rather than
implied. The file's own header defines this vocabulary.

The release act stays `pnpm version:*`. `scripts/bump-version.ts` computes both the new
`package.json` and the promoted changelog before writing either, so a refused release leaves both
files as they were. The promotion is the pure `releaseChangelog` in
`scripts/core/release/changelog.ts`. It refuses a missing Unreleased heading, an Unreleased section
with no list entry, and a version that already has a section. It stamps the UTC calendar day. The
increment moved into `scripts/core/utils/semver.ts` as `incrementSemver` next to the comparator
restore already uses, replacing the script's own `split(".").map(Number)`. That parser turned a
prerelease into `NaN`, and the new function refuses a prerelease outright.

A tag pushed by hand bypasses the script, so the image workflow (`.github/workflows/docker.yml`)
checks two things before it builds a `v*` tag: that `package.json` matches the tag, and that
`CHANGELOG.md` has a dated section for that version. The section heading is matched as a literal
prefix. A first draft used a regular expression, and its unescaped dots let `1.0.0` pass on a
`## [1a0a0]` heading. Pull requests get no changelog gate, because most changes are invisible to an
operator.

No update check was built. Of the three shapes weighed, an opt-in check would have needed a setting,
a cache, a schedule, a Hosted exception and an ADR. It would also compare against an endpoint that
holds nothing, since the repository has no tag and no GitHub release. A passive signal from the
upgrade script would report only at the moment an operator had already decided to upgrade. The page
therefore states that Remit does not check for updates and puts the changelog and the upgrade
runbook one click away. `features/health/services/releaseLinks.ts` derives both links from
`package.json`'s `repository.url`, so a fork links its own files. It points at `main` rather than at
the running version's tag, because the operator needs the releases after theirs. A repository URL
that is not GitHub over HTTPS yields no links, and the footer is not rendered.

## Evidence

- Changelog: `CHANGELOG.md`, whose header states the entry vocabulary.
- Release path: `scripts/bump-version.ts`; `scripts/core/release/changelog.ts`'s `releaseChangelog`;
  `scripts/core/utils/semver.ts`'s `incrementSemver`, beside the existing `compareSemver`.
- Tag gate: the `Verify release changelog` step in `.github/workflows/docker.yml`.
- Surface: `features/health/services/releaseLinks.ts`, `features/health/types.ts`'s `ReleaseLinks`,
  `features/health/queries.ts`'s `getSystemInfo`,
  `features/health/components/HealthSettingsPage/SystemInfoStrip.tsx`; the
  `health.systemInfo.versionHint`, `changelogLink` and `upgradeGuideLink` keys in
  `lib/i18n/types.ts` and `lib/i18n/locales/en.tsx`.
- Unit tests: `scripts/core/utils/__tests__/semver.test.ts` (equal, ahead, behind, prerelease, build
  metadata, malformed input, each increment, prerelease refusal);
  `scripts/core/release/__tests__/changelog.test.ts` (promotion, earlier releases untouched, empty,
  missing heading, existing version, CRLF input);
  `features/health/services/__tests__/releaseLinks.test.ts`.
- Documents: `README.md`'s Self-hosting list; ARCHITECTURE.md sections 14 (Health and status,
  Updates); `docs/operations/UPGRADE.md`'s Before You Upgrade; `AGENTS.md`'s command table.

## Verification

`pnpm typecheck` passes. `pnpm lint` reports no errors; its two warnings are `max-lines` in
`features/templates` files this change does not touch. `pnpm format:check` is clean, including
`CHANGELOG.md`. `pnpm test` passed 2,380 tests in 267 files. An earlier run made while lint and
react-doctor were running concurrently timed out five tests in four files, and the two files whose
names that run's output kept passed on their own. `pnpm test:integration` passed 840 tests with 4
skipped; `features/proposals/__tests__/mutations.integration.test.ts` hit a thirty-second test
timeout and `lib/jobs/__tests__/queueRoundTrip.integration.test.ts` a ten-second `beforeAll` timeout
under full-suite load, and both files passed, 26 tests, when run alone. `pnpm build` succeeds, lists
`/settings/system`, and builds the scripts. react-doctor reports nothing on the touched files.
Fallow's only entry for a touched file is `bumpVersion`'s complexity, which is unchanged from before
at a cyclomatic complexity of 5.

The release path was run for real: `pnpm version:patch` moved `package.json` to `1.0.1` and turned
Unreleased into a dated `1.0.1` section, and both files stayed Prettier-clean. An immediate second
bump refused on the now-empty section and wrote nothing. Both files were then restored byte for
byte. The tag gate's own step text was extracted from the workflow and run against copies of the
files. It failed on a tag that did not match `package.json`, on a version with only an Unreleased
section, on a `## [1a0a0]` heading, and on an undated heading, and passed once a dated section was
present.

Not verified by hand: `/settings/system` was not opened in a browser, so the footer links and a
keyboard-only reading of the strip were checked only by reading the component, which uses the
`Button` and `CardFooter` primitives and conveys nothing by colour. The workflow step has not run on
GitHub, because no `v*` tag has been pushed. The `component-reviewer` agent is not available in this
environment and was not run.

## Known gaps

- **No release has been published.** `package.json` is still `1.0.0`, no `v*` tag exists, and the
  image workflow's changelog gate has never run on GitHub.
- **Nothing tells an operator a release exists** unless they compare the running version against the
  changelog themselves. That is the chosen position, not an omission.
- **A pull request that changes behaviour without an Unreleased entry is not caught**; the first
  point of enforcement is the version bump.
- **The links point at GitHub `main`**, so an instance with no route to github.com shows links that
  do not open, and a fork hosted elsewhere shows none.
- **The system page's links have no automated rendering test**, in line with the testing rules for a
  presentational component.
- **The two load-sensitive integration files still time out under full-suite load**, as DR-0045 and
  DR-0046 recorded.
