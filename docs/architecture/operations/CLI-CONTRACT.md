# Operational CLI Contract

This document is the implementation-facing contract for Remit's operational commands. The
architecture overview explains why self-hosting operations are product surface area; this document
defines how command names, execution contexts, packaging, validation, and status are governed.

ADR-0020 owns the accepted architectural decision. This document owns the detailed contract that
contributors use when adding or changing operational commands.

## Scope

The contract covers commands intended to run against a real Remit installation, whether self-hosted
or Hosted-managed. It does not cover developer workflow scripts such as `dev`, `services:*`,
`database:test:*`, CI helpers, or `version:*` scripts.

## Naming and shape

Operational behaviour that runs inside the app container uses `remit:<operation>` package scripts.

| Rule                | Required form                                                |
| ------------------- | ------------------------------------------------------------ |
| `package.json` key  | `remit:<operation>` - colon-separated, lowercase, kebab-case |
| Source file         | `scripts/<operation>.ts`                                     |
| Compiled output     | `scripts/dist/<operation>.js`                                |
| Invocation in image | `node ./scripts/dist/<operation>.js` via `pnpm remit:<op>`   |

Shipped in-container operational commands:

- `remit:reset-password`
- `remit:backup`
- `remit:restore`
- `remit:rotate-encryption-key`
- `remit:seed-demo`
- `remit:reset-data`

## Execution context

Every operational command declares one execution context.

| Context          | Invocation                                             | Permitted operations                                                                                                |
| ---------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| **In-container** | `docker compose exec app pnpm remit:<op>`              | Anything reachable from inside the app container: database, encryption key, uploads volume, configured object store |
| **Host-side**    | `bash scripts/host/<op>.sh` or operator-run docs steps | Pulling Docker images, restarting the compose project, mounting host volumes, image registry access                 |
| **Both**         | Same script, callable from either side                 | Reserved for read-only inspection helpers; no destructive operation may declare "both"                              |

A command that requires Docker socket access, image pulls, or compose restarts is host-side only.
The app container must never mount the Docker socket. That would turn one application vulnerability
into host-level Docker daemon access.

Host-side scripts live under `scripts/host/` as POSIX shell scripts. They are checked out and run on
the host that owns the compose project and are not copied into the runtime image.

## Promotion criteria

A `remit:<operation>` command becomes a `package.json` script only when all of the following are
true:

1. **Real backing implementation.** The compiled output runs end-to-end against a real Postgres
   instance and a real uploads volume. Stubs, commented-out core logic, and placeholder errors are
   not acceptable.
2. **Tier-appropriate tests.** Pure helpers extracted into `scripts/core/` or service modules are
   Tier 1. End-to-end script behaviour is Tier 2 integration-tested against the Dockerized test
   Postgres described by `.agents/rules/testing.md`.
3. **Docs accuracy.** `README.md`, the architecture overview, and the status matrix in this document
   must describe the command accurately in the same PR that ships the implementation.
4. **Build entry.** `tsup.scripts.config.ts` includes the new entry, and the entry name matches
   `<operation>` exactly.
5. **Runtime packaging.** `Dockerfile` copies the compiled output into the runtime image when the
   execution context is in-container. Host-side scripts are not copied into the image.

A PR that adds a `package.json` script without satisfying every item above is rejected. Remit does
not ship placeholder package scripts.

## Build and packaging

- Source: TypeScript in `scripts/<operation>.ts`, top-level await allowed, ESM only.
- Output: `scripts/dist/<operation>.js` via tsup (`platform: "node"`, `target: "node24"`,
  `format: ["esm"]`, `clean: true`, `splitting: false`).
- Shared CLI helpers belong in `scripts/core/` for prompts, logging, exit handling, and similar
  concerns. They must not depend on `next/*`, `react`, or any client-only module.
- Pure business logic invoked by a script lives in `features/<feature>/services/` per ADR-0007 and
  is imported through the feature server barrel.
- Scripts must call `process.exit(0)` on success and `process.exit(1)` on uncaught failure. They
  must close the database client explicitly or rely on `pg`'s implicit close.
- Sensitive output such as passwords, encryption keys, and tokens is printed to stdout only when the
  operator explicitly requested it interactively; it is never logged through `pino`.

For each in-container script, the runtime stage of `Dockerfile` includes one COPY line:

```dockerfile
COPY --from=builder --chown=nextjs:nodejs /app/scripts/dist/<operation>.js ./scripts/dist/<operation>.js
```

## Validation baseline

Every implementation PR for a `remit:*` script must run and pass the appropriate checks for the
change:

