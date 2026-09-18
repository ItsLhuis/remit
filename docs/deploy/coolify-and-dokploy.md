# Remit on Coolify or Dokploy

**Not tested** — written against Coolify's and Dokploy's Docker Compose documentation as of
2026-09-17, and against Remit's own Compose file, which was deployed and verified on a plain Docker
host the same day. Nobody has executed this guide on either panel. What is certain is the Remit
half: the Compose file, the variables, and what each service needs. What is not is the panel half —
a screen may have been renamed, and the domain and environment editors move between releases.

One guide covers both because the deployment is the same one: a Linux host running Docker, with a
web UI that pastes your Compose file in, injects a Traefik or Caddy label set, and redeploys on a
push. Where the two differ is only which screen you are on, and that is said inline.

## Who this is for

You already run Coolify or Dokploy on a server and want Remit beside the other things it manages.
The panel owns the domain, the certificate and the redeploys; Remit owns everything inside its
Compose file.

If the panel is not already there, [Linux host](linux-host.md) is less machinery for one
application.

## Before you start

- **Coolify or Dokploy installed and reachable**, with a server attached and Docker healthy on it.
- **A DNS record for Remit's hostname pointing at that server.** The panel's proxy answers it.
- **At least 2 GB of RAM free on the host after the panel's own overhead.** Remit's five containers
  idle at roughly 750 MB together, and the worker starts a Chromium process per PDF.
- **Remit's `docker-compose.yml`**, from a clone or from the repository's web view. You will paste
  it in.

## Install

### 1. Create the resource

- **Coolify** — _Project → New Resource → Docker Compose_, then paste the file.
- **Dokploy** — _Create Service → Compose_, then paste the file or point it at the Git repository.

Paste `docker-compose.yml` unchanged. Do not paste `docker-compose.dev.yml`,
`docker-compose.test.yml` or `docker-compose.ci.yml`; those are development and CI assets and are
not deployments.

Both panels create the network themselves, so nothing in the file needs a `networks:` block added.

### 2. Leave Caddy out

Remit's `with-proxy` profile starts its own Caddy on ports 80 and 443. The panel already has a proxy
on those ports, and starting a second one breaks both.

Leave `COMPOSE_PROFILES` unset. The `caddy` service only runs when that profile is named, so an
unedited file leaves it out.

### 3. Set the environment

In the panel's environment editor for this resource:

| Variable                       | Value                                                                 |
| ------------------------------ | --------------------------------------------------------------------- |
| `REMIT_PUBLIC_URL`             | `https://remit.example.com` — the hostname the panel serves           |
| `REMIT_ENCRYPTION_KEY`         | `openssl rand -base64 32`, generated once, stored off the server      |
| `BETTER_AUTH_SECRET`           | `openssl rand -base64 32`                                             |
| `POSTGRES_USER`, `POSTGRES_DB` | `remit`, or anything you prefer                                       |
| `POSTGRES_PASSWORD`            | `openssl rand -hex 32` — hex, so the connection URL needs no escaping |
| `MINIO_ROOT_USER`              | `remit`                                                               |
| `MINIO_ROOT_PASSWORD`          | `openssl rand -hex 32`                                                |
| `REMIT_DATA_DIR`               | `./data`                                                              |
| `REMIT_IMAGE_TAG`              | `latest`, or a released version tag                                   |

[`.env.example`](../../.env.example) documents every variable, including the optional ones.

**The encryption key lives in the panel's environment editor and nowhere else.** Deleting the
resource deletes it, and no backup archive taken with it can ever be opened again
([ADR-0005](../architecture/adr/0005-encryption-at-rest.md)). Copy it into a password manager before
the first deploy.

### 4. Point the domain at the app

Both panels attach a domain to one service and one port.

- **Coolify** — on the resource's _Domains_, set the domain against the `app` service, port `3000`.
- **Dokploy** — _Domains_ tab, _Add Domain_, service `app`, container port `3000`, and enable the
  certificate.

Only `app` gets a domain. `database`, `redis`, `minio` and `worker` stay unreachable from outside;
browsers never talk to object storage, because the app streams every stored file itself
([ADR-0040](../architecture/adr/0040-deployment-agnostic-images.md)).

