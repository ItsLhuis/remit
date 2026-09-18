# Remit behind an Nginx reverse proxy

**Tested** — 2026-09-17, on Docker Engine 29.5.3 with Compose v5.1.4 and Nginx 1.31.6, from an empty
clone through every step below, including `nginx -t` on the block given here and the
forwarded-address check at the end. Two substitutions: the certificate was self-signed rather than
issued by Let's Encrypt, and Nginx ran in a container on the app's Docker network with
`proxy_pass http://app:3000` rather than on the host with `proxy_pass http://127.0.0.1:3000`.
Certbot itself is therefore the one step not covered from experience.

## Who this is for

A Linux host that already runs Nginx, usually because it already serves other sites. Nginx
terminates TLS and forwards to Remit, which runs in Docker on the same machine and publishes one
port. Remit adds no Nginx module, no rewrite rules and no sub-path support: it is served at the root
of a hostname.

If nothing fronts the host yet, [Linux host](linux-host.md) is simpler — Remit ships a Caddy profile
that obtains certificates on its own. Come here when Nginx is already the thing holding the
certificates.

Remit is not designed to be served under a path such as `example.com/remit`. Give it a hostname.

## Before you start

- Everything in the [Linux host](linux-host.md) guide's prerequisites, except the Caddy parts.
- **Nginx** already installed and serving, with a working way to obtain certificates — usually
  `certbot --nginx`.
- **A hostname** with a DNS record pointing at this host, and a certificate for it.
- **Ports 80 and 443 belong to Nginx.** Remit's own port is published on loopback only and is never
  reached from outside.

## Install

### 1. Install Remit without its proxy

```bash
git clone https://github.com/ItsLhuis/remit.git
cd remit
bash scripts/host/install.sh --url https://remit.example.com --no-proxy --port 3000
```

`--no-proxy` leaves Caddy out. Everything else is the same as the [Linux host](linux-host.md) guide,
including copying `REMIT_ENCRYPTION_KEY` off the machine before going further.

### 2. Bind Remit to loopback

Nginx reaches Remit over the host's loopback interface, so nothing else should. In `.env`:

```bash
REMIT_APP_BIND=127.0.0.1
PORT=3000
```

Apply it:

```bash
docker compose up -d
```

Confirm it is not reachable from outside — from another machine,
`curl http://<host-ip>:3000/api/health` must fail to connect.

### 3. Write the server block

Save this as `/etc/nginx/sites-available/remit.conf` and symlink it into `sites-enabled`, or put it
under `/etc/nginx/conf.d/remit.conf` on distributions that use that layout. Replace
`remit.example.com` and the two certificate paths.

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name remit.example.com;

    return 308 https://$host$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name remit.example.com;

    ssl_certificate     /etc/letsencrypt/live/remit.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/remit.example.com/privkey.pem;

    # Attachments are accepted up to 25 MB each; the upload route streams the body rather than
    # buffering it, so this only has to be larger than the largest file an owner will attach.
    client_max_body_size 30m;

    location / {
        proxy_pass http://127.0.0.1:3000;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;

        # $remote_addr, deliberately, and never $proxy_add_x_forwarded_for. Remit reads the first
        # entry of X-Forwarded-For as the client address, for audit entries and per-IP rate limits.
        # The append form keeps whatever the caller sent in front of the real address, so anyone
        # could choose the IP their failed logins are recorded under. Replacing the header is what
        # makes it trustworthy, and is what Remit's own Caddy profile does.
        proxy_set_header X-Forwarded-For   $remote_addr;

        # Streamed responses: stored files, attachments and export archives leave the app as a
        # stream, and buffering them through Nginx delays the first byte for no gain.
        proxy_buffering off;
    }
}
```

Check and reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Certbot writes the certificate paths above for you if you run
`sudo certbot --nginx -d remit.example.com` after the `server_name` line exists.

### 4. Create the owner account

Open `https://remit.example.com`. The rest of first-run setup is the same as every other deployment,
and [`INSTALL.md`](../operations/INSTALL.md) covers it.

