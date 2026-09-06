# DR-0036: Stripe hosted checkout

- **Status:** Shipped
- **Date:** 2026-09-06
- **Verdict:** Complete with known gaps
- **Decisions:** ADR-0009, ADR-0016, ADR-0018, ADR-0032
- **Supersedes:** —

## What

A client on a public invoice link pays it by card through a Stripe-hosted Checkout Session whose
payment intent carries the invoice id, so the settlement the existing webhook records lands on the
right invoice.

## Why

Remit shipped the consumer half of the card-payment path and never the producer. The webhook
verified a signature, read `metadata.remit_invoice_id` off a payment intent, recorded a payment and
settled the invoice — and nothing in Remit ever created such an intent. The public invoice page
rendered a permanently disabled button whose comment stated the reason: with no path that records
what a Checkout Session collects, a working button would take a client's money and leave the invoice
reading unpaid.

The same shape of gap made the public invoice's "Stripe is configured" boolean unsafe. It meant a
secret key alone, while the receiver requires a secret key _and_ a webhook secret; an instance with
the first and not the second would have shown a pay button that charged the client and recorded
nothing.

## Scope

Included: the checkout-initiation route on the public invoice surface, the server-derived amount and
the payability rules that gate it, the payment-intent metadata contract that joins producer to
consumer, idempotency across repeated submissions, the success and cancel returns, the alignment of
"Stripe is configured" onto one definition, and the settings warning for the configuration that
would take money without recording it.

Excluded, with reasons:

- **Stripe Elements and any client-side card collection.** Hosted Checkout keeps card data off the
  operator's box entirely, which is the right default for software a freelancer self-hosts.
  `settings.stripe_publishable_key` remains stored and unused by this path.
- **`checkout.session.completed` handling.** The shipped receiver is keyed on
  `payment_intent.succeeded` and is tested; adding a second settlement event would give the same
  money two recorders.
- **Refunds, partial captures and saved payment methods.** No document promises them.
- **Any schema change.** The capability needed none.

## How

The join between the two halves is one parameter. `payment_intent_data.metadata` is the only
Checkout Session field that reaches the payment intent a `payment_intent.succeeded` event carries; a
session's own `metadata` map stays on the session. Setting the id in the wrong one of those two maps
produces the exact failure the disabled button existed to prevent — a completed charge the receiver
acknowledges as an unlinked intent — and it fails silently, with a 200 from the webhook.

The producer and the receiver sit in the same directory for that reason, and the producer takes the
invoice as an argument rather than resolving it. `features/invoices` already depends on
`features/payments` to record a settlement, so a producer that read the public invoice itself would
close an import cycle; the resolution lives on the invoices side and reuses
`findIssuedInvoiceByPublicToken`, the same function the page's read uses, so the checkout path and
the page cannot disagree about which invoices are visible.

Three properties are enforced structurally rather than by a check. The initiation route reads no
request body at all, so there is no field in which an amount, a currency or an invoice identity
could arrive. Idempotency is a key derived from the invoice and the balance being charged, so a
second click replays the first session rather than opening a second — and no session id is
persisted, which would have been a new column and a new way for Remit and Stripe to disagree about
which session is live. The metadata value is the invoice uuid and never the public token, so a
rotation mid-checkout costs a redirect and never a payment.

The return page is the part most easily got wrong, and it records nothing. `success_url` is a
guessable URL the client's own browser follows; a page that settled an invoice on arrival would be a
forged-payment vulnerability. It renders the invoice's real state instead, and when the webhook has
not yet landed it re-runs its own server render on a short interval — the same database every other
view reads, never a second status source — behind copy that tells the client the payment went
through and not to pay again.

`stripeConfigured` on the public read model was widened to the definition the receiver has always
used. That is a behaviour change on existing instances: one holding only a secret key loses its pay
button, correctly, because no payment it took could ever have been recorded.

## Evidence

- Metadata contract and session creation: `features/payments/stripeCheckout.ts`; the receiver it
  answers to is `features/payments/stripeWebhook.ts`'s `stripePaymentIntentSchema`.
