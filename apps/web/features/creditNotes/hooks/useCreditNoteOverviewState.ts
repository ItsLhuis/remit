"use client"

import { type TransitionStartFunction } from "react"

import { debounce, parseAsInteger, parseAsString, useQueryState } from "nuqs"

// The overview has no population toggle of its own — a credit note has no status, so there is nothing
// to switch between — which is why it cannot use the shared `useListFilters`: that hook always owns a
// status parameter, and inventing one here would put a dead parameter in every URL. Only the
// free-text search is synced, and it resets the page so a narrowed result set never lands out of
// range. Every other filter is a column filter owned by `useDataTable`.
export function useCreditNoteOverviewState(startTransition: TransitionStartFunction) {
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
