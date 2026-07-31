"use client"

import { type TransitionStartFunction } from "react"

import { debounce, parseAsInteger, parseAsString, useQueryState } from "nuqs"

// Mirrors useProposalOverviewState: the contract list has no population toggle of its own, so the
// shared `useListFilters` would put a dead status parameter in every URL. Only the free-text search
// is synced, and it resets the page so a narrowed result set never lands out of range.
export function useContractListState(startTransition: TransitionStartFunction) {
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
