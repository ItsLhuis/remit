# ADR-0030: The client portal is an index, and it never carries a signing link

- **Status:** Accepted
- **Date:** 2026-09-05

## Context

`/i/[token]`, `/p/[token]` and `/c/[token]` each resolve a bearer token to exactly one row and show
it. `/s/[token]` resolves a token to a **client** and then has to decide, for every record that
client owns, whether an anonymous holder of the link may see it — including records that did not
exist when the link was issued, because a portal token is a standing door rather than a covering
note for one document.

Two facts about the surrounding system shape the answer. `clients.notes` is an encrypted column
because it may carry NDA-protected content, and the client detail read model is the only place it is
allowed to leave the server. And the four public routes are not equally consequential: `/i/` only
displays, `/p/` sends a one-time code to an address the instance already holds before it will record
an acceptance, and `/c/` records a binding signature on a name and an email address the signer types
in themselves, with no second factor at all.

The portal link, unlike the three document links, is the one a client is expected to keep — pinned
in a browser, filed in a shared inbox, forwarded to whoever handles invoices this quarter. Its
audience is wider than any single document link's, and it cannot be narrowed after it is shared.

## Decision

**The portal is an index, not a document viewer.** Each row carries what identifies a document, what
state it is in, and what it is worth. Line items, notes, payment instructions, contract terms and
signatures stay behind the document's own public route, where their exposure was already decided and
where the rate limit and the read that governs them already live. Adding a field to the portal is
therefore a decision about the index, not a second copy of a document surface that has to be kept in
step with the first.

**A row appears when the client was sent the thing it names.** Invoices that are not drafts,
proposals and contracts past `issued_at`, and every live project. Nothing soft-deleted. A draft is
withheld for the reason `/i/[token]` withholds it: it has never been sent and its number may still
change.

**A row links onward only when the document's own route would still admit the caller.** An expired
proposal, a proposal whose project has been archived, and a document whose link was revoked all show
as rows without an opener. The portal never sends a client to a page that answers "unavailable".

**The portal never links to a contract, in any state, and never reads `contracts.public_token`.**
Signing is the one thing an anonymous holder of a link can do in Remit that binds the client, and it
is the only public action with no second factor. `/p/` is protected by an emailed OTP, so a portal
holder who is not the intended recipient cannot accept a proposal with the link alone; `/i/` is
inert. Putting the one unauthenticated signature behind a link that may be forwarded would widen who
can commit the client, so the portal reports where each agreement stands and leaves signing to the
message that was addressed to a person.

**Handing over the invoice and proposal links is acceptable, and is the point.** Those tokens were
already delivered to this client by email; the portal is where they stop being buried in a thread.
The tokens travel as **paths** and never as a bare token field, they are present only for documents
this same client owns, and revoking one takes its link out of the portal on the next render, because
"revoked" is an absent token (ADR-0029) rather than a flag some reader has to remember to check.

**What the portal never shows**, and the list is the security boundary of the surface:
`clients.notes`; the client's own address, tax id, phone and negotiated hourly rate; a project's
description, budget and hourly rate; time entries; expenses; tasks; client contacts; attachments;
payments as records of their own; a credit note's reason; every internal id; and every token except
the two paths above. The exclusions are expressed as column selections in the read, so Postgres
enforces them rather than a mapper that could forget one.

**Payments and credit notes are properties of the invoice they belong to.** What a client asks is
what they still owe on a given invoice, which the invoice row already answers with its total, what
has been paid and what is outstanding. A payment row would add a method, a reference and internal
notes to answer nothing. The outstanding figure is credit-aware — it runs through
`computeInvoiceOutstandingAfterCredits`, the same helper the owner's invoice screen uses — because
the row prints its credit notes directly beneath the amount and a figure that ignored them would
contradict itself on one line. `/i/[token]` does not yet do this, so the two disagree on a credited
invoice; the portal is the correct one and the document route is the one to bring into line.

**The portal writes nothing.** It records no view, so `clients` gains no `first_viewed_at`,
`last_viewed_at` or `view_count`. Invoices and proposals carry those columns because a document is
sent once and "has it been opened" is a question about that act; a portal is opened whenever the
client feels like checking a balance, and a counter over that answers nothing the freelancer asked.
Leaving them out also makes the route read-only in the strongest sense: there is no write path on it
to reason about.

## Consequences

### Positive

- Every exposure question has one answer to check rather than four surfaces to compare: if a field
  is not on a row, it is behind a link whose own route already decided it.
- The read cannot leak a field by omission in a mapper, because the columns are never selected.
- A client with a forwarded portal link can see what is owed and open what was already emailed to
  them, and can still not sign anything.
- No schema change, no migration, and no new export-manifest or seed classification.

### Negative

- A freelancer cannot tell whether a client has opened their portal. That is a real feature request
  this deliberately declines; the per-document view counters still answer the question that matters
  at send time.
- A contract awaiting signature is visible in the portal but not actionable from it, which will read
  as an omission to someone who has not seen this reasoning. The section says signing links arrive
  by email.
- `resolveContractDisplayStatus` is restated inside `features/clients/services/portalStatement.ts`
  rather than imported, because `features/contracts` reaches `features/clients/server` through its
  own mutations and a value import would close a dependency cycle. A test compares the two across
  the whole status and window matrix so the restatement cannot drift.

## Alternatives considered

### Show the client everything Remit holds about them

Maximally transparent, and consistent with the data-ownership principle the README opens with.
Rejected because "everything" includes records written in an internal tool by someone who did not
expect a reader: a project description, a budget never quoted, a credit note's reason, working notes
on a payment. Transparency to the client is a decision the freelancer should make per document by
sending it, not one the portal makes for them by aggregating.

### Link the contract signing page from the portal

The obvious convenience, and the reason the portal exists at all is to save the client hunting
through email. Rejected on the asymmetry above: it is the only public action with no second factor
and the only one that binds the client. If contract signing ever gains an OTP of the kind `/p/` has,
this decision should be revisited rather than assumed.

### Give the portal its own view-tracking columns

Symmetrical with invoices and proposals, and cheap. Rejected because the symmetry is false — those
counters answer "did this document arrive", which a standing link has no equivalent of — and because
it would put a write path on the one anonymous route that otherwise has none, for a number nobody
asked for.

### Compute the row set in SQL and skip the read model

Fewer moving parts, and the filters are all expressible as `where` clauses. Rejected because the
link-availability rules are not: they restate what three other public reads admit, and a SQL copy of
each would be a fourth place for those rules to drift. They live in the mappers, next to a comment
naming the read each one mirrors.
