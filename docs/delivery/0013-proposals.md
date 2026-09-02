# DR-0013: Proposals and public acceptance

- **Status:** Shipped
- **Date:** 2026-07-29
- **Verdict:** Complete
- **Decisions:** ADR-0017
- **Supersedes:** —
- **Reconstructed:** yes

## What

Proposals with line items and a draft-to-accepted lifecycle, an anonymous public URL where a client
reads one, and an OTP-gated acceptance that converts it to an invoice or a contract draft.

## Why

The proposal is chronologically the first document a freelancer sends and the one whose acceptance
starts the money. Sending it as a PDF attachment and asking for a reply saying "yes" leaves no
record of who accepted, when, or what they were looking at when they did. A tokenised page with a
verified acceptance turns that into evidence.

## Scope

Included: proposals with line items carrying per-item discount and tax, numbering from the instance
sequence, the status lifecycle, the public tokenised read at `/p/[token]`, OTP request and
verification, acceptance and rejection, immutability after acceptance, conversion to an invoice or a
contract draft, and the instance-wide proposals list.

Excluded: a proposal quoting several projects, and projects created from accepted line items.
ADR-0026 records that rejection: it would have made parentage many-to-many, contradicted ADR-0017's
mutually-exclusive line-item parents, and forced the freelancer to answer scoping questions at
acceptance time. Also excluded: editing an accepted proposal, which `locked_at` refuses.

## How

The public token is minted at draft and withheld until the proposal is issued, so the URL exists
before it is shareable and nothing has to mint one at send time under load.

Token comparison is constant-time and a miss returns the same response shape and timing as a valid
token on an archived document, which is what defeats enumeration. `lib/publicToken.ts` is its own
module rather than an export of `lib/utils/index.ts`, because that barrel is imported by client code
and the comparison must not travel there.

Acceptance is gated by an OTP sent to the resolved recipient rather than by the token alone: the
token proves someone has the link, the OTP proves they control the address the proposal was sent to.
Both routes are rate-limited.

`locked_at` makes an accepted proposal immutable, so the document the client accepted is the
document that survives.

## Evidence

- `features/proposals/` — `publicQueries.ts`, `publicResponse.ts`, `documentData.ts`,
  `overviewQueries.ts`
- `features/proposals/services/calculateProposalTotal.ts`, `canTransitionProposalStatus.ts`,
  `proposalNumber.ts`, `proposalOtp.ts`, `proposalRenderData.ts`
- `lib/publicToken.ts` — `matchesPublicToken`
- `app/(public)/p/[token]/`, `app/(public)/p/[token]/otp/request/route.ts`,
  `app/(public)/p/[token]/otp/verify/route.ts`, `app/(dashboard)/proposals/`
- `database/schema/proposals.ts`, `database/schema/proposalOtps.ts`, `database/schema/lineItems.ts`
- `docs/architecture/adr/0017-polymorphic-line-items.md`

## Verification

Service tests cover totals, the transition guard, numbering and OTP generation. Integration tests
cover the mutations, the public read, the public response flow, the overview query and the document
data build. `app/(public)/p/[token]/otp/__tests__/otpRoutes.test.ts` covers the OTP routes including
rate limiting and the enumeration-defeating response shape.

Not covered by an end-to-end test: the full client-facing acceptance journey in a browser. It is
covered at the integration layer instead.

## Known gaps

`docs/architecture/ARCHITECTURE.md` states that editing an accepted proposal creates an immutable
historical version and preserves the original. No version table or history exists; `locked_at`
refuses the edit outright.
