# Deployment guides

Platform-specific ways to run Remit. Each guide takes one target from nothing to an instance you are
logged into, with backups configured and an invoice sent.

These are not a substitute for the runbooks. [`INSTALL.md`](../operations/INSTALL.md) owns what the
installer asks and writes, [`UPGRADE.md`](../operations/UPGRADE.md) owns upgrading, and
[`RESTORE.md`](../operations/RESTORE.md) owns restoring. A guide here says what is different about
one platform and links to those rather than restating them.

## How Remit runs

Remit is published as two images on GitHub Container Registry, built from one `Dockerfile` by
`.github/workflows/docker.yml`: `ghcr.io/itslhuis/remit/app`, the Next.js server, and
`ghcr.io/itslhuis/remit/worker`, the job consumer, which adds Chromium for PDF rendering. Both are
published for `linux/amd64` and `linux/arm64`. Neither image carries anything about a deployment:
the `Dockerfile` takes no build argument, no address, no secret and no `NEXT_PUBLIC_*` value, so the
image a release names runs at any address.

`docker-compose.yml` runs the two beside PostgreSQL 16, Redis 8 and a bundled S3-compatible object
store, RustFS, which is pinned to an exact release and image digest. Only `app` publishes a port;
the database, Redis and object storage are reachable inside the Compose network alone, and browsers
never talk to object storage: the app serves the files. `app` and `worker` mount the same
`REMIT_DATA_DIR`, and `worker` starts only once `app` reports healthy, which keeps the two from
migrating at the same time. There are two profiles:

- **Default** publishes the app on `PORT` at the interface `REMIT_APP_BIND` names (`0.0.0.0` unless
  set), for a reverse proxy you already run (Nginx, Caddy, Traefik, Cloudflare Tunnel) or a trusted
  LAN.
- **`with-proxy`** adds Caddy, which obtains and renews a certificate for `REMIT_PUBLIC_URL`,
  redirects HTTP to HTTPS and proxies to the app (`deploy/caddy/Caddyfile`). The app's port is
  published on loopback only when `REMIT_APP_BIND=127.0.0.1`, which `scripts/host/install.sh` writes
  when you choose this profile. `COMPOSE_PROFILES=with-proxy` in `.env` keeps the profile on for
  every later `docker compose` command, `scripts/host/upgrade.sh`'s included.

Uploaded files go through one adapter, `lib/storage`, configured by `S3_ENDPOINT`, `S3_REGION`,
`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET` and `S3_FORCE_PATH_STYLE`
(`lib/config/envSchema.ts`). The bundled store starts with the same key pair the app and worker sign
with. Pointed at Amazon S3, Cloudflare R2 or Backblaze B2 instead, the same variables keep the files
there, in three buckets derived from `S3_BUCKET`: `<S3_BUCKET>`, `<S3_BUCKET>-documents` and
`<S3_BUCKET>-exports` (`lib/storage/bucketNames.ts`). Remit creates a missing bucket, and leaves one
alone that answers a head request with `403`, so you can create the three in advance for a key that
cannot create buckets (`lib/storage/objectStore.ts`).

## Which guide is for me

