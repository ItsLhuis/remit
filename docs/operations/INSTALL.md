# Remit Installation Runbook

This runbook takes a host with Docker on it to a Remit instance you are logged into. The installer
does the work; this page says what it asks, what it writes, what to do when a step fails, and how to
install without it.

Operating the instance afterwards — upgrading, backing up, restoring — has its own runbooks, linked
at the end.

## Requirements

- Docker Engine 24 or newer, with the Docker Compose v2 plugin (`docker compose`, not
  `docker-compose`).
- Git, to clone the repository.
- 5 GB of free disk.
- For automatic HTTPS: a DNS name whose record points at the host, and ports 80 and 443 reachable
  from the internet.

Remit runs five containers — the Next.js `app`, a `worker` for background jobs, PostgreSQL, Redis
and MinIO — and Caddy as a sixth when HTTPS is automatic. Only the app, or Caddy in front of it, is
reachable from outside the host.

## 1. Get the repository

```bash
git clone https://github.com/ItsLhuis/remit.git
cd remit
```

Read `scripts/host/install.sh` before you run it. The installer is distributed only this way, never
as a `curl | bash` one-liner: it needs the checkout's `docker-compose.yml` and
`deploy/caddy/Caddyfile`, and it generates the key that encrypts your data, which is reason enough
to see what it does first.

## 2. Run the installer

```bash
bash scripts/host/install.sh
```

Run it as your own user, not with `sudo`. That user needs access to Docker.

It asks at most three questions:

| Question                  | What it decides                                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Public URL                | The address every link Remit sends is built from. An origin only — `https://remit.example.com`, with no path and no trailing slash, and a port only if it is not 80/443. |
| Run Caddy for HTTPS?      | Whether this host terminates TLS. Yes needs an `https://` URL with no port, and binds ports 80 and 443.                                                                  |
| Email for the certificate | The ACME account Caddy obtains the certificate with, asked only when the answer above is yes.                                                                            |

Nothing else is asked. Business details, email, payments and the backup destination are set in the
browser once the instance runs, where they can also be changed later.

Then it shows `REMIT_ENCRYPTION_KEY` once and asks you to type its last six characters.

**That key encrypts the SMTP password, Stripe keys, bank details and client notes in the database,
and every backup archive. If it is lost, that data and every backup are permanently unreadable, and
nobody can recover them.** Store it in a password manager, or anywhere else off the host, before you
confirm. Nothing is written until you do.

The installer then writes `.env` with mode `0600`, pulls the images, starts the stack and waits up
to five minutes for the app to report healthy. The app applies database migrations as it starts.

With Caddy, the certificate is requested on first start, so the DNS record must already point at the
host.

## 3. Create the owner account

Open the public URL. The first visit lands on registration, because an instance with no user has no
one to log in as.

The setup wizard then runs in one pass and cannot be skipped:

1. **Account** — name, email and password.
2. **Business profile** — the name, address and tax identifiers that appear on your documents. This
   step also creates the instance's organization.
3. **Two-factor authentication** — scan the QR code with an authenticator app and confirm a code.
   TOTP is mandatory for every role and there is no opt-out.
4. **Recovery codes** — shown once. Save them somewhere other than the host running Remit; they are
   how you get back in if you lose the authenticator.

You land on the dashboard. The instance is running.

## 4. Back up the configuration and set up backups

Copy `.env` off the host now. It holds `REMIT_ENCRYPTION_KEY`, and no backup archive can be restored
without the key that encrypted it.

Then open `/settings/backup` and choose where backups go: the local data directory by default, or an
S3-compatible bucket such as Amazon S3, Cloudflare R2 or Backblaze B2. The worker takes a backup at
01:00 UTC on the cadence you choose, and the dashboard warns the owner when one has not succeeded
recently. To take one immediately:

```bash
docker compose exec app pnpm remit:backup
```

A backup you have never restored is a hope rather than a backup; the [restore runbook](RESTORE.md)
describes how to test one.

## 5. Configure what you actually use

None of this is required to issue an invoice, and each part is independent.

| To do this                                 | Go to                 |
| ------------------------------------------ | --------------------- |
| Send documents by email (SMTP or Resend)   | `/settings/email`     |
| Accept card payments, or show bank details | `/settings/payment`   |
| Set numbering, currency, tax and terms     | `/settings/invoicing` |
| Define your tax rates                      | `/settings/tax-rates` |
| Add an accountant or an assistant          | `/settings/team`      |
| Check dependencies and backup status       | `/settings/system`    |

`/settings/system` is the page to open when something looks wrong: it reports database connectivity,
migration state, email, storage and Stripe reachability, backup destination and last result, disk
usage, and the encryption key fingerprint.

## Unattended install

Every answer can be given as an option, for configuration management or a provisioning script:

```bash
bash scripts/host/install.sh --yes \
  --url https://remit.example.com \
  --proxy --acme-email ops@example.com \
  --accept-key-custody
```

