import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { PublicInvoicePage, PublicInvoiceUnavailable } from "@/features/invoices"
import { getPublicInvoice, recordPublicInvoiceView } from "@/features/invoices/server"

// `robots` renders the `<meta name="robots" content="noindex, nofollow">` the public-token rule
// requires in the page head; `proxy.ts` sets the matching `X-Robots-Tag` on the response. The title
// is deliberately generic — an invoice number in a browser tab or a shared screenshot is a leak the
// page itself does not need.
export const metadata: Metadata = {
  title: t("invoices.public.metadataTitle"),
  robots: { index: false, follow: false }
}

// Never cached: the page prints an outstanding balance that a payment recorded in the dashboard can
// change at any moment, and every render is also the view-tracking event the freelancer reads.
export const dynamic = "force-dynamic"

type PublicInvoiceRouteProps = {
  params: Promise<{ token: string }>
}

const PublicInvoiceRoute = async ({ params }: PublicInvoiceRouteProps) => {
  const { token } = await params

  const invoice = await getPublicInvoice({ token })

  if (!invoice) return <PublicInvoiceUnavailable />

  // After the read, so a token that resolves to nothing leaves no trace and the counter cannot be
  // moved by probing. Awaited rather than fired and forgotten: an unawaited promise in a server
  // render is not guaranteed to survive the response.
  await recordPublicInvoiceView({ token })

  return <PublicInvoicePage invoice={invoice} />
}

export default PublicInvoiceRoute
