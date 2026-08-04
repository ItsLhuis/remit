"use client"

import { type TransitionStartFunction } from "react"

import { debounce, parseAsInteger, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs"

export function useListFilters<TStatus extends string>(
  statusValues: readonly TStatus[],
  defaultStatus: TStatus,
  startTransition: TransitionStartFunction,
  statusKey = "status"
) {
  // `shallow: false` on purpose: these filters narrow a server-paginated list, so the URL change
  // has to re-run the server component that fetches it. It is the deliberate opposite of the task
  // board, which holds its whole column set client-side and stays shallow. Every setter resets the
  // page first, because a narrower result set can leave the current page past the end of it.
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
