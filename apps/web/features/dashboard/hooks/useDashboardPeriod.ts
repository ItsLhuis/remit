"use client"

import { type TransitionStartFunction } from "react"

import { parseAsStringLiteral, useQueryState } from "nuqs"

import { DASHBOARD_PERIODS, DEFAULT_DASHBOARD_PERIOD } from "../schemas"

// `shallow: false` on purpose: the period decides which rows the server aggregates, so the URL
// change has to re-run the server component that reads them rather than settling in the client.
export function useDashboardPeriod(startTransition: TransitionStartFunction) {
  return useQueryState(
    "period",
    parseAsStringLiteral(DASHBOARD_PERIODS)
      .withDefault(DEFAULT_DASHBOARD_PERIOD)
      .withOptions({ shallow: false, startTransition })
  )
}
