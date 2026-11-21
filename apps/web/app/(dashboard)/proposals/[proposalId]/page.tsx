import { notFound } from "next/navigation"

import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { ProposalDetailPage } from "@/features/proposals"
import { getProposalDetail } from "@/features/proposals/server"

export const metadata: Metadata = {
  title: t("proposals.metadata.detail")
}

type ProposalDetailRouteProps = {
  params: Promise<{ proposalId: string }>
}

const ProposalDetailRoute = async ({ params }: ProposalDetailRouteProps) => {
  const { proposalId } = await params

  const proposal = await getProposalDetail({ id: proposalId })

  if (!proposal) notFound()

  return <ProposalDetailPage proposal={proposal} />
}

export default ProposalDetailRoute
