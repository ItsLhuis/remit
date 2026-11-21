"use client"

import { LeadRouteError } from "@/features/leads"

type LeadDetailErrorProps = {
  reset: () => void
}

const LeadDetailError = ({ reset }: LeadDetailErrorProps) => {
  return <LeadRouteError reset={reset} />
}

export default LeadDetailError
