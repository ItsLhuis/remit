import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { DashboardPage } from "@/features/dashboard"
import { getDashboardPageData } from "@/features/dashboard/server"

export const metadata: Metadata = {
  title: t("app.metadata.dashboardTitle")
}

type DashboardRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const DashboardRoute = async ({ searchParams }: DashboardRouteProps) => {
  const data = await getDashboardPageData(await searchParams)

  return <DashboardPage data={data} />
}

export default DashboardRoute
