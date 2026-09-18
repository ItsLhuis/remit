# ADR-0041: Error tracking — a minimal envelope sender, events built by addition, and two reporting boundaries

- **Status:** Accepted
- **Date:** 2026-09-18

## Context

[ADR-0018](0018-no-telemetry.md) decided that error tracking is off unless the deployment sets
`SENTRY_DSN`, and the architecture described a Sentry-compatible interface that self-hosted Sentry
and GlitchTip could both receive. Neither decided what an event may contain, where one is produced,
or what produces it, and nothing did: the variable was validated and read by no code.

An error event is produced at the moment something has gone wrong, which is when a stack frame is
most likely to be holding a client's name, an invoice number or a decrypted `clients.notes`. The
data an event could carry is therefore the decision, and three facts shaped it:

- **The official Sentry SDK for Next.js collects by default what Remit must never send.** Its
  current `dataCollection` defaults collect cookies, request and response headers and bodies, URL
  query parameters, the values of local variables in stack frames, and five lines of source around
  each frame. Its build integration wraps `next.config`, uploads source maps with an authentication
  token at build time, and expects a browser configuration file. Making it safe is subtraction: the
  project would have to know every field the SDK can add in every version it upgrades to, including
  the envelope headers it writes outside `beforeSend`.
- **The published images carry nothing about a deployment**
  ([ADR-0040](0040-deployment-agnostic-images.md)). A source map upload needs one receiver and one
  token at build time, and a DSN in the browser would have to be served to it at runtime.
- **The Sentry envelope is small and documented.** An error event posted to
  `/api/<project id>/envelope/` with the public key in `X-Sentry-Auth` is accepted by Sentry and by
  GlitchTip on the same endpoint and the same DSN format.

## Decision

**A minimal envelope sender, with no SDK.** `lib/errorTracking/` formats an error event and posts it
to the endpoint the DSN names. There is no dependency, no build integration and no browser code.

**Every event is built by addition in one pure function.** `buildErrorEvent` constructs the event
from nothing, adding only values it can classify: the error's type and code, its stack frames read
from below the message, the process's release, environment and runtime, and the reporting boundary's
own context checked against closed vocabularies — a route pattern, a route type, a job name, an
attempt count. **An error's message is never sent**, at any depth of its `cause` chain; the value of
every exception is a fixed sentence. The function **fails closed**: a context value outside its
vocabulary drops the whole event. The sender's only entry point runs every error through it, so no
call site can bypass it.

**Exactly two boundaries report.** An error that escapes a server component, a route handler, a
server action or the proxy, which Next.js hands to `onRequestError`; and a job whose last attempt
fails in the worker, together with a worker that fails to start. A failure a handler catches is
logged and not reported, and feature code never calls the reporter. The boundary writes the full
error to the log under the event's id, which is how a received event is traced back.

**No DSN, nothing constructed.** The sender is started only when `SENTRY_DSN` is set, and only from
the validated environment after validation has passed, so the boot failure that carries the
environment happens before a sender can exist. A set DSN that is not a DSN fails the boot. The
browser and the operational CLI never report, and Hosted mode changes nothing.

## Consequences

### Positive

- Every field that can leave the instance is enumerated in one file and pinned by tests that place
  secrets in messages, `cause` chains, extra properties, arrays and serialized objects.
- An instance without a DSN runs no new code on any path and ships no new bytes to a browser.
- One protocol serves self-hosted Sentry and GlitchTip alike, over plain HTTP on a private network
  if the operator's receiver lives there.
- The report-versus-log rule is a structural boundary rather than a judgement at each call site.

### Negative

- A received event has no message. The operator reads the error in the instance log, found by the
  event id; the receiver groups and alerts, and does not explain.
- Server stack frames point into minified production chunks with no source maps, and the receiver
  cannot map them. The worker's bundle is not minified.
- There are no breadcrumbs, no tracing, no performance data and no release health.
- A failure that a server action catches and logs is never reported, although most failures an owner
  sees as "Something went wrong" are exactly that.
- Remit owns the envelope format. A receiver that stops accepting it breaks reporting silently
  except for the delivery warning in the log.

## Alternatives considered

### The official SDK, configured down

`@sentry/nextjs` with `dataCollection` narrowed and a `beforeSend` that rebuilds each event. It was
rejected because its safety would be subtractive and version-dependent: what reaches the wire is
whatever the SDK collects minus what the configuration remembers to remove, the envelope headers it
writes are not governed by `beforeSend`, and its build and browser integration conflict with images
that carry no deployment.

### The SDK as a bare transport

`@sentry/node` with default integrations disabled, called only with events Remit builds. It removes
most of the collection problem, but keeps a large dependency, OpenTelemetry included, in both the
server and the worker in order to perform one HTTP request, and still adds fields and headers of its
own choosing.

### Forwarding `logger.error` through a pino hook

Every logged error would be reported. It was rejected because Remit deliberately logs and continues
in many places where an alert would be wrong, because a log entry's context object is free-form and
would all arrive at the builder, and because the boot-time validation failure is itself a
`logger.fatal` entry.

### Sending the message after pattern redaction

The redaction patterns under `scripts/core/cli/redact.ts` recognise connection strings and keys.
They cannot recognise a client's name or a note, so redaction is a list of what is known to be
dangerous, and anything else passes.

### Entity ids and job ids in the event

An id identifies nobody by itself, but it lets a third-party receiver correlate every failure on one
record into a history of that record. Several job ids embed the record they work on. The log line
carries both under the event id instead, on the instance.

### Browser error capture through a same-origin relay

The browser would post to an application route that forwards to the receiver, so the DSN would stay
on the server. It was rejected because a client-side handler sees form state, URL parameters and
rendered line items, and because the relay would be a new endpoint to authenticate and rate limit
for a class of error that `error.tsx` boundaries already contain.
