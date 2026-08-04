---
paths:
  - "features/**/queries.ts"
---

# Query Rules

Read operations live in `features/<feature>/queries.ts`. Queries are the read-path counterpart to
the server actions in `actions.md`: thin, server-only orchestrators that read through Drizzle and
hand the result to pure services for any calculation. The canonical exemplar is
`features/clients/queries.ts`.

## Server-only

`queries.ts` is server-only. It imports `@/database` and may import another feature's server barrel
(`@/features/<feature>/server`), so it is never re-exported from a client-safe `index.ts`. Expose a
query to other features through `server.ts`, never `index.ts` (see `architecture.md`).

## Public shape

Export reads as named `async function` declarations that return a typed read model. Reads do not use
the `{ data } | { error }` action shape and never throw expected "not found" states to the caller.

- A read of one record returns `T | null`.
- A read of a collection returns `T[]`, or a `{ rows, rowCount }` page object when paginated.
- A computed page or read model returns its named type (`ClientListPageData`, `ClientDetail`).

```ts
export async function getClientDetail(input: unknown): Promise<ClientDetail | null> {
  const parsed = clientIdSchema.safeParse(input)

  if (!parsed.success) return null

  const client = await database.query.clients.findFirst({
    where: and(eq(clients.id, parsed.data.id), isNull(clients.deletedAt))
  })

  if (!client) return null

  return toClientDetail(client)
}
```

## Validate untrusted input

When a query receives `unknown` (route params, search params, a client-passed id), validate it with
the feature's Zod schema using `safeParse` and return the empty result (`null` or `[]`) on failure.
Internal callers that already hold a typed value may pass it directly.

## Parallelize independent reads

Run independent reads concurrently with `Promise.all` rather than awaiting them in series.

```ts
const [list, filterOptions, summary] = await Promise.all([
  listClients(query, defaults.defaultCurrency),
  getClientFilterOptions(),
  getClientsSummary(defaults.defaultCurrency)
])
```

## Delegate logic to services

Queries build SQL and shape rows; they do not contain business rules. Health scoring, summaries,
trend bucketing, and similar logic live in pure functions under `services/` and receive plain rows
as arguments (see `architecture.md`). Filtering, sorting, and pagination are query concerns: keep
the `where`-clause and `order-by` builders as file-private helpers in `queries.ts`, below the public
reads (the `.ts` helper-below convention in `code-style.md`).

## Row mapping and money

Convert `bigint` money columns to `number` at the query boundary with `Number(...)`; services and
the UI work in integer cents (see `money-and-dates.md`). Map database rows to read models with small
`to<Model>` functions, applying `?? defaultCurrency` and `?? ""` fallbacks there rather than in the
component.

## Naming

Use `get` for a single record or a computed read model and `list` for collections, matching the
feature's existing names: `getClientDetail`, `getClientsPageData`, `listClients`,
`listClientOptions`.

## Comments

Three things a read cannot say for itself: soft-delete visibility that deliberately differs from a
sibling read, a status derived in SQL that a badge elsewhere must agree with, and an encrypted
column reaching a client-bound read model rather than staying inside a server-only adapter. The last
is the easiest to miss, because the column reads as ordinary here. See [comments.md](comments.md)
("Where comments belong").
