// How long a produced export artifact — a data export archive or a rendered report PDF — stays
// downloadable before the nightly sweep removes it with its object.
//
// A fixed week rather than a setting or one of the retention windows. An artifact is a copy of data
// the instance still holds, made to be downloaded, so asking again costs a minute and nothing is lost
// when it goes; a week covers the owner who requests on Friday and downloads on Monday. A setting
// would be one more number to understand for no decision anyone has asked to make. The retention
// windows were rejected on meaning, not size: they govern how long a deleted record is legally held,
// they default to "never", and tying a whole-instance archive in a bucket to either would keep every
// export forever on a default instance — the accumulation this exists to end.
export const EXPORT_ARTIFACT_LIFETIME_DAYS = 7

const MILLISECONDS_PER_DAY = 86_400_000

// `producedAt` is when the artifact finished (`completed_at`), or when it was asked for when it never
// finished: a failed or abandoned request has no object, and its row expires on the same clock.
export function getExportArtifactExpiresAt(producedAt: Date): Date {
  return new Date(producedAt.getTime() + EXPORT_ARTIFACT_LIFETIME_DAYS * MILLISECONDS_PER_DAY)
}

export function isExportArtifactExpired(producedAt: Date, now: Date): boolean {
  return getExportArtifactExpiresAt(producedAt).getTime() <= now.getTime()
}

// The newest production time that has expired by `now`, so a sweep can select expired rows in SQL.
export function getExportArtifactCutoff(now: Date): Date {
  return new Date(now.getTime() - EXPORT_ARTIFACT_LIFETIME_DAYS * MILLISECONDS_PER_DAY)
}
