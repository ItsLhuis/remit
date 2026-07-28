import { notFound } from "next/navigation"

import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { ProposalsListPage } from "@/features/proposals"
import { getProposalsPageData } from "@/features/proposals/server"

export const metadata: Metadata = {
  title: t("proposals.metadata.list")
}

type ProposalsRouteProps = {
  params: Promise<{ projectId: string }>
}

const ProposalsRoute = async ({ params }: ProposalsRouteProps) => {
  const { projectId } = await params

  const data = await getProposalsPageData({ projectId })

  if (!data) notFound()

  return <ProposalsListPage data={data} />
}

export default ProposalsRoute
