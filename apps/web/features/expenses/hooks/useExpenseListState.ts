"use client"

import { type TransitionStartFunction } from "react"

import { useListFilters } from "@/hooks"

import { EXPENSE_STATUS_FILTERS } from "../schemas"

export function useExpenseListState(startTransition: TransitionStartFunction) {
  return useListFilters(EXPENSE_STATUS_FILTERS, "active", startTransition)
}
