import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { ProposalsOverviewPage } from "@/features/proposals"
import { getProposalOverviewPageData } from "@/features/proposals/server"

export const metadata: Metadata = {
  title: t("proposals.metadata.list")
}

type ProposalsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const ProposalsPage = async ({ searchParams }: ProposalsPageProps) => {
  const data = await getProposalOverviewPageData(await searchParams)

  return <ProposalsOverviewPage data={data} />
}

export default ProposalsPage
