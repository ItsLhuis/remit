import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { handleMetricsRequest } from "../handleMetricsRequest"

const TOKEN = "metrics-token-for-tests-0123456789abcdefghij"
const RESOLVED_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7"

const mocks = vi.hoisted(() => ({
  env: { REMIT_METRICS_TOKEN: undefined as string | undefined },
  readQueueJobCounts: vi.fn(),
  readScheduledJobStats: vi.fn(),
  writeAudit: vi.fn(async () => undefined),
  matchesPublicToken: vi.fn(),
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() }
}))

vi.mock("@/lib/config/env", () => ({ env: mocks.env }))

vi.mock("@/lib/logger", () => ({ logger: mocks.logger }))

vi.mock("@/lib/audit", () => ({ writeAudit: mocks.writeAudit }))

vi.mock("@/lib/i18n/server", () => ({ t: (key: string) => key }))

vi.mock("@/lib/jobs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/jobs")>()),
  readQueueJobCounts: mocks.readQueueJobCounts,
  readScheduledJobStats: mocks.readScheduledJobStats
}))

vi.mock("@/lib/publicToken", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/publicToken")>()

  mocks.matchesPublicToken.mockImplementation(original.matchesPublicToken)

  return { ...original, matchesPublicToken: mocks.matchesPublicToken }
})

// The allowlist, written out by hand rather than derived from `collectMetrics.ts`. Deriving it would
// let a metric added to the collector pass this test by construction, and this list is the security
// property: anything `/api/metrics` exposes has to be argued for here first.
const ALLOWED_METRICS = [
  "remit_build_info",
  "process_start_time_seconds",
  "process_resident_memory_bytes",
  "nodejs_heap_size_used_bytes",
  "remit_queue_jobs",
  "remit_scheduled_job_runs_total",
  "remit_scheduled_job_last_success_timestamp_seconds",
  "remit_metrics_collector_up"
]

// Every label name the endpoint may carry and the closed vocabulary its values come from. `version`
// is the one open value and is the application's own semver string.
const ALLOWED_LABEL_VALUES: Record<string, RegExp> = {
  version: /^\d+\.\d+\.\d+/,
  state: /^(waiting|active|delayed|prioritized|waiting-children|failed)$/,
  job: /^(backup\.run|recurring\.schedule|invoice\.overdue|invoice\.reminder|retention\.purge)\.sweep$/,
  outcome: /^(completed|failed)$/,
  collector: /^(queue|scheduled_jobs)$/
}

const METRIC_NAME_PATTERN = /^[a-zA-Z_:][a-zA-Z0-9_:]*$/

type ParsedSeries = { name: string; labels: Record<string, string>; value: string }

type ParsedExposition = {
  help: Map<string, string>
  types: Map<string, string>
  series: ParsedSeries[]
}

const HELP_LINE = /^# HELP (\S+) (.*)$/
const TYPE_LINE = /^# TYPE (\S+) (counter|gauge)$/
const SAMPLE_LINE = /^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{(.*)\})? (\S+)$/
const LABEL_PAIR = /([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\]|\\.)*)"/g

// A deliberately strict reader of the text format: a sample whose family has not already declared
// HELP and TYPE is a failure, which is what a scraper that honours metadata requires.
function parseExposition(body: string): ParsedExposition {
  const parsed: ParsedExposition = { help: new Map(), types: new Map(), series: [] }

  for (const line of body.split("\n")) {
    if (line.length > 0) readLine(parsed, line)
  }

  return parsed
}

function readLine(parsed: ParsedExposition, line: string): void {
  const [, helpName, helpText] = HELP_LINE.exec(line) ?? []
  const [, typeName, typeValue] = TYPE_LINE.exec(line) ?? []

  if (helpName) parsed.help.set(helpName, helpText ?? "")
  else if (typeName) parsed.types.set(typeName, typeValue ?? "")
  else parsed.series.push(readSample(parsed, line))
}

function readSample(parsed: ParsedExposition, line: string): ParsedSeries {
  const [, name = "", labelText = "", value = ""] = SAMPLE_LINE.exec(line) ?? []

  if (!value) throw new Error(`Unparseable line: ${line}`)
  if (!parsed.help.has(name) || !parsed.types.has(name)) {
    throw new Error(`Sample before metadata: ${line}`)
  }

  const labels = Object.fromEntries(
    [...labelText.matchAll(LABEL_PAIR)].map(([, key = "", labelValue = ""]) => [key, labelValue])
  )

  return { name, labels, value }
}

