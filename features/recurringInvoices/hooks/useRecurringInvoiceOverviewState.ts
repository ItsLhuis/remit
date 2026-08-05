"use client"

import { type TransitionStartFunction } from "react"

import { debounce, parseAsInteger, parseAsString, useQueryState } from "nuqs"

// The overview's status is a multi-select column filter owned by `useDataTable`, not the single-value
// toggle `useListFilters` provides, so the shared hook cannot be used here: its status parameter is
// named `status` too and the two would fight over the same URL key. Only the free-text search is
// synced, and it resets the page so a narrowed result set never lands out of range. Every other
// filter is a column filter owned by `useDataTable`.
export function useRecurringInvoiceOverviewState(startTransition: TransitionStartFunction) {
  const sharedOptions = { shallow: false as const, startTransition }

  const [, setPage] = useQueryState(
    "page",
    parseAsInteger.withOptions(sharedOptions).withDefault(1)
  )

  const [search, setSearchValue] = useQueryState(
    "search",
    parseAsString.withDefault("").withOptions({ ...sharedOptions, limitUrlUpdates: debounce(300) })
  )

  const setSearch = (next: string) => {
    void setPage(1)
    void setSearchValue(next)
  }

  return { search, setSearch }
}
