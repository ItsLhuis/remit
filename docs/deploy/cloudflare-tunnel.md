# Remit behind a Cloudflare Tunnel

**Not tested** — written against Cloudflare's own tunnel documentation as of 2026-09-17 and against
Remit's Compose file, which was deployed and verified on a plain Docker host the same day. Nobody
has run this guide against a real Cloudflare account. The Remit half is certain; the Cloudflare half
is from documentation, and the dashboard's wording moves. The one step to be sceptical of is the
recorded client address in the verification section — check it rather than assume it.

## Who this is for

A machine with no usable inbound address: a home server behind a router you do not control, a
carrier-grade NAT connection, an office network where opening a port is not an option. `cloudflared`
makes an outbound connection to Cloudflare, and Cloudflare answers your hostname on the public
internet.

It is also the deployment with the widest exposure decision in it. Every request, including the
public invoice, proposal and contract links your clients open, passes through Cloudflare. That is
compatible with Remit's position on data ownership only if you decide it is; Remit itself sends
nothing anywhere ([ADR-0018](../architecture/adr/0018-no-telemetry.md)), and this is a deployment
choice on top of that, not a product one.

If the host has a public address, [Linux host](linux-host.md) is simpler and keeps the traffic
between your client and your server.

## Before you start

- **A Cloudflare account with a zone** — a domain whose nameservers are Cloudflare's.
- **Docker Engine 24 or newer** with the Compose plugin, on the machine that will run Remit.
- **No inbound ports.** Ports 80 and 443 stay closed; that is the point.
- Everything else from the [Linux host](linux-host.md) prerequisites.

## Install

### 1. Install Remit without its proxy

```bash
git clone https://github.com/ItsLhuis/remit.git
cd remit
bash scripts/host/install.sh --url https://remit.example.com --no-proxy
```

`--no-proxy` leaves Caddy out. Caddy would try to obtain a certificate over ports 80 and 443, which
is exactly what this deployment does not have — Cloudflare holds the certificate instead.

Copy `REMIT_ENCRYPTION_KEY` out of `.env` and off the machine before going further.

### 2. Create the tunnel

In the Cloudflare dashboard, go to **Networking → Tunnels**, create a tunnel, choose the Docker
connector, and copy the token it shows. The token is a credential: treat it the way you treat the
encryption key.

### 3. Run the connector beside Remit

Save this as `docker-compose.tunnel.yml` in the checkout:

```yaml
services:
  cloudflared:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command: tunnel --no-autoupdate run
    environment:
      TUNNEL_TOKEN: ${TUNNEL_TOKEN}
    depends_on:
      app:
        condition: service_healthy
```

Add `TUNNEL_TOKEN=<the token>` to `.env`, then start both files together:

```bash
docker compose -f docker-compose.yml -f docker-compose.tunnel.yml up -d
```

Every later `docker compose` command in this deployment needs both `-f` flags, including the ones in
[`UPGRADE.md`](../operations/UPGRADE.md). `scripts/host/upgrade.sh` does not pass them, so it
upgrades Remit and leaves the connector alone — which is harmless, because the connector is a
separate image on its own release cycle.

### 4. Route the hostname to the app

Back in the tunnel's **Routes** tab, add a route:

- **Domain / subdomain** — `remit.example.com`, matching `REMIT_PUBLIC_URL` exactly.
- **Service** — `HTTP`, `app:3000`.

`app:3000` is the container name and its internal port. `localhost:3000` does not work: the
connector is its own container, and its localhost is not the app's.

Nothing else gets a route. `database`, `redis`, `minio` and `worker` have none, and browsers never
reach object storage anyway — the app streams every stored file itself
([ADR-0040](../architecture/adr/0040-deployment-agnostic-images.md)).

### 5. Create the owner account

Open the hostname. Registration, the business profile and TOTP enrolment are the same everywhere;
[`INSTALL.md`](../operations/INSTALL.md) covers them.

## Environment

