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

        // Sort ids arrive from the URL and end up naming an order-by column, so an id outside the
        // caller's known column set invalidates the whole parse rather than being dropped: a
        // partially honoured sort would silently reorder a table by something the user never chose.
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
