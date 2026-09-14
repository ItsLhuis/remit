import { type NextRequest } from "next/server"

import { apiOperations, getApiInvoice, handleApiItemRequest } from "@/features/api/server"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params

  return handleApiItemRequest(request, id, apiOperations.getInvoice, getApiInvoice)
}
