export type InvoiceCheckoutInput = {
  status: "draft" | "sent" | "paid"
  totalCents: number
  amountPaidCents: number
  stripeConfigured: boolean
}

export type InvoiceCheckoutRefusal = "not_configured" | "invoice_not_issued" | "nothing_outstanding"

export type InvoiceCheckoutDecision =
  | { payable: true; amountCents: number }
  | { payable: false; reason: InvoiceCheckoutRefusal }

// Whether a Checkout Session may be started for an invoice, and for how much. The amount is derived
// here and nowhere else, so a caller cannot be talked into charging a number that arrived in a
// request — see `stripeCheckout.ts`, which passes only the invoice's own columns in.
//
// A partially paid invoice is payable for its remainder rather than refused: the client owes the
// balance, `deriveInvoiceStatusView` already models that state, and refusing it would leave the only
// card path unable to finish a payment it started. The amount is therefore the outstanding balance
// and never the total.
//
// The refusals are ordered by what a caller may learn: configuration is a property of the instance
// and says nothing about the token, so it is checked first; the two invoice-shaped refusals below it
// are collapsed into one response by the route.
export function decideInvoiceCheckout({
  status,
  totalCents,
  amountPaidCents,
  stripeConfigured
}: InvoiceCheckoutInput): InvoiceCheckoutDecision {
  if (!stripeConfigured) return { payable: false, reason: "not_configured" }

  // The same guard `paymentWrites.ts` applies to every other way money reaches an invoice, stated
  // here so a session is never opened for a charge the recorder would then refuse: a draft has never
  // been issued, so there is nothing for a client to have been asked to pay.
  if (status === "draft") return { payable: false, reason: "invoice_not_issued" }

  const outstandingCents = totalCents - amountPaidCents

  if (outstandingCents <= 0) return { payable: false, reason: "nothing_outstanding" }

  return { payable: true, amountCents: outstandingCents }
}

// The Stripe idempotency key for the session this decision authorises. Two submissions that would
// charge the same invoice the same amount produce the same key, so Stripe replays the first session
// instead of opening a second — one URL, one charge, however many times the button is pressed.
//
// The amount is part of the key on purpose: once a payment lands the outstanding balance changes,
// which is a genuinely different charge and has to be allowed to open its own session. Stripe
// retains a key for 24 hours, which is also the default lifetime of the session it created, so the
// two expire together and a stale key can never resurrect an expired session.
export function buildInvoiceCheckoutIdempotencyKey(invoiceId: string, amountCents: number): string {
  return `remit_invoice_checkout_${invoiceId}_${amountCents}`
}
