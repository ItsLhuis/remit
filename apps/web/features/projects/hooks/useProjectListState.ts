"use client"

import { type TransitionStartFunction } from "react"

import { useListFilters } from "@/hooks"

import { PROJECT_STATUS_FILTERS } from "../schemas"

export function useProjectListState(startTransition: TransitionStartFunction) {
  return useListFilters(PROJECT_STATUS_FILTERS, "active", startTransition)
}
