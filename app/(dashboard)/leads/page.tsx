import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { getLeadsPageData } from "@/features/leads/server"

import { LeadsListPage } from "@/features/leads"

export const metadata: Metadata = {
  title: t("leads.metadata.list")
}

type LeadsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const LeadsPage = async ({ searchParams }: LeadsPageProps) => {
  const data = await getLeadsPageData(await searchParams)

  return <LeadsListPage data={data} />
}

export default LeadsPage
