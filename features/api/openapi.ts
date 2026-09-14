import { createDocument } from "zod-openapi"

import pkg from "@/package.json"

import { apiOperations, type ApiOperation } from "./operations"
import { apiErrorSchema } from "./responseSchemas"
import { apiListParamsSchema, apiResourceIdSchema } from "./schemas"

type OpenApiDocument = ReturnType<typeof createDocument>

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
  const errorResponse = (description: string) => ({
    description,
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
        content: { "application/json": { schema: operation.response } }
      },
      ...(operation.kind === "list"
        ? { "400": errorResponse("A query parameter is invalid or not supported") }
        : {}),
      "401": errorResponse(
        "The token is missing, unknown, revoked, expired, or lacks the scope for this resource"
      ),
      ...(operation.kind === "item" ? { "404": errorResponse("No such record") } : {}),
      "429": errorResponse("Rate limit exceeded"),
      "500": errorResponse("Unexpected failure")
    }
  }
}
