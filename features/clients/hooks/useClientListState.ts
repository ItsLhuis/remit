"use client"

import { type TransitionStartFunction } from "react"

import { debounce, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs"

import { CLIENT_STATUS_FILTERS, type ClientStatusFilter } from "../schemas"

export function useClientListState(startTransition: TransitionStartFunction) {
  const [search, setSearch] = useQueryState(
    "search",
    parseAsString
      .withDefault("")
      .withOptions({ shallow: false, startTransition, limitUrlUpdates: debounce(300) })
  )

  const [status, setStatus] = useQueryState(
    "status",
    parseAsStringLiteral(CLIENT_STATUS_FILTERS)
      .withDefault("active")
      .withOptions({ shallow: false, startTransition })
  )

  const setStatusFilter = (next: ClientStatusFilter) => {
    void setStatus(next)
  }

  return {
    search,
    setSearch,
    status,
    setStatus: setStatusFilter
  }
}
