"use client"

import { ReportRouteError } from "@/features/reports"

type ReportsErrorProps = {
  reset: () => void
}

const ReportsError = ({ reset }: ReportsErrorProps) => {
  return <ReportRouteError reset={reset} />
}

export default ReportsError
