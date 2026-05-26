#!/usr/bin/env bash
set -euo pipefail

timeout_seconds=300
interval_seconds=5
dry_run=0

show_help() {
  cat <<'USAGE'
Usage: bash scripts/host/_wait-for-health.sh [--dry-run] [--help]

Polls the app container health until healthy, or until the 5-minute timeout.
Exits non-zero if the service reports unhealthy or does not become healthy in time.

Container status is read via `docker inspect` against the container id returned
by `docker compose ps -q app`. This avoids parsing `docker compose ps --format json`
output with regex.
USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
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

# Prints "<health>|<state>" where either part may be empty. Uses the Docker
# inspect template API, which is a stable contract since Docker 1.12+.
get_app_status() {
  container_id=$1
  docker inspect \
    --format='{{if .State.Health}}{{.State.Health.Status}}{{end}}|{{.State.Status}}' \
    "$container_id" 2>/dev/null
}

start_epoch=$(date +%s)
deadline_epoch=$((start_epoch + timeout_seconds))

echo "[health] waiting up to ${timeout_seconds}s for app to become healthy."

while :; do
  set +e
  container_id=$(get_app_container_id)
  set -e

  health_status=""
  state_status=""

  if [ -n "$container_id" ]; then
    set +e
    status_pair=$(get_app_status "$container_id")
    inspect_status=$?
    set -e

    if [ "$inspect_status" -ne 0 ]; then
      echo "[health] could not inspect app container." >&2
      print_failure_logs
      exit 1
    fi

    health_status=${status_pair%%|*}
    state_status=${status_pair##*|}
  fi

  if [ "$health_status" = "healthy" ]; then
    echo "[health] app service is healthy."
    exit 0
  fi

  if [ "$health_status" = "unhealthy" ]; then
    echo "[health] app service reported unhealthy." >&2
    print_failure_logs
    exit 1
  fi

  now_epoch=$(date +%s)

  if [ "$now_epoch" -ge "$deadline_epoch" ]; then
    if [ -n "$health_status" ]; then
      echo "[health] timed out waiting for app health; last health status: $health_status." >&2
    elif [ -n "$state_status" ]; then
      echo "[health] timed out waiting for app health; last container state: $state_status." >&2
    else
      echo "[health] timed out waiting for app health; no app container status was returned." >&2
    fi
    print_failure_logs
    exit 1
  fi

  if [ -n "$health_status" ]; then
    echo "[health] current app health: $health_status; checking again in ${interval_seconds}s."
  elif [ -n "$state_status" ]; then
    echo "[health] current app state: $state_status; checking again in ${interval_seconds}s."
  else
    echo "[health] app container not visible yet; checking again in ${interval_seconds}s."
  fi

  sleep "$interval_seconds"
done
