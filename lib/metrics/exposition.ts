// The Prometheus text exposition format, version 0.0.4, which every Prometheus-compatible scraper
// accepts without content negotiation. Hand-formatted rather than through a client library: the
// endpoint serves a handful of counters and gauges with no histograms, and a library's in-process
// registry would hold none of the job metrics anyway, because those live in the worker process and
// are read from Redis at scrape time.

export type MetricType = "counter" | "gauge"

export type MetricSample = {
  labels?: Readonly<Record<string, string>>
  value: number
}

export type MetricFamily = {
  name: string
  help: string
  type: MetricType
  samples: readonly MetricSample[]
}

export const EXPOSITION_CONTENT_TYPE = "text/plain; version=0.0.4; charset=utf-8"

const METRIC_NAME_PATTERN = /^[a-zA-Z_:][a-zA-Z0-9_:]*$/
const LABEL_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/

// Every rule a scraper enforces is enforced here by throwing, because each one is a mistake in the
// code that builds the families rather than something a scrape can recover from: a malformed name
// is dropped by the scraper, a duplicate series fails the whole scrape, and a counter without
// `_total` graphs as a gauge in every tool that follows the naming convention.
export function formatExposition(families: readonly MetricFamily[]): string {
  const seenNames = new Set<string>()

  let output = ""

  for (const family of families) {
    if (family.samples.length === 0) continue

    assertValidFamily(family)

    if (seenNames.has(family.name)) throw new Error(`Duplicate metric family "${family.name}"`)

    seenNames.add(family.name)
    output += formatFamily(family)
  }

  return output
}

function assertValidFamily(family: MetricFamily): void {
  if (!METRIC_NAME_PATTERN.test(family.name)) {
    throw new Error(`Invalid metric name "${family.name}"`)
  }

  if (family.type === "counter" && !family.name.endsWith("_total")) {
    throw new Error(`Counter "${family.name}" must end in _total`)
  }
}

function formatFamily(family: MetricFamily): string {
  const seenSeries = new Set<string>()

  const lines = [
    `# HELP ${family.name} ${escapeHelp(family.help)}`,
    `# TYPE ${family.name} ${family.type}`
  ]

  for (const sample of family.samples) {
    const series = `${family.name}${formatLabels(sample.labels)}`

    if (seenSeries.has(series)) throw new Error(`Duplicate series "${series}"`)

    seenSeries.add(series)
    lines.push(`${series} ${formatValue(sample.value)}`)
  }

  return `${lines.join("\n")}\n`
}

function formatLabels(labels: Readonly<Record<string, string>> | undefined): string {
  const entries = Object.entries(labels ?? {})

  if (entries.length === 0) return ""

  const pairs = entries.map(([name, value]) => {
    if (!LABEL_NAME_PATTERN.test(name) || name.startsWith("__")) {
      throw new Error(`Invalid label name "${name}"`)
    }

    return `${name}="${escapeLabelValue(value)}"`
  })

  return `{${pairs.join(",")}}`
}

function formatValue(value: number): string {
  if (Number.isNaN(value)) return "NaN"
  if (value === Number.POSITIVE_INFINITY) return "+Inf"
  if (value === Number.NEGATIVE_INFINITY) return "-Inf"

  return String(value)
}

function escapeHelp(help: string): string {
  return help.replaceAll("\\", "\\\\").replaceAll("\n", "\\n")
}

function escapeLabelValue(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\n", "\\n")
}
