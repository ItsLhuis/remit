# Deployment guides

Platform-specific ways to run Remit. Each guide takes one target from nothing to an instance you are
logged into, with backups configured and an invoice sent.

These are not a substitute for the runbooks. [`INSTALL.md`](../operations/INSTALL.md) owns what the
installer asks and writes, [`UPGRADE.md`](../operations/UPGRADE.md) owns upgrading, and
[`RESTORE.md`](../operations/RESTORE.md) owns restoring. A guide here says what is different about
one platform and links to those rather than restating them.

## Which guide is for me

| You have                                                   | Guide                                         |
| ---------------------------------------------------------- | --------------------------------------------- |
| A Linux server with Docker, and nothing in front of it yet | [Linux host](linux-host.md)                   |
| A Linux server already serving other sites through Nginx   | [Behind Nginx](nginx.md)                      |
| Coolify or Dokploy managing a Docker host for you          | [Coolify and Dokploy](coolify-and-dokploy.md) |
| A home server with no public IP, and a Cloudflare domain   | [Cloudflare Tunnel](cloudflare-tunnel.md)     |
| A Raspberry Pi                                             | [Raspberry Pi](raspberry-pi.md)               |

Everything except the Raspberry Pi guide assumes a 64-bit x86 host. Both published images are
`linux/amd64` and `linux/arm64`, so an arm64 server works anywhere a guide says amd64.

## What "tested" means here

Every guide opens with one of two lines, and they mean exactly what they say:

- **Tested** — someone followed this document from a clean state, every step in the order written,
  and completed its verification section. The line names the date and the host, because a guide ages
  against the platform it describes.
- **Not tested** — the guide was written from the platform's own documentation and from Remit's
  Compose file, but nobody has executed it end to end. The line names what was checked and what was
  not, and the guide is still correct about Remit; what it cannot promise is that a console screen
  still has the name it had when this was written.

A guide never claims more than that. A deployment guide that fails at step four costs an evaluator
their evening, and the honest label is what keeps this directory worth reading.

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
bank details, the client notes, and every backup archive
([ADR-0005](../architecture/adr/0005-encryption-at-rest.md)). Nobody can reconstruct it — not you,
not a support channel, not the database. Store it off the host before the instance holds anything.
Where it lives differs per platform, and recreating a service is the usual way it is lost.

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

**A new instance has no document templates, and sending without one sends nothing.** The render job
stops at `Invoice PDF skipped: no template to render`, and because the email is what carries the
PDF, no mail is attempted either. The invoice still moves to `sent` and still publishes a client
link, so the interface shows a successful send and the client heard nothing. Create a template at
`/templates` and mark it the default for its document type before the first real send. This is not
specific to a platform; it is true of every new instance, and it is why every guide's verification
includes it.

## Platforms without a guide

Remit was published as two images so it could run anywhere, and it does. Two commonly requested
targets still have no guide here, deliberately.

**Railway and Render.** Both can run Remit, and neither can run it from the Compose file in this
repository. Neither platform lets two services share a persistent disk, so `app` and `worker` cannot
share the data directory the local backup destination writes into; both would need managed
PostgreSQL, managed Redis, an S3-compatible bucket in place of MinIO, and an S3 backup destination
rather than the local one. That is a different deployment model, not a different set of buttons, and
it has four paid managed services in it. Writing that from documentation, untested, is exactly the
guide that fails at step four. If you run Remit on either and it works, the configuration is worth
contributing.

Nothing about that is a limitation in the platforms; it is a consequence of Remit shipping a Compose
file whose two application services share a volume.
