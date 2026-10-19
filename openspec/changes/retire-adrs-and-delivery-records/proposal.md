# retire-adrs-and-delivery-records

## Product position

Remit's architecture decision records and delivery records were written after the code they describe
and repeatedly drifted from it. The owner decided they stop existing, with no migration: behaviour
is documented by the code, its tests, the lint rules, `AGENTS.md`, `.agents/rules/` and the living
specs in `openspec/specs/`. This change deletes both sets and every reference to them, and makes the
spec format describe the present only. Contributors and agents gain one source of truth that is
mechanically checked instead of three that disagree.

Recovery point: `HEAD` before the first deletion is `73c1860d289872ba3bcd33d9786c1bb9a68a5c2e`.
`git show 73c1860:docs/architecture/adr/README.md` and `git show 73c1860:docs/delivery/README.md`
list every deleted document.

## Scope

- In:
  - Delete `docs/architecture/adr/` (50 records and its index), `docs/delivery/` (61 records and its
    index), `tests/docs/adr.test.ts` and `tests/docs/delivery.test.ts`: 113 files, 752,543 bytes of
    `docs/` (1,178,642 bytes in 128 files before).
  - Remove every citation of them: 172 files, 418 occurrences outside the deleted folders (features
    83 files, lib 22, scripts 13, docs 11, database 11, root 10, `.github` 5, `.agents` 5, tests 4,
    drizzle 3, app 3, hooks 1, deploy 1).
  - Guidance text that describes migrating from those records, and `AGENTS.md` owner decision 4.
  - The spec format loses its Evolution section and the `Superseded by` marker.
  - A relative-link check for `docs/`, `openspec/`, `AGENTS.md` and the rule files.
- Out: every other document's content (`ARCHITECTURE.md`, `SCHEMA.md`, `CLI-CONTRACT.md`,
  `BACKUP-ARCHIVE.md`, runbooks, deployment guides lose only their citations; restructuring them is
  `restructure-reference-docs`), application behaviour, SQL statements, `openspec/specs/` (no spec
  is written), `tools/git-guard/`, `.claude/hooks/`, `.claude/settings*.json`, `.husky/`, `.codex/`,
  lint logic, released `CHANGELOG.md` entries.

## Capabilities touched

- none

## Spec impact

- Added: none
- Modified: none
- Removed: none
- Unchanged behaviour that must survive: the whole application. Outside `docs/`, `openspec/` and the
  guidance files, every diff is comment-only.

## Decisions

Taken by the owner before this proposal:

1. Both record sets are deleted in full, including their indexes and tests. No migration, redirect
   table, pointer stub or tag; git is the archive.
2. Present tense only. No touched file may mention the deleted records, migration, replacement or a
   former state. Such text is deleted, not reworded. `AGENTS.md` owner decision 4 is deleted and the
   list renumbered; the working principles gain one sentence: repository files describe the present
   state and history lives in git. The reviewer checks this in every task.
3. Citations are updated in the same change as the deletion. A comment that still needs a reason
   keeps the principle or the rule name; a citation that was the only content is dropped.
   Comment-only edits in application code and configuration files. In `drizzle/migrations/*.sql`
   only comment lines change: the installed `drizzle-orm` 0.45.1 migrator
   (`node_modules/drizzle-orm/pg-core/dialect.js`) decides what is applied by `created_at` alone and
   never compares the stored hash, and `scripts/core/backup/plan.ts` counts applied rows. Documents
   that `restructure-reference-docs` will rewrite lose citations mechanically, by a reviewed script
   plus a manual pass over every rephrased sentence. Contributor-facing text (`README.md`,
   `.github/CONTRIBUTING.md`, `.github/ISSUE_TEMPLATE/*`, `.github/PULL_REQUEST_TEMPLATE.md`, the
   non-entry text of `CHANGELOG.md`) states the present contribution flow. Test fixtures that use a
   deleted path as sample data switch to an existing path.
4. `openspec/` stays as built; no spec is written here.
5. Specs describe only the present: Status, Requirements, How it works, Decisions, Known limits. A
   decision that no longer holds is edited or deleted in place. A spec's history is
   `git log -- <spec>` and the `Change: <name>` lines of the commits that closed each change.

Found in the evidence and decided under decision 3: the `ARCHITECTURE.md` section that indexes the
records, and its table-of-contents line, consist only of citations and are deleted.

## Open questions

## Gate 1

approved
