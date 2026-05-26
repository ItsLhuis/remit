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

Reserved names claimed by shipped or planned in-container work:

- `remit:reset-password`
- `remit:backup`
- `remit:restore`
- `remit:rotate-encryption-key`
- `remit:seed-demo`

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
2. **Tier-appropriate tests.** Pure helpers extracted into `scripts/_lib/` or service modules are
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
- Shared CLI helpers belong in `scripts/_lib/` for prompts, logging, exit handling, and similar
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
| `remit:rotate-encryption-key` | Planned | In-container | Reserved name. Requires its own ADR before implementation.                               |
| `remit:seed-demo`             | Shipped | In-container | Deterministic demo data; presets plus capped numeric count overrides.                    |

## `remit:upgrade` exception

Upgrade is host-side only.

There is no `remit:upgrade` package script. The name is not reserved. It must not be added to
`package.json` unless a future ADR explicitly supersedes ADR-0020 and changes the operational model.

The shipped upgrade flow is `scripts/host/upgrade.sh`, run by an operator on the host that owns the
compose project. It snapshots through the in-container backup command, pulls images, restarts the
compose project, and waits for health. The app container does not pull its own image, restart its
parent compose project, or receive Docker socket access. Pending migrations continue to run through
`docker-entrypoint.sh` when the app container starts.
