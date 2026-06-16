"use client"

import { type TransitionStartFunction } from "react"

import { debounce, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs"

import { LEAD_STATUS_FILTERS, type LeadStatusFilter } from "../schemas"

export function useLeadListState(startTransition: TransitionStartFunction) {
  const [search, setSearch] = useQueryState(
    "search",
    parseAsString
      .withDefault("")
      .withOptions({ shallow: false, startTransition, limitUrlUpdates: debounce(300) })
  )

  const [status, setStatus] = useQueryState(
    "status",
    parseAsStringLiteral(LEAD_STATUS_FILTERS)
      .withDefault("active")
      .withOptions({ shallow: false, startTransition })
  )

  const setStatusFilter = (next: LeadStatusFilter) => {
    void setStatus(next)
  }

  return {
    search,
    setSearch,
    status,
    setStatus: setStatusFilter
  }
}
