#!/usr/bin/env bash
set -euo pipefail

dry_run=0
purpose=upgrade
app_port=""
with_proxy=0

# Five gigabytes: the two Remit images, PostgreSQL, Redis, MinIO and Caddy come to about three, and
# the first backup archives and a database that has started to grow need the rest.
minimum_free_kilobytes=$((5 * 1024 * 1024))

show_help() {
  cat <<'USAGE'
Usage: bash scripts/host/_check-prereqs.sh [--for install|upgrade] [--port PORT] [--proxy] [--dry-run] [--help]

Checks the host prerequisites for a Remit upgrade (the default) or install.

Both:
  - Docker CLI version 24 or newer
  - Docker Compose v2 plugin form (`docker compose`)
  - docker-compose.yml in the current working directory

Upgrade only:
  - a running `app` service in the compose project

Install only:
  - a reachable Docker daemon
  - a writable working directory with at least 5 GB free
  - with --port PORT: nothing already listening on that port
  - with --proxy: nothing listening on ports 80 and 443, and deploy/caddy/Caddyfile present
USAGE
}

usage_error() {
  echo "[prereqs] $1" >&2
  echo "" >&2
  show_help >&2
  exit 2
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run)
      dry_run=1
      ;;
    --for)
      if [ "$#" -lt 2 ]; then usage_error "--for needs install or upgrade."; fi

      case "$2" in
        install | upgrade) purpose=$2 ;;
        *) usage_error "--for needs install or upgrade." ;;
      esac

      shift
      ;;
    --port)
      if [ "$#" -lt 2 ] || [ -z "$2" ]; then usage_error "--port needs a value."; fi

      app_port=$2
      shift
      ;;
    --proxy)
      with_proxy=1
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

required_ports=()

if [ -n "$app_port" ]; then
  required_ports+=("$app_port")
fi

if [ "$with_proxy" = "1" ]; then
  required_ports+=(80 443)
fi

if [ "$dry_run" = "1" ]; then
  echo "[prereqs] dry run: docker --version"
  echo "[prereqs] dry run: docker compose version"
  echo "[prereqs] dry run: test -f docker-compose.yml"

  if [ "$purpose" = "upgrade" ]; then
    echo "[prereqs] dry run: docker compose ps --services --status running app"
  else
    echo "[prereqs] dry run: docker info"
    echo "[prereqs] dry run: test -w . and df -Pk ."

    if [ "$with_proxy" = "1" ]; then
      echo "[prereqs] dry run: test -f deploy/caddy/Caddyfile"
    fi

    for port in "${required_ports[@]+"${required_ports[@]}"}"; do
      echo "[prereqs] dry run: check nothing listens on 127.0.0.1:$port"
    done
  fi

  exit 0
fi

if ! docker_version_output=$(docker --version 2>&1); then
  echo "[prereqs] Docker is required on the host before running this $purpose." >&2
  echo "[prereqs] Install Docker Engine 24 or newer: https://docs.docker.com/engine/install/" >&2
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

if [ "$purpose" = "upgrade" ]; then
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
  exit 0
fi

if ! docker info >/dev/null 2>&1; then
  echo "[prereqs] The Docker daemon is not reachable." >&2
  echo "[prereqs] Start Docker, or add this user to the docker group and log in again." >&2
  exit 1
fi

echo "[prereqs] Docker daemon OK."

if ! probe_file=$(mktemp ./.remit-install-probe.XXXXXX 2>/dev/null); then
  echo "[prereqs] The working directory is not writable: $(pwd)" >&2
  echo "[prereqs] Run the installer as the user who owns this checkout." >&2
  exit 1
fi

rm -f "$probe_file"

free_kilobytes=$(df -Pk . | awk 'NR == 2 { print $4 }')

if [ -n "$free_kilobytes" ] && [ "$free_kilobytes" -lt "$minimum_free_kilobytes" ]; then
  echo "[prereqs] At least 5 GB of free disk is needed; $(pwd) has $((free_kilobytes / 1024)) MB." >&2
  echo "[prereqs] Free some space, or run the installer from a checkout on a larger disk." >&2
  exit 1
fi

echo "[prereqs] Working directory writable, with $((free_kilobytes / 1024 / 1024)) GB free."

if [ "$with_proxy" = "1" ] && [ ! -f deploy/caddy/Caddyfile ]; then
  echo "[prereqs] deploy/caddy/Caddyfile was not found; the with-proxy profile mounts it." >&2
  echo "[prereqs] Run the installer from a complete checkout of the repository." >&2
  exit 1
fi

# A connect test rather than `ss` or `netstat`, which differ by distribution and are missing from
# minimal images: bash's /dev/tcp is the same everywhere this script runs. It sees a listener on the
# loopback or wildcard address, which is where anything that would collide with Compose sits.
for port in "${required_ports[@]+"${required_ports[@]}"}"; do
  if (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; then
    echo "[prereqs] Port $port is already in use on this host." >&2

    if [ "$port" = "80" ] || [ "$port" = "443" ]; then
      echo "[prereqs] Caddy needs ports 80 and 443. Stop what holds them, or install without --proxy." >&2
    else
      echo "[prereqs] Stop what holds it, or choose another port with --port." >&2
    fi

    exit 1
  fi

  echo "[prereqs] Port $port is free."
done
