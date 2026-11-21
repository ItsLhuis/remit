import {
  MANUAL_PAYMENT_METHOD_VALUES,
  type ManualPaymentMethod,
  type PaymentMethod
} from "../schemas"

// A row is the freelancer's own bookkeeping entry unless the Stripe receiver wrote it. That is the
// test behind every "may this be edited" affordance, and it agrees with the server-side refusal in
// paymentWrites.ts's `updatePaymentWrite`.
export function isManualPaymentMethod(method: PaymentMethod): method is ManualPaymentMethod {
  return (MANUAL_PAYMENT_METHOD_VALUES as readonly PaymentMethod[]).includes(method)
}

// Seeds the edit form from an existing row. `stripe` collapses to `other` rather than throwing: the
// form has no such option, and the affordance that reaches this is already hidden for those rows, so
// the fallback exists only to keep the narrowing total.
export function toManualPaymentMethod(method: PaymentMethod): ManualPaymentMethod {
  return isManualPaymentMethod(method) ? method : "other"
}
