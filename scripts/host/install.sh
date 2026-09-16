#!/usr/bin/env bash
set -euo pipefail

# Git Bash and MSYS2 rewrite any argument that looks like a POSIX path into a Windows one before
# calling a native program, which turns the container path in the `chown` below into
# `C:/Program Files/Git/app/data`. Every path this script hands Docker is a container path, so the
# rewrite is switched off; outside those shells the variables mean nothing.
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"

dry_run=0
env_only=0
assume_yes=0
accept_key_custody=0
allow_http=0
pull_images=1
use_local_images=0
proxy_choice=""
public_url=""
acme_email=""
app_port=""
image_tag="latest"
env_temp_file=""

show_help() {
  cat <<'USAGE'
Usage: bash scripts/host/install.sh [options]

Takes a host with Docker on it to a running Remit instance:
  1. ./scripts/host/_check-prereqs.sh --for install
  2. Ask for the public URL and whether Caddy should provide HTTPS
  3. Generate every secret and write .env (mode 0600)
  4. docker compose pull
  5. docker compose up -d --no-build
  6. ./scripts/host/_wait-for-health.sh

Re-running is safe. An existing .env is never rewritten and its REMIT_ENCRYPTION_KEY is never
replaced: the installer checks the key is present and goes straight to starting the stack.

Options:
  --url URL             Public origin, such as https://remit.example.com. Asked when omitted.
  --proxy               Run Caddy (the with-proxy profile) for automatic HTTPS. Needs an https://
                        URL with no port, DNS pointing at this host, and ports 80 and 443 free.
  --no-proxy            Publish the app port for a reverse proxy you already run.
  --acme-email EMAIL    Email for the certificate account. Required with --proxy.
  --port PORT           Host port the app is published on (default: 3000).
  --image-tag TAG       Tag of remit/app and remit/worker to run (default: latest).
  --allow-http          Accept an http:// URL for a host other than localhost.
  --yes                 Never prompt. Every answer must come from options.
  --accept-key-custody  With --yes: you will back up REMIT_ENCRYPTION_KEY from .env yourself.
  --env-only            Write .env and stop. Nothing is checked, pulled or started.
  --no-pull             Start from images already on this host instead of pulling them.
  --dry-run             Print every command without executing any, and write nothing.
  --help                Print this help text.

Environment:
  REMIT_INSTALL_ENCRYPTION_KEY  An existing key to install with instead of generating one, for
                                restoring a backup onto a new host. Deliberately not an option,
                                so it never lands in shell history or a process listing.

This script never installs packages, uses sudo, changes firewall or DNS settings, obtains a
certificate outside the with-proxy profile, or writes outside this checkout.

Exit codes: 0 success, 1 failure, 2 usage error.
USAGE
}

usage_error() {
  echo "[install] $1" >&2
  echo "" >&2
  show_help >&2
  exit 2
}

require_value() {
  if [ "$#" -lt 2 ] || [ -z "$2" ]; then
    usage_error "$1 needs a value."
  fi
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --url)
      require_value "$@"
      public_url=$2
      shift
      ;;
    --proxy)
      if [ "$proxy_choice" = "no" ]; then usage_error "--proxy and --no-proxy cannot be combined."; fi
      proxy_choice=yes
      ;;
    --no-proxy)
      if [ "$proxy_choice" = "yes" ]; then usage_error "--proxy and --no-proxy cannot be combined."; fi
      proxy_choice=no
      ;;
    --acme-email)
      require_value "$@"
      acme_email=$2
      shift
      ;;
    --port)
      require_value "$@"
      app_port=$2
      shift
      ;;
    --image-tag)
      require_value "$@"
      image_tag=$2
      shift
      ;;
    --allow-http)
      allow_http=1
      ;;
    --yes)
      assume_yes=1
      ;;
    --accept-key-custody)
      accept_key_custody=1
      ;;
    --env-only)
      env_only=1
      ;;
    --no-pull)
      pull_images=0
      use_local_images=1
      ;;
    --dry-run)
      dry_run=1
      ;;
    --help)
      show_help
      exit 0
      ;;
    *)
      echo "[install] unknown option: $1" >&2
      echo "" >&2
      show_help >&2
      exit 2
      ;;
  esac
  shift