| You have                                                   | Guide                                         |
| ---------------------------------------------------------- | --------------------------------------------- |
| A Linux server with Docker, and nothing in front of it yet | [Linux host](linux-host.md)                   |
| A Linux server already serving other sites through Nginx   | [Behind Nginx](nginx.md)                      |
| Coolify or Dokploy managing a Docker host for you          | [Coolify and Dokploy](coolify-and-dokploy.md) |
| A home server with no public IP, and a Cloudflare domain   | [Cloudflare Tunnel](cloudflare-tunnel.md)     |
| A Raspberry Pi or another arm64 server                     | [Linux host](linux-host.md#arm64-hosts)       |

Both published images are `linux/amd64` and `linux/arm64` (`.github/workflows/docker.yml`), so an
arm64 server follows the same guides; the [arm64 hosts](linux-host.md#arm64-hosts) section covers
what differs.

## What "tested" means here

Every guide opens with one of two lines, and they mean exactly what they say:

- **Tested** — someone followed this document from a clean state, every step in the order written,
  and completed its verification section. The line names the date and the host, because a guide ages
  against the platform it describes, and the commit the run used, or says that it is not recorded. A
  step edited after the run is named in the line as not re-executed.
- **Not tested** — the guide was written from the platform's own documentation and from Remit's
  Compose file, but nobody has executed it end to end. The line names what was checked and what was
  not, and the guide is still correct about Remit; what it cannot promise is that a console screen
  still has the name it had when this was written.

No automation executes any guide in this directory; the labels record manual runs. A guide never
claims more than that. A deployment guide that fails at step four costs an evaluator their evening,
and the honest label is what keeps this directory worth reading.

## The shape every guide follows

Each guide has these sections, in this order. If one does not apply to a platform, the guide says so
rather than dropping the heading.

1. **Who this is for** — the deployment shape the guide assumes, and when to use a different one.
2. **Before you start** — accounts, tools, DNS, disk, the version of anything that matters.
3. **Install** — numbered, every command copy-pasteable, every placeholder obviously a placeholder.
4. **Environment** — which variables the platform sets, which you supply, which are generated.
5. **TLS and the address** — what terminates TLS, and how the app learns the address it is reached
   at.
6. **The worker** — where the background job process runs, or what stops working without it.
7. **Backups** — configure a destination and confirm a run, before the guide ends.
8. **Upgrading** — the path for this platform.
9. **Verify** — log in, create a client, send an invoice.
10. **Troubleshooting** — the failures this platform actually produces.

## Five things every deployment gets wrong

These are true on every platform, so each guide repeats them where they bite rather than pointing
here.

**`REMIT_ENCRYPTION_KEY` is not recoverable.** It encrypts the SMTP password, the Stripe keys, the
bank details, the client notes, and every backup archive. Nobody can reconstruct it — not you, not a
support channel, not the database. Store it off the host before the instance holds anything. Where
it lives differs per platform, and recreating a service is the usual way it is lost.

**`REMIT_PUBLIC_URL` must be exactly the origin a browser uses.** Every link Remit emails is built
from it, and it is also the only origin Better Auth trusts: reach the instance at a different
scheme, host or port and every sign-in fails with an origin error, while the page itself loads fine.
It is an origin and nothing else — no path, no trailing slash, and a port only when it is not the
scheme's default.

**The worker is a second process, not a second copy of the app.** It is a separate image with
Chromium in it. Without it running, nothing stops visibly: recurring invoices are never generated,
reminders and late fees are never applied, PDFs are never rendered, data exports never finish,
webhooks are never delivered and scheduled backups never run. A deployment without a worker is a
deployment that quietly does half the job.

**Plain HTTP breaks sign-in everywhere except localhost.** The published image runs with
`NODE_ENV=production`, so session cookies carry the `Secure` attribute and a browser discards them
over `http://`. You can register and then never stay signed in. Browsers make an exception for
`localhost`, which is why a local trial works and a LAN address does not. Terminate TLS somewhere.

**A new instance sends with built-in layouts, and sending needs email configured.** A document with
no template of its own and no default for its type renders with a built-in layout
(`features/templates/documentLayout.ts`), so a new instance renders the invoice PDF and mails it
attached to a plain-text message with Remit's own wording (`features/invoices/emailJob.ts`). The
mail goes out only once an email provider is configured at `/settings/email`
(`features/email/documentEmail.ts`). Create templates at `/templates` only to change that look. This
is true of every new instance, and it is why every guide's verification sends an invoice.

## Platforms without a guide

Remit was published as two images so it could run anywhere, and it does. Two commonly requested
targets still have no guide here, deliberately.

**Railway and Render.** Both can run Remit, and neither can run it from the Compose file in this
repository. Neither platform lets two services share a persistent disk, so `app` and `worker` cannot
share the data directory the local backup destination writes into; both would need managed
PostgreSQL, managed Redis, an S3-compatible bucket in place of the bundled store, and an S3 backup
destination rather than the local one. That is a different deployment model, not a different set of
buttons, and it has four paid managed services in it. Writing that from documentation, untested, is
exactly the guide that fails at step four. If you run Remit on either and it works, the
configuration is worth contributing.

Nothing about that is a limitation in the platforms; it is a consequence of Remit shipping a Compose
file whose two application services share a volume.
