# ADR-0048: A worker crash is reported, and a request error is logged once

- **Status:** Accepted
- **Date:** 2026-10-07
- **Supersedes:** [ADR-0041](0041-error-tracking-boundary.md) on two points: the process boundary
  covers a worker that crashes after starting as well as one that fails to start, and at the request
  boundary the full error is the line Next.js writes rather than a line Remit writes under the event
  id. Every other point of ADR-0041 stands.

## Context

ADR-0041 reports a worker that fails to start. A worker that started and then threw outside any job
— an unhandled rejection, an uncaught exception — was not reported at all: Node's default killed the
process, and only the container log showed why.

ADR-0041 also has every boundary write the full error to the log under the event id. At the request
boundary Next.js has already written that error itself, stack and all, so with a DSN set every
request error was logged twice. Next.js 16 logs every request error unless its server was started
`quiet`, an option of the internal `startServer` that the standalone `server.js` never passes; there
is no supported way to turn its line off.

## Decision

**A worker crash is the process boundary.** `scripts/worker.ts` installs `unhandledRejection` and
`uncaughtException` handlers once error tracking has started. A crash is reported with
`{ source: "process", phase: "run" }`, logged with its event id, and the process exits non-zero
after a bounded flush, with a hard deadline should anything before the flush hang. After an uncaught
exception the process's state is unknown, so a restart — the Compose service's
`restart: unless-stopped` — is the only safe continuation. `phase` gains the one literal `run`; no
other field is added to what an event carries.

**At the request boundary Remit writes a receipt, not a second copy.** `onRequestError` logs one
line carrying the event id, the route pattern, the error's type and the digest Next.js prints beside
a rendering error, and not the error. The error itself is logged once, by Next.js. An operator gets
from a received event to its log line by the digest, and by route and time where there is none.

## Consequences

### Positive

- No worker failure goes unreported, whether it happens before or after the worker starts.
- A request error appears once in the log.

### Negative

- The request error's stack is in Next.js's plain-text line, not in Remit's structured one.
- A route handler's error carries no digest, so its event is matched to its log line by route and
  time.

## Alternatives considered

### Suppressing Next.js's line

Not available through any supported setting. Starting the server `quiet` through a custom server
built on `next/dist` internals was rejected: it couples deployment to an undocumented entry point
and would also silence every request error on an instance with no DSN.

### Keeping the full error on Remit's line

ADR-0041's original choice, rejected here because it is the duplicate.

### Continuing after a crash

Logging and carrying on was rejected: after an uncaught exception Node documents the process state
as undefined, and a worker that runs money-affecting jobs must not continue in it.
