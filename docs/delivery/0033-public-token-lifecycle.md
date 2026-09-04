# DR-0033: Public token lifecycle

- **Status:** Shipped
- **Date:** 2026-09-04
- **Verdict:** Complete with known gaps
- **Decisions:** ADR-0029
- **Supersedes:** —

## What

Every public bearer token in Remit — the invoice, proposal and contract link, and the client portal
— is minted by one function, and can be rotated or revoked by the owner from the surface the record
already lives on, with an audit entry that never records the credential.

## Why

Three of the four tokens were minted once at document creation, by five copies of
`randomBytes(32).toString("base64url")`, and could never be changed. The fourth,
`clients.portal_token`, had a column and a partial unique index and no writer anywhere: the client
portal could not be enabled because nothing minted its token.

A link forwarded to the wrong address therefore stayed live for the life of the document, and the
only remedy was deleting the document behind it. That is the gap this record closes; the security
architecture had described it as closed, which DR-0032 removed from the documents rather than
believed.

## Scope

Included: one CSPRNG minter and the migration of every writer onto it, including the demo seeder and
the three test factories; nullable token columns and the migration that relaxes them; rotate and
revoke for all four holders, owner-gated; the owner-facing controls on the invoice, proposal and
contract detail pages and the client workspace; two new UI primitives the four surfaces share; the
audit vocabulary; and the passages in `README.md`, `ARCHITECTURE.md`, `SCHEMA.md` and
`CLI-CONTRACT.md` that are now true.

Excluded, deliberately: the `/s/[token]` route itself. This delivery makes the portal token exist,
mintable and withdrawable; the surface that reads it is its own capability, and building both at
once would have meant designing a public page inside a security change. Also excluded: any change to
`matchesPublicToken`, whose one constant-time comparison is settled; and any second lifecycle for
the client portal, which uses the same two mutations as the documents under different labels.

## How

The stage's real question was what revocation _means_ on three columns that were `NOT NULL`, and the
answer — clear the column, so a revoked row is not found by the token lookup at all — is recorded
with its rejected alternatives in ADR-0029. Two consequences of that choice are worth stating here
because they are what the code shows rather than argues.

The first is that indistinguishability stopped being a rule to follow. Each public read already
compares against a full-length decoy when the row lookup misses, so an absent token puts a revoked
document on exactly the path an unknown token takes; there is no revoked branch to forget. A
`revoked_at` column would have needed that branch in every public read, and this repository's
history is a list of exactly that failure.

The second is that `text | null` made the compiler enumerate the callers. Every site that builds a
URL from a token had to say what it does when there is none, which is how the rule that a background
job never re-mints got written down at all: the two document email jobs and the invoice reminder job
skip and log, rather than quietly issuing a replacement link and undoing the owner's withdrawal.

Refusing both actions on a document that was never issued is what keeps the send paths honest: a
draft always carries a token, so `sendInvoice` and its siblings needed no new guard. The refusal
does not extend to a signed, paid or accepted document — the token is not document content.

The three document features each got a `publicLink.ts` module rather than more lines in
`mutations.ts`; the client pair stayed in `features/clients/mutations.ts`, whose length gave no
reason to split it. `revalidateProposalPaths` and `revalidateContractPaths` moved to their feature's
`mutationContext.ts`, where the invoice equivalent already lived.

## Evidence

- Minter and comparison: `lib/publicToken.ts`; unit tests in `lib/__tests__/publicToken.test.ts`.
- Writers now on the minter: `features/invoices/mutations.ts`, `features/invoices/conversion.ts`,
  `features/invoices/systemWrites.ts`, `features/proposals/mutations.ts`,
  `features/contracts/mutations.ts` (two sites), `scripts/core/seedDemo/plan.ts`, and
  `tests/factories/{invoices,proposals,contracts}.ts`.
- Schema: `database/schema/{invoices,proposals,contracts}.ts`;
  `drizzle/migrations/0003_revocable_public_tokens.sql`.
