# DR-0046 — Public read API and outbound webhooks

- **Status:** Shipped
- **Date:** 2026-09-14
- **Verdict:** Complete with known gaps
- **Decisions:** ADR-0013, ADR-0016, ADR-0018, ADR-0023, ADR-0037, ADR-0038, ADR-0039
- **Supersedes:** —

## What

A token-authenticated, read-only REST API over five resources, owner-managed scoped API tokens, and
signed outbound webhooks delivered as retrying jobs behind an SSRF-defended fetcher.

## Why

ARCHITECTURE.md once promised "a REST API mirroring the server actions, with scoped API tokens
managed in `/settings/api` and outbound webhooks configurable per event in `/settings/webhooks`",
with documentation generated from Zod. None of it existed: no route, no token table, no webhook
delivery, no generated document. The documentation reconciliation removed the sentence because it
was untrue. An owner who wanted their invoices in an accountant's tooling, or a script to react when
an invoice was paid, had only the whole-instance data export.

## Scope

Included: a read-only API under `/api/v1/` over clients, projects, invoices, time entries and
expenses; scoped, hashed, revocable, owner-minted API tokens; outbound webhooks for a subset of the
domain event map, signed and delivered through the job queue with bounded retries and an SSRF
defence; an OpenAPI document generated from the schemas the routes validate with; the
`/settings/api` and `/settings/webhooks` surfaces; two ADRs; and the documentation of the result.

Excluded, with reasons:

- **Writes.** Every existing mutation gate resolves its role from a Better Auth session, and a write
  API would also need idempotency keys and a compatibility promise on every request shape. Adding
  writes later is strictly easier than withdrawing them.
- **Proposals, contracts, payments, credit notes, templates, settings, team and audit logs.** The
  first two are bearer-token-bearing client documents, payments and credit notes are summarised on
  the invoice, and the rest are configuration or security records rather than business data a
  consumer integrates with.
- **Bulk extraction.** `features/dataExport` already provides it.
- **Filtering and sorting parameters.** Every collection pages; filters are additive later.

## How

A request to `/api/v1/*` passes `proxy.ts` without a session check and reaches a thin route shell.
`features/api/handleApiRequest.ts` applies a per-IP limit, authenticates, applies a per-token limit,
validates `page` and `perPage` strictly, calls the read in `features/api/resources.ts`, and parses
the result through that operation's schema in `features/api/responseSchemas.ts`. The reads are the
application's own queries fed the same parsed list query, so the API holds no second definition of
which rows exist. The response parse is the boundary: a read model that grows a field publishes
nothing until a schema names it, and it is what caught the client detail read returning its
outstanding balance as a `bigint` string.

Authentication looks a token up by its SHA-256 digest, reads the creator's membership role, and
hands both to the pure `evaluateApiTokenAccess`, which intersects the token's scopes with that live
role. Nothing caches the row, so revocation, expiry and a removed membership refuse the next
request, and every refusal is one `401`. Token format, hashing and minting live in `lib/apiToken.ts`
rather than in either feature: placed in `features/api`, the settings module's import of the minter
pulled every resource read into the settings graph and closed dozens of import cycles through
`features/settings/server.ts`.

The OpenAPI document is built by zod-openapi from `features/api/operations.ts`, the registry every
route answers through, so documentation and routing share one list.

A webhook starts as a bus subscriber in `features/webhooks/events.ts`, loaded by
`instrumentation.ts` and the worker's module loader. It writes one `webhook_deliveries` row per
active subscribed endpoint and queues `webhook.delivery.send`, for which `enqueueJob` gained per-job
attempts and backoff. `features/webhooks/delivery.ts` makes one attempt per run, records it under a
conditional update on the attempt count, settles the endpoint's failure streak, prunes old history,
and throws only to ask BullMQ for the next retry. Every request goes through
`features/webhooks/safePost.ts`, which checks addresses inside the request's own DNS `lookup`, so
the socket connects to exactly the address that passed.

Both settings surfaces are owner-only and follow the team settings page's shape. The new
`components/ui/SecretReveal.tsx` primitive carries the one-time reveal, and the dialogs drop the
revealed value from state when they close.

## Evidence

- Schema: `database/schema/apiTokens.ts`, `database/schema/webhooks.ts`, two enums in
  `database/schema/enums.ts`, `drizzle/migrations/0009_parched_jasper_sitwell.sql`; classification
  in `scripts/core/domainData/inventory.ts`; exclusion in
  `features/dataExport/services/exportManifest.ts`.
- Tokens: `lib/apiToken.ts`, `features/api/authenticate.ts`, `features/api/queries.ts`,
  `features/api/services/apiAccess.ts`.
- API: `app/api/v1/**/route.ts` (nine routes), `features/api/handleApiRequest.ts`,
  `features/api/resources.ts`, `features/api/services/serializers.ts`,
  `features/api/responseSchemas.ts`, `features/api/operations.ts`, `features/api/openapi.ts`;
  `proxy.ts`'s `isPublicApiRoute`; list-query parsers exported from five feature server barrels.
