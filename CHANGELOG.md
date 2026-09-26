# Changelog

Every release of Remit is recorded here, newest first. The format follows
[Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This file is written for the operator deciding whether and when to upgrade. An entry says what
changed for the people who use and run an instance, not how the code changed; the commit history
answers that.

## Entry vocabulary

A release groups its entries under these headings, in this order, and leaves out the ones it does
not need:

- **Upgrade notes**: what an operator must know before upgrading. Every database migration the
  release applies when the container starts, anything that changes or removes stored data, every
  breaking change, and any action needed before or after the upgrade. A release with none of these
  says so in one line, so the absence is stated rather than implied.
- **Added**: capabilities that did not exist before.
- **Changed**: existing behaviour that now works differently.
- **Deprecated**: capabilities that still work and will be removed in a later release.
- **Removed**: capabilities that no longer exist.
- **Fixed**: defects corrected.
- **Security**: vulnerabilities fixed. Upgrade promptly when a release carries one.

Upcoming changes collect under **Unreleased** as they land. `pnpm version:patch`,
`pnpm version:minor` and `pnpm version:major` turn that section into the new version's dated
section, and refuse to run while it has no entries.

## [Unreleased]

### Upgrade notes

- One database migration, applied when the container starts: it adds `settings.mcp_enabled`, set to
  off on every existing instance.
- A second migration settles every issued invoice whose payments and credit notes already cover its
  total: it becomes paid, dated when it was covered, and stops being chased as overdue.
- **Edit `.env` before upgrading, or the containers refuse to start.** Replace `BETTER_AUTH_URL` and
  `NEXT_PUBLIC_APP_URL` with a single `REMIT_PUBLIC_URL` holding the same origin, with no path or
  trailing slash, and delete `NEXT_PUBLIC_STORAGE_BASE_URL` and `MINIO_PUBLIC_URL`.
- **Update `docker-compose.yml` from the repository before running the upgrade script.** The images
  are now `ghcr.io/itslhuis/remit/app` and `ghcr.io/itslhuis/remit/worker`.
- MinIO no longer publishes ports 9000 and 9001, and its bucket no longer allows anonymous reads. A
  reverse-proxy route to MinIO, or anything else that reached storage directly, is no longer needed
  and no longer works.
- **If `.env` sets `SENTRY_DSN`, errors start being sent to it after this upgrade.** The variable
  used to do nothing. It must now be a DSN with a key and a numeric project id, such as
  `https://<key>@errors.example.com/1`, or the containers refuse to start. Leave it empty to keep
  sending nothing.

### Added

- Invoices, proposals and credit notes render from a built-in layout when no template of their type
  exists, so a new instance can send them without designing a template first.
- The public invoice page lists the credit notes applied to the invoice.
- The public API and MCP tools give an invoice its `displayStatus` (overdue and partially paid
  included), and the API invoice detail now carries `outstandingCents`.
- An invoice with a late fee says when its template would leave the fee off the PDF.
- An MCP server at `/api/mcp` lets an AI assistant read clients, projects, invoices, time entries
  and expenses through read-only tools, authenticated with the API tokens you already create in
  `/settings/api`. It is off until you turn it on in `/settings/mcp`, which says what turning it on
  shares, gives the address to connect to, and lists the latest tool calls.
- This changelog, kept in step with the version by the release commands.
- `/settings/system` links this changelog and the upgrade runbook beside the running version, and
  says that Remit does not check for updates.
- `scripts/host/install.sh` installs Remit on a host with Docker in one command: it checks the host,
  asks for the public URL and whether to run Caddy, generates every secret, writes `.env` with mode
  `0600`, starts the stack and waits until it is healthy. It shows the encryption key once and
  continues only after you confirm you stored it, and re-running it never replaces `.env` or its
  key.
- A `with-proxy` Compose profile runs Caddy in front of Remit with an automatically issued and
  renewed HTTPS certificate.
- Error tracking to a Sentry or GlitchTip project you run, off unless `SENTRY_DSN` is set. A request
  error no handler caught and a background job that failed its last attempt are reported with their
  type, code and stack frames and never their message, the request or any business data.
  `/settings/system` shows whether it is on.

### Changed

- Credit notes now count toward settling an invoice: once payments and credit notes cover the total,
  the invoice is paid.
- Sending a document on an instance with no mail provider now warns that no email went out.
- Charging or adjusting a late fee re-renders the invoice PDF, so later reminders attach one showing
  the fee.
- Uploads and public files — avatars, logos, client and template images, expense receipts — are sent
  to and served from the instance's own address, so a deployment needs one hostname and one
  certificate.

### Fixed

- Sending an invoice or proposal on an instance with no templates marked it sent and never emailed
  it, and a credit note issued there never got a PDF.
- The public invoice page left a late fee out of its summary, so the lines it listed did not add up
  to its total.
- The public invoice page, card checkout, "mark as paid", reminders, late fees, the invoice and
  client lists, the API and the MCP tools ignored credit notes when stating what was owed.
- The templates page claimed missing types fall back to a built-in layout that did not exist.
- The background worker could not start in a container at all: its compiled bundle imported
  `next/headers`, which plain Node cannot resolve, so it restarted forever while the app stayed
  healthy. PDF rendering, reminder and overdue sweeps, recurring invoice generation and scheduled
  backups never ran on a Docker deployment.
- `pnpm remit:restore` failed after replacing the database when the archive contained no uploads,
  which is every instance whose files live in object storage. It now restores an empty uploads
  directory instead of stopping half way.
- The published application image started the background worker instead of the web server, and no
  worker image was published. Both images now build from their own Dockerfile stage.
- A published image carried `http://localhost:3000` in its browser code and could not serve any
  other address.
- The backup settings page said nothing ran backups automatically, although the worker takes one
  overnight whenever the configured cadence says one is due. It now describes the schedule.
- `scripts/host/upgrade.sh` printed rollback guidance, and claimed its backup step had completed,
  when the prerequisite check or the pre-upgrade backup failed — before anything had changed. It now
  says that nothing was changed and that the upgrade can be run again.

## History before this file

Remit has not published a tagged release. Work delivered before this changelog existed is not
reconstructed here: [README.md](README.md) describes what the product does, and
[docs/delivery/](docs/delivery/README.md) records what was built and how it was verified.
