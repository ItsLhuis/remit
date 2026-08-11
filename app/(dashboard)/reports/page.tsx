import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { ReportsPage } from "@/features/reports"
import { getReportsPageData } from "@/features/reports/server"

export const metadata: Metadata = {
  title: t("reports.metadata.list")
}

type ReportsRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const ReportsRoute = async ({ searchParams }: ReportsRouteProps) => {
  const data = await getReportsPageData(await searchParams)

  return <ReportsPage data={data} />
}

export default ReportsRoute
