# Platform deployment guides

- **Status:** Shipped
- **Date:** 2026-09-17
- **Verdict:** Complete with known gaps
- **Decisions:** ADR-0005, ADR-0018, ADR-0019, ADR-0020, ADR-0022, ADR-0023, ADR-0040
- **Supersedes:** —

## What

`docs/deploy/` — five platform deployment guides and an index, each taking one target from nothing
to an instance with backups configured and a test invoice delivered, and each stating whether it was
executed end to end or written only from documentation.

## Why

The self-hosting surface ended at `docs/operations/INSTALL.md`, which covers one host with Docker
and the installer. Everything else an evaluator actually has — an existing Nginx, a Coolify box, a
home server behind a router, a Pi — was undocumented, and the architecture had named eight intended
targets without shipping any.

The word that decided how this was done is **tested**. A deployment guide nobody has followed is a
plausible-looking sequence of commands that fails at step four against a console screen renamed six
months ago, and it costs an evaluator their evening before they conclude the project is
unmaintained. Marking guides honestly is the deliverable as much as the guides are.

## Scope

Shipped, executed end to end: **Linux host with Docker Compose** and **behind an existing Nginx
reverse proxy**. Shipped, marked not tested, with what was verified and what was not stated at the
top: **Coolify and Dokploy**, **Cloudflare Tunnel**, **Raspberry Pi**.

Coolify and Dokploy are one guide rather than two. The deployment is identical — a Linux host
running Docker, with a web UI that pastes the Compose file in and injects a Traefik label set — and
only the screen names differ. Two files 90% identical would be two things to keep true.

**Railway and Render ship no guide**, and `docs/deploy/README.md` and `ARCHITECTURE.md` say why
rather than leaving them listed as planned. Both can run Remit; neither can run it from this
repository's Compose file, because neither lets two services share a persistent disk and `app` and
`worker` share the data directory the local backup destination writes into. Each would need managed
PostgreSQL, managed Redis, an S3-compatible bucket in place of MinIO and an S3 backup destination —
a different deployment model, four paid services, and nothing anybody here has run.

No application code, no Compose change, no migration and no dependency. The guides describe the
deployment models ADR-0019, ADR-0020, ADR-0023 and ADR-0040 already decided, so no ADR either.

## How

One section order, written down in `docs/deploy/README.md` and held by every guide: who it is for,
prerequisites, install, environment, TLS and the address, the worker, backups, upgrading, verify,
troubleshoot. It is the shape `UPGRADE.md` and `RESTORE.md` already use.

Four facts drive most of what differs per platform and are stated where they bite rather than once
in the index: where `REMIT_ENCRYPTION_KEY` lives on that platform and what recreating a service does
to it (ADR-0005), that `REMIT_PUBLIC_URL` must equal the browser's origin exactly because it is also
the only origin Better Auth trusts, that the worker is a second image whose absence stops every
scheduled and rendered thing silently (ADR-0022, ADR-0023), and that the production image's `Secure`
session cookies make plain HTTP unusable anywhere but `localhost`.

A fifth was found by running the verification rather than by reading code, and is now in the index
and in every guide's verification: a new instance has no document templates, and sending an invoice
without one renders no PDF and therefore sends no email, while still marking the invoice sent and
publishing a client link.

The Nginx guide's `X-Forwarded-For` line is `$remote_addr`, not the reflexive
`$proxy_add_x_forwarded_for`, and the config carries a comment saying why: `lib/utils/request.ts`'s
`getIpAddress` reads the first entry of the header, so the append form lets a caller choose the
address their failed logins are recorded under. Both forms were executed and the difference
observed.

## Evidence

- `docs/deploy/README.md` — the index, the shared shape, the marking convention, the five
  cross-platform facts, and the Railway/Render exclusion with its reason.
- `docs/deploy/linux-host.md`, `docs/deploy/nginx.md` — the two guides marked tested, each with the
  date, the engine versions and the substitutions named in its opening line.
