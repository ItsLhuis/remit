# ADR-0032: Card payment — one recorder, a server-derived amount, and idempotency keyed on the balance

- **Status:** Accepted
- **Date:** 2026-09-06

## Context

Remit's Stripe receiver shipped long before anything produced a payment for it to receive. It
verifies a signature, reads `metadata.remit_invoice_id` off the payment intent carried by a
`payment_intent.succeeded` event, records a payment and settles the invoice. Building the producer
forces four questions that no existing document answers, each of which has a plausible wrong answer
that fails silently rather than loudly.

The wrong answers are worth naming, because all four take a client's money and none of them raise an
error: a session whose invoice id lives in the session's own metadata instead of the payment
intent's; a success page that marks the invoice paid because the browser came back; an amount
carried in the request the client controls; and a second charge produced by a second click.

## Decision

**The verified webhook is the only thing that records money.** No other path writes a payment,
including the `success_url` return. That URL is guessable, the client controls their own browser,
and the redirect carries no proof of anything; a page that settled an invoice on arrival would be a
forged-payment vulnerability. The return page therefore renders the invoice's real state as the
database currently knows it, which may still read unpaid for a few seconds, and says so in words
rather than inventing a second source of truth.

**The invoice id travels in `payment_intent_data.metadata`, never in the session's own metadata.** A
Checkout Session and the payment intent it creates carry independent metadata maps, and
`payment_intent_data` is the only session parameter that reaches the intent. A session whose id sat
only in session metadata would complete, charge the client, and be acknowledged by the receiver as
an unlinked intent belonging to another integration — the client out of pocket, the invoice unpaid.
The key stays namespaced for the reason the receiver already records: a self-hoster's Stripe account
may serve other integrations whose intents reach the same endpoint.

**The value is the invoice's uuid and never its public token.** A token can be rotated or revoked
while a session is open, and money collected by that session is still owed on the same invoice.
Nothing on the payment path keys on the token; the token appears only in the return URLs, where its
loss costs a redirect and never a payment.

**The amount is derived on the server from the invoice's own columns.** The initiation request
carries a token and nothing else — there is no field in which a client could send an amount, a
currency or an invoice identity. The charge is the outstanding balance, so a partially paid invoice
is payable for its remainder, and the currency is the invoice's own, so the session can never
produce a completion the recorder would refuse for a currency or amount mismatch.

**Idempotency is keyed on the invoice and the amount it is being charged.** Two submissions that
would charge the same balance produce the same Stripe idempotency key, so Stripe replays the first
session rather than opening a second: one URL, one charge, however many times the button is pressed.
The amount is part of the key deliberately — once a payment lands the balance changes, which is a
genuinely different charge and must be allowed its own session. Stripe retains an idempotency key
for 24 hours, the default lifetime of the session it created, so the two expire together and a stale
key cannot resurrect an expired session.

**"Stripe is configured" means both secrets, everywhere.** The receiver has always required a secret
key and a webhook signing secret together. The public invoice's affordance now means the same thing,
because a secret key alone is enough to open a session and charge a client while leaving nothing
that can verify the event which would record the payment. That state is reachable by an operator
filling the form halfway, so the settings surface names it rather than reporting progress.

## Alternatives considered

**Stripe Elements with a client-side payment intent.** `settings.stripe_publishable_key` has existed
since the payments schema landed and implies this was once imagined. Rejected: hosted Checkout keeps
card data off the operator's machine entirely, which matters more for software a freelancer runs on
their own box than the styling control Elements buys. The publishable key stays stored and unused
rather than being removed, because an Elements integration remains a legitimate later choice.

**Handling `checkout.session.completed` instead of, or alongside, `payment_intent.succeeded`.** It
is Stripe's usual fulfilment event and would let the session's own metadata carry the id. Rejected:
the shipped receiver is keyed on the payment intent and is tested there, and a second settlement
event would give the same money two recorders and the aggregate two ways to be written.

**Reusing an open session instead of an idempotency key.** It would require storing a session id per
invoice — a new column, a new lifecycle and a new way for the database to disagree with Stripe about
which session is live. The idempotency key achieves the same one-charge guarantee with no persisted
state, and Stripe already owns the expiry.

**Polling a payment-status endpoint from the return page.** Rejected as a second source of truth.
The page re-runs its own server render instead, reading the same database every other view reads.

## Consequences

Positive: the card path cannot charge an amount a client chose, cannot record a payment without a
verified signature, and cannot double-charge a double click. A rotated token does not strand money
in flight. An operator who has configured half of Stripe is told so instead of discovering it
through a client's missing payment.

Negative: a client who completes a payment sees a short window in which the invoice still reads
unpaid, which is the honest reading of the database and is handled with copy rather than with a
claim. Remit holds no record of a Checkout Session beyond an audit entry, so an abandoned session is
invisible until it expires on Stripe's side. Card payments require both Stripe secrets, which is
stricter than the previous public affordance and will turn the button off on any instance that had
stored only a secret key — correctly, since no payment it took would ever have been recorded.
