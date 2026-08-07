import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { ActivityFeedPage } from "@/features/activityLog"
import { getActivityFeedPageData } from "@/features/activityLog/server"

export const metadata: Metadata = {
  title: t("activity.metadata.feed")
}

type ActivityRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const ActivityRoute = async ({ searchParams }: ActivityRouteProps) => {
  const data = await getActivityFeedPageData(await searchParams)

  return <ActivityFeedPage data={data} />
}

export default ActivityRoute
