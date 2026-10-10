import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { requireRole } from "@/lib/auth/session"

import { ActivityFeedPage } from "@/features/activityLog"
import { getActivityFeedPageData } from "@/features/activityLog/server"

export const metadata: Metadata = {
  title: t("activity.metadata.feed")
}

type ActivityRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const ActivityRoute = async ({ searchParams }: ActivityRouteProps) => {
  const { role } = await requireRole(["owner", "accountant", "assistant"])

  // The trash is owner-only (`/settings/data`), so only the owner is offered a way into it.
  const data = await getActivityFeedPageData(await searchParams, {
    canOpenTrash: role === "owner"
  })

  return <ActivityFeedPage data={data} />
}

export default ActivityRoute
