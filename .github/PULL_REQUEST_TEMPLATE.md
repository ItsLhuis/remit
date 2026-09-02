## What this changes

<!-- One or two sentences. What does the reader of `git log` need to know? -->

## Why

<!-- The problem this solves. Link the issue if there is one: Closes #123 -->

## How to verify

<!-- The steps a reviewer follows to see it working, or the tests that prove it. -->

## Checks

<!-- `pnpm ci` runs lint, typecheck, the unit suite and a production build. -->

- [ ] `pnpm ci` passes
- [ ] `pnpm test:integration` passes, or the change touches no mutation, query, job or script
- [ ] `pnpm test:e2e` passes, or the change touches no flow that crosses features

## Repository rules this change respects

<!-- Delete any line that does not apply to this change. -->

- [ ] Schema changes were generated with `pnpm database:generate`; no migration SQL was hand-edited
      and the migration history was not squashed
- [ ] New user-facing strings go through `t()`, with the key added to both `lib/i18n/types.ts` and
      the English locale
- [ ] Writes go through a server action in `mutations.ts`; new API routes are public token routes,
      webhooks, health or metrics
- [ ] Business logic added to `services/` is pure — no framework, Drizzle, React or IO imports
- [ ] Input crossing a trust boundary is validated with Zod
- [ ] Comments added carry a "why" the code cannot, per `.agents/rules/comments.md`
- [ ] A delivery record was opened and sealed, if this change delivers a whole capability

## Notes for the reviewer

<!-- Anything you want looked at closely: a rejected alternative, a trade-off, a risk. -->
