import { logger } from "@/lib/logger"

import { QUEUE_COUNT_STATES, readQueueJobCounts, readScheduledJobStats } from "@/lib/jobs"

import pkg from "@/package.json"

import { type MetricFamily } from "./exposition"

type CollectorName = "queue" | "scheduled_jobs"

type Collector = {
  name: CollectorName
  collect: () => Promise<MetricFamily[]>
}

type CollectorResult = {
  name: CollectorName
  ok: boolean
  families: MetricFamily[]
}

// Well inside a scraper's default ten-second timeout. The bound is what keeps a Redis outage from
// hanging the scrape: `lib/jobs/connection.ts` sets `maxRetriesPerRequest: null` for BullMQ's sake,
// so a command issued while Redis is down is queued until it comes back rather than rejected, and an
// unbounded await here would never settle.
const COLLECTOR_TIMEOUT_MS = 2_000

const COLLECTORS: Collector[] = [
  { name: "queue", collect: collectQueueMetrics },
  { name: "scheduled_jobs", collect: collectScheduledJobMetrics }
]

// Everything `/api/metrics` can ever expose is assembled here, and nothing else in the codebase
// produces a family: this list is the allowlist, and `__tests__/handleMetricsRequest.test.ts` pins
// it so a metric added later has to be added there too. No family carries a count of domain rows
// (ARCHITECTURE.md section 1) and every label value is drawn from a closed vocabulary — a queue
// state, a scheduled job name, a collector name — never from a path, an id or a message.
//
// A collector that fails or times out drops its own families and reports `0` on
// `remit_metrics_collector_up` instead of failing the response: a 500 because Redis blipped would
// throw away the process metrics that were still true and tell the operator nothing about why.
export async function collectMetrics(): Promise<MetricFamily[]> {
  const results = await Promise.all(COLLECTORS.map(runCollector))

  return [
    ...collectProcessMetrics(),
    ...results.flatMap((result) => result.families),
    {
      name: "remit_metrics_collector_up",
      help: "Whether a metrics collector succeeded on this scrape (1) or failed or timed out (0).",
      type: "gauge",
      samples: results.map((result) => ({
        labels: { collector: result.name },
        value: result.ok ? 1 : 0
      }))
    }
  ]
}

async function runCollector(collector: Collector): Promise<CollectorResult> {
  try {
    const families = await withTimeout(collector.collect(), COLLECTOR_TIMEOUT_MS)

    return { name: collector.name, ok: true, families }
  } catch (error) {
    logger.warn(
      { action: "metrics.collect", collector: collector.name, err: error },
      "Metrics collector failed"
    )

    return { name: collector.name, ok: false, families: [] }
  }
}

// Read in-process at scrape time from the app container, which is the process answering the
// request. The worker's own memory is not visible from here and is deliberately not reported.
function collectProcessMetrics(): MetricFamily[] {
  const memory = process.memoryUsage()

  return [
    {
      name: "remit_build_info",
      help: "Remit build information; the value is always 1.",
      type: "gauge",
      samples: [{ labels: { version: pkg.version }, value: 1 }]
    },
    {
      name: "process_start_time_seconds",
      help: "Start time of the process since the Unix epoch in seconds.",
      type: "gauge",
      samples: [{ value: Math.round(Date.now() / 1000 - process.uptime()) }]
    },
    {
      name: "process_resident_memory_bytes",
      help: "Resident memory size in bytes.",
      type: "gauge",
      samples: [{ value: memory.rss }]
    },
    {
      name: "nodejs_heap_size_used_bytes",
      help: "Process heap size used by the V8 heap in bytes.",
      type: "gauge",
      samples: [{ value: memory.heapUsed }]
    }
  ]
}

// Per state, never per job name: a count of pending `invoice.reminder.send` or
// `invoice.email.send` jobs is a count of the instance's invoices seen through a keyhole, while the
// per-state total is the operational signal — a rising `failed` is the one number here most worth
// an alert. Completed jobs are omitted because `DEFAULT_JOB_OPTIONS` prunes them, so their count
// measures retention rather than work.
async function collectQueueMetrics(): Promise<MetricFamily[]> {
  const counts = await readQueueJobCounts()

  return [
    {
      name: "remit_queue_jobs",
      help: "Jobs in the background job queue, by state.",
      type: "gauge",
      samples: QUEUE_COUNT_STATES.map((state) => ({ labels: { state }, value: counts[state] }))
    }
  ]
}

async function collectScheduledJobMetrics(): Promise<MetricFamily[]> {
  const stats = await readScheduledJobStats()

  return [
    {
      name: "remit_scheduled_job_runs_total",
      help: "Scheduled job runs recorded by the worker, by outcome. A failure counts once, after its last retry.",
      type: "counter",
      samples: stats.flatMap((entry) => [
        { labels: { job: entry.job, outcome: "completed" }, value: entry.completed },
        { labels: { job: entry.job, outcome: "failed" }, value: entry.failed }
      ])
    },
    {
      name: "remit_scheduled_job_last_success_timestamp_seconds",
      help: "When a scheduled job last completed, in seconds since the Unix epoch.",
      type: "gauge",
      samples: stats.flatMap((entry) =>
        entry.lastSuccessAt === null
          ? []
          : [{ labels: { job: entry.job }, value: entry.lastSuccessAt }]
      )
    }
  ]
}

async function withTimeout<TValue>(promise: Promise<TValue>, timeoutMs: number): Promise<TValue> {
  let timer: ReturnType<typeof setTimeout> | undefined

  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs)
  })

  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}
