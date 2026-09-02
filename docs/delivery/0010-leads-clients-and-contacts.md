# DR-0010: Leads, clients and client contacts

- **Status:** Shipped
- **Date:** 2026-08-21
- **Verdict:** Complete
- **Decisions:** ADR-0027
- **Supersedes:** —
- **Reconstructed:** yes

## What

The record of who a freelancer does business with: a lead pipeline with stages and one-click
conversion, client profiles with billing details and encrypted notes, and named contacts beneath a
client.

## Why

Every document Remit produces names somebody. Before this existed, the client was the only party the
system knew about, which forced two wrong answers at once: a prospect who had not become a client
had nowhere to live except as a client who was not one, and a company with a project manager, an
accounts-payable address and a signatory had one email field to hold all three.

## Scope

Included: leads with a five-stage pipeline, source tracking and conversion to a client; clients with
billing address, tax identifiers, currency, default hourly rate, locale and encrypted internal
notes; client contacts as named recipients beneath a client; per-client health scoring, outstanding
balance and billing trend; and the list, detail and workspace surfaces for all three.

Excluded: contacts as an identity. A contact is a delivery target and an acceptance identity, never
a principal — it has no login, no session and no role, per ADR-0027. Extending it into an account
model would have contradicted the single-instance model. Also excluded: attachments and images on
leads, which stay light by the same precedent.

## How

A lead and a client are separate tables rather than one table with a status, because a lead has no
billing identity and a client must have one, and merging them would have made every required client
column nullable. Conversion copies forward and leaves the lead behind as the record of where the
client came from.

`clients.notes` is an `encryptedColumn()`. It is the only encrypted column outside `settings`, and
it is encrypted because free-text notes about a client are the most sensitive unstructured field in
the product.

`clientRecipients.ts` is a pure service that resolves who a document should be sent to given a
client and its contacts. It exists as a service rather than inline in the mutations because three
document features need the same answer, and the resolution order is a domain rule rather than a
query.

Status transitions for leads are guarded by a pure predicate rather than by the UI, so an invalid
transition is refused by the server whichever surface asks for it.

## Evidence

- `features/leads/`, `features/clients/`
- `features/clients/services/clientRecipients.ts`, `clientHealth.ts`,
  `calculateOutstandingBalance.ts`, `buildClientBillingTrend.ts`, `summarizeClients.ts`
- `features/leads/services/canTransitionLeadStatus.ts`, `summarizeLeads.ts`
- `features/clients/contactQueries.ts`, `features/clients/components/ClientContactsPanel/`
- `database/schema/leads.ts`, `database/schema/clients.ts`, `database/schema/clientContacts.ts`
- `app/(dashboard)/leads/`, `app/(dashboard)/clients/`
- `docs/architecture/adr/0027-contact-identity.md`

## Verification

Service unit tests cover health scoring, outstanding balance, the billing trend, the summaries, the
lead transition guard and recipient resolution. Integration tests cover the client, lead and contact
mutations and the contact queries against a real Postgres, including the soft-delete visibility
rules. Schema tests pin the validation contracts.

Not covered by an automated test: the list surfaces' filter and pagination behaviour, which is
exercised by the shared `useListFilters` and `useDataTable` hook tests rather than per feature.

## Known gaps

The `entity_type` enum cannot hold `lead`, so lead activity cannot appear in the activity feed at
all.
