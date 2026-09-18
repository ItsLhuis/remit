# Remit on a Raspberry Pi

**Not tested** — no Pi was used. Two facts that decide whether this deployment is possible at all
were verified rather than assumed, on 2026-09-17: both published images carry a `linux/arm64`
variant, and the arm64 worker image's Chromium executes and reports
`Chromium 149.0.7827.53 Alpine Linux`. The rest of the guide is the [Linux host](linux-host.md)
procedure, which was executed and verified on amd64 the same day. What nobody has measured is how a
Pi behaves under a real PDF render.

## Who this is for

A Raspberry Pi 4 or 5 running a 64-bit operating system, on a home or office network. It is a real
deployment for a one-person business: Remit's five containers idle at roughly 750 MB of memory
together, and the load of a freelancer's invoicing is not load.

The part to think about before starting is not the CPU. It is that PDF rendering starts a Chromium
process, and that the SD card most Pis boot from is the wrong place for a database.

## Before you start

- **A Raspberry Pi 4 or 5 with at least 4 GB of RAM.** 8 GB if you would rather not think about it.
  A 2 GB Pi runs the stack and will be tight the first time Chromium starts.
- **A 64-bit operating system.** Raspberry Pi OS (64-bit) or Ubuntu Server arm64. The published
  images have no 32-bit variant, so a 32-bit install cannot run Remit at all — `docker compose up`
  fails with an architecture mismatch rather than with anything helpful.

  ```bash
  uname -m   # aarch64 is what you need; armv7l is not
  ```

- **An SSD or a good USB disk**, not the SD card. PostgreSQL writes constantly, and SD cards fail
  under that in months. Boot from it if the Pi supports it; otherwise at least move Docker's data
  directory onto it.
- **Docker Engine 24 or newer** with the Compose plugin:

  ```bash
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
  ```

  Log out and back in afterwards.

- **A hostname and a way to reach it.** A Pi at home usually has no public address; the
  [Cloudflare Tunnel](cloudflare-tunnel.md) guide is the common answer, and the two combine.

## Install

Identical to the [Linux host](linux-host.md) guide, which is the authority for every step:

```bash
git clone https://github.com/ItsLhuis/remit.git
cd remit
bash scripts/host/install.sh --url https://remit.example.com --proxy --acme-email you@example.com
```

Use `--proxy` only if ports 80 and 443 on the Pi are reachable from the internet and DNS points at
it. Behind a home router that usually is not true, so use `--no-proxy` and put a tunnel in front.

Docker picks the `linux/arm64` image automatically. The first pull is slower than on a server — the
worker image carries Chromium — and the first boot is slower again, because the app applies
migrations before it listens. Five minutes is normal; the installer waits.

Copy `REMIT_ENCRYPTION_KEY` off the Pi before doing anything else. A Pi is the machine most likely
to be reimaged on a whim.

## Environment

Identical to the [Linux host](linux-host.md) guide. Nothing about the architecture appears in the
configuration: the images differ, the variables do not.

`REMIT_CHROMIUM_PATH` is set inside the worker image and is not something to configure here.

## TLS and the address

As on any other host: Caddy through the `with-proxy` profile if the Pi is publicly reachable, an
existing proxy ([Behind Nginx](nginx.md)), or a [Cloudflare Tunnel](cloudflare-tunnel.md).

What does not work is reaching it over plain HTTP at a LAN address such as
`http://192.168.1.50:3000`. The image runs in production mode, so session cookies carry `Secure` and
the browser discards them: you can register and then never stay signed in. Browsers make an
exception for `localhost` only, which does not help from another device on the network.

## The worker

The worker matters more here than anywhere else, because it is where Chromium runs. Everything else
Remit does on a Pi is light; rendering a PDF is the one moment the hardware is asked for something.

```bash
docker compose ps
docker compose logs worker
```

Without it: no recurring invoices, no reminders, no late fees, no PDFs, no exports, no webhook
deliveries and no scheduled backups.

If a render fails on a 2 GB Pi, the log shows Chromium dying rather than an application error.
Adding swap on the SSD — not on the SD card — is the usual fix, but more memory is the real one.

## Backups

The local destination is the one to avoid here: it puts the archive on the same disk as the
database, on the hardware most likely to fail.

1. `/settings/backup`, destination an S3-compatible bucket.
2. **Test destination**, which writes one small object and deletes it.
3. Choose a cadence, then run one now:

   ```bash
   docker compose exec app pnpm remit:backup
   ```

## Upgrading

```bash
bash scripts/host/upgrade.sh
```

Unchanged from [`UPGRADE.md`](../operations/UPGRADE.md), and slower: pulling the worker image again
takes a while on a home connection. The script waits for health for five minutes, which is enough
for a Pi that is only migrating.

## Verify

The same list as everywhere else, and step 5 is the one that is actually about the Pi.

1. The hostname answers, and `/api/health` returns `{"ok":true,...}`.
2. **Sign in**, then open a second tab and confirm you are still signed in.
3. **Configure email** at `/settings/email` and send its test message.
4. **Create a client**, then a project.
5. **Create an invoice** with one line item and send it. The mail must arrive with a PDF attached.
   That is the render finishing on arm64, which is the whole question this guide exists to answer.
   Watch `docker compose logs -f worker` while it happens.
6. **Configure backups** and run one.

## Troubleshooting

### `no matching manifest for linux/arm/v7`

The operating system is 32-bit. `uname -m` prints `armv7l`. Reinstall a 64-bit image; there is no
32-bit build of Remit.

### The worker dies while rendering

Memory. Chromium is the only part of Remit with an appetite, and a 2 GB Pi with the other four
containers running has little to give it. Add swap on the SSD, or use a larger Pi.

### Everything is slow after a few weeks

Usually the SD card. `dmesg` shows I/O errors before anything else does. Move the data onto an SSD
and restore from a backup.

### The instance is unreachable from other devices

Either nothing terminates TLS — see **TLS and the address** above — or the app is bound to loopback.
Check `REMIT_APP_BIND` in `.env`.