The [Linux host](linux-host.md) table, plus `TUNNEL_TOKEN`, and with `PORT` and `REMIT_APP_BIND`
irrelevant — the connector reaches the app over the Docker network rather than through a published
port. You may set `REMIT_APP_BIND=127.0.0.1` so the app is not also reachable on the LAN; nothing in
this deployment needs it to be.

`REMIT_ENCRYPTION_KEY` lives in `.env` on this machine. A home server's disk is the least backed-up
disk most people own, which makes copying that key off it more urgent here, not less.

## TLS and the address

Cloudflare terminates TLS at its edge and presents its certificate for your hostname. The connector
speaks plain HTTP to the app inside the Docker network. The browser is on HTTPS, which is what
matters: the production image marks session cookies `Secure`, and a browser on `http://` discards
them.

`REMIT_PUBLIC_URL` must be the `https://` hostname the route serves. It is the base of every emailed
link and the only origin Remit's authentication layer trusts.

Do not enable Cloudflare's _Always Use HTTPS_ alongside a tunnel expecting it to change anything for
Remit, and do not put a Page Rule or Transform Rule in front of it that rewrites the `Host` header.
Remit is served at the root of a hostname and does not support a path prefix.

## The worker

Unchanged, and unrelated to the tunnel: `worker` takes its work from Redis, not from HTTP, so it
needs no route and no inbound anything. Without it: no recurring invoices, no reminders, no late
fees, no PDFs, no exports, no webhook deliveries and no scheduled backups.

## Backups

A home server is the deployment where this matters most, and the local destination is the one that
helps least — it is on the same disk as the database.

1. `/settings/backup`, destination an S3-compatible bucket (Cloudflare R2 is one, and is already in
   the account you just used).
2. **Test destination** — it writes one small object and deletes it.
3. Choose a cadence, then run one now:

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.tunnel.yml exec app pnpm remit:backup
   ```

## Upgrading

```bash
bash scripts/host/upgrade.sh
```

It backs up, pulls, restarts and waits for health. It operates on `docker-compose.yml` only, so the
connector keeps running on its old image; update that separately with
`docker compose -f docker-compose.yml -f docker-compose.tunnel.yml pull cloudflared`.

## Verify

1. The hostname answers from a network that is not yours — a phone on mobile data is the honest
   test, since anything on your LAN might be reaching the app directly.
2. `https://remit.example.com/api/health` returns `{"ok":true,...}`.
3. **Sign in**, then open a second tab and confirm you are still signed in.
4. **Configure email** at `/settings/email` and send its test message.
5. **Create a client**, then a project.
6. **Create an invoice** with one line item and send it. The mail must arrive with a PDF attached.
7. **Check the recorded address.** Sign out, fail one sign-in on purpose, and look at whether the
   audit entry shows the real client address or the connector's. Remit reads the first entry of
   `X-Forwarded-For`; if that turns out to be the tunnel rather than the caller, every audit entry
   and every per-IP rate limit on this instance is keyed on one address, and you should know that
   before you need it rather than after.

## Troubleshooting

### The hostname returns error 1033

The connector is not connected. `docker compose logs cloudflared` — usually a bad or revoked token,
or no outbound connectivity on the machine.

### Error 502 through the tunnel

The route points somewhere the connector cannot reach. It must be `http://app:3000`, not
`localhost:3000`, and the connector has to be on the same Compose project as the app.

### Sign-in fails while pages load

`REMIT_PUBLIC_URL` does not match the hostname in the address bar.

### Uploads over a few megabytes fail

Cloudflare caps request body size per plan, and the cap on the free plan is below what Remit accepts
for attachments. Check the current limit for your plan; the failure appears as a Cloudflare error
page rather than as anything from Remit.

### It works at home and nowhere else

You are reaching the published app port on your LAN rather than the tunnel. Set
`REMIT_APP_BIND=127.0.0.1`, `docker compose up -d`, and test again from outside.