## Environment

Identical to the [Linux host](linux-host.md) guide, with two differences:

| Variable           | Value here                                                      |
| ------------------ | --------------------------------------------------------------- |
| `REMIT_PUBLIC_URL` | The `https://` hostname Nginx serves — never `http://127.0.0.1` |
| `REMIT_APP_BIND`   | `127.0.0.1`                                                     |
| `COMPOSE_PROFILES` | unset; Caddy must not run                                       |

`REMIT_ACME_EMAIL` is unused here: certificates are Nginx's problem.

## TLS and the address

Nginx terminates TLS. Remit itself is spoken to over plain HTTP on loopback and never learns the
scheme — it does not read `X-Forwarded-Proto` to decide anything, and it does not need to. What it
does need is `REMIT_PUBLIC_URL` set to the `https://` origin, because that value is both the base of
every emailed link and the only origin its authentication layer trusts. Point it at `127.0.0.1:3000`
and every sign-in from the browser fails with an origin error while the pages themselves load.

`X-Forwarded-Proto` is still set above because it costs nothing and is what any future middleware
would read.

## The worker

Unchanged: `worker` is a second container from a second image, and Nginx has nothing to do with it —
it takes work from Redis rather than from HTTP. Confirm with `docker compose ps` that it is running.
Without it: no recurring invoices, no reminders, no late fees, no PDFs, no exports, no webhook
deliveries and no scheduled backups.

## Backups

Unchanged from the [Linux host](linux-host.md) guide. Configure a destination at `/settings/backup`,
test it, and run one before the instance holds anything real:

```bash
docker compose exec app pnpm remit:backup
```

## Upgrading

`bash scripts/host/upgrade.sh`, exactly as in [`UPGRADE.md`](../operations/UPGRADE.md). Nginx is not
involved and does not need reloading: the container keeps the same published port.

## Verify

1. `curl -I https://remit.example.com/api/health` returns `200` with a JSON body, and the plain HTTP
   address redirects to it.
2. **Sign in**, then open a second tab. Staying signed in is what proves the cookie survived the
   proxy.
3. **Configure email** at `/settings/email` and send its test message.
4. **Create an invoice template** at `/templates` and mark it the default for invoices. Without one
   the render is skipped and no email is sent at all, while the invoice still shows as sent — see
   the [Linux host](linux-host.md) guide's troubleshooting for what that looks like in the log.
5. **Create a client**, then a project for it.
6. **Create an invoice** with one line item and send it. The email must arrive with a PDF attached.
7. **Check the address that was recorded.** Sign out, fail one sign-in on purpose with a wrong
   password, and confirm `/settings/system` and the audit trail record your real address rather than
   `127.0.0.1` or something a caller chose. A proxy that forwards the wrong thing here is invisible
   until the day an audit record matters.

## Troubleshooting

### 502 Bad Gateway

Nginx cannot reach the app. `docker compose ps` — the app may still be starting, since it migrates
before it listens. If it is healthy, `REMIT_APP_BIND` is probably still `0.0.0.0` on a different
interface, or SELinux is blocking the loopback connection
(`sudo setsebool -P httpd_can_network_connect 1` on RHEL-family systems).

### Sign-in fails, pages load

`REMIT_PUBLIC_URL` does not match the browser's address bar. It must be the public `https://`
origin, not the loopback address Nginx forwards to.

### 413 Request Entity Too Large on upload

`client_max_body_size` is smaller than the file. It defaults to 1 MB, which is below every limit
Remit itself enforces.

### Every audit entry shows the same address

`X-Forwarded-For` is not being set, or is being set with `$proxy_add_x_forwarded_for` while
something upstream also sends the header. Use `$remote_addr` as above.

### A PDF opens as a download instead of in the browser

That is Remit, not Nginx: stored files are served with a content type and a `nosniff` header, and
the browser decides. Nothing in the proxy needs changing.
