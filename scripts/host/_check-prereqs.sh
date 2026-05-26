#!/usr/bin/env bash
set -euo pipefail

dry_run=0

show_help() {
  cat <<'USAGE'
Usage: bash scripts/host/_check-prereqs.sh [--dry-run] [--help]

Checks the host prerequisites for a Remit upgrade:
  - Docker CLI version 24 or newer
  - Docker Compose v2 plugin form (`docker compose`)
  - docker-compose.yml in the current working directory
  - a running `app` service in the compose project
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
      echo "[prereqs] unknown option: $1" >&2
      echo "" >&2
      show_help >&2
      exit 2
      ;;
  esac
  shift
done

if [ "$dry_run" = "1" ]; then
  echo "[prereqs] dry run: docker --version"
  echo "[prereqs] dry run: docker compose version"
  echo "[prereqs] dry run: test -f docker-compose.yml"
  echo "[prereqs] dry run: docker compose ps --services --status running app"
  exit 0
fi

if ! docker_version_output=$(docker --version 2>&1); then
  echo "[prereqs] Docker is required on the host before upgrading." >&2
  echo "$docker_version_output" >&2
  exit 1
fi

docker_major=$(printf '%s\n' "$docker_version_output" | sed -n 's/^Docker version \([0-9][0-9]*\).*/\1/p')

if [ -z "$docker_major" ]; then
  echo "[prereqs] Could not read Docker major version from: $docker_version_output" >&2
  exit 1
fi

if [ "$docker_major" -lt 24 ]; then
  echo "[prereqs] Docker 24 or newer is required; found: $docker_version_output" >&2
  exit 1
fi

echo "[prereqs] Docker version OK: $docker_version_output"

if ! compose_version_output=$(docker compose version 2>&1); then
  echo "[prereqs] Docker Compose v2 plugin is required. Install the plugin form: docker compose" >&2
  echo "$compose_version_output" >&2
  exit 1
fi

echo "[prereqs] Docker Compose plugin OK: $compose_version_output"

if [ ! -f docker-compose.yml ]; then
  echo "[prereqs] docker-compose.yml was not found in the current working directory: $(pwd)" >&2
  exit 1
fi

echo "[prereqs] Compose file OK: $(pwd)/docker-compose.yml"

if ! running_services=$(docker compose ps --services --status running app 2>&1); then
  echo "[prereqs] Could not inspect the compose project. Start the stack first, then upgrade." >&2
  echo "$running_services" >&2
  exit 1
fi

if ! printf '%s\n' "$running_services" | grep -qx "app"; then
  echo "[prereqs] app service is not running; start the stack first, then upgrade" >&2
  exit 1
fi

echo "[prereqs] app service is running."