| Check                                                        | Command                                                            |
| ------------------------------------------------------------ | ------------------------------------------------------------------ |
| `package.json` parses as valid JSON                          | `node -e "JSON.parse(require('fs').readFileSync('package.json'))"` |
| Every `remit:*` script resolves to an existing compiled file | Assert `scripts/dist/<name>.js` exists                             |
| `tsup` build succeeds                                        | `pnpm build:scripts`                                               |
| TypeScript passes                                            | `pnpm typecheck`                                                   |
| Lint passes                                                  | `pnpm lint`                                                        |
| Unit tests for extracted services pass                       | `pnpm test`                                                        |
| Integration test for the script passes against test Postgres | `pnpm test:integration`                                            |
| Docs do not claim unshipped commands are shipped             | Manual review against README, architecture, and this matrix        |

The PR description must include the output of `pnpm build:scripts` and the relevant test run for the
implemented command.

## Status matrix

| Command                       | Status  | Context      | Notes                                                                                    |
| ----------------------------- | ------- | ------------ | ---------------------------------------------------------------------------------------- |
| `remit:reset-password`        | Shipped | In-container | ADR-0012. Operational recovery exception for Better Auth-owned tables.                   |
| `remit:backup`                | Shipped | In-container | Local plus S3/R2/B2 encrypted `.remitbak` destinations.                                  |
| `remit:restore`               | Shipped | In-container | Local path or `remit://<destination>/<key>` restore with mandatory pre-restore snapshot. |
| Remote backup destinations    | Shipped | In-container | `s3`, `r2`, and `b2` implemented through the S3-compatible adapter.                      |
| Upgrade flow                  | Shipped | Host-side    | `scripts/host/upgrade.sh`; runbook in `docs/operations/UPGRADE.md`. No `remit:upgrade`.  |
| `remit:rotate-encryption-key` | Shipped | In-container | ADR-0021. Rotates registered encrypted columns and `.remitbak` archive encryption.       |
| `remit:seed-demo`             | Shipped | In-container | Deterministic demo data; presets plus capped numeric count overrides.                    |
| `remit:reset-data`            | Shipped | In-container | ADR-0025. Empties domain data; account, organization, and instance configuration stay.   |

## Operator command reference

### `pnpm remit:reset-password`

- **Runs in:** the application container or an equivalent runtime environment with the application
  database/auth configuration loaded.
- **Required configuration:** database connectivity and Better Auth configuration.
- **Destructive scope:** sensitive account recovery, but not broadly destructive.
- **Confirmation:** prompts for the target email, displays the matched account, and asks the
  operator to confirm the credential reset.
- **Effects:** generates a temporary password, hashes it through the application auth password
  hashing path, updates the user's credential account, sets `users.mustChangePassword = true`, and
  writes `auth.password_reset.cli_issued` with `userAgent: "cli/reset-password"`.
- **Limitations:** does not alter TOTP secrets, backup codes, sessions, organizations, or any other
  Better Auth-owned second-factor state.

### `pnpm remit:seed-demo`

- **Runs in:** the application container or an equivalent runtime environment with database access.
- **Required configuration:** database/auth environment and an existing owner membership created by
  registration/setup.
- **Destructive scope:** non-destructive by default; `--reseed` deletes and replaces seedable
  demo/domain rows.
- **Confirmation:** asks for confirmation unless `--yes` is supplied.
- **Flags:** `--dry-run`, `--yes`, `--reseed`, `--seed <number>`,
  `--size <small|medium|large|clients>`, `--clients <number>`, `--projects <number>`,
  `--invoices <number>`, and `--help`.
- **Effects:** seeds deterministic demo/domain data only: settings, tax rates, leads, clients,
  projects, tasks, time entries, expenses, proposals, invoices, line items, payments, credit notes,
  contracts, and recurring invoice schedules.
- **Limitations:** refuses to proceed when seedable rows already exist unless `--reseed` is
  supplied; does not seed or mutate Better Auth-owned auth tables, organization tables, uploads,
  email logs, audit logs, or activity logs.

### `pnpm remit:reset-data`

- **Runs in:** the application container or an equivalent runtime environment with database access.
- **Required configuration:** database environment. A reachable Redis is optional; an unreachable
  one degrades to a warning.
- **Destructive scope:** destructive and unrecoverable short of a restore. Deletes every domain row
  in the instance.
- **Confirmation:** a typed confirmation, not a yes/no — the operator types the business name from
  `settings`, or `DELETE` when the instance has no business name. `--yes` skips it for scripted use.
