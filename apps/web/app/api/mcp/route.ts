import { handleMcpRequest } from "@/features/mcp/server"

export const dynamic = "force-dynamic"

export async function POST(request: Request): Promise<Response> {
  return handleMcpRequest(request)
}

// GET and DELETE were the 2025-era stream and session operations. They pass through the same
// Origin, switch and token checks as a POST, and the SDK then answers them with 405: this endpoint
// keeps no session and opens no stream.
export async function GET(request: Request): Promise<Response> {
  return handleMcpRequest(request)
}

export async function DELETE(request: Request): Promise<Response> {
  return handleMcpRequest(request)
}
