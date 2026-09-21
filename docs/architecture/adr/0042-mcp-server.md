# ADR-0042: MCP server — off by default, the API's own tokens over Streamable HTTP, read-only tools

- **Status:** Accepted
- **Date:** 2026-09-19

## Context

The Model Context Protocol lets an AI assistant call a server's tools. A freelancer running Remit
asks their numbers questions — what is outstanding this month, what is unbilled on a project, which
clients have not been invoiced since March — and answers them by clicking through screens. The
public API ([ADR-0038](0038-public-api-scope-and-tokens.md)) answers a program that already knows
which endpoint to call; it does not answer a model deciding which question to ask.

This is the first Remit feature that hands business data to a language model, and it is in direct
tension with README's first principle: data covered by an NDA never has to leave the operator's
infrastructure. [ADR-0018](0018-no-telemetry.md) is not violated — the operator connects the
assistant — but the consent question is sharper, not softer.

The specification was verified rather than remembered. The current revision is **2026-07-28**, which
replaced 2025-11-25 during the planning of this work, and it changed the transport:

- Streamable HTTP is one endpoint that accepts POST. Every request carries its own protocol version
  and client capabilities; there is no session, no `initialize` handshake and no GET stream. A
  client written for 2025-11-25 or earlier still opens with `initialize`, and a server that wants to
  serve it answers that era statelessly.
- Servers **MUST** validate the `Origin` header on every connection and answer an `Origin` that is
  present and invalid with **403**, against DNS rebinding.
- Authorization is **OPTIONAL**. An HTTP implementation that supports it **SHOULD** follow the OAuth
  2.1 chapter — Protected Resource Metadata, an authorization server, Resource Indicators — and
  "clients and servers **MAY** negotiate their own custom authentication and authorization
  strategies". The Protected Resource Metadata **MUST** is a requirement inside that chapter, not on
  every HTTP server.
- Tools are model-controlled, resources application-controlled and prompts user-controlled. A server
  may return a different tool list for different credentials. Unknown tools are protocol errors;
  invalid arguments are tool results the model can correct. Servers **MUST** validate inputs,
  control access, rate-limit and sanitise outputs.

[ADR-0013](0013-better-auth-organization.md) makes Better Auth the owner of identity. The installed
Better Auth (1.6) can act as an OAuth 2.1 authorization server only through its in-core `mcp` and
`oidcProvider` plugins, which the next minor removes, or the separate `@better-auth/oauth-provider`
package with the JWT plugin, a login and consent page and its own client, token and consent tables.

## Decision

### The privacy position

**What leaves the instance, and to whom.** With the server on and an assistant connected through an
API token, every tool call returns business records to that assistant: client names, email
addresses, phone numbers, tax ids, postal addresses and outstanding balances; projects with their
budgets, rates and descriptions; invoices with their amounts, dates, notes and line items; time
entries and expenses with their descriptions and amounts. Remit hands that answer to the MCP client
holding the token and to nobody else. The client then sends it to the language model it runs against
— for a hosted assistant, a third party's servers, under that party's terms, where it may be logged,
retained or reviewed. Remit cannot see that second hop, cannot limit it and cannot recall anything
that crossed it. A result has left the operator's infrastructure the moment it is returned.

**What never leaves, whatever the token's scopes.**

- `clients.notes`. It is encrypted at rest because it may carry content covered by an NDA; it is the
  one field whose exposure would turn a convenience into a breach of confidence, and nothing an
  assistant is asked makes it necessary.
- Every public bearer token and path — invoice, proposal and contract links and the client portal
  token. Each is a live route into the instance that needs no account; a model holding one could
  hand a client's documents to anyone.
- Every `encryptedColumn()` value — provider credentials, the IBAN, webhook and backup secrets. They
  are configuration rather than business records, and no tool reads the tables that hold them.
- Session, credential and API-token material, including the token the assistant itself presents.
- `audit_logs`. It records who did what and from where; it is the instance's security record, not
  business data.
- Internal storage keys. A tool reports whether an expense has a receipt, never where the file is.
- Records in the trash. The tools read live records only, as the API and the screens do by default.
- Everything the public API does not publish: proposals, contracts, payments and credit notes as
  records of their own, leads, tasks, contacts, attachments, templates, settings, team, reports and
  the activity feed.

