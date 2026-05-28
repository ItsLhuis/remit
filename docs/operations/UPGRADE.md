# Remit Host-Side Upgrade Runbook

Remit upgrades are host-side only. The app container does not pull images, restart Docker Compose,
or receive access to the Docker socket.

## Prerequisites

- Host shell access to the checkout that contains `docker-compose.yml`.
- Docker Engine 24 or newer.
- Docker Compose v2 plugin form available as `docker compose`.
- The Remit compose stack is already running. If it is stopped, start it first with
  `docker compose up -d`, confirm it is healthy, then upgrade.
- The configured backup destination is reachable. For the default local destination, the
  `${REMIT_DATA_DIR:-./data}` volume must be writable and have enough space for a `.remitbak`
  archive.
- The current app image tag is known. The production compose file reads `REMIT_IMAGE_TAG` and
  defaults to `latest`.

## Quick Start

From any directory inside the Remit checkout:

```bash
bash scripts/host/upgrade.sh
```

Preview the commands without changing the instance:

```bash
bash scripts/host/upgrade.sh --dry-run
```

## What The Script Does

The script discovers the repository root, checks host prerequisites, and then runs the upgrade
sequence from the compose project directory:

1. Snapshot: `docker compose exec -T app pnpm remit:backup --yes`
2. Pull: `docker compose pull`
3. Restart: `docker compose up -d`
4. Health: `./scripts/host/_wait-for-health.sh`

The backup is mandatory. The only escape hatch is a double opt-in:

```bash
REMIT_ALLOW_UPGRADE_WITHOUT_BACKUP=1 bash scripts/host/upgrade.sh --skip-backup
```

Use that only when you already have a verified external snapshot. The host script has no other
prompts. The app entrypoint applies pending migrations during `docker compose up -d`; the upgrade
script does not run migrations itself.

## Rollback

If the upgrade backup writes a new local `.remitbak`, the script prints that snapshot path. Use that
path as `<snapshot-file>` below.

```bash
docker compose stop app
export REMIT_IMAGE_TAG=<previous-tag>
docker compose pull app
docker compose up -d
docker compose exec -T app pnpm remit:restore "<snapshot-file>"
./scripts/host/_wait-for-health.sh
```

If you do not use `REMIT_IMAGE_TAG`, pin the app image reference in your compose file to the
previous known-good tag before `docker compose pull app`.

When the configured backup destination is remote, the backup step can complete without producing a
new local `.remitbak`; the script reports that no new local snapshot was detected. In that case,
restore from the configured remote URI, such as `remit://s3/remit-backups/...`, or from another
verified backup. If the backup was skipped, restore from your last verified backup instead of a
pre-upgrade snapshot.

## Troubleshooting

### Image Registry Unreachable

`docker compose pull` exits non-zero and the script stops before restarting the stack. Keep the
current stack running, fix registry credentials or network access, then rerun the upgrade.

### Backup Failure

The script stops before pulling images. Check the backup output for the failing destination. For
local backups, confirm the data directory is writable and has enough disk space. For S3-compatible
destinations, confirm the saved bucket, endpoint, region, and credentials in Remit settings.

### Migration Failure

The entrypoint runs migrations before the app starts. If migration fails, the new app container
exits or never becomes healthy. Review the app logs printed by the health wait, pin the previous
image tag, start the previous image, and restore the printed pre-upgrade snapshot if the database
was changed.

### Health Timeout

`_wait-for-health.sh` polls Docker Compose health for five minutes. On timeout or `unhealthy`, it
prints `docker compose logs --tail 50 app`. Use those logs to decide whether to wait, fix
configuration, or roll back.

## Safety Boundaries

- No `remit:upgrade` package script exists.
- No Docker socket is mounted into the app container.
- Host scripts under `scripts/host/` are not copied into the runtime image.
- The pre-upgrade backup is mandatory unless both `--skip-backup` and
  `REMIT_ALLOW_UPGRADE_WITHOUT_BACKUP=1` are present.