let requestCounter = 0

// A distinct client address per request, so the module-level rate-limit bucket one test fills is
// never the bucket another test reads.
function makeRequest(
  options: { authorization?: string; ip?: string; path?: string } = {}
): Request {
  requestCounter += 1

  const headers = new Headers({
    "x-forwarded-for": options.ip ?? `198.51.100.${requestCounter % 250}`,
    "user-agent": "vitest"
  })

  if (options.authorization !== undefined) headers.set("authorization", options.authorization)

  return new Request(`http://localhost:3000${options.path ?? "/api/metrics"}`, { headers })
}

async function readResponse(response: Response) {
  return {
    status: response.status,
    body: await response.text(),
    contentType: response.headers.get("content-type"),
    cacheControl: response.headers.get("cache-control"),
    robots: response.headers.get("x-robots-tag")
  }
}

beforeEach(() => {
  vi.clearAllMocks()

  mocks.env.REMIT_METRICS_TOKEN = TOKEN
  mocks.readQueueJobCounts.mockResolvedValue({
    waiting: 2,
    active: 1,
    delayed: 0,
    prioritized: 0,
    "waiting-children": 0,
    failed: 3
  })
  mocks.readScheduledJobStats.mockResolvedValue([
    { job: "backup.run.sweep", completed: 4, failed: 1, lastSuccessAt: 1_789_000_000 },
    { job: "recurring.schedule.sweep", completed: 0, failed: 0, lastSuccessAt: null }
  ])
})

afterEach(() => {
  vi.useRealTimers()
})

