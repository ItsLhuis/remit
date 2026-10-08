import { type NextRequest } from "next/server"

// A malformed body becomes `null` rather than a thrown parse error, so it falls through to the
// same Zod rejection as a well-formed body with the wrong fields.
export async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}
