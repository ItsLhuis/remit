"use client"

import { type TransitionStartFunction } from "react"

import { useListFilters } from "@/hooks"

import { LEAD_STATUS_FILTERS } from "../schemas"

export function useLeadListState(startTransition: TransitionStartFunction) {
  return useListFilters(LEAD_STATUS_FILTERS, "active", startTransition)
}
