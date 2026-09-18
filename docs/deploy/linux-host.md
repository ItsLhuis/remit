# Remit on a Linux host

**Tested** — 2026-09-17, on Docker Engine 29.5.3 with Compose v5.1.4, from an empty clone through
every step below: the installer with its Caddy profile, the owner account and TOTP enrolment, SMTP,
an invoice template, a client, a project, an invoice sent with its PDF attached, then a backup and a
restore. One substitution: the host had no public DNS name, so Caddy issued the certificate from its
own internal authority instead of from Let's Encrypt. ACME issuance is the single step this guide
does not cover from experience; everything on either side of it ran as written.

## Who this is for

One Linux machine that you have a shell on and that runs nothing else on ports 80, 443 or 3000: a
VPS at any provider, a virtual machine, or a box in a cupboard. Everything runs on it — the
application, the background worker, PostgreSQL, Redis, MinIO for stored files, and Caddy for HTTPS
if you want the host to handle certificates.

Use a different guide if the host already serves other sites through Nginx
([Behind Nginx](nginx.md)), if a panel manages Docker for you
([Coolify and Dokploy](coolify-and-dokploy.md)), or if the host has no public address at all
([Cloudflare Tunnel](cloudflare-tunnel.md)).

## Before you start

- **A host with at least 2 GB of RAM and 20 GB of disk.** Five containers run continuously, and the
  worker starts a Chromium process for every PDF it renders. A 1 GB host boots and then fails on the
  first invoice.
