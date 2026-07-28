"use client"

import { type TransitionStartFunction } from "react"

import { debounce, parseAsInteger, parseAsString, useQueryState } from "nuqs"

// The overview has no population toggle of its own, so it cannot use the shared `useListFilters`:
// that hook always owns a status parameter, and inventing a single-value one here would put a dead
// parameter in every URL. Only the free-text search is synced, and it resets the page like the
// shared hook does, so a narrowed result set never lands on an out-of-range page.
export function useProposalOverviewState(startTransition: TransitionStartFunction) {
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