done

interactive=1

if [ "$assume_yes" = "1" ] || [ "$dry_run" = "1" ]; then
  interactive=0
fi

if [ "$interactive" = "1" ] && [ ! -t 0 ]; then
  usage_error "There is no terminal to ask questions on. Run this from a terminal, or pass --yes with every answer as an option."
fi

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)

if project_root=$(git -C "$script_dir" rev-parse --show-toplevel 2>/dev/null); then
  :
else
  project_root=$(CDPATH='' cd -- "$script_dir/../.." && pwd)
fi

cd "$project_root"

env_file="$project_root/.env"

cleanup() {
  if [ -n "$env_temp_file" ] && [ -e "$env_temp_file" ]; then
    rm -f "$env_temp_file"
  fi
}

trap cleanup EXIT

say() {
  echo "[install] $*"
}

fail() {
  echo "[install] $1" >&2
  shift

  for line in "$@"; do
    echo "[install]   $line" >&2
  done

  exit 1
}

print_recovery_hint() {
  echo "[install] To see what went wrong:" >&2
  echo "[install]   docker compose ps" >&2
  echo "[install]   docker compose logs --tail 100 app worker" >&2
  echo "[install] Fix the cause and run this installer again. A re-run keeps .env and its" >&2
  echo "[install] REMIT_ENCRYPTION_KEY exactly as they are." >&2
}

run_or_abort() {
  command_text=$1
  shift

  if [ "$dry_run" = "1" ]; then
    say "dry run: $command_text"
    return 0
  fi

  set +e
  "$@"
  command_status=$?
  set -e

  if [ "$command_status" -ne 0 ]; then
    echo "[install] command failed with exit code $command_status: $command_text" >&2
    print_recovery_hint
    exit 1
  fi
}

ask() {
  local question=$1
  local fallback=$2
  local answer=""

  if [ -n "$fallback" ]; then
    printf '[install] %s [%s]: ' "$question" "$fallback" >&2
  else
    printf '[install] %s: ' "$question" >&2
  fi

  IFS= read -r answer || answer=""

  if [ -z "$answer" ]; then
    answer=$fallback
  fi

  printf '%s' "$answer"
}

ask_yes_no() {
  local answer

  answer=$(ask "$1 (y/n)" "$2")

  case "$answer" in
    y | Y | yes | YES | Yes) return 0 ;;
    *) return 1 ;;
  esac
}