- **Docker Engine 24 or newer with the Compose v2 plugin.** `docker compose version` must work;
  `docker-compose` with a hyphen is the old tool and is not enough. Install from
  [docs.docker.com/engine/install](https://docs.docker.com/engine/install/).
- **Git**, to clone the repository. The installer is not distributed any other way.
- **A user that is not root and is in the `docker` group.** Remit never needs `sudo` after Docker is
  installed.
- **For HTTPS on this host:** a DNS `A` record (and `AAAA` if the host has IPv6) already pointing at
  it, and ports 80 and 443 reachable from the internet. Caddy requests the certificate on first
  start, so the record has to exist first.

## Install

### 1. Prepare the user

Skip this if you already log in as a non-root user with Docker access.

```bash
sudo adduser remit
sudo usermod -aG docker remit
su - remit
```

### 2. Open the ports you need

The installer never touches the firewall. With `ufw`, and HTTPS on this host:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

Without HTTPS on this host, open the app's port instead — `sudo ufw allow 3000/tcp` — and only if
something outside the host has to reach it directly.

### 3. Clone the repository

```bash
git clone https://github.com/ItsLhuis/remit.git
cd remit
```

Read `scripts/host/install.sh` before running it. It generates the key that encrypts your data, and
it is shipped through a clone rather than a `curl | bash` line so that reading it first is possible.

### 4. Run the installer

With HTTPS on this host:

```bash
bash scripts/host/install.sh --url https://remit.example.com --proxy --acme-email you@example.com
```

With a reverse proxy elsewhere, or a trusted LAN:

```bash
bash scripts/host/install.sh --url https://remit.example.com --no-proxy
```

It checks the host, asks nothing else, generates every secret, writes `.env` with mode `0600`, pulls
both images, starts the stack and waits for `/api/health`. It shows `REMIT_ENCRYPTION_KEY` once and
does not write anything until you type its last six characters back.

[`INSTALL.md`](../operations/INSTALL.md) has every option, the unattended form, what a re-run does,
and what to do when a step fails.

### 5. Copy the key off the host

```bash
cat .env
```

Store `REMIT_ENCRYPTION_KEY` in a password manager, or anywhere that is not this machine. It cannot
be recovered or reset. Without it the encrypted columns and every backup archive are permanently
unreadable ([ADR-0005](../architecture/adr/0005-encryption-at-rest.md)).

### 6. Create the owner account

Open the public URL. The first visit lands on registration, then a setup wizard that asks for your
business profile and enrols TOTP. Recovery codes are shown once; save them somewhere other than this
host.

## Environment

`.env` in the checkout is the whole configuration, and `docker compose` reads it from there. The
installer writes all of it; you normally edit only the first two rows below.

| Variable                                                           | Who sets it                                 |
| ------------------------------------------------------------------ | ------------------------------------------- |
| `REMIT_PUBLIC_URL`                                                 | you, at install                             |
| `REMIT_ACME_EMAIL`                                                 | you, when Caddy runs here                   |
| `REMIT_ENCRYPTION_KEY`, `BETTER_AUTH_SECRET`                       | generated once, never regenerate            |
| `POSTGRES_PASSWORD`, `MINIO_ROOT_PASSWORD`                         | generated once                              |
| `PORT`, `REMIT_APP_BIND`, `COMPOSE_PROFILES`, `REMIT_IMAGE_TAG`    | generated from your answers; safe to change |
| `REMIT_METRICS_TOKEN`, `REMIT_WEBHOOK_ALLOWED_HOSTS`, `SENTRY_DSN` | you, only if you use those features         |

[`.env.example`](../../.env.example) documents every variable with a safe placeholder and is the
reference for anything not listed here. Email, payments, tax and backup destination are **not**
environment variables — they are set in the browser under `/settings/**`, where they can be changed
later.

After editing `.env`, apply it with `docker compose up -d`.

## TLS and the address

`REMIT_PUBLIC_URL` must be exactly the origin a browser types — scheme, host, and a port only when
it is not the scheme's default, with no path and no trailing slash. It is both the base of every
link Remit emails and the only origin the authentication layer trusts, so a mismatch produces a page
that loads normally and a sign-in that fails with an origin error.

With `--proxy`, Caddy runs as a sixth container, obtains and renews a certificate for that host,
redirects HTTP to HTTPS, and is the only thing published on the network; the app's own port is
published on `127.0.0.1` only. Its configuration is
[`deploy/caddy/Caddyfile`](../../deploy/caddy/Caddyfile).

Without `--proxy`, the app is published directly on `PORT` and something else has to terminate TLS.
It must be something: the published image runs in production mode, so session cookies carry `Secure`
and a browser drops them over plain `http://`. Registration appears to work and then nothing stays
signed in. Browsers exempt `localhost`, which is why a laptop trial over HTTP works and a LAN
address does not.

## The worker

`worker` is a second container from a second image — the same application code plus Chromium. It
consumes the job queue in Redis.

```bash
docker compose ps
```

Both `app` and `worker` must be `running`. Without the worker, nothing appears broken and none of
this happens: recurring invoices are not generated, reminders and late fees are not applied, PDFs
are not rendered, data exports never finish, webhooks are not delivered, and scheduled backups do
not run.

## Backups

Do this before the instance holds anything you care about.

1. Open `/settings/backup`. The default destination is the local data directory; an S3-compatible
   bucket (Amazon S3, Cloudflare R2, Backblaze B2) is the safer choice, because a backup on the same
   disk as the database does not survive losing the disk.
2. For a remote destination, use **Test destination**. It writes one small object and deletes it,
   because a backup needs write access and a listing only proves read access.
3. Choose a cadence. The worker takes a backup at 01:00 UTC on that cadence, and the dashboard warns
   the owner when no backup has succeeded recently.
4. Take one now and confirm it exists:

   ```bash
   docker compose exec app pnpm remit:backup
   ```

A backup you have never restored is a hope rather than a backup.
[`RESTORE.md`](../operations/RESTORE.md) describes testing one.

## Upgrading

```bash
bash scripts/host/upgrade.sh
```

It takes a backup, pulls the images, restarts the project and waits for health; migrations run
inside the app container as it starts. Read the [`CHANGELOG.md`](../../CHANGELOG.md) entries between
your version and the new one first — `/settings/system` shows the version you are running. The full
procedure, the rollback path and its troubleshooting are in
[`UPGRADE.md`](../operations/UPGRADE.md).

Remit never checks for new releases and never updates itself.

## Verify

Do all of it. Sending an invoice is the only action that exercises the database, the queue, the
worker, Chromium, object storage and email in one go, which is why it is the check.

1. **Sign in** at the public URL, with the password and a TOTP code. Coming back signed in on a new
   tab is the part that proves cookies survive your TLS setup.
2. **Configure email** at `/settings/email` — SMTP or Resend — and use its test send. Nothing else
   in this list works without it.
3. **Create an invoice template** at `/templates` and mark it the default for invoices. A new
   instance ships with none, and an invoice with no template to render produces no PDF — and
   therefore no email at all, because the mail is what carries the PDF. The invoice still moves to
   `sent` and still gets a client link, so nothing on screen says the client heard nothing.
4. **Create a client** at `/clients`, with an email address you can read, then a **project** for
   that client. Invoices hang off a project.
5. **Create an invoice** on that project with one line item, and send it.
6. **Confirm the whole path**:
   - the invoice moved to `sent` and shows a client link;
   - the email arrived, with a PDF attached that opens;
   - `/settings/system` reports the database, storage and email checks green.

If no mail arrives at all, check `docker compose logs worker` for
`Invoice PDF skipped: no template to render` before looking anywhere else.

## Troubleshooting

### The installer stops at "waiting for health"

It prints the last app log lines. Almost always one of: the database volume is owned by root after a
manual `mkdir`, a migration failed, or `REMIT_ENCRYPTION_KEY` is not valid base64.
`docker compose logs app` has the reason.

### The certificate is never issued

`docker compose logs caddy`. Caddy needs the DNS record to resolve to this host and ports 80 and 443
reachable from the internet before it can complete the challenge. A cloud firewall in front of the
host is as effective at blocking it as `ufw` is.

### Sign-in bounces back to the login page

`REMIT_PUBLIC_URL` does not match the origin in the browser's address bar, or the instance is being
reached over plain HTTP outside `localhost`. Fix `.env` and `docker compose up -d`; check
`docker compose logs app` for an origin error naming both values.

### An invoice says "sent" but the client got nothing

There is no default invoice template. The render job stops with
`Invoice PDF skipped: no template to render` in `docker compose logs worker`, writes an audit entry,
and never chains to the email — so the invoice is marked sent, the client link works, and no mail
was ever attempted. Create a template at `/templates`, set it as the default for invoices, and send
again.

### Nothing scheduled ever happens

`docker compose logs worker`. If it cannot reach Redis it says so and retries forever. If the
container is not running at all, the queue fills and the application keeps accepting work.

### The disk fills

Backups in the local destination and rendered PDFs both grow. `/settings/system` reports disk usage,
and the retention counts on `/settings/backup` decide how many archives a run leaves behind.

## Where to go next

| Question                           | Runbook                                |
| ---------------------------------- | -------------------------------------- |
| What exactly does the installer do | [INSTALL.md](../operations/INSTALL.md) |
| How do I upgrade                   | [UPGRADE.md](../operations/UPGRADE.md) |
| How do I restore a backup          | [RESTORE.md](../operations/RESTORE.md) |
| How do I scrape metrics            | [METRICS.md](../operations/METRICS.md) |
