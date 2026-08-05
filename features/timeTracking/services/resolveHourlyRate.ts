export type HourlyRateSource = "entry" | "task" | "project" | "client" | "settings" | "none"

export type HourlyRateSources = {
  entry: { hourlyRateOverrideCents: number | null } | null
  task: { hourlyRateCents: number | null } | null
  project: { hourlyRateCents: number | null } | null
  client: { defaultHourlyRateCents: number | null } | null
  settings: { defaultHourlyRateCents: number | null } | null
}

export type ResolvedHourlyRate = {
  rateCents: number
  source: HourlyRateSource
}

// The ladder tests for "a rate was set", never for "a rate is non-zero". Zero is a rate a
// freelancer genuinely agrees to — a pro-bono client, a written-off task — so a zero at any rung
// stops the fallthrough and wins exactly as a non-zero one does. Treating it as absent would
// silently re-price that work at a rung further down.
//
// `"none"` with 0 cents is the honest answer for an instance that has configured no rate anywhere.
// It is never a default rate in disguise: the caller snapshots what it gets, and no rate is
// invented here or at any call site.
export function resolveHourlyRate({
  entry,
  task,
  project,
  client,
  settings
}: HourlyRateSources): ResolvedHourlyRate {
  const ladder: Array<[HourlyRateSource, number | null | undefined]> = [
    ["entry", entry?.hourlyRateOverrideCents],
    ["task", task?.hourlyRateCents],
    ["project", project?.hourlyRateCents],
    ["client", client?.defaultHourlyRateCents],
    ["settings", settings?.defaultHourlyRateCents]
  ]

  for (const [source, rateCents] of ladder) {
    if (rateCents !== null && rateCents !== undefined) return { rateCents, source }
  }

  return { rateCents: 0, source: "none" }
}
