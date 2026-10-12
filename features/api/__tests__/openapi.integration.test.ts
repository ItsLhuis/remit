import { readdirSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

import { expect, test } from "vitest"

import { apiTokenScope } from "@/database/schema"

import { getOpenApiDocument } from "../openapi"
import { API_TOKEN_SCOPES } from "../schemas"

// Runs in the integration project only because the response schemas read their enum values from
// `@/database/schema`, which validates the environment at import. Nothing here touches a database.

const routeRoot = fileURLToPath(new URL("../../../app/api/v1", import.meta.url))

function listRoutePaths(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)

    if (statSync(path).isDirectory()) return listRoutePaths(path)

    if (entry !== "route.ts") return []

    const segments = relative(routeRoot, directory).split(sep).filter(Boolean)

    return [
      `/api/v1/${segments.map((segment) => segment.replace(/^\[(\w+)\]$/, "{$1}")).join("/")}`
    ]
  })
}

test("documents exactly the route files under app/api/v1, no more and no fewer", () => {
  const documented = Object.keys(getOpenApiDocument().paths ?? {}).sort()

  expect(documented).toEqual(listRoutePaths(routeRoot).sort())
})

test("describes a success and a refusal for every documented operation", () => {
  for (const [path, item] of Object.entries(getOpenApiDocument().paths ?? {})) {
    const responses = item?.get?.responses ?? {}

    expect(Object.keys(responses), path).toEqual(expect.arrayContaining(["200", "401", "429"]))
  }
})

// The header names a documented response declares, or none for a reference or an absent response.
function headerNames(response: unknown): string[] {
  if (typeof response !== "object" || response === null || !("headers" in response)) return []

  return Object.keys(response.headers ?? {})
}

test("documents the rate-limit headers a success and a token's refusal carry", () => {
  for (const [path, item] of Object.entries(getOpenApiDocument().paths ?? {})) {
    const responses = item?.get?.responses ?? {}

    expect(headerNames(responses["200"]), path).toEqual(["RateLimit-Policy", "RateLimit"])
    expect(headerNames(responses["429"]), path).toEqual([
      "RateLimit-Policy",
      "RateLimit",
      "Retry-After"
    ])
  }
})

test("restates the database's token scope enum exactly", () => {
  expect([...API_TOKEN_SCOPES]).toEqual(apiTokenScope.enumValues)
})
