# DR-0051 — Error tracking

- **Status:** Shipped
- **Date:** 2026-09-18
- **Verdict:** Complete with known gaps
- **Decisions:** ADR-0005, ADR-0018, ADR-0023, ADR-0040, ADR-0041
- **Supersedes:** —

## What

With `SENTRY_DSN` set, an error that escapes a request or exhausts a job's last attempt is sent to a
Sentry-compatible receiver as an event built from an allowlist that carries no message and no
business data; with it unset, nothing is constructed.

## Why

`lib/config/env.ts` validated `SENTRY_DSN`, `.env.example` documented it and ADR-0018 named it as
the opt-in for error tracking, but no code read it and `docker-compose.yml` never passed it to
either container. An operator who set it got nothing and no signal that nothing happened. The
failures an operator most needs to hear about happen in the worker, a separate container whose
stdout nobody watches, and an error is the one moment a stack frame is most likely to hold a
client's name, an invoice number or a decrypted note.

## Scope

Included: a sender for the server and worker processes; one pure function that builds every event
from allowlisted pieces and drops what it cannot classify; reporting at the two boundaries where a
failure has escaped every handler; the Compose passthrough; a status row on `/settings/system`; and
the documentation that describes all of it.

Excluded, with reasons:

- **The browser.** A client-side handler sees form state, URL parameters and rendered line items,
  and the DSN is never sent to a browser.
- **The operational CLI.** `remit:backup`, `remit:restore` and the rest run with the operator at the
  terminal, already redact their own failure reasons, and handle the material an error there is most
  likely to carry: archive keys, credentials and database URLs.
- **Error messages.** A message is free text assembled by whatever code threw it, including driver
  errors that quote column values, so it never leaves; the instance log keeps it.
- **Failures a handler catches and logs.** Catching a failure is the decision that it is handled;
  those stay in the log.

## How

There is no Sentry SDK. ADR-0041 records why: the SDK's defaults collect request bodies, cookies,
query strings, local variables and source lines, so making it safe would be subtraction, and its
build integration assumes one receiver known at build time, which a published image cannot have.
`lib/errorTracking/` posts a Sentry envelope to the endpoint the DSN names, which self-hosted Sentry
and GlitchTip both accept.

The safety property lives in one pure function, `buildErrorEvent`. It does not clean an error; it
builds an event from nothing, adding the error's type, a failure code from a closed pattern, stack
frames read only from below the message, and the reporting boundary's own context checked against
closed vocabularies. An exception's value is one fixed sentence at every depth of the `cause` chain.
The message is withheld outright because no rule can classify it: the smoke test's first real event
was a Drizzle error whose message quoted the requested public token as a query parameter. A context
value outside its vocabulary drops the whole event rather than the field. The reporter is the only
way to the network and runs every error through the builder, so no call site can skip it.

Frames are read below the header V8 renders from the error's name and message, because a message can
contain lines shaped like frames. When the header no longer matches the error, the boundary is
unknowable and no frame is sent. Paths are made relative to the working directory, and a path
outside it is cut to its file name so a development checkout does not send an account name.

Two boundaries report. `instrumentation.ts`'s `onRequestError` receives what escapes a server
component, route handler, server action or the proxy, and never reads the request's path or headers.
`lib/jobs/worker.ts` reports the attempt that exhausts a job's budget, the same attempt it already
counted for the metrics, and `scripts/worker.ts` reports a failed start. Each boundary logs the full
error under the event's id, and the event carries that id again as an `errorEventId` tag, because
GlitchTip displays an id of its own. `no-restricted-imports` fails a feature or route that imports
the reporter.

Both processes start the sender from the validated `env`, after validation. `lib/config/env.ts`
exits during that import when validation fails, so a sender cannot exist at the one moment an error
carries the environment. `lib/config/envSchema.ts` now refuses a set DSN that is not a DSN, so a
typo stops the boot instead of switching reporting off unnoticed. Sending is fire-and-forget, is
bounded at five seconds, and stops at five unanswered sends. A receiver outage is logged once when
it starts and once when it ends, like the rate limiter's Redis fallback.

## Evidence

- Builder: `lib/errorTracking/errorEvent.ts` (`buildErrorEvent`, `WITHHELD_MESSAGE`, the context and
  facts schemas). Frames: `lib/errorTracking/stackFrames.ts` (`parseStackFrames`). DSN:
  `lib/errorTracking/dsn.ts` (`parseErrorTrackingDsn`). Framing: `lib/errorTracking/envelope.ts`.
  Sender: `lib/errorTracking/reporter.ts` (`startErrorTracking`, `reportError`,
  `flushErrorReports`), exported through `lib/errorTracking/index.ts`.
- Boundaries: `instrumentation.ts` (`register`, `onRequestError`); `lib/jobs/worker.ts`
  (`settleFailedAttempt`); `scripts/worker.ts` (`main`, `reportStartFailure`).
- Configuration: `lib/config/envSchema.ts` (`SENTRY_DSN`); `docker-compose.yml` passes `SENTRY_DSN`
  to `app` and `worker`; `.env.example` states the unset and set behaviour.
- Health: `features/health/queries.ts` (`getErrorTrackingHealthCheck`), `features/health/types.ts`,
  and the `health.checks.errorTracking.*` keys in `lib/i18n/types.ts` and `lib/i18n/locales/en.tsx`.
- Lint: `eslint.config.mjs`'s boundary rule forbids `@/lib/errorTracking` under `features/` and
  `app/`.
- Documents: `docs/architecture/ARCHITECTURE.md` section 13 (configuration hierarchy and data
  residency), section 14 (health and status) and section 16 (What an operator can observe, Error
  tracking); [ADR-0041](../architecture/adr/0041-error-tracking-boundary.md) and its rows in both
  ADR indexes; `.agents/rules/errors.md` (Reported versus logged); `README.md`'s Self-hosting list;
  `CHANGELOG.md`'s Unreleased upgrade note and entry.
