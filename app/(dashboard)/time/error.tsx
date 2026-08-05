"use client"

import { TimeEntryRouteError } from "@/features/timeTracking"

type TimeErrorProps = {
  reset: () => void
}

const TimeError = ({ reset }: TimeErrorProps) => {
  return <TimeEntryRouteError reset={reset} />
}

export default TimeError
