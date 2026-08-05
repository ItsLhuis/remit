import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { TimeTrackingPage } from "@/features/timeTracking"
import { getTimeTrackingPageData } from "@/features/timeTracking/server"

export const metadata: Metadata = {
  title: t("timeTracking.metadata.list")
}

type TimeRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const TimeRoute = async ({ searchParams }: TimeRouteProps) => {
  const data = await getTimeTrackingPageData(await searchParams)

  return <TimeTrackingPage data={data} />
}

export default TimeRoute