### 5. Deploy, then create the owner account

Deploy and watch the logs until `app` is healthy. It applies database migrations as it starts, so
the first boot takes longer than later ones. Then open the domain: the first visit lands on
registration, and the setup wizard enrols TOTP. [`INSTALL.md`](../operations/INSTALL.md) covers that
part.

## Environment

As above. Two variables in `.env.example` are deliberately absent here: `PORT` and `REMIT_APP_BIND`
are for publishing the app on a host interface, and the panel's proxy reaches the container over the
Docker network instead.

## TLS and the address

The panel's proxy terminates TLS and renews the certificate. Remit is spoken to over plain HTTP
inside the Docker network, which is fine — what matters is that the browser is on HTTPS, because the
production image marks session cookies `Secure`.

`REMIT_PUBLIC_URL` must be the same origin the panel serves, exactly. It is the base of every
emailed link and the only origin Remit's authentication layer trusts, so a mismatch gives you pages
that load and sign-ins that fail.

After the first deploy, check what address ends up in the audit trail: sign out, fail one sign-in on
purpose, and look at whether the entry shows your address or the proxy's. Both panels use Traefik,
which sets `X-Forwarded-For` correctly by default, but a hand-edited label set can undo that.

## The worker

`worker` is in the Compose file and the panel starts it with everything else. Confirm it is running
after each deploy. Without it: no recurring invoices, no reminders, no late fees, no PDFs, no data
exports, no webhook deliveries and no scheduled backups — and nothing in the interface says so.

Do not scale `app` to more than one replica. Each app container applies migrations on start, and the
Compose file's ordering — the worker waits for the app to be healthy — is what keeps two of them
from migrating at once.

## Backups

Configure this before the instance holds anything real.

Open `/settings/backup` and choose a destination. On a panel-managed host, prefer an S3-compatible
bucket over the local directory: the local one lives in a Docker volume on the same server, and the
whole point of the panel is that the server is disposable.

Then run one by hand. Both panels have a terminal or exec for a running container:

```bash
pnpm remit:backup
```

## Upgrading

The panel redeploys; `scripts/host/upgrade.sh` does not apply here, because it drives Docker Compose
on the host and the panel owns that.

**That script's first step is a backup, and the panel's redeploy has no equivalent.** So:

1. Read [`CHANGELOG.md`](../../CHANGELOG.md) from your version forward. Each release names the
   migrations it applies on start.
2. Take a backup and confirm it completed.
3. Redeploy from the panel, with `REMIT_IMAGE_TAG` set to the version you want.
4. Watch the logs: migrations run in the app's entrypoint before it serves.

[`UPGRADE.md`](../operations/UPGRADE.md) has the rollback path; the image tag is how you pin a
previous version.

## Verify

1. The domain answers, and `/api/health` returns `{"ok":true,...}`.
2. **Sign in**, then open a second tab and confirm you are still signed in.
3. **Configure email** at `/settings/email` and send its test message.
4. **Create a client**, then a project.
5. **Create an invoice** with one line item and send it. The mail must arrive with a PDF attached —
   that is the proof the worker and its Chromium are alive.
6. **Configure backups** and run one.

## Troubleshooting

### The deploy succeeds and the domain 502s

The domain is attached to the wrong service or port. It belongs on `app`, port `3000`. Also check
`app` is healthy rather than merely running: it migrates before it listens.

### Ports 80 or 443 are already allocated

`COMPOSE_PROFILES` includes `with-proxy`, so Remit started its own Caddy against the panel's proxy.
Remove it and redeploy.

### Sign-in fails while pages load

`REMIT_PUBLIC_URL` is not the origin in the address bar. Fix it in the environment editor and
redeploy.

### An upgrade left the instance unreadable

The resource was recreated and `REMIT_ENCRYPTION_KEY` was regenerated. Restore the old key into the
environment editor. If it is gone, the encrypted columns and every archive taken with it are gone
too; there is no recovery path.

### Data disappeared after a redeploy

The panel recreated volumes rather than reusing them. Both panels keep named volumes across a
redeploy of the same resource, but not across deleting and recreating one. Restore from a backup.
