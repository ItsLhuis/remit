# DR-0052 — MCP server

- **Status:** Shipped
- **Date:** 2026-09-21
- **Verdict:** Complete with known gaps
- **Decisions:** ADR-0013, ADR-0016, ADR-0018, ADR-0038, ADR-0042
- **Supersedes:** —

## What

An owner can turn on a Model Context Protocol server at `/api/mcp` that lets an AI assistant holding
one of the instance's API tokens read clients, projects, invoices, time entries and expenses through
read-only tools, with exactly the permissions that token has on the REST API.

## Why

A freelancer running Remit already asks their numbers questions — what is outstanding this month,
what is unbilled on a project, which clients have not been invoiced since March — and answers them
by clicking through screens. An assistant can answer them in one sentence, but only through a
protocol it speaks, and nothing in Remit spoke one: the REST API answers a program that already
knows which endpoint to call, not a model deciding which question to ask.

It is also the first Remit feature that hands business data to a language model, which sits in
direct tension with the product's first principle — data covered by an NDA never has to leave the
operator's infrastructure. That tension has to be resolved in the open rather than by a feature that
quietly contradicts the README.

## Scope

Included: a Streamable HTTP endpoint served by the application, authenticated by the REST API's own
tokens; eight read-only tools over the five resources the API publishes, each projecting through the
API's response schemas; an instance-wide switch that defaults to off; an owner-only settings page
carrying the consent statement, the connection details and the recent tool calls; an audit entry per
tool call; and the documentation that describes all of it.

Excluded, with reasons:

- **Write tools.** The REST API writes nothing, and a token may never do more through MCP than
  through the API. A write reachable by a model that has just read free text is also a
  prompt-injection path.
- **The specification's OAuth authorization flow.** Authorization is optional in the specification;
  adopting its OAuth chapter would put a second token model beside the API's.
- **stdio.** A second distributable, versioned against the instance, that could only reach Remit
  through an unfiltered API or a database connection outside the application's authorization.
- **Resources and prompts.** Every question the assistant answers is a parameterised read, which is
  what a tool is.
- **Anything the REST API does not publish**, and records in the trash.

## How

The endpoint is a route in the application, not a second process. `app/api/mcp/route.ts` hands every
request to `features/mcp/handleMcpRequest.ts`, which checks `Origin`, the per-IP limit and the
switch, reads the JSON-RPC body once, admits the request through the public API's own
`authenticateApiRequest` — against the called tool's resource for a `tools/call`, against none
otherwise — applies the per-token limit, and passes the admitted body to the SDK's per-request
handler. ADR-0042 records why this is Streamable HTTP with the API's tokens rather than stdio or the
specification's OAuth, and the privacy position the whole surface is built to.

What makes a token read the same through both surfaces is construction, not review. Each tool in
`features/mcp/tools.ts` names the REST operation it mirrors and takes that operation's resource and
response schema; it reads through the same `features/api/resources.ts` function the REST route
calls, now able to pass the screens' own filters; and the tools a request sees are
`readableApiResources`, the same access decision asked once per resource. The per-request server
registers only those tools, so a call outside the token's scopes is refused at admission and could
not run behind it either.

The protocol moved while the work was planned: the specification the work was written against was
2025-11-25, and the current one is 2026-07-28, which removed sessions and the `initialize`
handshake. The SDK's 2.0 line serves the new revision and answers 2025-era clients statelessly from
the same tool definitions, so both kinds of client connect. Two things the SDK and the application
disagreed on had to be bridged: the API's response schemas carry OpenAPI component names that Zod
writes as a JSON Schema `id` keyword a strict client refuses, so each tool's output schema is
generated with those dropped; and the SDK hands tool arguments over untyped, so each tool parses its
own arguments again before any read.

Enabling is a column rather than an environment variable because it is a consent decision the owner
takes, not a deployment fact. `/settings/mcp` states that decision inline rather than behind a
dialog, so it can be read again while the server is on.

## Evidence

- `features/mcp/handleMcpRequest.ts` — admission order, limits, the switch, the batch refusal.
- `features/mcp/tools.ts` — the eight tools, each bound to a REST operation; the output-schema
  bridge.
- `features/mcp/runTool.ts` — the response-schema parse on the way out and the `mcp.tool.called`
  audit entry.
