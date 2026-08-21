# ADR-0027: Contact identity — delivery target and acceptance identity, never an entity

- **Status:** Accepted
- **Date:** 2026-08-20

## Context

`client_contacts` shipped as a schema-only table: columns, indexes, a partial unique index for the
primary slot, seed data, reset coverage, and export coverage, with no reader, no writer, and no
screen. Two questions were written down and deliberately left open, because they are product
decisions rather than schema ones, and the table cannot be finished without answering both.

**A document could not be sent to a person.** Every send path resolved the recipient the same way —
`features/proposals/documentData.ts`, `features/invoices/documentData.ts`,
`features/contracts/documentData.ts`, and the overdue reminder in `features/invoices/jobs.ts` all
read `clients.email`. When the client is a company, that address is the one on file for billing; the
person who should receive the invoice is whoever handles finance there, and Remit had no way to say
so. The contacts table named those people and nothing consumed it.

**A person could not answer a document.** `features/proposals/publicResponse.ts`'s
`matchesProposalRecipient` compared the OTP request address against `clients.email` alone. Answering
the first question without the second produces an incoherence worse than either gap: a proposal
mailed to the signatory that only the billing mailbox can accept. The two questions are one question
— what a contact _is_ to Remit — and are answered here together.

The constraint both answers work inside is
[Architecture: What Remit is not](../ARCHITECTURE.md#1-what-remit-is-not): Remit is not a contact
manager. A contact is reachable only through its client, has no route, no module, and no top-level
list, and no other table carries a `contact_id`.

## Decision

**A contact is an address with a capability, never an entity.** It gains two capabilities, both
scoped to the client it belongs to, and no navigational existence of its own.

**Delivery: resolved at send time, stored nowhere.** Every document email resolves its recipient
through one function — `features/clients/contactQueries.ts`'s `getClientDocumentRecipient`, which
calls the pure `resolveDocumentRecipient` in `features/clients/services/clientRecipients.ts` — and
that function returns the client's live primary contact when it has one, and `clients.email`
otherwise. All four send paths use it, so proposals, invoices, contracts, and overdue reminders
cannot disagree about where a client's mail goes. No column is added to any document, and nothing
references `client_contacts`: the record of where a document actually went already exists in
`email_logs.recipient_email` and `email_logs.recipient_name`, written per send and indexed by
`(document_type, document_id)`. The document itself is still addressed to the company — the merge
data that renders the PDF is unchanged, and only the envelope moves.

**Acceptance: the client's own address, plus that client's live contacts.** `publicResponse.ts` now
matches the OTP request against an identity list built by `listClientRecipientIdentities`, which is
`clients.email` followed by every non-soft-deleted contact row of that one client.
`matchProposalRespondent` returns the matched identity rather than a boolean, and the OTP is issued
to that identity and mailed to that address and no other. `proposal_otps.email` records the address
the code was sent to, so `verifyProposalOtp` still compares a single address and a code issued to
one identity cannot be spent by another. Everything else about the flow is untouched: a miss returns
the identical success payload with no email sent and an audit entry recording the mismatch, the rate
limits stay on the two `otp/*/route.ts` handlers keyed as they were, the attempt ceiling stays per
proposal, and the token comparison stays constant-time-shaped. A soft-deleted contact is not an
identity, a soft-deleted client has no identities at all, and a contact of a different client is
never in the list, because the list is built from one client's rows.

**The primary slot is a promotion, not a flag.** `uq_client_contacts_primary` already made two live
primaries unrepresentable. Promotion is therefore demote-then-promote inside one transaction
(`features/clients/mutations.ts`'s `demotePrimaryContacts`), and the losing side of two concurrent
promotions surfaces as a Postgres unique violation that `handleClientContactActionError` converts
into a translated message. A client's first contact takes the slot even when the form leaves the box
unticked, because a contacts list whose members receive nothing is a surface that appears to do
something and does not. Deleting the primary frees the slot and falls back to `clients.email` rather
than promoting a survivor nobody chose.

**Contact writes are audited.** `client_contact.created`, `.updated`, `.deleted`, and
`.primary_changed` are written on the same footing as client writes, for a stronger reason than
symmetry: after this ADR, adding a contact grants an address that can receive and accept this
client's documents, and removing one revokes it.

**The surface is a tab in the client workspace.** `features/clients/components/ClientContactsPanel/`
renders inside `ClientWorkspace`'s existing tab set. There is no `features/contacts`, no `/contacts`
route, no top-level list, and no global contact search.

## Consequences

### Positive

- The invoice reaches the person who pays it and the proposal reaches the person who signs it, which
  is what the table was added for.
- The person a document was sent to can act on it. Delivery and acceptance were decided together, so
  the two cannot drift into the incoherent pair.
- Four send paths share one recipient rule, expressed once as a pure function and unit-tested there.
- Nothing references `client_contacts`, so the "not a contact manager" boundary survives verbatim,
  and the table can still be dropped without touching another table's schema.
- No migration, no new column, and no new nullable state on any document.

### Negative

- Changing a client's primary contact silently changes where their _next_ document and next reminder
  go. Nothing warns about that, and the freelancer has to notice the header line on the contacts tab
  that names the current address.
- A document cannot be sent to a different address than the client's current primary. Choosing a
  recipient per document is not expressible, and adding it later means a column and a UI this
  decision does not build.
- Every live contact can accept every proposal for its client. The set is not per-document and not
  per-role: an "approver" and a "finance" contact are equally able to accept, and `role` is free
  text that grants nothing.
- Revoking a person's ability to answer means deleting or editing their contact row; there is no
  narrower control.
- Two concurrent promotions still make one caller retry. The message says so, but the alternative
  was a lock the write path does not otherwise need.

## Alternatives considered

### Store the chosen recipient on the document, picked per send

A `recipient_email` column on `proposals`, `invoices`, and `contracts`, snapshotted when the
document is sent, with the primary contact as the pre-filled default. It survives the contact being
deleted and needs no foreign key, so the "nothing references `client_contacts`" rule would have
held. Rejected because it buys a capability nobody asked for at the cost of three columns, a
migration, export-manifest and inventory decisions, and a recipient field on three forms — and it
buys it twice over, because `email_logs` already answers the question the snapshot exists to answer:
it records the address every send actually used, per send, and survives the contact, the primary
slot, and the client's own address changing. The genuine gain is per-document choice, which is a
different feature; when a freelancer asks for it, this ADR is what it supersedes.

### A foreign key from the document to the contact

The most expressive option: the document names the person, and the join is exact. Rejected because
it reverses the Stage 29 constraint recorded in `SCHEMA.md` section 13 and in ARCHITECTURE's "What
Remit is not" — that no other table carries a `contact_id` — and that constraint is what keeps a
contact a sub-record rather than an entity. The moment a document points at a contact, deleting a
contact has to answer for documents, contacts need a merge or reassign operation, and the contacts
list becomes a thing with its own referential life. That is the contact manager Remit says it is
not, and the address recorded in `email_logs` is a better record of a send than a foreign key that
can be re-pointed afterwards.

### Leave acceptance on `clients.email` and widen delivery only

The smaller change: send to the primary contact, keep `matchesProposalRecipient` as it is. Rejected
because it manufactures the exact incoherence this stage exists to remove — a proposal delivered to
someone who cannot answer it, with a link that works and an address that does not, and no message
that explains why. Either both capabilities move to the contact or neither does.

### Give contacts a role enum and grant capabilities per role

`role` becomes an enum — signatory, finance, approver — and only a signatory may accept while only a
finance contact receives invoices. Rejected because it is a permission model, and a permission model
needs somewhere to be administered, an answer for a contact with two roles, and a migration path for
the free text already stored. Remit's users are freelancers dealing with a handful of people per
client; the primary slot plus a free-text label is the amount of structure that job needs. If
per-role capability is ever wanted, `role` is where it starts, and the free text loses nothing by
being there first.

### A per-client portal identity with its own credential

Contacts get portal logins, and acceptance becomes an authenticated action rather than an emailed
code. Rejected as out of scope and out of shape: `/s/[token]` (the client portal) is a separate
surface with its own token, the OTP flow already proves control of the mailbox a document was sent
to, and issuing credentials to a client's staff makes Remit an identity provider for other people's
employees.
