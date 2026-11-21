"use client"

import { type TransitionStartFunction } from "react"

import { useListFilters } from "@/hooks"

import { CLIENT_STATUS_FILTERS } from "../schemas"

export function useClientListState(startTransition: TransitionStartFunction) {
  return useListFilters(CLIENT_STATUS_FILTERS, "active", startTransition)
}