- `features/mcp/services/toolAudit.ts`, `toolArguments.ts`, `requestEnvelope.ts` — the pure pieces,
  each with a test beside it.
- `features/api/services/apiAccess.ts`'s `readableApiResources`,
  `features/api/services/listSearchParams.ts` and `features/api/resources.ts` — the shared admission
  and the filters, which the REST routes still call with none.
- `features/settings/mcp/` and `app/(dashboard)/settings/mcp/page.tsx` — the owner surface and its
  owner-only mutation.
- `database/schema/settings.ts`'s `mcpEnabled` and
  `drizzle/migrations/0010_nostalgic_ghost_rider.sql`; the export manifest excludes the column as
  configuration.
- `features/mcp/__tests__/mcpServer.integration.test.ts` — both protocol eras through the real SDK
  client against the real route, the 404 while off, the 403 for a foreign `Origin`, one 401 for
  every refusal, REST parity for seven scope sets, revocation and a lost membership mid-session, the
  per-token limit.
- `features/mcp/__tests__/mcpExposure.integration.test.ts` — every tool called against planted
  sentinels with the raw protocol bytes searched; the audit entries; the overdue, date-range and
  unbilled filters.
- `features/mcp/__tests__/tools.integration.test.ts` — every tool pinned to its REST operation and
  response schema, and no free-text argument outside the audit projection.
- `features/settings/mcp/__tests__/mutations.integration.test.ts` and
  `features/settings/mcp/components/McpSettingsPage/__tests__/McpAccessCard.test.tsx`.
- ADR-0042.

## Verification

`pnpm typecheck` passes. `pnpm lint` passes with the two `max-lines` warnings the template editor
already had. `pnpm test:integration` passed 882 of 882. `pnpm build`, which also builds the
operational scripts, passes and lists `/api/mcp` and `/settings/mcp` as dynamic routes.
`pnpm database:generate` reports no schema changes after the migration. react-doctor scores 91 with
26 warnings, none in a touched file. fallow reports nothing unused in `features/mcp`,
`features/settings/mcp` or `features/api`. It counts `features/settings/mcp/mutations.ts` in the
owner-gate clone group every settings mutation already shares, which the architecture rules keep
unshared on purpose. It scores `handleMcpRequest` 49.5 on CRAP because only integration tests reach
it.

`pnpm test` passed 2501 of 2501 on a quiet machine. The first full run, with a development server
running beside it, failed ten cases in four files this change does not touch, all at the five second
limit. One earlier full run failed `McpAccessCard.test.tsx` without a timeout. The cause was the
spinner's `aria-label`: while the save was still pending, the button's accessible name was "loading"
plus "turn off", so an exact-name query could land in that window. A throwaway test held the save
open and confirmed the name. The test now waits until the button is named "turn off" alone and is
enabled.

`features/mcp/services` and `features/api/services/listSearchParams.ts` have 100% statement, branch,
function and line coverage. `pnpm test:coverage` still exits non-zero on the services branch
threshold, at 86.22% against 90%. It was 86.06% before this change, which lowers it nowhere. Under
coverage instrumentation, `ProposalForm.test.tsx` and `destination.test.ts` time out, as they
already did under load.

The real-client run used the MCP Inspector CLI 2.7.0 against a production build on port 3100. The
build ran over the migrated test database, seeded through the test factories with sentinel values
planted in `clients.notes`, a client portal token, a receipt's storage key and two encrypted
settings columns. A recording proxy on the next port captured every request and response byte.

- With the switch off, a request with a valid token and one without both got 404, and so did the
  Inspector.
- With the switch on, the Inspector completed both handshakes. The 2026-07-28 client sent
  `server/discover`; the 2025-11-25 client sent `initialize` and `notifications/initialized`. Both
  listed the eight tools, each marked read-only. The Inspector's `--strict` schema portability check
  exits 0 on both lists.
- Asked what Acme owes, the assistant's path was `list_clients` searching "Acme", then
  `list_invoices` for that client in the sent, overdue and partially paid states. It returned two
  invoices, one 120,000 cents overdue and one 80,000 with 30,000 paid, and a client balance of
  170,000 cents in EUR. A query over `invoices` and `payments` in the database gave the same two
  rows and the same total. Globex's open invoice and Acme's paid invoice were excluded. An overdue
  filter, an unbilled time-entry filter and a September expense range each returned exactly the
  seeded row. `get_client`, `get_project` and `get_invoice` returned their records, the last over
  the 2025 era.
