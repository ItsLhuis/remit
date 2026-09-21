import { z } from "zod"

const toolCallEnvelopeSchema = z.object({
  method: z.literal("tools/call"),
  params: z.object({ name: z.string() })
})

// The tool a JSON-RPC body asks to call, or null for any other message. Read before the MCP SDK
// sees the body so the request can be authenticated against that tool's resource, exactly as a
// REST route is against its own — which is what makes a token that lacks the scope answer with the
// same refusal as an unknown token rather than with a tool error that confirms the token is real.
// Anything unparseable is not a tool call here; the SDK answers it with the protocol's own error.
export function readCalledToolName(body: unknown): string | null {
  const parsed = toolCallEnvelopeSchema.safeParse(body)

  return parsed.success ? parsed.data.params.name : null
}
