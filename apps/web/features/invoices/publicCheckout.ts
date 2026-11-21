import { t } from "@/lib/i18n/server"

import { startInvoiceCheckout } from "@/features/payments/server"

import { getPublicInvoiceCheckoutTarget } from "./publicQueries"

// The anonymous write side of `/i/[token]/pay`, paired with the anonymous read in
// `publicQueries.ts`. It resolves the token and hands the resolved invoice to the payments feature,
// which owns everything about the money — the amount, the payability rules, the Stripe session and
// the metadata contract with the webhook.
//
// The split is an import-cycle constraint made useful: this feature already depends on
// `features/payments` to record a settlement, so the producer cannot reach back here for the public
// read. Resolving on this side means the checkout path and the page share one definition of which
// invoices are visible — `findIssuedInvoiceByPublicToken` — rather than growing a second one.

export type StartPublicInvoiceCheckoutRequest = {
  token: string
  ipAddress: string | null
  userAgent: string | null
}

export async function startPublicInvoiceCheckout({
  token,
  ipAddress,
  userAgent
}: StartPublicInvoiceCheckoutRequest): Promise<{ data: { url: string } } | { error: string }> {
  const invoice = await getPublicInvoiceCheckoutTarget({ token })

  // The same message every refusal inside the payments feature returns, so an unknown token and an
  // invoice that exists but cannot be paid are one indistinguishable answer.
  if (!invoice) return { error: t("invoices.public.payment.unavailable") }

  return startInvoiceCheckout({ invoice, token, ipAddress, userAgent })
}
