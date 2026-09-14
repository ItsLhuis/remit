# ADR-0039: Outbound webhooks — minimal signed payloads, delivered as jobs, behind a pinned-address SSRF defence

- **Status:** Accepted
- **Date:** 2026-09-14

## Context

The architecture once promised outbound webhooks "configurable per event in `/settings/webhooks`".
Building one means Remit's server makes a request to a URL a person typed, from inside the network
it is deployed on. On a self-hosted instance that network holds PostgreSQL, Redis, MinIO, the
`/api/metrics` endpoint on localhost, a router's admin page, and on a cloud host a metadata service
at 169.254.169.254. A naive fetcher turns the instance into a proxy onto all of them.

Four more facts shaped the design:

- **The event vocabulary already exists.** `lib/events/types.ts`'s `EventMap` is the typed domain
  event list, and `features/activityLog/events.ts` shows the subscriber pattern.
- **[ADR-0023](0023-job-scheduling-bullmq-redis.md) owns retryable work.** A delivery that must
  survive a receiver being down is exactly that.
- **Remit already demands signed deliveries of Stripe.** It owes its own receivers the same.
- **The opening of ARCHITECTURE.md keeps business data inside the instance** unless the owner
  deliberately sends it out.

## Decision

**The subscribable events are a typed subset of `EventMap`**: sixteen events on the five resources
the API reads, plus `payment.received`. Auth, membership, settings and template events are excluded,
because they describe the instance's security and configuration.

**A payload carries record ids and the scalar facts of the event, never the record.** It is
`{ type, timestamp, data }`, where `data` is an allowlist per event: an invoice id, a project's
status change, a time entry's duration. `userId` and `changedFields` are dropped everywhere. A
receiver that needs the invoice fetches it with an API token
([ADR-0038](0038-public-api-scope-and-tokens.md)), which keeps client data behind a credential the
owner can revoke and gives the receiver current state rather than a snapshot.

**Signing follows the Standard Webhooks specification.** HMAC-SHA256 over
`webhook-id.webhook-timestamp.body`, sent as `v1,<base64>` beside the id and timestamp headers, with
a `whsec_` secret of 32 random bytes. The timestamp inside the signed material defeats replay, since
a receiver refuses one outside five minutes. The signed id lets a receiver deduplicate retries. The
body is signed exactly as sent. A standard scheme means any of that specification's libraries
verifies a Remit delivery. The secret is encrypted at rest rather than hashed, because every
delivery must read it back, and it is shown once when minted or rotated.

**Delivery is a job.** The subscriber writes one `webhook_deliveries` row per subscribed active
endpoint and queues `webhook.delivery.send`; it never makes the request, so a slow or failing
receiver cannot become the emitting user's latency or error. The job makes one attempt per run: six
attempts, the first immediate and then exponential from thirty seconds, about sixteen minutes in
all. Every attempt is recorded (time, HTTP status, outcome code, never the response body) before the
job finishes or throws for a retry. A conditional update on the attempt count makes a re-delivered
job a no-op. A 2xx succeeds; a redirect, a refused address or a disabled endpoint fails at once,
because retrying cannot change the answer; anything else retries. Ten deliveries in a row that
exhaust their retries switch the endpoint off, record why, and write an audit entry. Completed
deliveries older than thirty days are pruned as each delivery completes.

**The SSRF defence is layered, and every layer is required:**

- _Static checks on the URL_, on save and again before every attempt: HTTPS only, no embedded
  credentials, a length bound, and an IP-literal host checked against the address policy.
- _An address policy_ built on `net.BlockList`: loopback, RFC 1918, carrier-grade NAT, IPv6
  unique-local, NAT64 and 6to4 prefixes, and documentation ranges are refused. Link-local (where
  metadata services answer), unspecified, multicast and reserved ranges are refused without
  exception. `BlockList` matches IPv4 rules against IPv4-mapped IPv6 spellings, which a prefix
  string check misses.
- _Address pinning_: the check runs inside the request's own DNS `lookup`, so the socket connects to
  exactly the address that passed. Checking a name and letting the client resolve it again is the
  DNS-rebinding gap. If any record a name resolves to is refused, the request is refused.
- _No redirects, one total timeout, and the response body never read._
- _An operator allowlist_, `REMIT_WEBHOOK_ALLOWED_HOSTS`, of exact hostnames that may use plain HTTP
  and private ranges, such as an automation server on the same network. It is a deployment variable
  and not a setting, because opening the private network to outbound requests is the operator's
  decision, and a field in the UI would turn the defence into a checkbox.

## Consequences

### Positive

- A webhook cannot be aimed at the instance's own services, by URL, by DNS answer or by redirect,
  without the operator naming the host.
- Client data does not leave in a payload; what leaves is ids and the fact that something happened.
- A receiver can verify and deduplicate with an off-the-shelf library.
- Emitting actions are unaffected by receivers: a delivery is a row and a queued job.

### Negative

- A receiver makes an API call to learn anything beyond ids.
- An allowlisted host may reach any private address it resolves to, not only one port or path.
- A delivery whose job exhausts BullMQ's attempts without recording one (a worker crash mid-attempt
  on every try) stays `pending` in the history.
- Secret rotation has no grace period: the old secret stops verifying at once.

## Alternatives considered

### Full records in the payload

Convenient for a receiver. Rejected: it copies client data to a URL someone typed, and a receiver
built on snapshots acts on state that may already have changed.

### Inline delivery from the subscriber

Rejected by ADR-0023's reasoning: no durable retry, and a slow receiver holds the emitting request.

### Resolve once at save time and store the address

Rejected: DNS changes, and a stored address goes stale the other way, sending a legitimate
receiver's deliveries to whoever holds the old address.

### A proxy or egress firewall as the only defence

Correct where available, but a self-hoster running one Compose file has neither. The application
defence is the floor; an operator's network policy can sit in front of it.
