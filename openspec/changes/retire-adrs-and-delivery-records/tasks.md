# retire-adrs-and-delivery-records — tasks

Each task is one commit whose body contains `Change: retire-adrs-and-delivery-records, task <n>`.
Tick the box in the same commit. A ticked box is a claim; `next-step` checks it against `git log`.

Shared definitions for every task:

- `CITE` is the citation pattern, used with `git grep -nP`:
  `'\bADRs?\b|ADR-?\d{4}|\badr/|[Dd]elivery records?|docs/delivery|[Dd]ecision [Rr]ecords?'`. Until
  task 9, the deleted folders and this change folder are excluded with
  `':!docs/architecture/adr' ':!docs/delivery' ':!openspec/changes/retire-adrs-and-delivery-records'`.
- Present-tense check, on every file the task touches:
  `git grep -niE 'ADR|delivery record|migrat|formerly|legacy|previously|no longer|used to|replaces|superseded|evolution' -- <touched files>`.
  Every hit is deleted or, when it describes present behaviour (for example a database migration),
  justified in the commit body.
- Comment-only tasks (5-8): `git diff --cached -U0` shows only comment lines changed; the reviewer
  confirms it. A citation is replaced by the principle or rule name when the comment still needs a
  reason, and dropped when it was the comment's only content (`.agents/rules/comments.md`).
- Gate per commit: `pnpm lint`, `pnpm typecheck`, `pnpm exec vitest run tests/docs`,
  `pnpm exec prettier --check <staged files>`; for a Markdown-only commit the `git-commit` reduced
  gate applies.

- [x] 1. Guidance describes the present
  - Do: remove every mention of migrating from, back-filling from, or the existence of decision or
    delivery records in `openspec/README.md`, `.agents/skills/write-spec/SKILL.md` (sources of
    claims are the code and its tests; the description loses "migrating") and its wrapper
    `.claude/skills/write-spec/SKILL.md`, and `docs/README.md` (drop the two routing rows and the
    paragraph about kinds of document; keep a present-tense sentence about runbooks and deployment
    guides if needed). In `AGENTS.md`: delete owner decision 4 and renumber; drop the records from
    the `docs/` line of the directory map; add to the working principles one sentence: repository
    files describe the present state, and history lives in git.
  - Done when: none of these files mentions the records, migration of documentation, or a former
    state; always-loaded bytes (`CLAUDE.md` + `AGENTS.md`, 9,748 before) did not grow.
  - Verify:
    `! git grep -nP "$CITE|until migrated|migrating|back-fill" -- openspec/README.md .agents/skills/write-spec .claude/skills/write-spec docs/README.md AGENTS.md && pnpm exec vitest run tests/docs`

- [x] 2. The spec format describes the present only
  - Do: remove the Evolution section from `openspec/templates/spec.md` and from `SPEC_SECTIONS` in
    `tests/docs/openspec.test.ts`; remove the Evolution and `Superseded by` wording from
    `openspec/README.md` ("History without dates" becomes: a decision that no longer holds is edited
    or deleted in place; history is `git log -- <spec>` and the `Change:` lines; "Closing a change"
    loses the Evolution line), from `.agents/skills/write-spec/SKILL.md` and
    `.agents/skills/finish-change/SKILL.md` (step 3 appends nothing), and from the `description`
    frontmatter of both and of their `.claude/skills/` wrappers.
  - Done when: the template passes the test; a scratch copy of the template with any one required
    section removed fails it.
  - Verify:
    `! git grep -niE 'evolution|superseded' -- openspec .agents/skills .claude/skills tests/docs/openspec.test.ts ':!openspec/changes' && pnpm exec vitest run tests/docs/openspec.test.ts`,
    then the scratch-copy check: for each section, remove it from a copy of the template, point the
    template test at the copy, and see it fail (do not commit the copy).

- [x] 3. Citations removed from the reference documents
  - Do: in `docs/architecture/ARCHITECTURE.md`, `docs/architecture/SCHEMA.md`,
    `docs/architecture/operations/CLI-CONTRACT.md`, `docs/architecture/specs/BACKUP-ARCHIVE.md`,
    `docs/operations/*.md` and `docs/deploy/*.md`, remove citations mechanically with a script you
    review: a parenthetical or link that only cites a record is deleted; a sentence that depends on
    the citation is minimally rephrased to stand alone. Then read every rephrased sentence. Do not
    improve, shorten or restructure the prose. Leave for task 9 the `ARCHITECTURE.md` section that
    indexes the records, its table-of-contents line and the opening note that links to it (the
    record test reads that index until then).
  - Done when: the only citations left in `docs/` outside the deleted folders are those three
    places; `tests/docs/schema.test.ts` and `tests/docs/demoSeeding.test.ts` pass.
  - Verify: `git grep -cP "$CITE" -- docs ':!docs/architecture/adr' ':!docs/delivery'` lists
    `ARCHITECTURE.md` only, and every remaining hit is inside the index section, its
    table-of-contents line or the opening note; `pnpm exec vitest run tests/docs`.