- Across 184 raw response lines, none contains any of 16 forbidden values: the API token and its
  stored hash, the five sentinels, all four invoice public tokens, the portal token, the ciphertexts
  of the note and both encrypted settings, and the receipt's storage path. The expense reports
  `hasReceipt` and nothing else about the file. The token appears only in the requests the client
  sent.
- An extra argument and an unknown state came back as `isError` results naming what to fix.
  `delete_invoice` and `send_invoice` were refused by the Inspector itself after `tools/list`, and
  when replayed at the server directly they got the protocol's `-32602` "Tool not found".
- One SDK client connection made a call and saw two clients. The token was then revoked in the
  database, and the next call on the same connection got 401. The REST API refused the same token
  with 401.
- A foreign `Origin` with a valid token got 403. The instance's own `Origin` passed through to token
  authentication. `/.well-known/oauth-protected-resource`, its path-suffixed form and the
  authorization server metadata path all answer 404. No Protected Resource Metadata document is
  served, by design, since no OAuth flow exists to announce.
- The Inspector's rapid invocations tripped the 60-per-minute token limit: one 429, and one
  `auth.rate_limit.tripped` row naming the route and the token's id.
- The session left 11 `mcp.tool.called` rows, one per admitted call. Each names the creator's role,
  the token's id, the tool, the arguments with the search reduced to `"searched": true`, the outcome
  and a row count. None holds a returned record.

The switch was turned on and the token revoked by writing the database rather than through
`/settings/mcp` and `/settings/api`, because driving those pages needs a signed-in session with
TOTP. Both actions are covered by `features/settings/mcp/__tests__/mutations.integration.test.ts`
and the existing API token tests. Claude Code was not connected, because adding a server edits the
owner's own client configuration. No hosted assistant was tried. A `component-reviewer` agent was
not available in the environment the work ran in, and no substitute reviewer was run.

## Known gaps

- A hosted assistant that connects only through the specification's OAuth flow cannot connect.
  Clients that take a server address and a bearer header can.
- No Protected Resource Metadata document is served. A client that discovers authorization from one
  is told nothing and must be configured with the header by hand.
- A model reading free text through these tools can still be steered by it into the other tools its
  client holds, such as a web fetch or a mail sender. Remit's instructions ask the model to treat
  stored text as data but cannot make it.
- The tools reach only the five resources the API publishes, so no report, proposal, contract,
  payment or credit note is readable. "Revenue by month" is answered by adding up invoices, not by
  the reports feature.
- An invoice in a result carries its stored status. Overdue and partially paid exist as filters
  only, so an assistant has to filter for them or compare the due date and the amounts itself. The
  REST API has the same response shape.
- `@modelcontextprotocol/server` 2.0.0 was two days old when it was adopted.
- The SDK answers a foreign `Origin` with the `-32000` code the 2026-07-28 revision marks as legacy.
  Every refusal Remit writes itself carries the HTTP status as its code.
- `server/discover` advertises `tools.listChanged`, while `subscriptions/listen` is refused with
  `-32603` "Subscription limit reached", because no stream is kept open. The Inspector tolerates
  this; a client that insisted on a subscription would see an internal error.
- A one-shot client spends about four requests per tool call on discovery, the refused subscription
  and the tool list. The 60-per-minute token limit therefore allows around fifteen such invocations
  a minute. A client that keeps its connection spends one request per call.
- A call refused for its arguments, or naming a tool that does not exist, writes no audit row. It
  reads nothing, but a probing assistant leaves no trace beyond the instance log.
- Every admitted call is one row in the insert-only `audit_logs`, which grows with assistant use and
  is never pruned.
- `ProposalForm.test.tsx`, `RegisterForm.test.tsx`, `ChangePasswordForm.test.tsx`,
  `PropertyPanel.test.tsx`, `install.test.ts`, `sanitization.test.ts` and `destination.test.ts` time
  out under load or coverage instrumentation, as before this change.
