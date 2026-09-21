import { API_RESOURCES, type ApiResource, type ApiTokenScope } from "../schemas"

export type ApiTokenRole = "owner" | "accountant" | "assistant"

export type ApiTokenAccessInput = {
  // Null for a route that needs a valid token but no particular scope — the API's own OpenAPI
  // document, which describes every resource and reads none.
  resource: ApiResource | null
  scopes: readonly ApiTokenScope[]
  creatorRole: string | null
  revokedAt: Date | null
  expiresAt: Date | null
  now: Date
}

export type ApiTokenRefusal =
  | "revoked"
  | "expired"
  | "no_creator"
  | "role_forbidden"
  | "scope_missing"

export type ApiTokenAccess =
  | { allowed: true; role: ApiTokenRole }
  | { allowed: false; reason: ApiTokenRefusal }

// What each role may read through the application, restated for the API. ARCHITECTURE.md's role
// table grants every role read access to every entity, so today the three rows are identical; the
// table exists so that narrowing a role in the application is one edit here rather than a silent
// widening through the API.
const ROLE_READABLE_RESOURCES: Record<ApiTokenRole, readonly ApiResource[]> = {
  owner: ["clients", "projects", "invoices", "time_entries", "expenses"],
  accountant: ["clients", "projects", "invoices", "time_entries", "expenses"],
  assistant: ["clients", "projects", "invoices", "time_entries", "expenses"]
}

export function scopeForResource(resource: ApiResource): ApiTokenScope {
  return `${resource}:read`
}

// A token's effective permission is the intersection of its scopes and its creator's role as it
// stands at the moment of the request, never as it stood when the token was minted. That is the
// whole of the "never more than its creator" guarantee: the role is re-read on every call, so a
// demotion narrows every token that person minted and a removal refuses them all.
export function evaluateApiTokenAccess(input: ApiTokenAccessInput): ApiTokenAccess {
  if (input.revokedAt) return { allowed: false, reason: "revoked" }

  if (input.expiresAt && input.expiresAt.getTime() <= input.now.getTime()) {
    return { allowed: false, reason: "expired" }
  }

  if (!isApiTokenRole(input.creatorRole)) return { allowed: false, reason: "no_creator" }

  if (input.resource === null) return { allowed: true, role: input.creatorRole }

  if (!ROLE_READABLE_RESOURCES[input.creatorRole].includes(input.resource)) {
    return { allowed: false, reason: "role_forbidden" }
  }

  if (!input.scopes.includes(scopeForResource(input.resource))) {
    return { allowed: false, reason: "scope_missing" }
  }

  return { allowed: true, role: input.creatorRole }
}

// Every resource the token may read right now, derived by asking `evaluateApiTokenAccess` once per
// resource rather than by a second rule. The MCP server lists and admits its tools from this set, so
// the two surfaces cannot disagree about what a token reaches: there is one decision, asked twice.
export function readableApiResources(input: Omit<ApiTokenAccessInput, "resource">): ApiResource[] {
  return API_RESOURCES.filter((resource) => evaluateApiTokenAccess({ ...input, resource }).allowed)
}

function isApiTokenRole(value: string | null): value is ApiTokenRole {
  return value === "owner" || value === "accountant" || value === "assistant"
}
