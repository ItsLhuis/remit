# Remit Metrics Runbook

This runbook points a Prometheus scraper at a Remit instance. Metrics are off until you turn them
on, and when on they are protected by one bearer token and nothing else.

What the endpoint exposes, and why it exposes nothing more, is in the metrics section of
[ARCHITECTURE.md](../architecture/ARCHITECTURE.md#16-observability) and in
[ADR-0036](../architecture/adr/0036-metrics-allowlist-and-collection.md).

## 1. Set the token

Generate a token and put it in `.env`:

```bash
openssl rand -base64 32
```

```bash
REMIT_METRICS_TOKEN=<the generated value>
```

Restart the app so it reads the new value:

```bash
docker compose up -d app
```

With the variable empty, `GET /api/metrics` answers `404` to everyone. That is also the answer to a
missing or wrong token, so a `404` after this step means the token did not reach the container or
the scraper is not sending it — the endpoint gives no more specific answer on purpose.

## 2. Check it by hand

```bash
curl -H "Authorization: Bearer <token>" https://remit.example.com/api/metrics
```

A working endpoint returns `200` with lines like `remit_queue_jobs{state="failed"} 0`.

## 3. Add the scrape job

```yaml
scrape_configs:
  - job_name: remit
    scheme: https
    metrics_path: /api/metrics
    scrape_interval: 15s
    authorization:
      type: Bearer
      credentials_file: /etc/prometheus/remit-token
    static_configs:
      - targets: ["remit.example.com"]
```

`credentials_file` keeps the token out of the Prometheus configuration. Scrape no more often than
every 5 seconds: the endpoint allows 30 requests per client IP per minute and answers `429` above
that.

## What to alert on

| Signal                                                           | Meaning                                                             |
| ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| `remit_queue_jobs{state="failed"}` rising                        | A background job exhausted its retries; the worker log says which   |
| `time() - remit_scheduled_job_last_success_timestamp_seconds`    | A nightly sweep has not completed; above 26 hours is a missed night |
| `increase(remit_scheduled_job_runs_total{outcome="failed"}[1d])` | A sweep failed after its last retry                                 |
| `remit_metrics_collector_up == 0`                                | The app cannot read Redis; queue and job metrics are missing        |

A sweep's timestamp records the sweep running, not the work it decided to do. `backup.run.sweep`
completes every night, including the nights its cadence takes no backup, and it records a failed
backup and completes rather than retrying — so neither metric says whether an archive was written.
Backup freshness is on `/settings/system`, and the dashboard banner tells the owner when one is
overdue or failed.

## Security notes

- The token is the only protection. Treat it like a password, rotate it by changing `.env` and
  restarting, and scrape over HTTPS so it is not sent in the clear.
- The endpoint exposes no business data — no counts of invoices, clients or payments — and no label
  carries a path, an id or an error message. Nothing is ever pushed out of the instance.
- Metrics describe the app container's process and the shared job queue. The worker's own memory is
  not reported.
