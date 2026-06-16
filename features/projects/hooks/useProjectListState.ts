"use client"

import { type TransitionStartFunction } from "react"

import { debounce, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs"

import { PROJECT_STATUS_FILTERS, type ProjectStatusFilter } from "../schemas"

export function useProjectListState(startTransition: TransitionStartFunction) {
  const [search, setSearch] = useQueryState(
    "search",
    parseAsString
      .withDefault("")
      .withOptions({ shallow: false, startTransition, limitUrlUpdates: debounce(300) })
  )

  const [status, setStatus] = useQueryState(
    "status",
    parseAsStringLiteral(PROJECT_STATUS_FILTERS)
      .withDefault("active")
      .withOptions({ shallow: false, startTransition })
  )

  const setStatusFilter = (next: ProjectStatusFilter) => {
    void setStatus(next)
  }

  return {
    search,
    setSearch,
    status,
    setStatus: setStatusFilter
  }
}
