# DR-0048 — One-command install

- **Status:** Shipped
- **Date:** 2026-09-16
- **Verdict:** Complete with known gaps
- **Decisions:** ADR-0005, ADR-0020, ADR-0040
- **Supersedes:** —

## What

`scripts/host/install.sh` takes a host with Docker to a running instance at `/register` in one
command, on images that carry no deployment address and a Compose stack whose only public surface is
the application, or Caddy in front of it.

## Why

The self-hosting story was a runbook of hand edits: copy `.env.example`, generate two secrets with
`openssl`, set four URLs consistently, start Compose, and hope the key was saved. Building the
command that replaces it exposed that the images it would pull could not serve any real address:
`NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_STORAGE_BASE_URL` were compiled into the browser bundle as
`localhost`; browsers uploaded to and read from MinIO directly, so storage needed its own public
address and certificate and the Compose file published MinIO's console; the image workflow published
the worker stage under the application's name and no worker image at all; and the `with-proxy` Caddy
profile ARCHITECTURE.md described had never existed.

## Scope

Included: the installer and its shared prerequisite check; runtime-only configuration with one
`REMIT_PUBLIC_URL`; uploads streamed through the application and public files served from its
origin, with object storage internal to Compose; two images built from explicit targets; the
`with-proxy` Caddy profile; the tests, CI workflow and documentation for all of it. Two defects
found while verifying it were fixed in scope, because neither leaves an installed instance usable:
the worker could not start in a container at all, and `remit:restore` failed on an archive with no
local uploads.

Excluded, with reasons:

- **A hosted `curl | bash` path.** The installer needs the checkout's Compose file and Caddyfile,
  and an operator should read a script before it generates their encryption key.
- **Installing Docker, configuring DNS or firewalls.** Each is the operator's host, and a script
  that changes them unasked is one nobody can safely run.
- **Reconfiguring an existing install.** Re-running never rewrites `.env`; changing an answer is an
  edit to that file.
- **Platform deployment guides.** They build on this installer and are their own delivery.

## How

The installer is host-side, beside `upgrade.sh`, and follows its shape exactly: `set -euo pipefail`,
a `show_help` heredoc, an argument loop that refuses an unknown option with exit 2, `--dry-run`, and
bracketed log prefixes. `_check-prereqs.sh` grew a `--for install|upgrade` switch rather than a
second copy: both check Docker, Compose and the Compose file; an upgrade additionally needs a
running `app`, and an install needs a reachable daemon, a writable checkout with 5 GB free, and the
ports it is about to bind, probed through bash's `/dev/tcp` because `ss` and `netstat` differ per
distribution.

Three questions are asked, and each is a value Compose or the container needs before a page exists
to ask it on: the public URL, whether Caddy should terminate TLS, and the ACME email if it should.
Everything else stays in `/setup` and `/settings/**`. The URL rule is restated from
`lib/config/envSchema.ts` in shell, because the host has no Node; the installer's test feeds what it
accepts through that schema after Compose interpolation, so the two cannot drift apart silently.

Secrets come from `openssl rand`, falling back to `/dev/urandom`, and each is checked for its exact
shape before use; the passwords are hex so nothing needs escaping inside the connection URL Compose
builds. `.env` is written under `umask 077` to a `mktemp` file that is `chmod 600`-ed and moved into
place.

The encryption key gets the one deliberate exception to never printing a secret: interactively it is
displayed once and `.env` is written only after the operator types its last six characters back, so
abandoning the run leaves nothing behind. Unattended it is never printed and `--accept-key-custody`
is required. `REMIT_INSTALL_ENCRYPTION_KEY` supplies an existing key for a restore onto a new host,
through the environment rather than argv, as `rotate-encryption-key` does.

The re-run guard is the most important line in the script: an existing `.env` is never rewritten.
The only thing read from it is a `grep -q` on the key line, whose exit status says the key is
present without the value reaching a variable or a log. A re-run starts the stack without pulling,
so it can never become an upgrade without the backup `upgrade.sh` takes first. A missing `.env`
beside existing Compose volumes is refused outright.

`docker compose up -d --no-build` is deliberate: without it Compose silently builds an image the
registry does not have, which on a small server looks like a hang. Before starting, a one-shot
`chown` in the app's own image gives the bind-mounted data directory to the unprivileged user Docker
would otherwise leave it root-owned against.

The architecture changes behind it are ADR-0040: no `NEXT_PUBLIC_*` and no build argument, one
`REMIT_PUBLIC_URL` replacing `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL`, uploads streamed through
`POST /api/upload/[type]` and public objects served by `GET /api/storage/[...key]`, MinIO with no
published port and no anonymous bucket policy, and two images built from their own targets. The
upload route sits outside the `proxy.ts` matcher because Next.js buffers and truncates a proxied
body at ten megabytes, which an attachment exceeds; the security headers moved to
`lib/securityHeaders.ts` so that route keeps them.

## Evidence

- Installer: `scripts/host/install.sh`; `scripts/host/_check-prereqs.sh`'s `--for` switch.
- Compose and images: `docker-compose.yml` (image names, no MinIO ports, `REMIT_APP_BIND`, the
  `with-proxy` Caddy service), `deploy/caddy/Caddyfile`, `Dockerfile` (no build arguments),
  `.github/workflows/docker.yml` (two targets, two images).
