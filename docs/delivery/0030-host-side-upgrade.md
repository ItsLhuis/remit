# DR-0030: Host-side upgrade

- **Status:** Shipped
- **Date:** 2026-05-26
- **Verdict:** Complete
- **Decisions:** ADR-0020
- **Supersedes:** —
- **Reconstructed:** yes

## What

`bash scripts/host/upgrade.sh`, run on the host that owns the Compose project, which snapshots a
backup, pulls images, restarts the project and waits for health.

## Why

Upgrading a self-hosted instance by hand is four commands in a specific order, and the order is the
part that matters: an operator who pulls before backing up has no rollback if the new image's
migrations fail. The script exists to make the safe order the default one.

## Scope

Included: a host prerequisite check, an in-container backup through `remit:backup --yes`, a
`docker compose pull`, a `docker compose up -d`, a health wait, `--dry-run`, and rollback guidance
that distinguishes a detected local snapshot from a remote destination.

Excluded, and this is the whole point of the record: any in-container upgrade command. There is no
`pnpm remit:upgrade`, the name is not reserved, and it must not be added unless a future ADR
supersedes ADR-0020. The app container does not pull its own image, does not restart its parent
Compose project, and never receives the Docker socket.

## How

The exclusion above is a security boundary rather than a packaging preference. Mounting the Docker
socket into the app container would turn any single application vulnerability — an SSRF, a path
traversal, a dependency compromise — into host-level Docker daemon access, which is root on the host
in all but name. The upgrade therefore runs where the authority already is, on the host, and reaches
into the container only for the backup.

`--skip-backup` is refused unless `REMIT_ALLOW_UPGRADE_WITHOUT_BACKUP=1` is also set, the same
two-places double opt-in the restore command uses: a flag alone is too easy to paste from a forum
post.

Migrations are not the script's business. They continue to run through `docker-entrypoint.sh` when
the new app container starts, so the upgrade path and a plain container restart apply schema changes
the same way and there is no second migration mechanism to keep in step.

`--yes` is accepted for parity and reported as a no-op, because the flow is non-interactive by
design and silently ignoring a flag an operator passed is worse than telling them it did nothing.

## Evidence

- `scripts/host/upgrade.sh`, `scripts/host/_check-prereqs.sh`, `scripts/host/_wait-for-health.sh`
- `docs/operations/UPGRADE.md` — the operator runbook
- `docs/architecture/operations/CLI-CONTRACT.md` — the `bash scripts/host/upgrade.sh` section and
  the `remit:upgrade` exception
- `docs/architecture/adr/0020-operational-cli-contract.md`
- `docker-entrypoint.sh` — where migrations actually run
- `Dockerfile` — host-side scripts are deliberately not copied into the runtime image

## Verification

`--dry-run` prints the exact command sequence without executing it, which is how the ordering is
checked. The health wait is the functional assertion: the script does not report success until
`/api/health` answers, so an upgrade that starts a container which cannot serve fails loudly rather
than silently. The E2E workflow exercises the same image and entrypoint the upgrade produces.

Not covered by an automated test: the script itself. It is POSIX shell run on a host outside the
test environment, and no shell test harness exists in the repository. Its steps are verified by
`--dry-run` and by the runbook.

## Known gaps

The upgrade script has no automated test. Rollback is documented rather than automated: when no new
local `.remitbak` snapshot is detected, the runbook directs the operator to restore from the
configured remote URI or another verified backup by hand.