- **Flags:** `--dry-run`, `--yes`, and `--help`.
- **Effects:** deletes leads, clients, projects, tasks, time entries, expenses, proposals, invoices,
  line items, payments, credit notes, contracts, recurring invoice schedules, the runtime artifacts
  of those rows (activity logs, email logs, data exports, proposal OTPs, contract signatures), and
  the `uploads` rows those documents referenced — all in one transaction. Writes
  `instance.reset_data.completed` with per-table deleted counts and `userAgent: "cli/reset-data"`,
  then drains the BullMQ queue on a best-effort basis.
- **Limitations:** never touches Better Auth-owned tables, the `settings` row, `tax_rates`,
  `templates`, or `audit_logs`. Document numbering counters are not rewound. Objects in the
  configured store are not deleted, only the database rows that pointed at them. The scope
  classification is [ADR-0025](../adr/0025-instance-data-reset-scope.md).

### `pnpm remit:backup`

- **Runs in:** the application container or an equivalent runtime environment with access to the
  database, encryption key, uploads volume, and configured backup destination.
- **Required configuration:** `DATABASE_URL`, `REMIT_ENCRYPTION_KEY`, `REMIT_DATA_DIR`, readable
  uploads/storage paths, and a local or configured remote backup destination. Remote destinations
  use the encrypted backup credentials saved in `/settings/backup`.
- **Destructive scope:** non-destructive.
- **Confirmation:** overwriting an existing local output path requires interactive confirmation
  unless `--yes` is supplied.
- **Flags:** `--destination <local|s3|r2|b2>`, `--output <path>`, `--dry-run`, `--yes`, and
  `--help`. `--output` is local-only and cannot be combined with a remote destination.
- **Effects:** writes an AES-256-GCM encrypted `.remitbak` archive for local output or uploads the
  archive to the configured S3-compatible destination. On normal command runs it updates backup
  success/failure status and writes `instance.backup.completed` or `instance.backup.failed`.
- **Limitations:** a single run writes to one destination. The archive format is specified in
  [Backup archive format](../specs/BACKUP-ARCHIVE.md).

### `pnpm remit:restore`

- **Runs in:** the application container or an equivalent runtime environment with access to the
  live database, encryption key, uploads volume, and archive source.
- **Required configuration:** `DATABASE_URL`, `REMIT_ENCRYPTION_KEY`, `REMIT_DATA_DIR`, archive
  access, and any configured S3/R2/B2 credentials needed for remote archive URIs.
- **Destructive scope:** destructive restore operation. It replaces live database contents and
  uploads with archive contents.
- **Confirmation:** always creates a mandatory local pre-restore snapshot before destructive work.
  Interactive restore requires typed confirmation of the database name and the exact snapshot path.
  Unattended restore requires both `--yes` and `REMIT_ALLOW_UNATTENDED_RESTORE=1`.
- **Flags:** `<backup-file|remit://destination/key>`, `--dry-run`, `--yes`, and `--help`.
- **Effects:** accepts local archive paths or `remit://s3|r2|b2/<key>` remote references, verifies
  the archive, restores the database with
  `pg_restore --clean --if-exists --no-owner --no-privileges --single-transaction --dbname <DATABASE_URL>`,
  swaps uploads atomically, and runs forward migrations through the compiled migration entrypoint.
- **Audit:** writes `instance.restore.started`, `instance.restore.snapshot_taken`,
  `instance.restore.completed`, and, when eligible, `instance.restore.aborted`.
- **Limitations:** no `--force-version`, partial restore, or point-in-time recovery. Restore records
  the archive `schemaMigrationId` for audit and dry-run visibility; it does not implement a separate
  older-than-current migration warning gate. Detailed operator guidance is in the
  [Restore runbook](../../operations/RESTORE.md).

### `pnpm remit:rotate-encryption-key`

- **Runs in:** the application container or an equivalent runtime environment with database,
  encryption key, uploads, and backup/archive access.
- **Required configuration:** `DATABASE_URL`, the current `REMIT_ENCRYPTION_KEY`, `REMIT_DATA_DIR`,
  the explicit old and new encryption keys, and configured backup credentials when remote archives
  need re-encryption.
- **Destructive scope:** operationally sensitive destructive-style data rewrite.
- **Confirmation and key input:** keys are never accepted through argv. Interactive runs use masked
  prompts. Unattended runs require `REMIT_ALLOW_UNATTENDED_KEY_ROTATION=1` plus both `REMIT_OLD_KEY`
  and `REMIT_NEW_KEY`.