- [x] 4. Citations removed from rules and contributor-facing text
  - Do: `.agents/rules/{architecture,errors,money-and-dates}.md` keep the principle and drop the
    citation; `.agents/rules/comments.md` stops naming records among the standing documents and its
    example cites a rule or source symbol instead. `README.md` points to the runbook, command
    contract or rule that carries each fact and its Architecture list loses the records line;
    `.github/CONTRIBUTING.md` states the present flow (changes through `openspec/`, specs, rules,
    tests) instead of the record process and the per-decision reading; `.github/ISSUE_TEMPLATE/*`
    and `.github/PULL_REQUEST_TEMPLATE.md` lose the record mentions; the "History before this file"
    text of `CHANGELOG.md` points at `README.md` and `git log` only. No released entry changes.
  - Done when: none of these files cites a record; the rule edits are citation-only.
  - Verify:
    `! git grep -nP "$CITE" -- .agents README.md CHANGELOG.md .github/CONTRIBUTING.md .github/ISSUE_TEMPLATE .github/PULL_REQUEST_TEMPLATE.md && pnpm exec vitest run tests/docs`

- [x] 5. Comment citations removed in `features/`
  - Do: comment-only edits in every `features/**` file that cites a record.
  - Done when: `features/` has no citation; the diff is comment-only.
  - Verify: `! git grep -nP "$CITE" -- features && pnpm lint && pnpm typecheck`

- [x] 6. Comment citations removed in `lib/`, `hooks/`, `app/` and `proxy.ts`
  - Do: comment-only edits.
  - Done when: these paths have no citation; the diff is comment-only.
  - Verify: `! git grep -nP "$CITE" -- lib hooks app proxy.ts && pnpm lint && pnpm typecheck`

- [x] 7. Comment citations removed in `scripts/`, `database/`, `drizzle/` and `tests/`
  - Do: comment-only edits, except the sample path in
    `scripts/core/release/__tests__/changelogGate.test.ts`, which becomes an existing documentation
    path with the same tested behaviour. In `drizzle/migrations/*.sql` only comment lines change
    (the migrator tracks applied migrations by `created_at`; see the proposal). Leave
    `tests/docs/adr.test.ts` and `tests/docs/delivery.test.ts` for task 9.
  - Done when: these paths have no citation outside the two record tests; every diff line is a
    comment except the fixture string.
  - Verify:
    `! git grep -nP "$CITE" -- scripts database drizzle tests ':!tests/docs/adr.test.ts' ':!tests/docs/delivery.test.ts' && pnpm lint && pnpm typecheck && pnpm exec vitest run scripts/core/release tests/docs`

- [ ] 8. Comment citations removed in configuration files
  - Do: comment-only edits in `eslint.config.mjs`, `Dockerfile`, `docker-compose.yml`,
    `docker-compose.dev.yml`, `.env.example`, `doctor.config.ts`, `deploy/caddy/Caddyfile` and
    `.github/workflows/docker.yml`. No rule, setting or value changes.
  - Done when: the repository has no citation outside the record folders, the two record tests, the
    three `ARCHITECTURE.md` places kept for task 9, and this change folder.
  - Verify:
    `! git grep -nP "$CITE" -- . ':!docs' ':!tests/docs/adr.test.ts' ':!tests/docs/delivery.test.ts' ':!openspec/changes/retire-adrs-and-delivery-records' && pnpm lint`

- [ ] 9. Delete the records and their tests
  - Do:
    `git rm -r -- docs/architecture/adr docs/delivery tests/docs/adr.test.ts tests/docs/delivery.test.ts`;
    delete the `ARCHITECTURE.md` index section, its table-of-contents line and the opening note that
    links to it; remove any helper that only served the deleted tests.
  - Done when: no file outside this change folder mentions a deleted path, record number or record
    title.
  - Verify: `! git grep -nP "$CITE" -- . ':!openspec/changes/retire-adrs-and-delivery-records'`;
    then, for every path in
    `git ls-tree -r --name-only 73c1860 -- docs/architecture/adr docs/delivery`, grep the repository
    for its basename and its title (first heading) and remove or justify each hit;
    `pnpm exec vitest run tests/docs`.

- [ ] 10. Relative links resolve
  - Do: add `tests/docs/links.test.ts`: every relative Markdown link in `docs/**/*.md`,
    `openspec/**/*.md`, `AGENTS.md`, `CLAUDE.md`, `.agents/rules/*.md` and `.claude/rules/*.md`
    resolves to an existing file or directory (anchors ignored, external links skipped). Keep it
    small and general; do not duplicate the backticked-path check in `agentFiles.test.ts`. Fix any
    link it finds broken.
  - Done when: the test passes and fails when a broken link is added to a scratch copy.
  - Verify: `pnpm exec vitest run tests/docs/links.test.ts` (fails before: the file does not exist).
