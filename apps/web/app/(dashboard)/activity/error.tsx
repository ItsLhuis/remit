"use client"

import { ActivityRouteError } from "@/features/activityLog"

type ActivityErrorProps = {
  reset: () => void
}

const ActivityError = ({ reset }: ActivityErrorProps) => {
  return <ActivityRouteError reset={reset} />
}

export default ActivityError
