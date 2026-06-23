"use client"

import { parseAsStringLiteral, useQueryState } from "nuqs"

import { TASK_VIEW_VALUES, type TaskView } from "../schemas"

export function useTaskBoardState() {
  const [view, setView] = useQueryState(
    "view",
    parseAsStringLiteral(TASK_VIEW_VALUES).withDefault("kanban").withOptions({ shallow: true })
  )

  const setBoardView = (next: TaskView) => {
    void setView(next)
  }

  return {
    view,
    setView: setBoardView
  }
}