- Mutations: `features/{invoices,proposals,contracts}/publicLink.ts`; `rotateClientPortalLink` /
  `revokeClientPortalLink` and the portal clearing inside `softDeleteClient` in
  `features/clients/mutations.ts`.
- Gates: `require{Invoice,Proposal,Contract}PublicLink` and `requireClientPortalLink` in each
  feature's `mutationContext.ts`, registered in `doctor.config.ts`.
- Read models: `publicPath` and `publicLinkState` in
  `features/{invoices,proposals,contracts}/queries.ts`; `portalPath` in
  `features/clients/queries.ts`.
- Null-token consumers: `features/{invoices,proposals,contracts}/emailJob.ts` and
  `getReminderTarget` in `features/invoices/jobs.ts`.
- Surfaces: `Invoice/Proposal/ContractPublicLinkCard` beside each detail page, `ClientPortalCard` in
  `features/clients/components/ClientWorkspace/`, and the `CopyLinkField` and `ConfirmDialog`
  primitives in `components/ui/`.
- Documentation: ARCHITECTURE.md's public-token bullets and audit capture list, SCHEMA.md's four
  token rows, README's public-documents and security passages, CLI-CONTRACT.md's seeding effects,
  and ADR-0029.

## Verification

`pnpm typecheck`, `pnpm lint` (zero errors; the only warnings are the two pre-existing `max-lines`
ones in `features/templates/`), `pnpm test` (2012 tests), `pnpm test:integration` (663 tests) and
`pnpm build` all pass. `pnpm database:generate` produces the one migration above and reports no
further schema changes afterwards.

The security property has a test per token holder in
`features/{invoices,proposals,contracts}/__tests__/publicLink.integration.test.ts`: a rotated-away
token, a revoked token and a token that never existed all return the same `null`, and each still
spends one constant-time compare against a full-length value, so no branch tells them apart. The
same files assert that rotation invalidates the old URL and the new one resolves, that a role below
owner is refused with the token left in place, that a never-issued document refuses both actions,
and that no `audit_logs` row contains either token.
`features/clients/__tests__/portalLink.integration.test.ts` covers the portal's opt-in lifecycle and
its interaction with soft delete. The four cards have component tests covering their three states,
the confirmation copy, and the error path.

react-doctor and fallow were run against this branch and against `HEAD` in a clean worktree:
react-doctor is unchanged (88/100, 29 warnings, none in files this delivery wrote), fallow's
dead-code count fell from 81 to 78 and its health count is identical at 186 once both runs see the
same coverage data. Its clone-group count rose from 307 to 318, which is the four mirrored cards and
three mirrored modules, kept in lock-step on purpose.

One rotation was also driven through the running application against demo data: `/i/[token]`
rendered the invoice, the link was rotated in place, the old URL then rendered the indivisible
"unavailable" surface with `X-Robots-Tag: noindex, nofollow` and the new URL rendered the invoice
again.

Not covered: the revoke transition was not exercised through the running application, because the
local development database is still on `0002` and refuses a null token — the migration was applied
to the test database only. Nothing drove the controls with the keyboard alone outside the component
tests, no run inspected `audit_logs` through the UI, and the `/s/[token]` portal has no reader yet,
so the portal token's only exercise is its mutation path.

## Known gaps

- A restored client comes back without a portal, because soft delete clears the token. Nothing in
  the product says so yet; the restore surface does not exist.
- The demo seeder is no longer byte-identical across runs — its tokens differ every time.
  `CLI-CONTRACT.md` records the exception and `scripts/core/seedDemo/__tests__/seedDemo.test.ts`
  compares plans with the token fields stripped, but a reader of `README.md`'s "deterministic
  demo-data seeding" will not learn it there.
- Sending a document whose link was revoked is refused rather than re-issued. The message says what
  to do; it is one more step than a single "send anyway" would be.
- `features/clients/queries.ts` now emits `portalPath` for a route that does not exist, so a copied
  portal link 404s until the `/s/[token]` surface ships.