- Payability rules, the server-derived amount and the idempotency key:
  `features/payments/services/invoiceCheckout.ts`.
- Token resolution and delegation: `features/invoices/publicCheckout.ts`, over
  `getPublicInvoiceCheckoutTarget` in `features/invoices/publicQueries.ts`.
- Initiation route, its rate limit and its uniform refusal: `app/(public)/i/[token]/pay/route.ts`.
- Return surface: `app/(public)/i/[token]/paid/page.tsx`,
  `features/invoices/components/PublicInvoicePaidPage/`.
- Working affordance: `features/invoices/components/PublicInvoicePage/PublicInvoiceCardPayment.tsx`,
  with the token read from the address bar by `features/invoices/hooks/usePublicInvoiceToken.ts`
  rather than passed down, which keeps the property
  `app/(public)/i/[token]/__tests__/publicInvoiceRoute.test.tsx` pins.
- One definition of "Stripe is configured": `toPublicPaymentBlock` in
  `features/settings/payment/queries.ts`, matching `getStripeConfiguration` in both payments
  modules.
- Operator warning for the incomplete configuration:
  `features/settings/payment/components/PaymentSettingsPage/StripeConnectionStatus.tsx`.
- Decisions: ADR-0032.

## Verification

`pnpm typecheck`, `pnpm lint`, `pnpm test` (234 files, 2097 tests), `pnpm test:integration` (70
files, 716 tests) and `pnpm build` all pass. react-doctor scores 88/100 with no errors and no
warning that was not present before this work: an intermediate revision tripped
`react-doctor/no-giant-component` on the payment settings form, which the extraction of
`StripeConnectionStatus` returned to the baseline set.

The load-bearing test is `features/payments/__tests__/stripeCheckout.integration.test.ts`'s first
case. It takes the parameters the producer actually sent to Stripe, builds the
`payment_intent.succeeded` event those parameters imply, signs it with the real SDK helper and runs
it through the shipped receiver, then asserts the payment row and the settled invoice. Only the
outbound session call is stubbed; the signature verifier is real, so the metadata contract is proven
end to end rather than asserted twice. Beside it: the outstanding-balance amount, one idempotency
key across repeated submissions, the return URLs, an audit entry carrying no key material and no
token, and seven refusals — unknown token, draft, soft-deleted, settled, zero balance, secret key
without webhook secret, and no Stripe at all — each asserted to be the same answer as an unknown
token. `app/(public)/i/[token]/__tests__/invoiceCheckoutRoute.test.ts` covers the rate limit, its
key, the noindex header, the single failure status, and that a body naming an amount changes
nothing.

Not covered: the manual smoke against Stripe test mode with the CLI forwarding webhooks was not run,
so no claim is made about a real card, a real redirect, or the behaviour of a real expired session.
Everything above is evidence from the automated suites. The files with no direct automated test are
`app/(public)/i/[token]/paid/page.tsx`, `PublicInvoicePaidPage.tsx`,
`PublicInvoicePendingRefresh.tsx` and `StripeConnectionStatus.tsx`.

## Known gaps

- The manual Stripe test-mode smoke is unrun. Until it is, the automated evidence covers the
  contract and the refusals but not a real redirect or a real expired-session page.
- The four presentation files listed above carry no direct test.
- A fourth copy of the `noindexJson` helper now exists, beside the ones in
  `app/(public)/c/[token]/sign/route.ts` and `app/api/webhooks/stripe/route.ts` and the extracted
  one serving the OTP pair. It was left local to match the two nearest routes rather than refactored
  across three other surfaces; a shared helper under `lib/utils/` is the obvious consolidation.
- Remit persists nothing about a Checkout Session beyond its audit entry, so an abandoned session is
  invisible to the application until Stripe expires it. Reconciling abandoned sessions would need a
  stored session id, which ADR-0032 rejected for this delivery.
- `settings.stripe_publishable_key` remains stored and read by nothing. Hosted checkout does not
  need it; it is kept because an Elements integration stays a legitimate later choice.
