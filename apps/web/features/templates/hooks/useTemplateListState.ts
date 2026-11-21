"use client"

import { type TransitionStartFunction } from "react"

import { useListFilters } from "@/hooks"

import { TEMPLATE_ORIGIN_FILTERS } from "../schemas"

export function useTemplateListState(startTransition: TransitionStartFunction) {
  return useListFilters(TEMPLATE_ORIGIN_FILTERS, "all", startTransition, "origin")
}
