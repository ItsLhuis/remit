# Remit Installation Runbook

This runbook takes a machine with Docker on it to a Remit instance you are logged into. It documents
the Docker Compose path, which is how Remit is deployed today.

Everything here is done once, in order. Operating the instance afterwards — upgrading, backing up,
restoring — has its own runbooks, linked at the end.

## Requirements

- Docker Engine 24 or newer, with the Docker Compose v2 plugin (`docker compose`, not
  `docker-compose`).
- A machine reachable at the address you intend to serve Remit from.
- A reverse proxy terminating TLS in front of the app, if the instance is reachable from the
  internet. The production Compose file exposes the app for a proxy; it does not terminate TLS
  itself.

Remit runs five containers: the Next.js `app`, a `worker` for background jobs, PostgreSQL, Redis,
and MinIO for object storage.

## 1. Get the repository

```bash
git clone https://github.com/ItsLhuis/remit.git
cd remit
```

The published images are pulled from the registry, so no build step is required. The checkout is
what holds `docker-compose.yml`, your `.env`, and the host-side scripts.

## 2. Write the environment file

```bash
cp .env.example .env
```

Every variable is documented in `.env.example`. Four must be set before the first start, and two of
them are secrets you generate:

```bash
openssl rand -base64 32   # BETTER_AUTH_SECRET
openssl rand -base64 32   # REMIT_ENCRYPTION_KEY
```

| Variable               | Set it to                                                            |
| ---------------------- | -------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`   | The first generated value                                            |
| `REMIT_ENCRYPTION_KEY` | The second generated value                                           |
| `BETTER_AUTH_URL`      | The full public URL, no trailing slash — `https://remit.example.com` |
| `NEXT_PUBLIC_APP_URL`  | The same URL                                                         |

Also change `POSTGRES_PASSWORD`, `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD` away from their example
values before exposing the instance to a network.

**`REMIT_ENCRYPTION_KEY` protects your SMTP password, Stripe keys, bank IBAN and client notes at
rest, and it encrypts every backup archive.** Losing it means losing the ability to read those
columns and to restore any backup. Store a copy somewhere other than the server it runs on, before
you continue. Rotating it later is supported — see the encryption key rotation section of the
[operational CLI contract](../architecture/operations/CLI-CONTRACT.md) — but recovering a lost one
is not possible.

## 3. Start the instance

```bash
docker compose up -d
```

The app container applies pending database migrations through its entrypoint before the server
starts, so there is no separate migration step.

Watch it come up:

```bash
docker compose logs -f app
```

## 4. Confirm it is healthy

```bash
curl http://localhost:3000/api/health
```

A healthy instance answers `{"ok":true,"version":"…"}`. If it does not, the logs from the previous
step name the failing dependency — most first-run failures are a database password that does not
match between `POSTGRES_PASSWORD` and `DATABASE_URL`, or a `REMIT_ENCRYPTION_KEY` that is not 32
bytes of base64.

## 5. Create the owner account

Open the instance in a browser. The first visit lands on registration, because an instance with no
user has no one to log in as.

The setup wizard then runs in one pass and cannot be skipped:

1. **Account** — name, email and password.
2. **Business profile** — the name, address and tax identifiers that appear on your documents. This
   step also creates the instance's organization.
3. **Two-factor authentication** — scan the QR code with an authenticator app and confirm a code.
   TOTP is mandatory for every role and there is no opt-out.
4. **Recovery codes** — shown once. Save them somewhere other than the machine running Remit; they
   are how you get back in if you lose the authenticator.

You land on the dashboard. The instance is running.

## 6. Configure what you actually use

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

## 7. Take a backup before you rely on it

```bash
docker compose exec app pnpm remit:backup
```

This writes an encrypted `.remitbak` archive containing the database and your uploads. Confirm the
file exists and copy it off the machine. A backup you have never taken is not a backup, and the
[restore runbook](RESTORE.md) is written on the assumption that you have one.

Remote destinations — S3, Cloudflare R2, Backblaze B2 — are configured through the `backup_*`
columns of the `settings` row and used with `--destination`. Nothing schedules a backup for you; run
it from your own scheduler.

## Trying it out first

To see Remit with data in it before committing to a real instance:

```bash
docker compose exec app pnpm remit:seed-demo
```

This creates deterministic demo clients, projects, invoices, payments and expenses. Its inverse,
`pnpm remit:reset-data`, empties the domain data again while leaving your account, settings, tax
rates and templates intact.

## Where to go next

| Question                           | Runbook                                                       |
| ---------------------------------- | ------------------------------------------------------------- |
| How do I upgrade?                  | [UPGRADE.md](UPGRADE.md)                                      |
| How do I restore from a backup?    | [RESTORE.md](RESTORE.md)                                      |
| What exactly does a command do?    | [CLI-CONTRACT.md](../architecture/operations/CLI-CONTRACT.md) |
| What is inside a `.remitbak` file? | [BACKUP-ARCHIVE.md](../architecture/specs/BACKUP-ARCHIVE.md)  |
| How is the system built?           | [ARCHITECTURE.md](../architecture/ARCHITECTURE.md)            |
