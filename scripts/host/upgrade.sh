#!/usr/bin/env bash
set -euo pipefail

dry_run=0
skip_backup=0
yes=0
last_backup_path=""
pre_backup_path=""

show_help() {
  cat <<'USAGE'
Usage: bash scripts/host/upgrade.sh [--dry-run] [--yes] [--skip-backup] [--help]

Runs the host-side Remit upgrade flow:
  1. docker compose exec -T app pnpm remit:backup --yes
  2. docker compose pull
  3. docker compose up -d
  4. ./scripts/host/_wait-for-health.sh

Options:
  --dry-run       Print the commands without executing them.
  --yes           Confirmation flag accepted for parity. The host upgrade flow
                  is non-interactive by design and always invokes the backup
                  step with --yes regardless of this flag.
  --skip-backup   Skip the backup only when REMIT_ALLOW_UPGRADE_WITHOUT_BACKUP=1 is also set.
  --help          Print this help text.
USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run)
      dry_run=1
      ;;
    --yes)
      yes=1
      ;;
    --skip-backup)
      skip_backup=1
      ;;
    --help)
      show_help
      exit 0
      ;;
    *)
      echo "[upgrade] unknown option: $1" >&2
      echo "" >&2
      show_help >&2
      exit 2
      ;;
  esac
  shift
done

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

if project_root=$(git rev-parse --show-toplevel 2>/dev/null); then
  :
else
  project_root=$(CDPATH= cd -- "$script_dir/../.." && pwd)
fi

cd "$project_root"

if [ "$skip_backup" = "1" ] && [ "${REMIT_ALLOW_UPGRADE_WITHOUT_BACKUP:-0}" != "1" ]; then
  echo "[upgrade] refusing --skip-backup without REMIT_ALLOW_UPGRADE_WITHOUT_BACKUP=1." >&2
  echo "[upgrade] run with a pre-upgrade backup, or export REMIT_ALLOW_UPGRADE_WITHOUT_BACKUP=1 and pass --skip-backup to double opt in." >&2
  exit 1
fi

if [ "$yes" = "1" ]; then
  echo "[upgrade] non-interactive mode requested; backup will run with --yes."
fi

print_rollback_hint() {
  echo "[upgrade] rollback guidance:" >&2
  echo "[upgrade]   1. Set your compose image tag back to the previous known-good tag." >&2
  echo "[upgrade]   2. docker compose pull app" >&2
  echo "[upgrade]   3. docker compose up -d" >&2

  if [ -n "$last_backup_path" ]; then
    echo "[upgrade]   4. docker compose exec -T app pnpm remit:restore \"$last_backup_path\"" >&2
  elif [ "$skip_backup" = "1" ]; then
    echo "[upgrade]   4. Restore from your last known-good backup. No pre-upgrade backup was created because --skip-backup was used." >&2
  else
    echo "[upgrade]   4. The backup step completed but produced no new local snapshot; fetch the latest backup from the configured remote destination before restoring." >&2
  fi
}

fail_upgrade() {
  failed_status=$1
  failed_command=$2

  echo "[upgrade] command failed with exit code $failed_status: $failed_command" >&2
  print_rollback_hint
  exit "$failed_status"
}

run_or_abort() {
  command_text=$1
  shift

  if [ "$dry_run" = "1" ]; then
    echo "[upgrade] dry run: $command_text"
    return 0
  fi

  set +e
  "$@"
  command_status=$?
  set -e

  if [ "$command_status" -ne 0 ]; then
    fail_upgrade "$command_status" "$command_text"
  fi
}

run_script_or_abort() {
  command_text=$1
  script_path=$2
  shift 2

  if [ "$dry_run" = "1" ]; then
    echo "[upgrade] dry run: $command_text"
    return 0
  fi

  set +e
  if [ -x "$script_path" ]; then
    "$script_path" "$@"
  else
    bash "$script_path" "$@"
  fi
  command_status=$?
  set -e

  if [ "$command_status" -ne 0 ]; then
    fail_upgrade "$command_status" "$command_text"
  fi
}

read_latest_remitbak_inside_container() {
  docker compose exec -T app sh -lc 'ls -1t "${REMIT_DATA_DIR}/backups/"*.remitbak 2>/dev/null | head -n 1' 2>/dev/null
}

# Snapshot the newest existing .remitbak path before the backup step runs, so
# the post-backup capture can detect whether a brand-new local archive
# appeared. Without this, a stale older backup could be picked up as the
# rollback target.
capture_pre_backup_path() {
  if [ "$dry_run" = "1" ]; then
    echo "[upgrade] dry run: snapshot existing newest .remitbak path under REMIT_DATA_DIR/backups"
    return 0
  fi

  set +e
  pre_backup_path=$(read_latest_remitbak_inside_container)
  set -e
}

capture_post_backup_path() {
  if [ "$dry_run" = "1" ]; then
    echo "[upgrade] dry run: detect new .remitbak path under REMIT_DATA_DIR/backups"
    return 0
  fi

  set +e
  newest=$(read_latest_remitbak_inside_container)
  set -e

  if [ -n "$newest" ] && [ "$newest" != "$pre_backup_path" ]; then
    last_backup_path="$newest"
    echo "[upgrade] backup snapshot: $last_backup_path"
  else
    last_backup_path=""
    echo "[upgrade] backup completed; no new local .remitbak detected (remote destination or external snapshot)."
  fi
}

echo "[upgrade] project root: $project_root"
echo "[upgrade] checking host prerequisites."

if [ "$dry_run" = "1" ]; then
  bash ./scripts/host/_check-prereqs.sh --dry-run
else
  run_script_or_abort "./scripts/host/_check-prereqs.sh" ./scripts/host/_check-prereqs.sh
fi

if [ "$skip_backup" = "1" ]; then
  echo "[upgrade] step 1/4: snapshot backup skipped by double opt-in."
else
  echo "[upgrade] step 1/4: snapshot backup."
  capture_pre_backup_path
  run_or_abort "docker compose exec -T app pnpm remit:backup --yes" docker compose exec -T app pnpm remit:backup --yes
  capture_post_backup_path
fi

echo "[upgrade] step 2/4: pull images."
run_or_abort "docker compose pull" docker compose pull

echo "[upgrade] step 3/4: restart compose project."
run_or_abort "docker compose up -d" docker compose up -d

echo "[upgrade] step 4/4: wait for app health."

if [ "$dry_run" = "1" ]; then
  echo "[upgrade] dry run: ./scripts/host/_wait-for-health.sh"
  bash ./scripts/host/_wait-for-health.sh --dry-run
else
  run_script_or_abort "./scripts/host/_wait-for-health.sh" ./scripts/host/_wait-for-health.sh
fi

echo "[upgrade] upgrade completed successfully."
