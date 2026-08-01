import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { PublicContractPage, PublicContractUnavailable } from "@/features/contracts"
import { getPublicContract } from "@/features/contracts/server"

// `robots` renders the `<meta name="robots" content="noindex, nofollow">` the public-token rule
// requires in the page head; `proxy.ts` sets the matching `X-Robots-Tag` on the response. The title
// is deliberately generic — a contract number in a browser tab or a shared screenshot is a leak the
// page itself does not need.
export const metadata: Metadata = {
  title: t("contracts.public.metadataTitle"),
  robots: { index: false, follow: false }
}

// Never cached: the same URL renders a signable contract before the client signs and an unavailable
// record after, and a cached copy of the former would keep offering a signature form on a contract
// that is already executed.
export const dynamic = "force-dynamic"

type PublicContractRouteProps = {
  params: Promise<{ token: string }>
}

const PublicContractRoute = async ({ params }: PublicContractRouteProps) => {
  const { token } = await params

  const contract = await getPublicContract({ token })

  if (!contract) return <PublicContractUnavailable />

  return <PublicContractPage contract={contract} token={token} />
}

export default PublicContractRoute
