# Scripts

This directory holds Remit's operational commands: the `pnpm remit:*` commands that run against a
real instance and the host-side shell scripts that install and upgrade it. Read this before adding
or changing one. Developer workflow scripts (`dev`, `services:*`, `database:test:*`, `version:*`)
are out of scope.

What a command does, its prompts and its flags are in the code. Run `pnpm remit:<operation> --help`
for the flags of an operation that takes any; the parser and help text live in
`scripts/core/<area>/args.ts`. `remit:reset-password` is interactive and has neither flags nor
`--help`. The operator view of install, upgrade, backup and restore is in `docs/operations/`.

## Naming and layout

A `remit:*` command has the same name in every place that mentions it:

| Place              | Form                                                    |
| ------------------ | ------------------------------------------------------- |
| `package.json` key | `remit:<operation>`, lowercase, kebab-case              |
| Entry point        | `scripts/<operation>.ts`, a thin `main()` over the core |
| Core logic         | `scripts/core/<area>/`                                  |
| Bundle             | `scripts/dist/<operation>.js`, built by tsup            |
| Run                | `node ./scripts/dist/<operation>.js` via `pnpm`         |

`scripts/core/cli/` holds the shared prompt, bootstrap and exit helpers. Core code does not import
`next/*`, `react` or any client-only module. Business logic that is not specific to the command
belongs in `features/<feature>/services/`. A command exits `0` on success and `1` on failure.

## Promotion criteria

An operation becomes a `remit:<operation>` script in `package.json` only when all of these hold:

1. The compiled command runs end to end against a real Postgres and a real object store.
2. Its pure helpers have unit tests and its end-to-end behaviour has an integration test against the
   Dockerized test database (`.agents/rules/testing.md`).
3. `tsup.scripts.config.ts` has an entry named exactly `<operation>`.
4. The runtime stage of `Dockerfile` has a `COPY` line for `scripts/dist/<operation>.js`.
5. The documents that describe the command are accurate in the same change.

`tests/docs/packaging.test.ts` checks that `package.json`, `tsup.scripts.config.ts` and `Dockerfile`
agree. The build entries `migrate` and `worker` are bundled and copied but are not `remit:*`
commands: `docker-entrypoint.sh` runs the first before the web server starts, and the second is the
worker image's process (see below).

## Execution context

Every operational command runs in exactly one place.

| Context      | Invocation                                | Reaches                                                                |
| ------------ | ----------------------------------------- | ---------------------------------------------------------------------- |
| In-container | `docker compose exec app pnpm remit:<op>` | Database, encryption key, data volume and object store of the app      |
| Host-side    | `bash scripts/host/<op>.sh`               | Image pulls, compose restarts, host volumes, everything outside Docker |

The in-container commands are the `remit:*` scripts in `package.json`. The host-side scripts are
`scripts/host/install.sh` and `scripts/host/upgrade.sh`; they are POSIX shell, run from the checkout
that owns the compose project, and are not copied into the image. A leading underscore marks a
helper they share (`_check-prereqs.sh`, `_wait-for-health.sh`), not an operator entry point.

### The upgrade boundary

- The app container never mounts the Docker socket, so a vulnerability in the application cannot
  reach the Docker daemon.
- Anything that pulls images or restarts the compose project runs on the host.
- Upgrade is `scripts/host/upgrade.sh`, run by an operator on the host. It calls the in-container
  backup (`docker compose exec -T app pnpm remit:backup --yes`), pulls images and restarts the
  stack. Pending database migrations run when the app container starts (`docker-entrypoint.sh`).
- There is no `remit:upgrade` script, and none may be added unless this model changes.

### Processes that are not commands

`scripts/migrate.ts` and `scripts/worker.ts` are bundled by tsup like the commands but are never run
by an operator.

- `migrate` applies pending Drizzle migrations; `docker-entrypoint.sh` runs it before the web server
  starts in the `app` image.
- `worker` is the background job consumer. It is the `ENTRYPOINT` of the `worker` stage of
  `Dockerfile`, which `docker-compose.yml` builds for the `worker` service; that service sets no
  `entrypoint:` of its own and never reaches `docker-entrypoint.sh`. The process stays up until
  `SIGTERM` or `SIGINT`, so it does not follow the exit-on-success rule above.

## Scheduled backups and the locks

The worker's scheduled backup (`features/backups/jobs.ts`) runs the same pipeline as `remit:backup`.
Two PostgreSQL session advisory locks decide who may write archives:

- The backup lock (`lib/backups/backupLock.ts`) is taken by the scheduled backup, `remit:backup`,
  `remit:restore` and a non-dry-run `remit:rotate-encryption-key`, for the whole run. The try-lock
  never waits: the scheduled backup skips that occurrence with a warning, the commands print the
  holder and exit `1`.
- The rotation lock (`scripts/core/keyRotation/lock.ts`) is separate. The scheduled backup checks it
  first and skips while a rotation is running.

The operator view, including what a skip looks like, is in `docs/operations/BACKUP.md`.

## Key rotation

`pnpm remit:rotate-encryption-key` replaces `REMIT_ENCRYPTION_KEY`. The entry point is
`scripts/rotate-encryption-key.ts`; the flow is `scripts/core/keyRotation/runRotation.ts`.

- Keys never come through argv. An interactive run prompts for the old and new key with masked
  input. An unattended run needs `REMIT_ALLOW_UNATTENDED_KEY_ROTATION=1` with both `REMIT_OLD_KEY`
  and `REMIT_NEW_KEY` (`readKeys.ts`).
- The old key is verified against the data before anything is written. A dry run stops after that
  and writes nothing.
- Without `--backup-file`, a pre-rotation `.remitbak` is written first with the old key. A supplied
  file is verified instead.
- The rotation rewrites the registered encrypted columns table by table, then re-encrypts the local
  and configured remote `.remitbak` archives. Each table is an audit step, so an interrupted run
  continues with `--resume`, and a new run is refused while an earlier trail is incomplete.
- It holds the backup lock for the whole run, so no backup is written or pruned while archives are
  re-encrypted, and the rotation lock around the table rewrite. It lets go of the rotation lock only
  while the pre-rotation backup runs, because that backup runs under the lock the rotation already
  holds.
- It does not rewrite `.env` or deployment configuration. The operator sets the new
  `REMIT_ENCRYPTION_KEY` and recreates the stack afterwards. It does not touch Better Auth-owned
  password hashes, TOTP secrets, backup codes or sessions.

## Seeded demo data

`pnpm remit:seed-demo` produces the same records for the same seed, except for public document
tokens. Those are bearer credentials on a real port, so `scripts/core/seedDemo/plan.ts` mints them
from the CSPRNG on every run. A document that describes the seed as repeatable must name that
exception (`tests/docs/demoSeeding.test.ts`).