- **Flags:** `--backup-file <path>`, `--dry-run`, `--resume`, and `--help`.
- **Effects:** verifies the old key, creates a local pre-rotation backup unless a verified
  `--backup-file` is supplied, rotates registered Remit-owned encrypted database columns, and
  re-encrypts local and configured remote `.remitbak` archive envelopes.
- **Audit:** writes `instance.key_rotation.started`, `instance.key_rotation.table_completed`,
  `instance.key_rotation.backup_reencrypted`, `instance.key_rotation.completed`, and
  `instance.key_rotation.aborted`.
- **Limitations:** does not rewrite `.env` or deployment configuration, and does not rotate Better
  Auth-owned password hashes, TOTP secrets, backup codes, sessions, verification tokens,
  organizations, or memberships. Detailed rotation semantics are in
  [ADR-0021](../adr/0021-encryption-key-rotation.md).

### `bash scripts/host/upgrade.sh`

- **Runs in:** the host checkout that owns the deployed Docker Compose project, not inside the app
  container.
- **Required configuration:** Docker Engine 24 or newer, Docker Compose v2 plugin form, a
  `docker-compose.yml` in the project root, and a running `app` service.
- **Destructive scope:** host-side upgrade orchestration. It does not directly edit application
  data, but the restarted app entrypoint may apply pending migrations.
- **Confirmation:** the host script is non-interactive. `--yes` is accepted for parity and reports
  that the backup step will run with `--yes`.
- **Flags:** `--dry-run`, `--yes`, `--skip-backup`, and `--help`. `--skip-backup` is refused unless
  `REMIT_ALLOW_UPGRADE_WITHOUT_BACKUP=1` is also set.
- **Effects:** checks host prerequisites, runs `docker compose exec -T app pnpm remit:backup --yes`
  unless backup is skipped, pulls images, restarts the compose project, and waits for app health.
- **Limitations:** there is no `pnpm remit:upgrade`. Rollback guidance distinguishes a detected
  local `.remitbak` snapshot from remote backup destinations; when no new local `.remitbak` is
  detected, restore from the configured remote URI or another verified backup. Detailed steps are in
  the [Upgrade runbook](../../operations/UPGRADE.md).

### `scripts/migrate.ts`

- **Runs in:** the runtime container entrypoint path only.
- **Required configuration:** `DATABASE_URL`.
- **Destructive scope:** applies pending Drizzle migrations before the server starts.
- **Confirmation:** no prompts; it is invoked automatically by `docker-entrypoint.sh`.
- **Effects:** builds to `scripts/dist/migrate.js`; `docker-entrypoint.sh` runs
  `node scripts/dist/migrate.js` before `node server.js`.
- **Limitations:** not a user-facing `remit:*` command and not a package script.

### `scripts/worker.ts`

- **Runs in:** its own long-lived container, the `worker` service in `docker-compose.yml`, started
  with `entrypoint: ["node", "scripts/dist/worker.js"]`.
- **Required configuration:** `DATABASE_URL`, `REDIS_URL`, plus the encryption key and storage
  credentials the jobs it runs depend on.
- **Destructive scope:** none directly, but the jobs it consumes are money-affecting — recurring
  invoice generation, overdue detection and reminder dispatch (ADR-0023). Each carries its own
  entity-scoped idempotency guard so a retry cannot double-generate or double-send.
- **Confirmation:** no prompts; it is a supervised process, not an operator command.
- **Effects:** builds to `scripts/dist/worker.js`; registers the repeatable job schedulers in Redis
  on boot and consumes the queue until it receives `SIGTERM` or `SIGINT`.
- **Limitations:** not a user-facing `remit:*` command and not a package script. It cannot satisfy
  the `process.exit(0)` on success rule in Build and packaging, because success for a worker means
  staying up; that is why it is documented here rather than promoted to the `remit:*` namespace.
  `pnpm dev:worker` and `pnpm start:worker` exist for local runs only — the production container
  does not use them.

## `remit:upgrade` exception

Upgrade is host-side only.

There is no `remit:upgrade` package script. The name is not reserved. It must not be added to
`package.json` unless a future ADR explicitly supersedes ADR-0020 and changes the operational model.

The shipped upgrade flow is `scripts/host/upgrade.sh`, run by an operator on the host that owns the
compose project. It snapshots through the in-container backup command, pulls images, restarts the
compose project, and waits for health. The app container does not pull its own image, restart its
parent compose project, or receive Docker socket access. Pending migrations continue to run through
`docker-entrypoint.sh` when the app container starts.
