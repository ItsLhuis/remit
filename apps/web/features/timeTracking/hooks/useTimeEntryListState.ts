"use client"

import { type TransitionStartFunction } from "react"

import { useListFilters } from "@/hooks"

import { TIME_ENTRY_STATUS_FILTERS } from "../schemas"

export function useTimeEntryListState(startTransition: TransitionStartFunction) {
  return useListFilters(TIME_ENTRY_STATUS_FILTERS, "active", startTransition)
}
