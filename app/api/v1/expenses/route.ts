import { type NextRequest } from "next/server"

import { apiOperations, handleApiListRequest, listApiExpenses } from "@/features/api/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest): Promise<Response> {
  return handleApiListRequest(request, apiOperations.listExpenses, listApiExpenses)
}
