# Contributing to Remit

Remit's conventions are written down in detail already, and this file is a router to them rather
than a second copy. Anything it says twice will eventually disagree with itself.

## Before you write code

Read [`AGENTS.md`](../AGENTS.md) in the repository root. It is the entrypoint for both human and
agent contributors: the stack, the directory map, the hard rules, and the working principles.

The detailed conventions live in [`.agents/rules/`](../.agents/rules), one file per concern —
architecture, actions, queries, components, forms, hooks, types, imports, errors, security,
accessibility, i18n, testing, comments, money and dates, database, events, routes and code style.
Read the ones your change touches. `.agents/rules/code-style.md` names a canonical exemplar file for
every category; match it rather than the nearest neighbour.

For why the system is shaped the way it is, read
[`docs/architecture/ARCHITECTURE.md`](../docs/architecture/ARCHITECTURE.md). For a specific
decision, read its ADR. Neither is optional reading for a change that touches a boundary.

## Getting it running

```bash
pnpm install
pnpm dev:setup   # starts local services and applies migrations
pnpm dev
```

Node >= 24.11.1 < 25, pnpm 10.33.4. `.env.example` documents every environment variable with a safe
placeholder.

## Before you open a pull request

```bash
pnpm ci   # lint, typecheck, unit tests, production build
```

Run `pnpm test:integration` when your change touches a mutation, a query, a job or a script; it
needs the Dockerized test Postgres from `pnpm database:test:up`. Run `pnpm test:e2e` when it touches
a flow that crosses features.

`pnpm lint --fix` settles import order, spacing and type-import style. Do not hand-tune what the
formatter sets.

A few rules are worth stating here because they are easy to miss and are refused in review:

- Schema changes are generated with `pnpm database:generate`. Generated migration SQL is never
  edited by hand, and the migration history is never squashed.
- No `any`, no non-null assertions, no unvalidated input crossing a trust boundary, no plaintext
  secrets, no `TODO` or stub code.
- Every user-facing string goes through `t()`, and a new key is added to the `Translations` type and
  the English locale in the same commit.
- A comment explains a "why" the code cannot carry. `.agents/rules/comments.md` is stricter than
  most projects and explains why.

## Commits

Conventional Commits, enforced by commitlint: `feat(invoices): add late fee calculation`. Keep
commits atomic — one change per commit, so `git log` stays useful as the project's history.

## What gets recorded

When a change delivers a whole capability rather than an increment of one, it also writes a delivery
record. [`docs/delivery/README.md`](../docs/delivery/README.md) explains the format, when a record
opens, and when it seals.

## Reporting problems

Bugs go in an issue using the bug report template, and capability requests use the feature request
template. Questions belong in Discussions. **Security problems go in none of those** — see
[`SECURITY.md`](SECURITY.md).

Participation in all of these is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).