# The same rule `lib/config/envSchema.ts` applies to REMIT_PUBLIC_URL, restated because this runs on
# a host with no Node: an origin whose `URL#origin` is the string itself. That is why an uppercase
# host, a default port and a leading zero are refused rather than normalised — Node would normalise
# them and the container would then refuse to boot. The installer's test parses what this accepts
# through that schema, so the two cannot drift silently. IPv6 literals are not accepted.
url_problem() {
  local url=$1
  local rest port

  case "$url" in
    http://* | https://*) ;;
    *)
      echo "It must start with http:// or https://."
      return 0
      ;;
  esac

  rest=${url#*://}

  case "$rest" in
    */* | *\?* | *#*)
      echo "It must be an origin only, with no path, query or trailing slash."
      return 0
      ;;
  esac

  if ! printf '%s' "$rest" | grep -Eq '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[0-9]{1,5})?$'; then
    echo "It must be a lowercase host name or IPv4 address, optionally followed by :port."
    return 0
  fi

  case "$rest" in
    *:*)
      port=${rest##*:}

      case "$port" in
        0*)
          echo "The port must not start with 0."
          return 0
          ;;
      esac

      if [ "$port" -gt 65535 ]; then
        echo "The port must be between 1 and 65535."
        return 0
      fi

      if { [ "${url%%://*}" = "https" ] && [ "$port" = "443" ]; } ||
        { [ "${url%%://*}" = "http" ] && [ "$port" = "80" ]; }; then
        echo "Leave out the default port."
        return 0
      fi
      ;;
  esac
}

url_host() {
  local rest=${1#*://}

  printf '%s' "${rest%%:*}"
}

url_has_port() {
  case "${1#*://}" in
    *:*) return 0 ;;
    *) return 1 ;;
  esac
}

is_loopback_host() {
  case "$1" in
    localhost | *.localhost | 127.*) return 0 ;;
    *) return 1 ;;
  esac
}

is_valid_email() {
  printf '%s' "$1" | grep -Eq '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
}

is_valid_port() {
  case "$1" in
    '' | 0* | *[!0-9]*) return 1 ;;
  esac

  [ "$1" -ge 1 ] && [ "$1" -le 65535 ]
}

# A base64 encoding of exactly 32 bytes that decodes back to itself: 43 characters, one `=`, and a
# final character that carries no stray bits. `lib/config/envSchema.ts` refuses anything else at boot.
is_valid_encryption_key() {
  printf '%s' "$1" | grep -Eq '^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$'
}

# openssl first, /dev/urandom second. Both read the kernel CSPRNG; the fallback exists because
# minimal hosts and Alpine ship no openssl, while `od`, `head` and `base64` are in coreutils and
# BusyBox alike. Every value is checked for its exact shape afterwards, so a broken tool fails the
# install instead of writing a short or empty secret. Hex for the passwords rather than base64 so no
# character needs quoting inside DATABASE_URL, which Compose assembles from POSTGRES_PASSWORD; 32
# bytes keeps the full 256 bits, so the smaller alphabet costs no entropy.
random_hex() {
  local value

  if command -v openssl >/dev/null 2>&1; then
    value=$(openssl rand -hex 32)
  else
    value=$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')
  fi

  if ! printf '%s' "$value" | grep -Eq '^[0-9a-f]{64}$'; then
    fail "Could not generate a random secret." "Check that openssl or /dev/urandom works on this host."
  fi

  printf '%s' "$value"
}

random_encryption_key() {
  local value

  if command -v openssl >/dev/null 2>&1; then
    value=$(openssl rand -base64 32)
  else
    value=$(head -c 32 /dev/urandom | base64 | tr -d '\n')
  fi

  if ! is_valid_encryption_key "$value"; then
    fail "Could not generate REMIT_ENCRYPTION_KEY." "Check that openssl or /dev/urandom works on this host."
  fi

  printf '%s' "$value"
}

project_name() {
  docker compose config --format json 2>/dev/null | sed -n 's/^  "name": "\(.*\)",$/\1/p' | head -n 1
}

# `pull_policy` is what Compose does about an image this host lacks: `missing` fetches only those,
# `never` (from --no-pull) runs only what is already here.
start_stack() {
  local pull_policy=missing

  if [ "$pull_images" = "1" ]; then
    say "pulling images."
    run_or_abort "docker compose pull" docker compose pull
  fi

  if [ "$use_local_images" = "1" ]; then
    pull_policy=never
  fi

  # The data directory is a bind mount, and Docker creates a missing one owned by root, which the
  # app's unprivileged user cannot write backups into. Running chown inside the app's own image
  # names that user without this script knowing its uid, and needs no sudo on the host.
  say "preparing the data directory."
  run_or_abort "docker compose run --rm --no-deps --pull $pull_policy --user root --entrypoint chown app nextjs:nodejs /app/data" \
    docker compose run --rm --no-deps --pull "$pull_policy" --user root --entrypoint chown app nextjs:nodejs /app/data

  # --no-build, always: without it, an image the registry does not have is silently built from this
  # checkout, which takes long enough and enough memory to look like a hang on a small server.
  # Nothing migrates here — docker-entrypoint.sh applies pending migrations as the app starts.
  say "starting the stack."
  run_or_abort "docker compose up -d --no-build --pull $pull_policy" \
    docker compose up -d --no-build --pull "$pull_policy"

  say "waiting for the app to report healthy."

  if [ "$dry_run" = "1" ]; then
    say "dry run: ./scripts/host/_wait-for-health.sh"
    bash ./scripts/host/_wait-for-health.sh --dry-run
    return 0
  fi

  if ! bash ./scripts/host/_wait-for-health.sh; then
    print_recovery_hint
    exit 1
  fi
}

say "project root: $project_root"

# The one line in this script that must never be wrong. REMIT_ENCRYPTION_KEY encrypts the sensitive
# columns and every backup archive (ADR-0005, ADR-0020), and a second installer run that generated a
# new one would leave all of it permanently unreadable while reporting success. So an existing .env is
# never rewritten, whatever the options say. The only thing read from it is whether a key line with a
# value is present: `grep -q` reports that as an exit status, and the value never reaches a variable,
# the terminal or a log. A .env with no key is refused rather than completed, because the installer
# cannot tell a file nobody finished from one whose key was deleted.
if [ -e "$env_file" ]; then
  if ! grep -Eq '^REMIT_ENCRYPTION_KEY=.+' "$env_file"; then
    fail ".env exists but has no REMIT_ENCRYPTION_KEY, so the installer will not touch it." \
      "If this instance has ever stored data, restore the key from your backup of .env." \
      "If it never has, move .env aside and run the installer again to generate a new one."
  fi

  say ".env already exists and holds REMIT_ENCRYPTION_KEY; leaving it exactly as it is."

  if [ -n "$public_url$acme_email$app_port$proxy_choice" ] || [ "$image_tag" != "latest" ]; then
    say "the answers passed as options are ignored for an existing install; edit .env to change them."
  fi

  if [ "$env_only" = "1" ]; then
    exit 0
  fi

  say "checking host prerequisites."

  if [ "$dry_run" = "1" ]; then
    bash ./scripts/host/_check-prereqs.sh --for install --dry-run
  else
    bash ./scripts/host/_check-prereqs.sh --for install
  fi

  # A re-run must not become an upgrade: pulling here could replace running images with newer ones
  # and migrate the database without the backup `scripts/host/upgrade.sh` takes first. Compose pulls
  # an image only when it is missing.
  pull_images=0
  start_stack

  if [ "$dry_run" = "1" ]; then
    say "dry run complete: nothing was changed."
    exit 0
  fi

  say "Remit is running at the REMIT_PUBLIC_URL set in .env."
  say "Keep an off-server copy of .env: without its REMIT_ENCRYPTION_KEY no backup can be restored."
  exit 0
fi

# These are the only questions, and each is a value Docker Compose or the container needs before any
# page exists to ask it on: where the instance is reached, and whether this host terminates TLS for
# it. Everything a person can set once signed in — business details, email, payments, backups —
# belongs to /setup and /settings, where it can be changed later, and is not asked here.
if [ -z "$public_url" ] && [ "$interactive" = "1" ]; then
  while :; do
    public_url=$(ask "Public URL Remit will be opened at, such as https://remit.example.com" "")
    problem=$(url_problem "$public_url")

    if [ -z "$problem" ]; then break; fi

    echo "[install] $problem" >&2
  done
fi

if [ -z "$public_url" ]; then
  if [ "$dry_run" = "1" ]; then
    public_url="https://remit.example.com"
    say "dry run: no --url given; showing the plan for $public_url."
  else
    usage_error "--url is required with --yes."
  fi
fi

problem=$(url_problem "$public_url")

if [ -n "$problem" ]; then
  usage_error "--url $public_url is not usable. $problem"
fi

if [ -z "$proxy_choice" ]; then
  if [ "$interactive" = "1" ]; then
    proxy_default=n

    if [ "${public_url%%://*}" = "https" ] && ! url_has_port "$public_url"; then
      proxy_default=y
    fi

    if ask_yes_no "Run Caddy on ports 80 and 443 to get and renew an HTTPS certificate automatically?" "$proxy_default"; then
      proxy_choice=yes
    else
      proxy_choice=no
    fi
  else
    proxy_choice=no
  fi
fi

if [ "$proxy_choice" = "yes" ]; then
  if [ "${public_url%%://*}" != "https" ] || url_has_port "$public_url"; then
    usage_error "Caddy obtains a certificate for an https:// URL with no port; $public_url is not one."
  fi

  if [ -z "$acme_email" ] && [ "$interactive" = "1" ]; then
    while :; do
      acme_email=$(ask "Email for the certificate account (expiry notices only)" "")

      if is_valid_email "$acme_email"; then break; fi

      echo "[install] That does not look like an email address." >&2
    done
  fi

  if [ -z "$acme_email" ] && [ "$dry_run" = "1" ]; then
    acme_email="operator@example.com"
  fi

  if ! is_valid_email "$acme_email"; then
    usage_error "--acme-email with a valid address is required with --proxy."
  fi
fi

if [ "${public_url%%://*}" = "http" ] && ! is_loopback_host "$(url_host "$public_url")" && [ "$allow_http" = "0" ]; then
  if [ "$interactive" = "1" ]; then
    echo "[install] $public_url has no TLS: passwords and session cookies would cross the network in the clear." >&2

    if ! ask_yes_no "Continue with plain HTTP anyway?" "n"; then
      fail "Stopped before writing anything." "Re-run with an https:// URL, and --proxy or your own TLS proxy in front."
    fi
  else
    usage_error "$public_url has no TLS. Use an https:// URL, or pass --allow-http to accept that."
  fi
fi

if [ -z "$app_port" ]; then
  app_port=3000
fi

if ! is_valid_port "$app_port"; then
  usage_error "--port must be a number between 1 and 65535."
fi

if ! printf '%s' "$image_tag" | grep -Eq '^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$'; then
  usage_error "--image-tag $image_tag is not a valid image tag."
fi

app_bind=0.0.0.0

if [ "$proxy_choice" = "yes" ]; then
  app_bind=127.0.0.1
fi

supplied_key=${REMIT_INSTALL_ENCRYPTION_KEY:-}

if [ -n "$supplied_key" ] && ! is_valid_encryption_key "$supplied_key"; then
  usage_error "REMIT_INSTALL_ENCRYPTION_KEY is not a base64-encoded 32-byte key."
fi

if [ -z "$supplied_key" ] && [ "$interactive" = "0" ] && [ "$dry_run" = "0" ] && [ "$accept_key_custody" = "0" ]; then
  usage_error "--yes generates REMIT_ENCRYPTION_KEY without showing it, so --accept-key-custody is required: it records that you will back up .env yourself."
fi

if [ "$env_only" = "0" ]; then
  say "checking host prerequisites."

  prereq_arguments=(--for install --port "$app_port")

  if [ "$proxy_choice" = "yes" ]; then
    prereq_arguments+=(--proxy)
  fi

  if [ "$dry_run" = "1" ]; then
    prereq_arguments+=(--dry-run)
  fi

  if ! bash ./scripts/host/_check-prereqs.sh "${prereq_arguments[@]}"; then
    fail "Host prerequisites are not met; nothing was written or started."
  fi

  # A missing .env beside existing volumes means the configuration was lost, not that this is a new
  # install. Generating a fresh database password and encryption key over that data would lock the
  # instance out of its own database and make every encrypted column unreadable.
  if [ "$dry_run" = "1" ]; then
    say "dry run: docker volume ls --filter label=com.docker.compose.project=<project>"
  else
    compose_project=$(project_name)

    if [ -z "$compose_project" ]; then
      fail "Could not read the Compose project name from docker-compose.yml."
    fi

    if [ -n "$(docker volume ls -q --filter "label=com.docker.compose.project=$compose_project")" ]; then
      fail "Docker volumes for the Compose project \"$compose_project\" already exist, but .env does not." \
        "Restore .env from your backup and run the installer again; it will start the existing instance." \
        "Only if that data is disposable: docker compose down -v, then run the installer again."
    fi
  fi
fi

if [ "$dry_run" = "1" ]; then
  say "dry run: generate POSTGRES_PASSWORD, BETTER_AUTH_SECRET and MINIO_ROOT_PASSWORD (openssl rand -hex 32)"

  if [ -n "$supplied_key" ]; then
    say "dry run: use REMIT_ENCRYPTION_KEY from REMIT_INSTALL_ENCRYPTION_KEY"
  else
    say "dry run: generate REMIT_ENCRYPTION_KEY (openssl rand -base64 32) and require confirmation that it is stored"
  fi

  say "dry run: write $env_file (mode 0600)"
else
  postgres_password=$(random_hex)
  auth_secret=$(random_hex)
  minio_password=$(random_hex)

  if [ -n "$supplied_key" ]; then
    encryption_key=$supplied_key
  else
    encryption_key=$(random_encryption_key)

    # The only secret this script ever prints, and only interactively. An installer run is the one
    # moment someone is guaranteed to be watching, so the key is shown before .env exists and the
    # file is written only once the operator proves they copied it. Stopping here leaves nothing
    # behind, and a re-run generates a different key that nothing has used yet.
    if [ "$interactive" = "1" ]; then
      echo "[install] ================================================================================"
      echo "[install] REMIT_ENCRYPTION_KEY"
      echo "[install]"
      echo "[install]   $encryption_key"
      echo "[install]"
      echo "[install] This key encrypts the SMTP password, Stripe keys, bank details and client notes in"
      echo "[install] the database, and every backup archive. It is shown once. If it is lost, that data"
      echo "[install] and every backup are unreadable, and nobody can recover them."
      echo "[install] Store it now in a password manager or somewhere else off this server."
      echo "[install] ================================================================================"

      confirmed=0

      for _ in 1 2 3; do
        typed=$(ask "Type the last 6 characters of the key to confirm you have stored it" "")

        if [ "$typed" = "${encryption_key: -6}" ]; then
          confirmed=1
          break
        fi

        echo "[install] That does not match." >&2
      done

      if [ "$confirmed" = "0" ]; then
        fail "The key was not confirmed, so .env was not written and nothing was started." \
          "Run the installer again when you are ready to store the key."
      fi
    fi
  fi

  umask 077
  env_temp_file=$(mktemp "$project_root/.env.XXXXXX")

  {
    echo "# Written by scripts/host/install.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ)."
    echo "# Re-running the installer never rewrites this file. Edit a value here, then run"
    echo "# docker compose up -d. .env.example documents every variable."
    echo "REMIT_PUBLIC_URL=$public_url"
    echo "PORT=$app_port"
    echo "REMIT_APP_BIND=$app_bind"
    echo "REMIT_IMAGE_TAG=$image_tag"

    if [ "$proxy_choice" = "yes" ]; then
      echo "COMPOSE_PROFILES=with-proxy"
      echo "REMIT_ACME_EMAIL=$acme_email"
    fi

    echo ""
    echo "POSTGRES_USER=remit"
    echo "POSTGRES_PASSWORD=$postgres_password"
    echo "POSTGRES_DB=remit"
    echo ""
    echo "BETTER_AUTH_SECRET=$auth_secret"
    echo "# Back this value up off the server. Without it no encrypted column and no backup can be read."
    echo "REMIT_ENCRYPTION_KEY=$encryption_key"
    echo ""
    echo "MINIO_ROOT_USER=remit"
    echo "MINIO_ROOT_PASSWORD=$minio_password"
    echo "MINIO_BUCKET=remit"
    echo ""
    echo "REMIT_DATA_DIR=./data"
    echo "REMIT_METRICS_TOKEN="
  } >"$env_temp_file"

  chmod 600 "$env_temp_file"

  if [ -e "$env_file" ]; then
    fail ".env appeared while the installer was running; it was left untouched."
  fi

  mv "$env_temp_file" "$env_file"
  env_temp_file=""

  say "wrote $env_file (mode 0600)."
fi

if [ "$env_only" = "1" ]; then
  say "--env-only: stopping before Docker. Start the instance with: docker compose up -d"
  exit 0
fi

start_stack

if [ "$dry_run" = "1" ]; then
  say "dry run complete: nothing was written, pulled or started."
  exit 0
fi

say "Remit is running."
say "  Open $public_url. The first visit lands on /register, where you create the owner account."
say "  The setup wizard then enrols two-factor authentication, which is mandatory, and shows your"
say "  recovery codes once. Keep them off this machine."

if [ "$proxy_choice" = "yes" ]; then
  say "  Caddy requests the certificate for $(url_host "$public_url") on first use: its DNS record must"
  say "  point at this host, and ports 80 and 443 must be reachable from the internet."
fi

say "Back up now, off this server: $env_file"
say "  It holds REMIT_ENCRYPTION_KEY. Without that key no backup archive can ever be restored."
say "Next: choose a backup destination at $public_url/settings/backup, and read"
say "  docs/operations/UPGRADE.md before your first upgrade."
