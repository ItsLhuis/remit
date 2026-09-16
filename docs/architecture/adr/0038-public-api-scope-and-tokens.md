# ADR-0038: The public API — read-only over five resources, versioned by path, tokens bounded by their creator

- **Status:** Accepted
- **Date:** 2026-09-14

## Context

The architecture once promised "a REST API mirroring the server actions, with scoped API tokens
managed in `/settings/api`", with documentation generated from Zod. Nothing implemented it.
[ADR-0016](0016-server-actions-canonical.md) makes server actions the canonical write path and
admits API routes only for "future explicitly justified public API surfaces", so an API needs that
justification written down rather than assumed.

"Mirroring the server actions" is not a scope. Remit has dozens of mutations, and an API with
consumers cannot be reshaped the way an internal action can. Three facts constrained the answer:

- **Every role gate reads a Better Auth session.** `getCurrentRole` and each feature's `require*`
  helper resolve the role from request headers carrying a session cookie. A token request has none,
  so none of those gates is reachable from an API call as written.
- **Bulk extraction already exists.** `features/dataExport` produces a complete archive, so an API
  justified as "get my data out" would duplicate it.
- **[ADR-0013](0013-better-auth-organization.md) makes Better Auth the owner of identity.** An API
  token must not become a second identity system beside it.

The plausible callers are an accountant's tooling pulling invoices and time, and a freelancer's own
scripts. A tool that reacts to events is served by outbound webhooks
([ADR-0039](0039-outbound-webhook-delivery.md)), not by polling.

## Decision

**The API is read-only, over clients, projects, invoices, time entries and expenses.** Each has a
paged list; clients, projects and invoices also have a detail read. Excluded: proposals and
contracts (client-facing documents that carry bearer tokens), payments and credit notes (summarised
on the invoice), and templates, settings, team and audit logs (configuration and security records,
not business data). A read API has no idempotency story to design and cannot corrupt anything, and
adding writes later is strictly easier than withdrawing them.

This is the ADR-0016 justification for a second HTTP surface: it serves a caller that has no browser
and no session, it adds no write path, and every read delegates to the query the application's own
screen uses, so the API cannot hold a second definition of "the clients".

**Versioned by path, `/api/v1/`.** A breaking change is removing or renaming a field, changing a
field's type or meaning, or refusing a parameter that was accepted; adding a field or an endpoint is
not breaking. A breaking change ships as `/api/v2/` beside v1.

**One convention for every collection:** `page` and `perPage` (at most 100), a
`{ data, pagination: { page, perPage, total } }` envelope, and the default order of the matching
screen. Any other parameter is refused with `400` rather than ignored, so a caller asking for a
filter learns that v1 has none.

**A token is a bearer credential, stored as a hash, shown once.** Format `remit_` plus 32 random
bytes in base64url, minted through `lib/publicToken.ts`'s CSPRNG. The database holds its SHA-256
digest as a unique lookup key, plus a display prefix. SHA-256 rather than a password hash: the
secret has 256 bits of entropy, so no guessing rate makes it searchable, and a slow hash would add
its cost to every request.

**Scopes are one read scope per resource** (`clients:read` ... `expenses:read`), a vocabulary small
enough that an owner can read it at a glance.

**A token never exceeds its creator.** Only the owner mints tokens, on the footing of the client
portal link: a standing credential to business data is a transmit decision. On every request the
token's effective permission is its scopes intersected with the creator's role as it stands then,
read from `members` (a read-only query, which `auth.md` permits where no API covers the case). A
creator whose membership is removed makes every token they minted refuse, with nothing to update.
Nothing is cached between that read and the request, so revocation and expiry take effect on the
next call. Every refusal answers the same `401`.

**Audit attribution.** The API writes nothing, so no API-originated domain write needs attributing.
Minting and revoking are audited as `api_token.created` and `api_token.revoked`, against the acting
owner, with the token's id and never its value. A tripped API rate limit records the token id in the
entry's metadata. No audit column was added.

**Rate limits key on the token.** A per-IP backstop of 300 a minute runs before authentication, so
an anonymous caller cannot make the instance hash and look up credentials without bound. Once the
token is known the limit is 120 a minute per token, so integrations sharing an egress address do not
starve each other.

**The OpenAPI document is generated** by zod-openapi from the schemas the routes parse with. It is
served at `/api/v1/openapi.json` to any valid token rather than publicly, because an anonymous
document would announce that this particular instance exposes the API.

## Consequences

### Positive

- The whole security surface is reads, behind one authenticator, one refusal shape and one response
  boundary that strips any field a schema does not name.
- A demoted or removed member's integrations stop without anyone remembering to revoke them.
- The document cannot drift from the routes: a test fails when a route file exists without an
  operation or an operation names no route.

### Negative

- No integration can write: a script that creates a time entry still needs the UI.
- No filtering or sorting in v1; a consumer pages through a collection and filters locally.
- Every request costs a token lookup and a membership lookup, and at most one timestamp write a
  minute per token.

## Alternatives considered

### Mirror every server action

Rejected: it would publish every mutation as a permanent compatibility promise, and would have
required re-plumbing every session-based gate to accept a token before a single consumer asked for a
write.

### Scopes replace roles for API requests

A token could carry scopes alone, with no reference to its creator. Rejected: an assistant could
then mint, or be handed, a token outliving their own access. Intersecting with the creator's live
role is the only rule that makes "never more than its creator" true over time.

### A Better Auth API key plugin

Rejected for this surface: it would put a second credential model inside the authentication system's
own tables and upgrade cycle, for a credential whose permission Remit has to derive itself anyway.

### A header version

`Accept: application/vnd.remit.v1+json` versioning was rejected because a path is visible in every
log, proxy rule and curl command, which is where a self-hoster debugs an integration.