- Runtime configuration: `lib/config/envSchema.ts` and `lib/config/env.ts`; `lib/auth/client.ts`;
  `lib/storage/index.ts`'s `resolveStorageUrl`; `next.config.mjs`.
- Storage path: `app/api/upload/[type]/route.ts`, `app/api/storage/[...key]/route.ts`,
  `lib/storage/s3.ts`'s `putUploadedObject` and `getPublicObjectStream`,
  `lib/storage/objectErrors.ts`, `hooks/useFileUpload.ts`, `proxy.ts`'s matcher,
  `lib/securityHeaders.ts`.
- Defect fixes: `tsup.scripts.config.ts`'s `onSuccess` rewrite of `next/*` specifiers;
  `scripts/core/restore/uploadsSwap.ts`'s staging-directory creation.
- Tests: `scripts/host/__tests__/install.test.ts` (help, unknown option, no terminal, dry run,
  schema-validated `.env` for app and worker, proxy rendering, fresh secrets, supplied key, file
  mode, key never changed on re-run, `.env` without a key refused, custody required, URL shapes,
  proxy and plain-HTTP refusals); `app/api/upload/__tests__/upload-routes.test.ts`;
  `hooks/__tests__/useFileUpload.test.ts`; `tests/applySecurityHeaders.test.ts` including the
  matcher exclusions; `scripts/core/restore/__tests__/restoreArchive.test.ts`'s empty-uploads case.
- CI: `.github/workflows/install.yml` (install on a clean runner, `/register` redirect, `.env` mode,
  re-run key hash, worker still up, a backup written); the ShellCheck step in `ci.yml`.
- Documents: `README.md`'s Self-hosting section; ARCHITECTURE.md sections 9, 12, 13 and 14;
  `docs/operations/INSTALL.md`; `docs/operations/UPGRADE.md`;
  `docs/architecture/operations/CLI-CONTRACT.md`; `CHANGELOG.md`;
  [ADR-0040](../architecture/adr/0040-deployment-agnostic-images.md).

## Verification

`pnpm lint` reports no errors (two pre-existing `max-lines` warnings in `features/templates`, which
this change does not touch). `pnpm typecheck` and `pnpm format:check` pass. ShellCheck 0.11.0 is
clean on `install.sh`, `_check-prereqs.sh`, `_wait-for-health.sh`, `upgrade.sh` and
`docker-entrypoint.sh`; it found `SC1007` in `upgrade.sh` as well, which was fixed. `pnpm test`
passes 2,404 tests in 268 files. The integration tests for the modules whose variable was renamed
pass, 38 in 4 files.

A real install was run on Docker 29.5.3: `--yes --no-pull --proxy --url https://localhost`, which
wrote `.env` at mode `0600`, started the six containers and reached a healthy app. Through Caddy
over HTTPS, a browser script registered the owner, completed the business step, enrolled TOTP with a
generated code, acknowledged the recovery codes and reached the dashboard. It then checked that the
served page carries no build-time address and that the policy allows only this origin; uploaded an
avatar through `/api/upload/avatar` and read it back byte for byte from `/api/storage/...` with an
immutable cache header; fetched it through the Next.js image optimizer; uploaded a 20 MB attachment,
which the proxy's ten-megabyte buffer would have truncated, and confirmed through `mc stat` that
20,971,520 bytes were stored; and confirmed the public storage route answers 404 for a
documents-bucket key.

Re-running the installer over that instance left `.env` byte-identical — compared as a SHA-256 of
the key line, never the key — and started the stack without pulling. `--help` exits 0 and an unknown
option exits 2. `--dry-run` with Docker removed from `PATH` printed every command, executed none
(verified with a stub `docker` on `PATH` that records any call) and wrote no `.env`.
`pnpm remit:backup` wrote an archive into the bind-mounted data directory and `pnpm remit:restore`
restored it, after which the instance answered 200 and still held its user. The worker stayed up
with no restarts on the rebuilt image.

Not verified: the interactive key acknowledgement, because this environment has no TTY — its
non-interactive counterpart is tested and the interactive branch was reviewed by reading. A publicly
issued ACME certificate was not obtained; Caddy was exercised against `https://localhost`, where it
uses its internal CA. `.github/workflows/install.yml` has never run on GitHub. The Playwright suite
was not run. macOS was not tested.

## Known gaps

- **The two images have never been published.** `ghcr.io/itslhuis/remit/app` and `.../worker` do not
  exist yet; the first push creates them private, so an operator's `docker compose pull` fails until
  they are made public, and the old `ghcr.io/itslhuis/remit` package still holds a worker image
  under the application's name.
- **The installer accepts no IPv6 literal** as the public URL, and no host with an uppercase letter,
  which it refuses rather than normalising.
- **`_wait-for-health.sh` waits a fixed five minutes**, which a slow first start on a small server
  can exceed; the remedy is to re-run the installer.
- **Upload and public-read bytes pass through the application**, as ADR-0040 records; a deployment
  pointing `MINIO_ENDPOINT` at a remote S3 service pays that bandwidth twice.
- **The anonymous storage route has no rate limit**, matching the bucket exposure it replaced.
- **Windows is supported only through Git Bash**, where the installer disables MSYS path conversion;
  the Compose deployment itself remains a Linux target.
- **A replaced avatar or logo can survive in a browser cache** under its old key, because stored
  files are served as immutable.
