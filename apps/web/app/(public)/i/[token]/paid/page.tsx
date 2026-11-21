import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { PublicInvoicePaidPage, PublicInvoiceUnavailable } from "@/features/invoices"
import { getPublicInvoice } from "@/features/invoices/server"

export const metadata: Metadata = {
  title: t("invoices.public.metadataTitle"),
  robots: { index: false, follow: false }
}

// Never cached, and for a sharper reason than the invoice page's: this is where a client lands
// seconds after being charged, and the webhook that records the payment may not have arrived yet. A
// cached render here would show a stale unpaid balance to somebody deciding whether to pay again.
export const dynamic = "force-dynamic"

type PublicInvoicePaidRouteProps = {
  params: Promise<{ token: string }>
}

// Stripe's `success_url`. It resolves the invoice through the same read the invoice page uses, so a
// token that is unknown, revoked or rotated lands on the same unavailable surface — and records
// nothing either way. Arriving here is not a payment; only the signed webhook is.
//
// The view counter is deliberately not moved from here. It counts a client opening their invoice,
// and a redirect back from a payment provider is not that.
const PublicInvoicePaidRoute = async ({ params }: PublicInvoicePaidRouteProps) => {
  const { token } = await params

  const invoice = await getPublicInvoice({ token })

  if (!invoice) return <PublicInvoiceUnavailable />

  return <PublicInvoicePaidPage invoice={invoice} />
}

export default PublicInvoicePaidRoute
