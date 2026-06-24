import { type SortingState } from "@tanstack/react-table"

import { createParser } from "nuqs"

import { z } from "zod"

export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

const sortingItemSchema = z.object({
  id: z.string(),
  desc: z.boolean()
})

export function getSortingStateParser(columnIds?: Set<string>) {
  return createParser<SortingState>({
    parse: (value) => {
      try {
        const parsed: unknown = JSON.parse(value)
        const result = z.array(sortingItemSchema).safeParse(parsed)

        if (!result.success) return null

        if (columnIds && result.data.some((item) => !columnIds.has(item.id))) return null

        return result.data
      } catch {
        return null
      }
    },
    serialize: (value) => JSON.stringify(value),
    eq: (a, b) =>
      a.length === b.length &&
      a.every((item, index) => item.id === b[index]?.id && item.desc === b[index]?.desc)
  })
}
