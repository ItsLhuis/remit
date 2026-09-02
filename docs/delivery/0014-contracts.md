# DR-0014: Contracts and public signing

- **Status:** Shipped
- **Date:** 2026-08-01
- **Verdict:** Complete
- **Decisions:** ADR-0017, ADR-0022
- **Supersedes:** —
- **Reconstructed:** yes

## What

Contracts as a document distinct from proposals, built from block-based templates, with a public
signing URL that captures a typed signature and produces a signed PDF.

## Why

A proposal is an offer and a contract binds. Treating them as one document with a status would have
meant an accepted offer and a signed agreement carried the same evidentiary weight, which is wrong
in every jurisdiction Remit targets. A signature also has to be evidence rather than a checkbox: who
signed, from what address, with what browser, at what instant, against exactly which document text.

## Scope

Included: contracts with numbering from their own sequence, a lifecycle with expiry, conversion from
an accepted proposal, template-driven contract body blocks, the public read at `/c/[token]`, the
signing route capturing typed full name, IP address, user-agent and timestamp, and the signed PDF
render.

Excluded: cryptographic or certificate-backed signatures. The captured audit trail is the evidence
model, and a PKI signature would have introduced a key lifecycle the product does not otherwise
have. Also excluded: countersigning and multi-party signature order — one signer, because the
counterparty is the freelancer who issued the document.

## How

`contract_signatures` is insert-only, guarded by the same migration trigger as `audit_logs`. A
signature that can be rewritten after the fact is not evidence, and the guard is in the database
rather than in the mutations so no future write path can acquire an update.

The signing route is rate-limited and uses the same constant-time token comparison and
enumeration-defeating response shape as the proposal routes.

The signed PDF is rendered through the ADR-0022 pipeline rather than inline, and a guard refuses to
re-render or replace an existing signed PDF: the artefact the client signed must not be regenerable
from later template edits.

## Evidence

- `features/contracts/` — `publicDocument.ts`, `publicSigning.ts`, `publicQueries.ts`,
  `documentData.ts`, `pdfDocument.ts`, `pdfRenderJob.ts`
- `features/contracts/services/canTransitionContractStatus.ts`, `contractBlocks.ts`,
  `contractExpiry.ts`, `contractNumber.ts`, `contractRenderData.ts`
- `database/schema/contracts.ts`, `database/schema/contractSignatures.ts`,
  `drizzle/migrations/0001_insert_only_guards.sql`
- `app/(public)/c/[token]/`, `app/(public)/c/[token]/sign/route.ts`, `app/(dashboard)/contracts/`
- `docs/architecture/adr/0022-pdf-rendering-engine.md`

## Verification

Service tests cover the transition guard, expiry arithmetic, numbering, block assembly and render
data. Integration tests cover the mutations, the conversion from an accepted proposal, the public
read, the public signing flow and the signed-PDF guard.
`app/(public)/c/[token]/sign/__tests__/signRoute.test.ts` covers the signing route including rate
limiting.

Not covered by an end-to-end test: the client-facing signing journey in a browser. It is covered at
the integration layer.

## Known gaps

Nothing recorded on the day.
