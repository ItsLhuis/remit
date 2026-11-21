import { createDocument } from "zod-openapi"

import pkg from "@/package.json"

import { apiOperations, type ApiOperation } from "./operations"
import { apiErrorSchema } from "./responseSchemas"
import { apiListParamsSchema, apiResourceIdSchema } from "./schemas"

type OpenApiDocument = ReturnType<typeof createDocument>

// What `handleApiRequest.ts` sends once a token is admitted: every answer after admission describes
// the token's own limit, and a refusal adds when to retry. A `401` and the per-address backstop's
// `429` come before any token is known and carry none of these.
const RATE_LIMIT_HEADERS = {
  "RateLimit-Policy": {
    description: 'The quota per window of the token used, as `"token";q=<requests>;w=<seconds>`',
    schema: { type: "string" as const }
  },
  RateLimit: {
    description:
      'What remains of the quota and the seconds until it resets, as `"token";r=<requests>;t=<seconds>`',
    schema: { type: "string" as const }
  }
}

const RETRY_AFTER_HEADER = {
  "Retry-After": {
    description: "Seconds until the token's window resets, sent with a token's 429",
    schema: { type: "integer" as const }
  }
}

let cachedDocument: OpenApiDocument | null = null

// Generated from `operations.ts` and the very schemas the routes parse with — the request params in
// `schemas.ts` and the response boundary in `responseSchemas.ts` — so the document cannot promise a
// field the boundary strips or omit one it lets through. Localised validation messages do not appear
// in the output: zod-openapi emits structure, not error text, which is why the same schemas can
// carry translated messages and still produce one stable document.
//
// Built once per process: the input is static, and a document request should not pay for walking
// every schema again.
export function getOpenApiDocument(): OpenApiDocument {
  cachedDocument ??= buildOpenApiDocument()

  return cachedDocument
}

function buildOpenApiDocument(): OpenApiDocument {
  const operations: ApiOperation[] = Object.values(apiOperations)

  return createDocument({
    openapi: "3.1.0",
    info: {
      title: "Remit API",
      version: pkg.version,
      license: { name: "MIT", identifier: "MIT" },
      description:
        "Read-only access to one Remit instance. Every request carries `Authorization: Bearer <token>` with a token minted in Settings → API. Money is integer minor units of the record's currency; instants are ISO 8601 in UTC."
    },
    servers: [{ url: "/" }],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer" }
      }
    },
    paths: Object.fromEntries(
      operations.map((operation) => [operation.path, { get: toOperationObject(operation) }])
    )
  })
}

function toOperationObject(operation: ApiOperation) {
  const errorResponse = (description: string, headers = {}) => ({
    description,
    headers,
    content: { "application/json": { schema: apiErrorSchema } }
  })

  return {
    operationId: operation.operationId,
    summary: operation.summary,
    ...(operation.kind === "list" ? { requestParams: { query: apiListParamsSchema } } : {}),
    ...(operation.kind === "item" ? { requestParams: { path: apiResourceIdSchema } } : {}),
    responses: {
      "200": {
        description: "OK",
        headers: RATE_LIMIT_HEADERS,
        content: { "application/json": { schema: operation.response } }
      },
      ...(operation.kind === "list"
        ? {
            "400": errorResponse(
              "A query parameter is invalid or not supported",
              RATE_LIMIT_HEADERS
            )
          }
        : {}),
      "401": errorResponse(
        "The token is missing, unknown, revoked, expired, or lacks the scope for this resource"
      ),
      ...(operation.kind === "item"
        ? { "404": errorResponse("No such record", RATE_LIMIT_HEADERS) }
        : {}),
      "429": errorResponse(
        "Rate limit exceeded. The token's limit carries the rate-limit headers and Retry-After; the per-address limit, reached before the token is read, carries none",
        { ...RATE_LIMIT_HEADERS, ...RETRY_AFTER_HEADER }
      ),
      "500": errorResponse("Unexpected failure", RATE_LIMIT_HEADERS)
    }
  }
}