- Webhooks: `features/webhooks/{schemas,events,deliveries,delivery,jobs,safePost,secrets}.ts` and
  `features/webhooks/services/{addressPolicy,webhookUrl,signature,payload,deliveryPolicy}.ts`;
  `lib/jobs/types.ts`, `lib/jobs/enqueue.ts`; `REMIT_WEBHOOK_ALLOWED_HOSTS` in `lib/config/env.ts`
  and `.env.example`.
- Settings: `features/settings/api/**`, `features/settings/webhooks/**`, both pages under
  `app/(dashboard)/settings/`, `components/layout/SettingsSidebar.tsx`, `doctor.config.ts`.
- Defect fixed on the way: `features/clients/queries.ts`'s `getOutstandingBalanceCents` converts its
  `bigint` result with `Number(...)`.
- Unit tests: `lib/__tests__/apiToken.test.ts`; `features/api/services/__tests__/`; five files under
  `features/webhooks/services/__tests__/`, including the Standard Webhooks reference signature;
  `features/settings/{api,webhooks}/services/__tests__/`;
  `features/settings/webhooks/__tests__/labels.test.ts`.
- Component tests with `vitest-axe`: `CreateApiTokenDialog.test.tsx`,
  `CreateWebhookDialog.test.tsx`.
- Integration tests: `features/api/__tests__/routes.integration.test.ts` and
  `openapi.integration.test.ts`; `features/webhooks/__tests__/delivery.integration.test.ts`
  (loopback by name, private literal, DNS to private, mixed records, redirect, retry bound,
  auto-disable) and `events.integration.test.ts`; both settings modules'
  `mutations.integration.test.ts`; factories `tests/factories/apiTokens.ts` and `webhooks.ts`.
- Documents: [ADR-0038](../architecture/adr/0038-public-api-scope-and-tokens.md),
  [ADR-0039](../architecture/adr/0039-outbound-webhook-delivery.md), their index rows;
  ARCHITECTURE.md sections 9, 10, 12, 13 and 20; SCHEMA.md sections 30 to 33; README's Features.

## Verification

`pnpm typecheck` passes. `pnpm lint` reports no errors; its two warnings are `max-lines` in
`features/templates` files this change does not touch. `pnpm test` passes 2,360 tests in 264 files;
in one earlier full run two tests in `app/api/upload/__tests__/upload-routes.test.ts` timed out and
passed on their own. `pnpm test:integration` passed 837 tests with 8 skipped; two files,
`features/backups/__tests__/scheduledBackup.integration.test.ts` and
`lib/jobs/__tests__/queueRoundTrip.integration.test.ts`, failed on a ten-second `beforeAll` timeout
starting a real worker under full-suite load, and both passed when run alone.
`pnpm database:generate` reports no schema changes. `pnpm build` succeeds and lists all nine
`/api/v1` routes and both settings pages. react-doctor and fallow report nothing new on the touched
files beyond the owner gate the settings modules already duplicate. The generated document validates
with Redocly CLI's recommended ruleset with no errors or warnings.

`pnpm test:coverage` fails its services branch threshold at 86.05%. No new service file is below
90%; every file under the bar predates this change, led by
`features/templates/services/normalizeBlocks.ts`.

Against the production build: with no token, with a malformed token, and on `/api/v1/openapi.json`,
the API answered the same `401` JSON with `Cache-Control: no-store` and
`X-Robots-Tag: noindex, nofollow` rather than redirecting to login, and `/settings/api` redirected
an anonymous visitor to `/login`.

Not verified by hand: minting and using a token, revoking it, registering a webhook against a live
receiver, and keyboard-only use of both dialogs. The development database was not migrated to
`0009`, so those flows are covered only by the integration tests against the test database. The
`component-reviewer` agent is not available in this environment and was not run.

## Known gaps

- **The API is read-only and unfiltered.** Nothing can be written, and collections cannot be
  filtered or sorted by the caller.
- **Responses carry no rate-limit headers**, so a client learns its limit only from a `429`.
- **An invoice's detail omits the outstanding amount** its list row carries.
- **Secret rotation has no grace period**; the old signing secret stops verifying at once.
- **An allowlisted webhook host may reach any private address it resolves to**, not one port or
  path.
- **A delivery whose job exhausts BullMQ's attempts without recording one** stays `pending`.
- **The owner gate is duplicated** across the two new settings mutation modules, as the other
  settings modules already duplicate theirs.
- **The services branch coverage gate was failing before this change** and still fails.
- **The two BullMQ-backed integration files time out under full-suite load**, as DR-0045 recorded.
- **The drizzle-kit migration metadata files fail `pnpm format:check`**; they are generated and were
  left as written.
