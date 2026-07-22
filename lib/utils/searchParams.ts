// Readers for Next.js `searchParams`, which arrives as an untyped record whose values may be a
// string, a repeated string array, or absent. Every list query parses through these before its Zod
// schema, so a malformed URL degrades to the default instead of throwing.

export function readStringParam(input: unknown, key: string): string {
  if (input instanceof URLSearchParams) return input.get(key) ?? ""

  if (typeof input !== "object" || input === null) return ""

  const value = (input as Record<string, unknown>)[key]

  if (Array.isArray(value)) {
    const first = value[0]

    return typeof first === "string" ? first : ""
  }

  return typeof value === "string" ? value : ""
}

export function readArrayParam(input: unknown, key: string): string[] {
  const raw = readStringParam(input, key)

  if (!raw) return []

  return raw.split(",").flatMap((value) => {
    const trimmed = value.trim()

    return trimmed ? [trimmed] : []
  })
}

export function readIntParam(input: unknown, key: string, fallback: number): number {
  const parsed = Number.parseInt(readStringParam(input, key), 10)

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function readNumberAt(values: string[], index: number): number | null {
  const raw = values[index]

  if (raw === undefined || raw === "") return null

  const parsed = Number.parseInt(raw, 10)

  return Number.isFinite(parsed) ? parsed : null
}

export function readDateAt(values: string[], index: number): Date | null {
  const raw = values[index]

  if (raw === undefined || raw === "") return null

  const parsed = Number.parseInt(raw, 10)

  return Number.isFinite(parsed) ? new Date(parsed) : null
}

// The sorting state travels as a JSON array; the caller's Zod schema is what validates the shape, so
// this only has to hand back the feature's own default when the parameter is missing or malformed.
export function readSortParam(input: unknown, fallback: unknown): unknown {
  const raw = readStringParam(input, "sort")

  if (!raw) return fallback

  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}
