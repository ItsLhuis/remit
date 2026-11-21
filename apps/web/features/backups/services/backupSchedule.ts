export type BackupCadence = "daily" | "weekly"

export type BackupBannerState = "healthy" | "lastRunFailed" | "neverRun" | "overdue"

type BackupDueInput = {
  cadence: BackupCadence
  lastSuccessAt: Date | null
  now: Date
}

type BackupBannerInput = {
  cadence: BackupCadence
  lastFailureAt: Date | null
  lastSuccessAt: Date | null
  now: Date
}

const DAY_MS = 24 * 60 * 60 * 1000

const CADENCE_INTERVAL_MS: Record<BackupCadence, number> = {
  daily: DAY_MS,
  weekly: 7 * DAY_MS
}

// The sweep fires at one fixed hour, so two consecutive successes are stamped a little under a full
// interval apart: the second stamp is written when the run finishes, not when it started. Comparing
// against the bare interval would therefore refuse the tick after any run that took longer than
// nothing at all, and the instance would silently back up every other day. Four hours is one tick's
// worth of slack and no more — it can never let two runs land inside one interval.
const DUE_SLACK_MS = 4 * 60 * 60 * 1000

// A full missed occurrence plus a day, rather than the "N consecutive days" the architecture
// document phrased it as: N depends on the cadence, and warning a weekly instance after two days
// would be wrong every week. Daily warns after two missed nights, weekly after eight days.
const OVERDUE_GRACE_MS = DAY_MS

export function isBackupDue(input: BackupDueInput): boolean {
  if (!input.lastSuccessAt) return true

  const ageMs = input.now.getTime() - input.lastSuccessAt.getTime()

  return ageMs >= CADENCE_INTERVAL_MS[input.cadence] - DUE_SLACK_MS
}

// A failure newer than the last success outranks staleness, because it names the cause: an instance
// that is overdue *and* failing should be told why rather than told to wait.
export function evaluateBackupBannerState(input: BackupBannerInput): BackupBannerState {
  if (input.lastFailureAt && (!input.lastSuccessAt || input.lastFailureAt > input.lastSuccessAt)) {
    return "lastRunFailed"
  }

  if (!input.lastSuccessAt) return "neverRun"

  const ageMs = input.now.getTime() - input.lastSuccessAt.getTime()

  return ageMs > CADENCE_INTERVAL_MS[input.cadence] + OVERDUE_GRACE_MS ? "overdue" : "healthy"
}
