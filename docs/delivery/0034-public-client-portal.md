# DR-0034: Public client portal

- **Status:** Shipped
- **Date:** 2026-09-05
- **Verdict:** Complete with known gaps
- **Decisions:** ADR-0029, ADR-0030
- **Supersedes:** —

## What

`/s/[token]` is the read-only page a client opens with no account to see every document the business
has issued them and the state of their projects, behind the revocable portal token.

## Why

`clients.portal_token` had a column, a partial unique index and, since DR-0033, a minter and a
revoker — and nothing that read it. The route the architecture diagram, the schema and the README
had described since the beginning did not exist, so the one capability a freelancer could not give a
client was the one the documents promised most plainly: a single link that answers "what do I owe
you, and what have you sent me" without an account and without another email thread.

## Scope

Included: one anonymous read on `features/clients`, the `/s/[token]` route and its error boundary,
the portal surface and its unavailable twin, a pure service that summarises what is outstanding per
currency, the exposure decision that says field by field what the portal shows and refuses, and the
passages in `README.md`, `ARCHITECTURE.md` and `SCHEMA.md` that are now true.

Excluded, deliberately: view-tracking columns on `clients` (Part 4's decision is recorded in **How**
— the portal is a standing door, not a document, and has no send event a first view could be read
against); any write path at all, so the route is read-only in the strongest sense; attachments, time
entries, expenses, tasks and client contacts, which stay invisible to every public token route
(ADR-0028); and any change to how the portal token is minted, rotated or revoked, which is DR-0033's
and is consumed here unchanged.

## How

`getClientPortal` in `features/clients/publicQueries.ts` is the whole read. It validates the dynamic
token, resolves it against `clients.portal_token` and compares with `matchesPublicToken` against a
43-character decoy when the lookup misses, then fans out across invoices, proposals, contracts,
projects and settings in one `Promise.all`, groups the credit notes of the invoices it found, and
maps each row through a `to<Model>` helper. Every unavailable case returns one indivisible `null`.

Three things in it are not obvious from the code:

The **exclusions are column selections, not omissions in a mapper**. Each `findMany` names the
columns it reads, so `clients.notes`, a project's budget and description, a payment's reference and
a credit note's reason are never fetched at all. A future field is therefore opt-in.

**A row links onward only when the document's own public route would still admit the caller.** The
invoice and proposal mappers restate what `getPublicInvoice` and `getPublicProposal` admit, so an
expired proposal, a proposal on an archived project and a document whose link was revoked all appear
as rows with no opener rather than as links to an "unavailable" page.

**Contracts carry no link and `contracts.public_token` is never read on this path.** Signing is the
only anonymous action in Remit with no second factor, and the portal link is the one a client is
expected to keep and forward. [ADR-0030](../architecture/adr/0030-client-portal-exposure.md) records
that and the rest of the exposure decision.

The route adds a second rate limit above the proxy's, 30 per IP per five minutes, keyed on the
address rather than on the token because enumeration moves to a fresh token on every attempt. A
tripped limit renders the same unavailable panel a bad token does and reads nothing.

`resolvePortalContractStatus` in `features/clients/services/portalStatement.ts` restates
`features/contracts/services/contractExpiry.ts` rather than importing it: `features/contracts`
reaches `features/clients/server` through its own mutations, so a value import of the contracts
barrel from this feature's server graph closes a dependency cycle. A test compares the two across
the whole status and window matrix.

## Evidence

- Read: `features/clients/publicQueries.ts`; exported from `features/clients/server.ts`.
- Route: `app/(public)/s/[token]/page.tsx` and its `error.tsx`. `proxy.ts`'s `isPublicTokenRoute`
  already admitted `/s/`, so the `X-Robots-Tag` header and the CSP's unconditional
  `frame-ancestors 'none'` needed no change.
- Pure service: `features/clients/services/portalStatement.ts`.
- Surface: `features/clients/components/PublicClientPortalPage/**` and
  `features/clients/components/PublicClientPortalUnavailable.tsx`.
- Schema: `clients.portal_token` unchanged; no migration.
- Tests: `features/clients/__tests__/publicPortal.integration.test.ts` (24),
  `features/clients/services/__tests__/portalStatement.test.ts` (5),
  `features/clients/components/PublicClientPortalPage/__tests__/PublicClientPortalPage.test.tsx`
  (9), `app/(public)/s/[token]/__tests__/publicClientPortalRoute.test.tsx` (8).
- Documents: `README.md` ("Client portal"), `docs/architecture/ARCHITECTURE.md` sections 4, 9 and
  12, `docs/architecture/SCHEMA.md` section 13, and ADR-0030.

## Verification

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:integration` and `pnpm build` pass;
react-doctor and fallow report nothing new against `doctor.config.ts` and `.fallowrc.json`.

The integration suite proves the properties that matter and that a reader cannot check by eye: an
unknown token, a malformed token, a revoked portal and an archived client all produce the identical
`null`; a decoy of real token length is compared on every miss; a portal token for one client
reaches no invoice, proposal, contract, project or credit note of another; the read model carries no
client id, project id, invoice id, portal token or contract token, and no `notes`; drafts, unissued
documents and archived rows are withheld; and the exclusion list is asserted as the exact key set of
the read model rather than field by field.

Not covered by an automated test: the rendered `<meta name="robots">` tag (the route test asserts
the `metadata.robots` object Next renders it from), the proxy's `X-Robots-Tag` on this path (covered
for public token routes as a class in `__tests__/proxy.test.ts`), and the layout at narrow widths,
which was checked by hand.

## Known gaps

- The freelancer cannot tell whether a client has ever opened their portal. Declined deliberately
  with the reasoning in ADR-0030; the per-document view counters still answer the send-time
  question.
- A contract awaiting signature is visible in the portal and not signable from it. If contract
  signing ever gains a second factor of the kind `/p/` has, that decision is worth revisiting.
- `resolvePortalContractStatus` duplicates a rule that lives in `features/contracts`. The pin test
  keeps them equal, but the underlying cycle — `features/contracts` reaching
  `features/clients/server` through its mutations — is still there and is what forced the copy.
- The portal lists every document a client has ever been sent, with no paging. A client with years
  of history gets a long page; nothing in the read bounds it.
- The portal's outstanding figure is credit-aware and `/i/[token]`'s is not: `getPublicInvoice`
  still computes `totalCents - amountPaidCents` and its page shows no credit notes at all, so a
  client who opens a credited invoice from the portal sees a larger amount there than the portal
  quoted. The portal is the correct one. Fixing the document route means giving it a credit-note
  read of its own, which belongs to that surface rather than to this delivery.
- The read honours `clients.locale` over the instance default, but nothing in the application writes
  that column: `toClientWriteValues` in `features/clients/mutations.ts` omits it and the client form
  has no field for it, so only rows the demo seeder wrote carry one. The behaviour is correct and,
  for a client created through the app, currently unreachable. Found here, pre-dates this delivery,
  and is left as it stands rather than widened into a form change.