| Option                 | Effect                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `--url URL`            | The public URL.                                                                     |
| `--proxy`              | Run Caddy for automatic HTTPS.                                                      |
| `--no-proxy`           | Publish the app port for a reverse proxy you already run. The default with `--yes`. |
| `--acme-email EMAIL`   | The certificate account email. Required with `--proxy`.                             |
| `--port PORT`          | The host port the app is published on. Default `3000`.                              |
| `--image-tag TAG`      | The tag of `remit/app` and `remit/worker` to run. Default `latest`.                 |
| `--allow-http`         | Accept an `http://` URL for a host other than localhost.                            |
| `--yes`                | Never prompt.                                                                       |
| `--accept-key-custody` | Required with `--yes`: records that you will back up `.env` yourself.               |
| `--env-only`           | Write `.env` and stop, without checking the host or starting anything.              |
| `--no-pull`            | Start from images already on the host.                                              |
| `--dry-run`            | Print every command the installer would run, and change nothing.                    |
| `--help`               | Print the usage, including what the script refuses to do.                           |

`--yes` never prints the generated key, which is why `--accept-key-custody` is required with it.

To install onto a new host with a key you already have — to restore a backup there — export it
first:

```bash
read -rs REMIT_INSTALL_ENCRYPTION_KEY && export REMIT_INSTALL_ENCRYPTION_KEY
bash scripts/host/install.sh
```

It is deliberately not an option, so it stays out of your shell history and process listings.

The installer exits `0` on success, `1` on a failure, and `2` on a usage error.

## Running it again

Re-running is safe, and it is the recovery path after a failed install. When `.env` exists and holds
`REMIT_ENCRYPTION_KEY`, the installer leaves the file exactly as it is and only starts the stack. It
does not pull newer images, so a re-run is never an upgrade; upgrade with `scripts/host/upgrade.sh`,
which takes a backup first. To change an answer, edit `.env` and run `docker compose up -d`.

It refuses, and changes nothing, in two cases:

- **`.env` exists without `REMIT_ENCRYPTION_KEY`.** Restore the key from your backup of `.env`. Only
  if the instance never held data, move `.env` aside and run the installer again.
- **`.env` is missing but the instance's Docker volumes exist.** The configuration was lost, not the
  data. Restore `.env` from your backup and run the installer again. Only if the data is disposable,
  run `docker compose down -v` first.

## When a step fails

| Failure                         | What to do                                                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Docker missing or older than 24 | Install Docker Engine from docs.docker.com, then run the installer again.                                         |
| Docker daemon not reachable     | Start Docker, or add your user to the `docker` group and log in again.                                            |
| Port already in use             | Stop what holds it, or choose another with `--port`. With Caddy, ports 80 and 443 must be free.                   |
| Less than 5 GB free             | Free disk space, or clone the repository onto a larger disk.                                                      |
| Image pull fails                | Check that the host can reach `ghcr.io`, then run the installer again.                                            |
| App does not become healthy     | The installer prints the last app log lines. `docker compose logs app worker` names the failing dependency.       |
| No certificate                  | Check the DNS record and that ports 80 and 443 are reachable from the internet, then `docker compose logs caddy`. |

After fixing the cause, run the installer again. It keeps `.env` and its key.

## Installing without the installer

The installer's steps can be done by hand.

1. Copy the example configuration and restrict it to your user:

   ```bash
   cp .env.example .env
   chmod 600 .env
   ```

2. Set `REMIT_PUBLIC_URL`, and generate the secrets:

   ```bash
   openssl rand -hex 32      # POSTGRES_PASSWORD, and again for MINIO_ROOT_PASSWORD and BETTER_AUTH_SECRET
   openssl rand -base64 32   # REMIT_ENCRYPTION_KEY
   ```

   Hex keeps the database password free of characters that would need escaping inside the connection
   URL Compose builds from it.

3. For automatic HTTPS, uncomment `COMPOSE_PROFILES=with-proxy`, and set `REMIT_ACME_EMAIL` and
   `REMIT_APP_BIND=127.0.0.1`.

4. Pull the images, let the app's user own the data directory, and start:

   ```bash
   docker compose pull
   docker compose run --rm --no-deps --user root --entrypoint chown app nextjs:nodejs /app/data
   docker compose up -d
   ```

   The `chown` is needed because Docker creates the bind-mounted data directory owned by root, and
   the app runs as an unprivileged user that writes backups into it.

5. Wait for `docker compose ps` to show the app as healthy, then continue from
   [step 3](#3-create-the-owner-account).

## Trying it out first

To see Remit with data in it before committing to a real instance:

```bash
docker compose exec app pnpm remit:seed-demo
```

This creates deterministic demo clients, projects, invoices, payments and expenses. Its inverse,
`pnpm remit:reset-data`, empties the domain data again while leaving your account, settings, tax
rates and templates intact.

## Where to go next

| Question                            | Runbook                                                       |
| ----------------------------------- | ------------------------------------------------------------- |
| How do I upgrade?                   | [UPGRADE.md](UPGRADE.md)                                      |
| How do I restore from a backup?     | [RESTORE.md](RESTORE.md)                                      |
| How do I scrape it with Prometheus? | [METRICS.md](METRICS.md)                                      |
| What exactly does a command do?     | [CLI-CONTRACT.md](../architecture/operations/CLI-CONTRACT.md) |
| What is inside a `.remitbak` file?  | [BACKUP-ARCHIVE.md](../architecture/specs/BACKUP-ARCHIVE.md)  |
| How is the system built?            | [ARCHITECTURE.md](../architecture/ARCHITECTURE.md)            |
