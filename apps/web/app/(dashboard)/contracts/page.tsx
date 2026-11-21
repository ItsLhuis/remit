import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { ContractsListPage } from "@/features/contracts"
import { getContractsPageData } from "@/features/contracts/server"

export const metadata: Metadata = {
  title: t("contracts.metadata.list")
}

type ContractsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const ContractsPage = async ({ searchParams }: ContractsPageProps) => {
  const data = await getContractsPageData(await searchParams)

  return <ContractsListPage data={data} />
}

export default ContractsPage