- `docs/deploy/coolify-and-dokploy.md`, `docs/deploy/cloudflare-tunnel.md`,
  `docs/deploy/raspberry-pi.md` — the three marked not tested.
- `docs/architecture/ARCHITECTURE.md` section 14, "Deployment guides" — describes what exists and
  why two named targets do not.
- `README.md`, self-hosting section, and `docs/README.md`'s routing table — the two pointers in.
- `lib/utils/request.ts` `getIpAddress`, `deploy/caddy/Caddyfile` — the two sides of the forwarded
  address behaviour the Nginx guide documents.
- `features/invoices/pdfRenderJob.ts` — the `no template to render` path that returns without
  chaining to `invoice.email.send`, which is the template finding.
- `.github/workflows/docker.yml` — the `linux/amd64,linux/arm64` platform list the Raspberry Pi
  guide depends on.

## Verification

Both tested guides were followed from an empty clone of this repository on Docker Engine 29.5.3 with
Compose v5.1.4, with the text corrected mid-run where it was wrong.

The Linux host guide ran with the `with-proxy` profile at `https://remit.localhost`: installer,
HTTP-to-HTTPS redirect, `/api/health`, registration, business profile, TOTP enrolment from the
manual entry code, SMTP against a local mail catcher, an invoice template, a client, a project, an
invoice sent, and the delivered mail carrying `INV-0002.pdf` beginning `%PDF-`. Then `remit:backup`
and `remit:restore` in the app container, with both invoices still present afterwards. Idle memory
across the six containers measured 764 MiB, which is what the guide's 2 GB floor is based on.

The Nginx guide ran at `https://remit-nginx.localhost` with the app published on `127.0.0.1:3000`,
`nginx -t` passing on the block as written, the same registration-through-sent-invoice path, and the
forwarded-address check: a request carrying `X-Forwarded-For: 9.9.9.9` recorded the real peer with
`$remote_addr`, and recorded `9.9.9.9` after switching that one line to
`$proxy_add_x_forwarded_for`.

Not covered by either run: ACME certificate issuance. Neither host had a public DNS name, so Caddy
used its internal authority and Nginx a self-signed certificate. Both opening lines say so. The
Nginx run also proxied to `app:3000` on the Docker network rather than to `127.0.0.1:3000` from the
host.

`pnpm format:check`, `pnpm typecheck` and `pnpm lint` (0 errors, the two pre-existing `max-lines`
warnings) pass. `pnpm test` passes at 2414 tests across 269 files; one run under load failed
`scripts/core/destination/__tests__/destination.test.ts` and two subsequent runs passed it. All 168
relative links across the new and edited documents resolve.

## Known gaps

- Three of the five guides have never been executed. Coolify, Dokploy, Cloudflare and Raspberry Pi
  hardware were all unavailable, and each guide's opening line says what was verified instead.
- ACME issuance is untested in both tested guides, which is the step most likely to be where a real
  first install stops.
- `docker-compose.yml` mounts a named `uploads` volume into `app` and `worker` at `/app/uploads`
  that no code path reads or writes: `lib/storage/local.ts` resolves the uploads mirror to
  `$REMIT_DATA_DIR/uploads`, and runtime objects go to the object store. Found while working out
  what the app and the worker actually share; not changed here, because this delivery touches no
  Compose semantics.
- Sending a document with no template configured is silent: the invoice shows as sent, the client
  link works, and no mail was ever attempted. The guides document it; nothing in the product says it
  at the moment of sending.
- `/settings/system` reports its public-URL check as needing attention whenever the server cannot
  fetch its own public address, which includes any deployment whose certificate the container does
  not trust. The page says so itself, and no guide treats it as a failure.
- `scripts/core/destination/__tests__/destination.test.ts` failed once under load and passed on
  reruns. Not investigated.
