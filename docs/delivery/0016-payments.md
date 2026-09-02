# DR-0016: Payments and Stripe settlement

- **Status:** Shipped
- **Date:** 2026-08-03
- **Verdict:** Complete with known gaps
- **Decisions:** ADR-0009
- **Supersedes:** —
- **Reconstructed:** yes

## What

Payment records against an invoice, entered manually or settled automatically by a Stripe webhook,
with partial payments supported and the invoice status derived from them.

## Why

An invoice is not paid or unpaid; it is paid by an amount, sometimes in instalments, sometimes by
bank transfer weeks after the card attempt failed. Storing a boolean would have lost the history a
freelancer needs at year end, and it would have made a partial payment unrepresentable.

## Scope

Included: payment records with amount, method, date and reference; multiple payments per invoice;
the Stripe webhook that settles a payment on a successful charge; and the derived invoice status the
payments feed.

Excluded: initiating a Stripe checkout session. The webhook is the consumer half and it is complete;
the producer half does not exist. Also excluded: refunds as payment records — a correction is a
credit note, per the invoicing model.

## How

The webhook keys on `remit_invoice_id` carried in the Stripe metadata rather than on any Stripe
object id, so settlement does not depend on Remit having stored a session or intent identifier
beforehand. That is what lets the consumer stand alone without the producer.

The webhook route is rate-limited and verifies the Stripe signature before reading the body. The
request body is read once and the raw bytes are preserved for signature verification, because a body
consumed by JSON parsing cannot be verified afterwards.

`paymentSettlement.ts` is a pure service, so the decision about what a given charge means for an
invoice is testable without Stripe and is the same decision the manual path makes.

## Evidence

- `features/payments/` — `stripeWebhook.ts`, `paymentWrites.ts`, `mutations.ts`, `queries.ts`
- `features/payments/services/paymentSettlement.ts`, `paymentMethod.ts`
- `app/api/webhooks/stripe/route.ts`
- `database/schema/payments.ts`
- `features/settings/payment/` — the encrypted Stripe secret and webhook secret
- `features/invoices/services/invoiceStatusView.ts` — the consumer of the payment total

## Verification

`features/payments/__tests__/stripeWebhook.integration.test.ts` covers the webhook end to end
against a real Postgres with the Stripe SDK stubbed at the module boundary, including signature
rejection and settlement. `features/payments/__tests__/mutations.integration.test.ts` covers manual
entry and partial payments. Service tests cover the settlement decision and method mapping.

Not covered by an automated test: a real Stripe account. The webhook is verified against constructed
events only.

## Known gaps

There is no checkout producer. `README.md` describes "integrated Stripe with hosted checkout per
invoice"; the public invoice page's card payment block is deliberately inert and says so in the
component, so the webhook can only ever fire for a session something else created.
