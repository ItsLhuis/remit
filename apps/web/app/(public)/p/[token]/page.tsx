import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { PublicProposalPage, PublicProposalUnavailable } from "@/features/proposals"
import { getPublicProposal } from "@/features/proposals/server"

// `robots` renders the `<meta name="robots" content="noindex, nofollow">` the public-token rule
// requires in the page head; `proxy.ts` sets the matching `X-Robots-Tag` on the response. The title
// is deliberately generic — a document number in a browser tab or a shared screenshot is a leak the
// page itself does not need.
export const metadata: Metadata = {
  title: t("proposals.public.metadataTitle"),
  robots: { index: false, follow: false }
}

// Never cached: the same URL renders an open proposal before the client responds and a locked
// record after, and a cached copy of the former would keep offering an accept button.
export const dynamic = "force-dynamic"

type PublicProposalRouteProps = {
  params: Promise<{ token: string }>
}

const PublicProposalRoute = async ({ params }: PublicProposalRouteProps) => {
  const { token } = await params

  const proposal = await getPublicProposal({ token })

  if (!proposal) return <PublicProposalUnavailable />

  return <PublicProposalPage proposal={proposal} token={token} />
}

export default PublicProposalRoute
