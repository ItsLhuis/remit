"use client"

import { type TransitionStartFunction } from "react"

import { debounce, parseAsInteger, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs"

export function useListFilters<TStatus extends string>(
  statusValues: readonly TStatus[],
  defaultStatus: TStatus,
  startTransition: TransitionStartFunction,
  statusKey = "status"
) {
  const sharedOptions = { shallow: false as const, startTransition }

  const [, setPage] = useQueryState(
    "page",
    parseAsInteger.withOptions(sharedOptions).withDefault(1)
  )

  const [search, setSearchValue] = useQueryState(
    "search",
    parseAsString.withDefault("").withOptions({ ...sharedOptions, limitUrlUpdates: debounce(300) })
  )

  const [status, setStatusValue] = useQueryState(
    statusKey,
    parseAsStringLiteral(statusValues).withDefault(defaultStatus).withOptions(sharedOptions)
  )

  const setSearch = (next: string) => {
    void setPage(1)
    void setSearchValue(next)
  }

  const setStatus = (next: TStatus) => {
    void setPage(1)
    void setStatusValue(next)
  }

  return { search, setSearch, status, setStatus }
}
