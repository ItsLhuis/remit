import { type NextRequest } from "next/server"

import { apiOperations, handleApiListRequest, listApiProjects } from "@/features/api/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest): Promise<Response> {
  return handleApiListRequest(request, apiOperations.listProjects, listApiProjects)
}