- Tests: `lib/errorTracking/__tests__/errorEvent.test.ts` (26 cases),
  `lib/errorTracking/__tests__/stackFrames.test.ts` (8), `lib/errorTracking/__tests__/dsn.test.ts`
  (9), `lib/errorTracking/__tests__/reporter.test.ts` (8),
  `lib/errorTracking/__tests__/bootFailure.test.ts` (3),
  `lib/errorTracking/__tests__/instrumentation.test.ts` (3),
  `lib/jobs/__tests__/workerFailureReporting.test.ts` (2).

## Verification

`pnpm typecheck` and `pnpm lint` pass, lint with the two `max-lines` warnings the template editor
already had. `pnpm test` passed 2473 of 2473. One earlier full run failed a single case in
`CreateApiTokenDialog.test.tsx`, a file this change does not touch, and that case passed three times
alone and in the next full run. `pnpm test:integration` passed 845 of 845. `pnpm build` and
`pnpm build:scripts` pass. react-doctor scores 91 with 26 warnings, none in a touched file. fallow
reports nothing in `lib/errorTracking`. It flagged the worker's `failed` handler as a new complexity
hotspot, which went once the final-attempt logic moved into `settleFailedAttempt`.
`lib/errorTracking` has 98.3% statement and 92.9% branch coverage. `pnpm test:coverage` still exits
non-zero on the services branch threshold, at 86.06% against 90%, as it did before this change,
which touches no file under `features/**/services/`.

The builder's tests place 24 banned values — every encrypted column, `clients.notes`, each
deployment secret, each kind of token, an OTP, a TOTP secret, a backup code, an email address, a
request body and a query string. Each goes into a message, a three-deep `cause` chain, extra
properties, arrays, nested objects, a serialized environment and a thrown string, and none appears
in the output. Letting the message through turned eight tests red; parsing frames from the whole
stack turned two red. `bootFailure.test.ts` boots `instrumentation.ts` with a valid DSN and an
invalid encryption key: the process exits, no sender starts and no request is made.

The client bundle was measured against a build of the parent commit. 106 files and 5,714,105 bytes
became 106 files and 5,714,549, and exactly one chunk changed: the one holding the locale strings,
which grew by the health row's five strings. No chunk contains any error-tracking code.

The smoke ran against GlitchTip 6.2.6 on Docker, with a production build of the app. The database
URL pointed at a refused port and carried a marker password. A preload logged every outbound socket
the process opened.

- With `SENTRY_DSN` unset, a failing public-link request and a failing proposal-link request
  answered `500`. The server opened sockets only to the database, Redis and MinIO. In a browser, two
  thrown errors produced 26 same-origin requests and none elsewhere.
- With the DSN set, the same request produced one socket to the receiver and one issue with
  `runtime server`, `route.path /i/[token]`, `error.code ECONNREFUSED` and the digest. Its frames
  name `features_invoices_server_ts` chunks, and the connection-refused cause is chained. The server
  had logged the error with a message quoting the public token and the full SQL. The stored event,
  read through GlitchTip's API, its database and a screenshot of its issue page, carries only the
  tags, the two withheld exceptions, the frames and the SDK name. It has no request, user, context
  or breadcrumb section. Searching it for the token, the query string, the session cookie, the
  marker password, the port, `select`, `params`, the host name and the checkout path found nothing.
- The worker, pointed at the test database with a Chromium path that does not exist, failed an
  invoice PDF render five times and logged four attempts without an event id. The fifth produced one
  socket to the receiver and an issue with `runtime worker`, `job.name invoice.pdf.render`,
  `job.attempts 5`, culprit `invoice.pdf.render`, and frames through `renderInvoicePdf`,
  `renderHtmlToPdf` and `launchBrowser`. It has no field that carries the job id, and neither the
  invoice id, the Chromium path nor the database credentials appear in it. The worker's log keeps
  the job id beside the same event id.
- With the DSN pointed at a non-routable address, seven failing requests answered in 0.01 to 0.6
  seconds. Exactly five sockets opened toward the dead receiver, and one `TimeoutError` warning was
  logged. A worker in the same state failed a job's last attempt, completed the next job 1.5 seconds
  later while the report was still pending, and logged the timeout five seconds after the failure.
- With a valid DSN and an invalid encryption key, the server exited logging the variable's name and
  not its value, opened no socket at all, and the receiver's event count did not change.
- After the id tag was added, a contract-link failure's `errorEventId` tag in GlitchTip equals the
  `errorEventId` in the server's log line.

Self-hosted Sentry was not run; GlitchTip was the receiver. Sentry's envelope documentation was the
reference for the format.

## Known gaps

- Server stack frames point into minified production chunks. The standalone image ships source maps
  only for route entry files, and none is uploaded anywhere. The worker's frames are readable.
- A class whose name the production build minified is reported with the type `Error`: the Drizzle
  query error arrived that way.
- A failure a server action catches and logs is never reported, although it is what an owner sees as
  "Something went wrong". Reporting it means letting it escape, which is a feature's decision.
- A worker that crashes on an unhandled rejection is not reported. Its container restarts and the
  crash is in its log.
- `/settings/system` says whether a DSN is set and nothing about delivery. The receiver is the only
  place that shows whether events arrive.
- With a DSN set, a request error is logged twice: once by Next.js and once with its event id.
- The client bundle grew by the 444 bytes of the health row's strings, for every instance, with or
  without a DSN, because locale strings ship to the browser in one module.
- Every build reports `release` as `package.json`'s version, which has not changed since Remit
  started, so a receiver cannot yet tell one untagged build from another.
