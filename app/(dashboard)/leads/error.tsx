"use client"

import { LeadRouteError } from "@/features/leads"

type LeadsErrorProps = {
  reset: () => void
}

const LeadsError = ({ reset }: LeadsErrorProps) => {
  return <LeadRouteError reset={reset} />
}

export default LeadsError
