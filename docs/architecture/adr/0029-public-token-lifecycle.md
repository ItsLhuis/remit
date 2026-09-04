# ADR-0029: Public token lifecycle — one minter, and revocation as an absent token

- **Status:** Accepted
- **Date:** 2026-09-04

## Context

Remit hands anonymous visitors four bearer credentials: `invoices.public_token`,
`proposals.public_token`, `contracts.public_token` and `clients.portal_token`. The first three were
minted once, at document creation, by four copies of `randomBytes(32).toString("base64url")` spread
across five modules, and could never be changed afterwards. The fourth was minted by nothing at all
— the column and its partial unique index existed and no code path wrote a value.

ARCHITECTURE.md's security section stated that these tokens are "revocable and rotatable without
losing the underlying document", and listed "public token rotations" among the events that write an
`audit_logs` entry. Neither was true. A bearer credential the owner cannot withdraw is the one
security property this repository documented, promised to the person whose client data sits behind
it, and had not built: an invoice URL forwarded to the wrong address stayed live forever, and the
only remedy was deleting the document the link pointed at.

Three constraints shaped the answer. `matchesPublicToken` in `lib/publicToken.ts` is a settled
decision and its file-top comment explains why the module sits outside `lib/utils/index.ts`:
`node:crypto` has no browser build, and the barrel is imported by client-safe schema modules. The
proposal token has an invariant SCHEMA.md records — minted at draft creation, never surfaced to a
read model, URL, log or audit entry until `issued_at` is set. And every public read already answers
a miss with one indivisible "unavailable" result whose timing matches a hit, by comparing against a
full-length decoy when the row lookup returns nothing.

## Decision

**One minter.** `mintPublicToken` joins `matchesPublicToken` in `lib/publicToken.ts`: 32 CSPRNG
bytes, `base64url`, no arguments and no seed. All five previously inline call sites, the three test
factories and the demo seeder now go through it, so the entropy behind a token cannot differ between
the surface that issues it and the surface that reads it.

**Revocation is the absence of a token.** The three document columns become nullable — the client
portal column always was — and revoking clears the column. A token is live when the column holds a
value; there is no third state and no second column anywhere.

**The lifecycle is one pair of operations for all four holders.** `rotate` mints a fresh value over
whatever is there, including nothing; `revoke` clears it. Enabling a client portal is a rotation
from nothing and disabling it is a revocation, which is why the client surface labels the same two
mutations differently rather than having its own.

**Both are owner-only**, gated by `require<Entity>PublicLink` / `requireClientPortalLink` beside
each feature's existing gates. ARCHITECTURE.md's role table refuses `send` and `transmit` to
`accountant` and `assistant`, and changing what a recipient can still open is a transmit decision
rather than a draft edit — the same reasoning that already makes sending owner-only.

**A document that was never issued has no link to manage.** Both actions refuse a draft invoice, an
un-issued proposal and an un-issued contract. Their tokens exist but have never left the instance,
so there is no URL to withdraw and rotating one would invalidate nothing; the refusal is also what
lets the send paths keep assuming a draft still carries a token. A signed, terminated, paid or
accepted document is _not_ refused: the token is not document content, so the immutability its
status carries does not reach it.

**Audit records the fact, never the credential.** `<entity>.public_link.rotated` and `.revoked`,
plus `client.portal_link.*`, with `previousState: "live" | "none"` on a rotation. Neither the old
nor the new token appears in `metadata`, in a log line, or in a data export — the four columns were
already excluded from the export manifest as `bearerToken`.

**Soft-deleting a client clears its portal token.** The portal is a standing door into everything
Remit holds about that client, and leaving it open on a record the owner believes is gone is the
failure this ADR exists to prevent. A restored client comes back without a portal, and re-enabling
one is an explicit act.

**A revoked link cannot be mailed.** The document email jobs and the invoice reminder job skip a
document whose token is null and log why. Minting a replacement in a background job would silently
undo a withdrawal the owner asked for.

## Consequences

### Positive

- A revoked document is not found by the token lookup at all, so "revoked" and "never existed" are
  the same code path rather than two paths a future reader must keep answering identically. The
  indistinguishability is structural; nothing has to remember to check a flag.
- `text | null` makes the compiler enumerate every site that builds a URL from a token. The email
  jobs, the reminder job and the two detail read models each had to state what they do when there is
  no link, which is how the "skip rather than re-mint" rule got written down at all.
- One minter means one place to change if the entropy, the encoding or the CSPRNG ever moves.
- The client portal column finally has a writer, which is the prerequisite for the `/s/[token]`
  surface.

### Negative

- Revoking is not undoable: the old URL can never be brought back, only replaced. That is the point,
  but it means a mis-click costs a re-send rather than an undo, which is why both actions confirm.
- A restored client loses its portal link silently — the restore surface will have to say so.
- The demo seeder is no longer byte-identical across runs. Its bearer tokens are the one field a
  seed does not determine, recorded in `CLI-CONTRACT.md` and pinned by a test that compares two
  plans with the token fields stripped.
- Four near-identical link cards and three near-identical `publicLink.ts` modules now exist. They
  are kept in lock-step deliberately: the same shape on every surface is what makes a missing
  control visible.

## Alternatives considered

### Rotation is revocation

Rotate to a value nobody has been given and the link is functionally withdrawn — no schema change,
no new state, the `NOT NULL` columns preserved. Rejected because the owner then has no way to say
"nobody may open this, ever": there is always a live URL, held by whoever finds it. It also makes
the audit trail unable to tell a re-share from a withdrawal, and it leaves the client portal — which
genuinely has an off state — modelled differently from the three documents, which is the mess this
ADR exists to prevent.

### A `public_token_revoked_at` timestamp per document table

Expressive and auditable, and it keeps the columns `NOT NULL`. Rejected because it makes revocation
a predicate every reader must remember: the row is still found by the token lookup, and each of the
three (soon four) public reads has to gate on a second column. This repository's history is a list
of exactly that failure — five PDF job names with no registered handler, two invalid queue job ids —
and the nullable column enforces the same rule through Postgres instead of through discipline. It is
also redundant with `audit_logs`, which already records when a link was withdrawn and by whom.

### Making every column nullable _and_ adding a partial unique index to match `clients`

Postgres already treats NULLs as distinct in a plain unique index, so all three existing indexes
admit any number of revoked rows unchanged. Adding `WHERE public_token IS NOT NULL` to each would
have been three index rebuilds that change no behaviour, so the migration relaxes the `NOT NULL`
constraints and touches nothing else.

### Re-minting a token when a revoked document is sent again

The kind gesture: pressing "send" on a document whose link was revoked would quietly issue a new
one. Rejected because it makes a security action reversible by an ordinary one — the owner withdrew
the link deliberately, and a send path that undoes that without saying so is the same class of
surprise as a background job doing it. The document features refuse the send with a translated
message instead, and the card next to it issues a new link in one click.

### A shared `publicLink` module all four features import

The three document modules are structurally identical, and a generic one parameterised by table and
column would remove the repetition. Rejected on the boundary rule and on the audit vocabulary: each
feature owns its own gate, its own `Expected<Entity>Error`, its own translated messages and its own
`revalidate` paths, so the shared version would take five callbacks and read worse than the copy.
`code-style.md` names this case directly — similar scaffolding is not enough to justify extraction.