describe("handleMetricsRequest", () => {
  test("answers not found and collects nothing when no token is configured", async () => {
    mocks.env.REMIT_METRICS_TOKEN = undefined

    const response = await readResponse(
      await handleMetricsRequest(makeRequest({ authorization: `Bearer ${TOKEN}` }))
    )

    expect(response.status).toBe(404)
    expect(response.body).not.toContain("remit_")
    expect(mocks.readQueueJobCounts).not.toHaveBeenCalled()
    expect(mocks.readScheduledJobStats).not.toHaveBeenCalled()
  })

  test("answers a missing credential, a wrong one and a disabled endpoint identically", async () => {
    const missing = await readResponse(await handleMetricsRequest(makeRequest()))
    const wrong = await readResponse(
      await handleMetricsRequest(makeRequest({ authorization: `Bearer ${TOKEN.slice(1)}x` }))
    )
    const malformed = await readResponse(
      await handleMetricsRequest(makeRequest({ authorization: TOKEN }))
    )

    mocks.env.REMIT_METRICS_TOKEN = undefined

    const disabled = await readResponse(await handleMetricsRequest(makeRequest()))

    expect(missing.status).toBe(404)
    expect(wrong).toEqual(missing)
    expect(malformed).toEqual(missing)
    expect(disabled).toEqual(missing)
    expect(missing.cacheControl).toBe("no-store")
    expect(missing.robots).toBe("noindex, nofollow")
  })

  test("admits the credential through the constant-time comparison helper", async () => {
    await handleMetricsRequest(makeRequest({ authorization: "Bearer not-the-token" }))

    expect(mocks.matchesPublicToken).toHaveBeenCalledWith("not-the-token", TOKEN)
  })

  test("serves valid exposition format with metadata for every family when the credential is correct", async () => {
    const response = await readResponse(
      await handleMetricsRequest(makeRequest({ authorization: `Bearer ${TOKEN}` }))
    )
    const parsed = parseExposition(response.body)
    const seriesKeys = parsed.series.map(
      (entry) => `${entry.name}${JSON.stringify(Object.entries(entry.labels).toSorted())}`
    )

    expect(response.status).toBe(200)
    expect(response.contentType).toBe("text/plain; version=0.0.4; charset=utf-8")
    expect(response.cacheControl).toBe("no-store")
    expect(response.robots).toBe("noindex, nofollow")
    expect(new Set(seriesKeys).size).toBe(seriesKeys.length)
    expect([...parsed.types.keys()].every((name) => METRIC_NAME_PATTERN.test(name))).toBe(true)
    expect(
      [...parsed.types.entries()]
        .filter(([, type]) => type === "counter")
        .every(([name]) => name.endsWith("_total"))
    ).toBe(true)
    expect(parsed.series).toContainEqual({
      name: "remit_queue_jobs",
      labels: { state: "failed" },
      value: "3"
    })
    expect(parsed.series).toContainEqual({
      name: "remit_scheduled_job_runs_total",
      labels: { job: "backup.run.sweep", outcome: "failed" },
      value: "1"
    })
  })

  test("exposes no metric outside the allowlist", async () => {
    const response = await readResponse(
      await handleMetricsRequest(makeRequest({ authorization: `Bearer ${TOKEN}` }))
    )
    const parsed = parseExposition(response.body)

    expect([...parsed.types.keys()].toSorted()).toEqual(ALLOWED_METRICS.toSorted())
    expect(parsed.series.every((entry) => ALLOWED_METRICS.includes(entry.name))).toBe(true)
  })

  test("labels every series from a closed vocabulary and never from a request path or id", async () => {
    await handleMetricsRequest(makeRequest({ path: `/clients/${RESOLVED_ID}` }))

    const response = await readResponse(
      await handleMetricsRequest(
        makeRequest({ authorization: `Bearer ${TOKEN}`, path: `/api/metrics?id=${RESOLVED_ID}` })
      )
    )
    const parsed = parseExposition(response.body)

    expect(response.body).not.toContain(RESOLVED_ID)
    expect(response.body).not.toContain("/clients")

    for (const entry of parsed.series) {
      for (const [label, value] of Object.entries(entry.labels)) {
        expect(ALLOWED_LABEL_VALUES[label]?.test(value), `${entry.name}{${label}="${value}"}`).toBe(
          true
        )
      }
    }
  })

  test("degrades to the remaining metrics when a collector fails", async () => {
    mocks.readQueueJobCounts.mockRejectedValueOnce(new Error("Connection is closed."))

    const response = await readResponse(
      await handleMetricsRequest(makeRequest({ authorization: `Bearer ${TOKEN}` }))
    )
    const parsed = parseExposition(response.body)

    expect(response.status).toBe(200)
    expect(parsed.types.has("remit_queue_jobs")).toBe(false)
    expect(parsed.types.has("process_resident_memory_bytes")).toBe(true)
    expect(parsed.series).toContainEqual({
      name: "remit_metrics_collector_up",
      labels: { collector: "queue" },
      value: "0"
    })
    expect(parsed.series).toContainEqual({
      name: "remit_metrics_collector_up",
      labels: { collector: "scheduled_jobs" },
      value: "1"
    })
  })

  test("degrades rather than hanging when a collector never settles", async () => {
    vi.useFakeTimers()
    mocks.readScheduledJobStats.mockReturnValueOnce(new Promise(() => undefined))

    const pending = handleMetricsRequest(makeRequest({ authorization: `Bearer ${TOKEN}` }))

    await vi.advanceTimersByTimeAsync(2_000)

    const parsed = parseExposition((await readResponse(await pending)).body)

    expect(parsed.series).toContainEqual({
      name: "remit_metrics_collector_up",
      labels: { collector: "scheduled_jobs" },
      value: "0"
    })
    expect(parsed.types.has("remit_queue_jobs")).toBe(true)
  })

  test("rate-limits a caller and audits the trip whether or not metrics are enabled", async () => {
    mocks.env.REMIT_METRICS_TOKEN = undefined

    const statuses: number[] = []

    for (let attempt = 0; attempt < 31; attempt++) {
      statuses.push((await handleMetricsRequest(makeRequest({ ip: "203.0.113.77" }))).status)
    }

    expect(statuses.slice(0, 30).every((status) => status === 404)).toBe(true)
    expect(statuses[30]).toBe(429)
    expect(mocks.writeAudit).toHaveBeenCalledWith(
      "auth.rate_limit.tripped",
      expect.objectContaining({ ipAddress: "203.0.113.77", metadata: { route: "/api/metrics" } })
    )
  })

  test("never echoes or logs the token", async () => {
    mocks.readQueueJobCounts.mockRejectedValueOnce(new Error("Connection is closed."))

    const bodies = [
      await (await handleMetricsRequest(makeRequest({ authorization: `Bearer ${TOKEN}` }))).text(),
      await (await handleMetricsRequest(makeRequest({ authorization: "Bearer wrong" }))).text()
    ]
    const logged = JSON.stringify([
      mocks.logger.error.mock.calls,
      mocks.logger.warn.mock.calls,
      mocks.logger.info.mock.calls,
      mocks.writeAudit.mock.calls
    ])

    expect(bodies.some((body) => body.includes(TOKEN))).toBe(false)
    expect(logged).not.toContain(TOKEN)
  })
})
