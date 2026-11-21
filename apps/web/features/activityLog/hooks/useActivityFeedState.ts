"use client"

import { type TransitionStartFunction } from "react"

import { parseAsInteger, parseAsStringLiteral, useQueryState } from "nuqs"

import {
  ACTIVITY_ENTITY_TYPES,
  ACTIVITY_READ_FILTERS,
  type ActivityEntityType,
  type ActivityReadFilter
} from "../schemas"

export function useActivityFeedState(startTransition: TransitionStartFunction) {
  // `shallow: false` on purpose: the feed is paginated on the server, so a filter change has to
  // re-run the server component that reads it. Both filter setters reset the page first, because a
  // narrower result set can leave the current page past the end of it.
  const sharedOptions = { shallow: false as const, startTransition }

  const [, setPageValue] = useQueryState(
    "page",
    parseAsInteger.withOptions(sharedOptions).withDefault(1)
  )

  const [entityType, setEntityTypeValue] = useQueryState(
    "type",
    parseAsStringLiteral(ACTIVITY_ENTITY_TYPES).withOptions(sharedOptions)
  )

  const [read, setReadValue] = useQueryState(
    "read",
    parseAsStringLiteral(ACTIVITY_READ_FILTERS).withDefault("all").withOptions(sharedOptions)
  )

  const setEntityType = (next: ActivityEntityType | null) => {
    void setPageValue(1)
    void setEntityTypeValue(next)
  }

  const setRead = (next: ActivityReadFilter) => {
    void setPageValue(1)
    void setReadValue(next)
  }

  const setPage = (next: number) => {
    void setPageValue(next)
  }

  const reset = () => {
    void setPageValue(1)
    void setEntityTypeValue(null)
    void setReadValue("all")
  }

  return { entityType, setEntityType, read, setRead, setPage, reset }
}
