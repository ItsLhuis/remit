import { type ApiListParams } from "../schemas"

export type ApiDateRange = {
  from: Date | null
  to: Date | null
}

export type ApiListFilterValue = string | readonly string[] | ApiDateRange | undefined

// The query a screen's own list parser reads (`parseInvoiceOverviewQuery` and its siblings), built
// from filters already validated by the caller. Nothing here decides which keys are allowed: each
// read in `resources.ts` names the keys it passes, and none of them passes `status`, the screens'
// trash selector — a surface published to a token reads live rows only, as the screen does by
// default.
export function toListSearchParams(
  params: ApiListParams,
  filters: Readonly<Record<string, ApiListFilterValue>> = {}
): URLSearchParams {
  const searchParams = new URLSearchParams({
    page: String(params.page),
    perPage: String(params.perPage)
  })

  for (const [key, value] of Object.entries(filters)) {
    const encoded = encodeFilterValue(value)

    if (encoded) searchParams.set(key, encoded)
  }

  return searchParams
}

function encodeFilterValue(value: ApiListFilterValue): string | undefined {
  if (value === undefined) return undefined

  if (typeof value === "string") return value.length > 0 ? value : undefined

  if (isDateRange(value)) return encodeDateRange(value)

  return value.length > 0 ? value.join(",") : undefined
}

// A range travels as `from,to` in epoch milliseconds, the shape `DataTableDateFilter` writes. The
// parsers split it with `readArrayParam`, which drops empty items, so an open start cannot be left
// blank — `,123` would read back as a start of 123. It is written as the epoch instead, which
// every stored date follows.
function encodeDateRange(range: ApiDateRange): string | undefined {
  if (!range.from && !range.to) return undefined

  const from = String(range.from?.getTime() ?? 0)

  return range.to ? `${from},${range.to.getTime()}` : from
}

function isDateRange(value: string | readonly string[] | ApiDateRange): value is ApiDateRange {
  return typeof value === "object" && !Array.isArray(value) && "from" in value
}
