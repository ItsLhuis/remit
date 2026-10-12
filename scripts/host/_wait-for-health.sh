#!/usr/bin/env bash
set -euo pipefail

# The budget for a first start, which applies every pending migration before the app answers. A cold
# start from empty volumes, measured with the app and worker held to one x86 CPU and 1 GB each, was
# healthy 14 seconds after `docker compose up`. A Raspberry Pi on an SD card, the slowest host the
# deployment guides name, has not been measured, so the default leaves forty times that: running out
# early tells an operator their install failed while it was still starting, and costs nothing when it
# succeeds sooner. REMIT_HEALTH_TIMEOUT_SECONDS, or --timeout, gives a slower host longer, through
# the installer and the upgrade alike.
default_timeout_seconds=600
timeout_seconds=${REMIT_HEALTH_TIMEOUT_SECONDS:-$default_timeout_seconds}
interval_seconds=5
dry_run=0

show_help() {
  cat <<'USAGE'
Usage: bash scripts/host/_wait-for-health.sh [--timeout SECONDS] [--dry-run] [--help]

Polls the app container health until healthy, or until the timeout (default 600 seconds, or
REMIT_HEALTH_TIMEOUT_SECONDS when set). Exits non-zero if the container stops or restarts, or does
not become healthy in time. An "unhealthy" report alone is waited through: Docker gives up on a
slow first start long before its migrations finish, and reports healthy once they do.

Container status is read via `docker inspect` against the container id returned
by `docker compose ps -q app`. This avoids parsing `docker compose ps --format json`
output with regex.
USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --timeout)
      if [ "$#" -lt 2 ]; then
        echo "[health] --timeout needs a value." >&2
        exit 2
      fi

      timeout_seconds=$2
      shift
      ;;
    --dry-run)
      dry_run=1
      ;;
    --help)
      show_help
      exit 0
      ;;
    *)
      echo "[health] unknown option: $1" >&2
      echo "" >&2
      show_help >&2
      exit 2
      ;;
  esac
  shift
done

case "$timeout_seconds" in
  '' | 0* | *[!0-9]*)
    echo "[health] the timeout must be a whole number of seconds above zero, not '$timeout_seconds'." >&2
    exit 2
    ;;
esac

if [ "$dry_run" = "1" ]; then
  echo "[health] dry run: docker compose ps -q app"
  echo "[health] dry run: docker inspect --format='{{...}}' <container-id>"
  echo "[health] dry run: sleep $interval_seconds # repeated until healthy or ${timeout_seconds}s"
  echo "[health] dry run: docker compose logs --tail 50 app # on failure"
  exit 0
fi

print_failure_logs() {
  echo "[health] last 50 app log lines:" >&2
  docker compose logs --tail 50 app >&2 || true
}

get_app_container_id() {
  docker compose ps -q app 2>/dev/null | head -n 1
}

# Nothing a timeout leaves behind needs undoing: the containers go on starting in the background, so
# this says what to look at and that running the same command again is safe.
print_timeout_help() {
  echo "[health] The containers keep starting in the background; nothing has been undone." >&2
  echo "[health] To see where it is:" >&2
  echo "[health]   docker compose ps" >&2
  echo "[health]   docker compose logs --tail 100 app" >&2
  echo "[health] A first start applies every database migration before the app answers, and a" >&2
  echo "[health] small server can take longer than ${timeout_seconds}s to do it. Running the same" >&2
  echo "[health] command again is safe and picks up where this one stopped; to wait longer, set" >&2
  echo "[health] REMIT_HEALTH_TIMEOUT_SECONDS, for example REMIT_HEALTH_TIMEOUT_SECONDS=1200." >&2
}

# Prints "<health>|<state>|<restarts>", where the health part is empty for a container with no
# health check. Uses the Docker inspect template API, which is a stable contract since Docker 1.12+.
get_app_status() {
  container_id=$1
  docker inspect \
    --format='{{if .State.Health}}{{.State.Health.Status}}{{end}}|{{.State.Status}}|{{.RestartCount}}' \
    "$container_id" 2>/dev/null
}

start_epoch=$(date +%s)
deadline_epoch=$((start_epoch + timeout_seconds))
first_restart_count=""

echo "[health] waiting up to ${timeout_seconds}s for app to become healthy."

while :; do
  set +e
  container_id=$(get_app_container_id)
  set -e

  health_status=""
  state_status=""
  restart_count=""

  if [ -n "$container_id" ]; then
    set +e
    status_triple=$(get_app_status "$container_id")
    inspect_status=$?
    set -e

    if [ "$inspect_status" -ne 0 ]; then
      echo "[health] could not inspect app container." >&2
      print_failure_logs
      exit 1
    fi

    health_status=${status_triple%%|*}
    restart_count=${status_triple##*|}
    state_status=${status_triple#*|}
    state_status=${state_status%|*}
  fi

  if [ "$health_status" = "healthy" ]; then
    echo "[health] app service is healthy."
    exit 0
  fi

  # A stopped or restarting container is failing, not slow: its process exited, and waiting out the
  # budget would only delay the error its log already shows. An "unhealthy" report is not this:
  # Docker gives up on the health check about 80 seconds into a start (`start_period` plus five
  # failed probes in `docker-compose.yml`), while a first start on a small host is still migrating,
  # and reports healthy once the app answers.
  case "$state_status" in
    exited | dead | restarting)
      echo "[health] the app container is $state_status; it stopped while starting." >&2
      print_failure_logs
      exit 1
      ;;
  esac

  if [ -n "$restart_count" ]; then
    if [ -z "$first_restart_count" ]; then
      first_restart_count=$restart_count
    elif [ "$restart_count" != "$first_restart_count" ]; then
      echo "[health] the app container restarted while starting; its process is exiting." >&2
      print_failure_logs
      exit 1
    fi
  fi

  now_epoch=$(date +%s)

  if [ "$now_epoch" -ge "$deadline_epoch" ]; then
    if [ -n "$health_status" ]; then
      echo "[health] timed out after ${timeout_seconds}s waiting for app health; last health status: $health_status." >&2
    elif [ -n "$state_status" ]; then
      echo "[health] timed out after ${timeout_seconds}s waiting for app health; last container state: $state_status." >&2
    else
      echo "[health] timed out after ${timeout_seconds}s waiting for app health; no app container status was returned." >&2
    fi
    print_failure_logs
    print_timeout_help
    exit 1
  fi

  if [ "$health_status" = "unhealthy" ]; then
    echo "[health] app reports unhealthy, as a first start does while migrations run; checking again in ${interval_seconds}s."
  elif [ -n "$health_status" ]; then
    echo "[health] current app health: $health_status; checking again in ${interval_seconds}s."
  elif [ -n "$state_status" ]; then
    echo "[health] current app state: $state_status; checking again in ${interval_seconds}s."
  else
    echo "[health] app container not visible yet; checking again in ${interval_seconds}s."
  fi

  sleep "$interval_seconds"
done
