import { type NextRequest } from "next/server"

import { apiOperations, getOpenApiDocument, handleApiDocumentRequest } from "@/features/api/server"

export const dynamic = "force-dynamic"

// Token-gated like every other `/api/v1/` route rather than public: the document is no secret in an
// open-source codebase, but serving it anonymously would announce to anyone that this particular
// instance has the API reachable.
export async function GET(request: NextRequest): Promise<Response> {
  return handleApiDocumentRequest(request, apiOperations.getOpenApiDocument, getOpenApiDocument)
}
