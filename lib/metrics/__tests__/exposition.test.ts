import { describe, expect, test } from "vitest"

import { formatExposition, type MetricFamily } from "../exposition"

describe("formatExposition", () => {
  test("renders help, type and samples in the text format when families are valid", () => {
    const families: MetricFamily[] = [
      {
        name: "remit_queue_jobs",
        help: "Jobs in the queue, by state.",
        type: "gauge",
        samples: [
          { labels: { state: "waiting" }, value: 2 },
          { labels: { state: "failed" }, value: 0 }
        ]
      },
      {
        name: "remit_scheduled_job_runs_total",
        help: "Runs.",
        type: "counter",
        samples: [{ labels: { job: "backup.run.sweep", outcome: "completed" }, value: 3 }]
      },
      {
        name: "process_resident_memory_bytes",
        help: "Resident memory.",
        type: "gauge",
        samples: [{ value: 1024 }]
      }
    ]

    const output = formatExposition(families)

    expect(output).toBe(
      [
        "# HELP remit_queue_jobs Jobs in the queue, by state.",
        "# TYPE remit_queue_jobs gauge",
        'remit_queue_jobs{state="waiting"} 2',
        'remit_queue_jobs{state="failed"} 0',
        "# HELP remit_scheduled_job_runs_total Runs.",
        "# TYPE remit_scheduled_job_runs_total counter",
        'remit_scheduled_job_runs_total{job="backup.run.sweep",outcome="completed"} 3',
        "# HELP process_resident_memory_bytes Resident memory.",
        "# TYPE process_resident_memory_bytes gauge",
        "process_resident_memory_bytes 1024",
        ""
      ].join("\n")
    )
  })

  test("escapes backslashes, quotes and newlines in label values and help text", () => {
    const output = formatExposition([
      {
        name: "remit_build_info",
        help: "Line one\nback\\slash",
        type: "gauge",
        samples: [{ labels: { version: 'a"b\\c\nd' }, value: 1 }]
      }
    ])

    expect(output).toContain("# HELP remit_build_info Line one\\nback\\\\slash\n")
    expect(output).toContain('remit_build_info{version="a\\"b\\\\c\\nd"} 1\n')
  })

  test("renders non-finite values in the spellings a scraper accepts", () => {
    const output = formatExposition([
      {
        name: "remit_values",
        help: "Values.",
        type: "gauge",
        samples: [
          { labels: { kind: "nan" }, value: Number.NaN },
          { labels: { kind: "up" }, value: Number.POSITIVE_INFINITY },
          { labels: { kind: "down" }, value: Number.NEGATIVE_INFINITY }
        ]
      }
    ])

    expect(output).toContain('remit_values{kind="nan"} NaN\n')
    expect(output).toContain('remit_values{kind="up"} +Inf\n')
    expect(output).toContain('remit_values{kind="down"} -Inf\n')
  })

  test("omits a family with no samples when its collector produced nothing", () => {
    const output = formatExposition([
      { name: "remit_empty", help: "Nothing.", type: "gauge", samples: [] }
    ])

    expect(output).toBe("")
  })

  test("refuses a counter whose name does not end in _total", () => {
    expect(() =>
      formatExposition([
        { name: "remit_runs", help: "Runs.", type: "counter", samples: [{ value: 1 }] }
      ])
    ).toThrow("must end in _total")
  })

  test("refuses two samples with the same label set when a family repeats a series", () => {
    expect(() =>
      formatExposition([
        {
          name: "remit_queue_jobs",
          help: "Jobs.",
          type: "gauge",
          samples: [
            { labels: { state: "failed" }, value: 1 },
            { labels: { state: "failed" }, value: 2 }
          ]
        }
      ])
    ).toThrow("Duplicate series")
  })

  test("refuses a family name that appears twice", () => {
    const family: MetricFamily = {
      name: "remit_build_info",
      help: "Build.",
      type: "gauge",
      samples: [{ value: 1 }]
    }

    expect(() => formatExposition([family, family])).toThrow("Duplicate metric family")
  })

  test("refuses metric and label names outside the allowed character set", () => {
    expect(() =>
      formatExposition([{ name: "remit-jobs", help: "x", type: "gauge", samples: [{ value: 1 }] }])
    ).toThrow("Invalid metric name")

    expect(() =>
      formatExposition([
        {
          name: "remit_jobs",
          help: "x",
          type: "gauge",
          samples: [{ labels: { "job-name": "x" }, value: 1 }]
        }
      ])
    ).toThrow("Invalid label name")

    expect(() =>
      formatExposition([
        {
          name: "remit_jobs",
          help: "x",
          type: "gauge",
          samples: [{ labels: { __name__: "x" }, value: 1 }]
        }
      ])
    ).toThrow("Invalid label name")
  })
})