**The harder cases.** A client's postal address, phone and email; invoice notes and line-item
descriptions; project, time-entry and expense descriptions. These are what make an assistant worth
connecting — "what did I bill Acme for in March" needs the line items — and they are also what an
NDA can cover. They are exposed on exactly the terms the public API exposes them: under the
resource's read scope and not otherwise. The owner draws the line per token by choosing its scopes;
a token with `invoices:read` alone sees no client address. MCP never adds a field the API does not
publish and never withholds one it does, because a second, MCP-only projection would be a second
exposure vocabulary to keep in step with the first.

**Default state.** Off. `settings.mcp_enabled` defaults to `false`, and the migration that adds it
applies `false` to every existing instance. While it is off, `/api/mcp` answers every request with
404 whether or not a valid token is presented. Turning it on is an owner-only action on
`/settings/mcp`, beneath a statement of what it shares and what Remit cannot control; turning it off
takes effect on the next request. Turning it on creates no credential: a connection still needs an
API token the owner minted, with scopes the owner chose, and revoking that token ends the connection
on its next call.

**Whether this changes what Remit is.** It does not make any bullet of "What Remit is not" untrue:
the server is a read surface over the five resources the API already serves, not a team tool, a
marketplace, an accounting system, a project manager or a contact manager. It changes what the data
residency statement must say, which described outbound traffic only: with the server on, records
leave in answers to a connected assistant and then leave the operator's control. The principle stays
true — nothing in Remit requires the server, it ships off, and the one field designated for
NDA-covered content never passes through it.

### Transport: Streamable HTTP at `/api/mcp`, served by the application

The endpoint is a route in the application, built on the official TypeScript SDK's per-request
handler (`@modelcontextprotocol/server` 2.0), which serves 2026-07-28 requests and answers 2025-era
clients statelessly from the same tool definitions. It keeps no session, opens no subscription
stream (`maxSubscriptions: 0`) and answers GET and DELETE with 405. One JSON-RPC message per
request; a 2025-era batch is refused, because each call has to be admitted for its own resource.

Before anything else, a present `Origin` whose host is not `REMIT_PUBLIC_URL`'s is refused with 403.
A request without `Origin` passes: MCP clients are not browsers, and a DNS-rebinding page always
runs in one. A browser page on the right host still needs the bearer token, and the route answers no
CORS preflight.

A hosted assistant that can only connect through the specification's OAuth flow cannot connect. A
client that takes a server address and a bearer header — Claude Code, the MCP Inspector, and any
client configured with a header — can.

### Authorization: the API's tokens, admitted the API's way

There is one credential and one decision, shared with the public API:

- A connection presents an ADR-0038 API token as `Authorization: Bearer`, the custom strategy the
  specification permits. No OAuth layer exists, and no Protected Resource Metadata document is
  served: one naming no authorization server would announce a flow that does not exist.
- Every request is admitted by `features/api/authenticate.ts`'s `authenticateApiRequest`, the
  function every REST route calls. A `tools/call` is admitted against the called tool's resource,
  exactly as the matching REST route is; everything else against no resource. So a token lacking the
  scope, an unknown token, a revoked or expired one and one whose creator lost their membership all
  meet the same 401, and nothing is cached between two requests.
- The tool list is `readableApiResources` — the same `evaluateApiTokenAccess` decision asked once
  per resource — and the per-request server registers only those tools, a second enforcement that
  does not depend on the first.
- Each tool is the MCP face of one REST operation: it takes that operation's resource, and so its
  scope, and parses its result through that operation's response schema. A token therefore reads the
  same records and the same fields through either surface.
- Rate limits: 300 requests per IP per minute ahead of any database read, then 60 per token per
  minute, half the REST limit, because a model in a loop calls far faster than a person clicks.
- Remit's role gates are not involved beyond the creator's role that ADR-0038 already intersects
  with the scopes: the tools write nothing, so no `require*` gate has anything to decide.

### The surface: eight read tools, no resources, no prompts

`list_clients`, `get_client`, `list_projects`, `get_project`, `list_invoices`, `get_invoice`,
`list_time_entries` and `list_expenses`. The list tools accept the screens' own filters — a search,
states, a client or project, a range of calendar days, and billed or unbilled — and never the
screens' trash selector. Every question an assistant answers is a parameterised read, which is what
a tool is; resources would wait for the client application to decide to attach them, and prompts
would be product copy nobody has asked for.

Money stays integer minor units beside an explicit currency and instants stay ISO 8601 in UTC,
because the response schemas are the API's. The server's instructions tell the model how to read
both, and that names, descriptions, notes and line items are data typed by people, never
instructions.

### No write tools

