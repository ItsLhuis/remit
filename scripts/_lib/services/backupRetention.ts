export type BackupRetentionArchive = {
  createdAt: Date
  key: string
  size?: number
}

export type BackupRetentionPolicy = {
  daily: number
  weekly: number
  monthly: number
}

const DAY_MS = 24 * 60 * 60 * 1000

export function computeRetentionDeletions(
  existing: BackupRetentionArchive[],
  policy: BackupRetentionPolicy,
  now: Date
): string[] {
  if (existing.length === 0) return []

  const normalizedPolicy = {
    daily: normalizeRetentionCount(policy.daily),
    weekly: normalizeRetentionCount(policy.weekly),
    monthly: normalizeRetentionCount(policy.monthly)
  }
  const ordered = [...existing].sort(compareNewestFirst)
  const kept = new Set<string>()
  const dailyCutoff = new Date(now.getTime() - normalizedPolicy.daily * DAY_MS)
  const monthlyCutoff = new Date(
    now.getTime() - (normalizedPolicy.daily + normalizedPolicy.weekly * 7) * DAY_MS
  )

  keepMostRecentPerGroup({
    archives: ordered.filter((archive) => archive.createdAt >= dailyCutoff),
    groupKey: (archive) => calendarDayKey(archive.createdAt),
    keepCount: normalizedPolicy.daily,
    kept
  })

  keepMostRecentPerGroup({
    archives: ordered.filter(
      (archive) => archive.createdAt < dailyCutoff && archive.createdAt >= monthlyCutoff
    ),
    groupKey: (archive) => isoWeekKey(archive.createdAt),
    keepCount: normalizedPolicy.weekly,
    kept
  })

  keepMostRecentPerGroup({
    archives: ordered.filter((archive) => archive.createdAt < monthlyCutoff),
    groupKey: (archive) => calendarMonthKey(archive.createdAt),
    keepCount: normalizedPolicy.monthly,
    kept
  })

  return existing
    .filter((archive) => !kept.has(archive.key))
    .sort(compareOldestFirst)
    .map((archive) => archive.key)
}

function keepMostRecentPerGroup(input: {
  archives: BackupRetentionArchive[]
  groupKey: (archive: BackupRetentionArchive) => string
  keepCount: number
  kept: Set<string>
}): void {
  if (input.keepCount <= 0) return

  const seenGroups = new Set<string>()

  for (const archive of input.archives) {
    if (input.kept.has(archive.key)) continue

    const group = input.groupKey(archive)

    if (seenGroups.has(group)) continue
    if (seenGroups.size >= input.keepCount) return

    seenGroups.add(group)
    input.kept.add(archive.key)
  }
}

function normalizeRetentionCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
}

function compareNewestFirst(left: BackupRetentionArchive, right: BackupRetentionArchive): number {
  const timestampDiff = right.createdAt.getTime() - left.createdAt.getTime()

  return timestampDiff === 0 ? left.key.localeCompare(right.key) : timestampDiff
}

function compareOldestFirst(left: BackupRetentionArchive, right: BackupRetentionArchive): number {
  const timestampDiff = left.createdAt.getTime() - right.createdAt.getTime()

  return timestampDiff === 0 ? left.key.localeCompare(right.key) : timestampDiff
}

function calendarDayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function calendarMonthKey(date: Date): string {
  return date.toISOString().slice(0, 7)
}

function isoWeekKey(date: Date): string {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = value.getUTCDay() || 7
  value.setUTCDate(value.getUTCDate() + 4 - day)

  const year = value.getUTCFullYear()
  const yearStart = new Date(Date.UTC(year, 0, 1))
  const week = Math.ceil(((value.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7)

  return `${year}-W${String(week).padStart(2, "0")}`
}
