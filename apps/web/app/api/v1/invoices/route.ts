import { type NextRequest } from "next/server"

import { apiOperations, handleApiListRequest, listApiInvoices } from "@/features/api/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest): Promise<Response> {
  return handleApiListRequest(request, apiOperations.listInvoices, listApiInvoices)
}
