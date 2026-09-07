export type RetentionWindow = "trash" | "financial"

export type RetentionPolicy = {
  trashDays: number | null
  financialDays: number | null
}

const MILLISECONDS_PER_DAY = 86_400_000

export function getRetentionWindowDays(
  policy: RetentionPolicy,
  window: RetentionWindow
): number | null {
  return window === "financial" ? policy.financialDays : policy.trashDays
}

// Null whenever the governing window is unset, which is the shape "never purge" takes everywhere:
// the settings columns default to null, so a freshly migrated instance has no purge date for any
// row and the sweep below finds nothing to do.
export function getPurgeDueAt(
  deletedAt: Date,
  policy: RetentionPolicy,
  window: RetentionWindow
): Date | null {
  const days = getRetentionWindowDays(policy, window)

  if (days === null) return null

  return new Date(deletedAt.getTime() + days * MILLISECONDS_PER_DAY)
}

export function isPurgeable(
  deletedAt: Date,
  policy: RetentionPolicy,
  window: RetentionWindow,
  now: Date
): boolean {
  const dueAt = getPurgeDueAt(deletedAt, policy, window)

  if (dueAt === null) return false

  return dueAt.getTime() <= now.getTime()
}

// The cutoff a purge compares `deleted_at` against, so the sweep expresses the window once in SQL
// rather than reading every soft-deleted row into the process to date it.
export function getPurgeCutoff(
  policy: RetentionPolicy,
  window: RetentionWindow,
  now: Date
): Date | null {
  const days = getRetentionWindowDays(policy, window)

  if (days === null) return null

  return new Date(now.getTime() - days * MILLISECONDS_PER_DAY)
}
