"use client"

import { parseAsArrayOf, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs"

import {
  TASK_PRIORITY_VALUES,
  TASK_VIEW_VALUES,
  type TaskPriority,
  type TaskView
} from "../schemas"

export function useTaskBoardState() {
  const [view, setView] = useQueryState(
    "view",
    parseAsStringLiteral(TASK_VIEW_VALUES).withDefault("kanban").withOptions({ shallow: true })
  )

  const [search, setSearchValue] = useQueryState(
    "search",
    parseAsString.withDefault("").withOptions({ shallow: true })
  )

  const [priorities, setPrioritiesValue] = useQueryState(
    "priority",
    parseAsArrayOf(parseAsStringLiteral(TASK_PRIORITY_VALUES))
      .withDefault([])
      .withOptions({ shallow: true })
  )

  const setBoardView = (next: TaskView) => {
    void setView(next)
  }

  const setSearch = (next: string) => {
    void setSearchValue(next === "" ? null : next)
  }

  const setPriorities = (next: TaskPriority[]) => {
    void setPrioritiesValue(next.length > 0 ? next : null)
  }

  const togglePriority = (priority: TaskPriority) => {
    setPriorities(
      priorities.includes(priority)
        ? priorities.filter((value) => value !== priority)
        : [...priorities, priority]
    )
  }

  const clearFilters = () => {
    void setSearchValue(null)
    void setPrioritiesValue(null)
  }

  const hasActiveFilters = search !== "" || priorities.length > 0

  return {
    view,
    setView: setBoardView,
    search,
    setSearch,
    priorities,
    setPriorities,
    togglePriority,
    clearFilters,
    hasActiveFilters
  }
}