A token may never do more through MCP than through the public API, and the API writes nothing, so a
write tool is excluded by that rule before any other argument. The other argument stands on its own:
a model that has just read free text — an invoice note, a description pasted from a client's email —
can be instructed by that text, and a write it could reach would be the injected instruction's
reach. With no writes, the worst a confused or manipulated model can do through Remit is read what
its token already allows.

### Audit and visibility

Every tool call writes one `mcp.tool.called` entry: the token's creator and role, the token's id,
the tool, its arguments with any search reduced to "a search was made", whether it returned, found
nothing or failed, and how many records it returned — never the records. A search is not recorded
because `audit_logs` survives a client's erasure, which promises to leave no personal detail behind,
and a search is usually a client's name. `/settings/mcp` lists the latest calls. Switching the
server is audited as `settings.mcp.updated`.

### Hosted mode

The switch is available on a hosted instance and belongs to the owner. `REMIT_HOSTED_MODE` marks
infrastructure an operator runs on the owner's behalf; whether the owner's business records may be
read by the owner's assistant is the owner's decision, not the infrastructure's.

## Consequences

### Positive

- One credential model, one admission function and one response boundary serve both the API and the
  assistant, so a change to either reaches both, and a revocation or a demotion stops both at once.
- The consent is recorded where it is taken, in words, and stays on the page while the server is on.
- A tool can publish nothing the API does not already publish, by construction rather than by
  review.

### Negative

- Hosted assistants that only speak the specification's OAuth flow cannot connect.
- Tokens are static bearer credentials in a client's configuration file; they last until they expire
  or are revoked, and a client that leaks its configuration leaks read access.
- A read-only server still feeds untrusted text to a model that may hold other tools in the same
  client — a web fetch, a mail sender. Remit cannot see or limit those, and its instructions ask the
  model to treat stored text as data but cannot make it.
- The tools can answer only what the five API resources hold. "Revenue by month" is not a report the
  assistant can read; it can only add up invoices.
- Every call is an audit row. The table is insert-only and grows with assistant use.
- The SDK's 2.0 line was two days old when it was adopted, and the protocol has replaced its HTTP
  transport twice since the start of 2025.

## Alternatives considered

### stdio

A process the client spawns, holding a token in a local configuration file, with the operating
system as the authorization boundary. Rejected. It is a second artefact to build, version against
the instance and distribute, and it can reach Remit only two ways: through the public API, whose v1
refuses every filter, so answering "what is overdue" would mean paging whole collections into the
process; or through a database connection, which would re-make every authorization decision outside
the application and put database credentials in a desktop configuration file. It would also serve no
client the HTTP endpoint does not.

### Streamable HTTP with the specification's OAuth, Better Auth as the authorization server

Rejected for now. The in-core plugins are on their way out of Better Auth, and the maintained
package adds a JWT key set, login and consent pages, client registration and its own token, refresh
and consent tables. Its access tokens would be a second credential model beside ADR-0038's, with
their own scopes, lifetimes and revocation — two permission sets to keep identical, which is the
failure this decision exists to avoid. The authorization chapter also changed in 2026-07-28 (issuer
validation, client metadata documents over dynamic registration). An OAuth layer can be added later
in front of the same token model, for example by having the grant mint an API token.

### An MCP-specific token, or an MCP opt-in flag on each API token

Rejected: a second credential or a second flag is a second place the answer to "what can this
assistant read" lives. The instance switch is the consent; the token's scopes are the extent.

### A narrower projection than the API's

Withholding addresses, emails or line items from MCP while the API publishes them was rejected: the
owner already controls exactly this through scopes, and a second exposure vocabulary would have to
be kept in step with the first forever.

### Draft-only write tools

Creating a draft invoice is the compelling demonstration. Rejected: the API writes nothing, so a
token would do more through MCP than through the API, and a write reachable by a model that has just
read attacker-influenced text is a real injection path. Drafts can follow API writes, not precede
them.

### Answering every refusal with 404, as `/api/metrics` does

Rejected. A client with a mistyped token would be told the server does not exist and would fall back
to the deprecated transport. A 404 while the switch is off and a 401 for a refused token when it is
on tell an anonymous prober only that the server is on — and the API's existence is already
discoverable on every instance.

### The SDK's 1.x line, or no SDK

1.30 predates 2026-07-28 and would serve only the 2025 era. A hand-written JSON-RPC server was
rejected because two protocol eras, their negotiation and their error shapes are exactly what an SDK
exists to own; the SDK is used below the admission layer and never decides who may call what.
