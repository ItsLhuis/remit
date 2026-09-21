import { type AuthInfo } from "@modelcontextprotocol/server"

import { scopeForResource } from "@/features/api"
import { type ApiRequestContext } from "@/features/api/server"

export type McpSession = ApiRequestContext & {
  ipAddress: string | null
  userAgent: string | null
}

// The SDK carries caller identity to the per-request server factory as an `AuthInfo`, and passes it
// through untouched. The session rides beside it, keyed on that very object, rather than inside its
// untyped `extra`.
const sessions = new WeakMap<AuthInfo, McpSession>()

// `token` holds the token's row id, never the bearer value: nothing inside the SDK needs the secret,
// and the id is what every audit entry already names the credential by.
export function toAuthInfo(session: McpSession): AuthInfo {
  const authInfo: AuthInfo = {
    token: session.tokenId,
    clientId: session.tokenId,
    scopes: session.resources.map(scopeForResource)
  }

  sessions.set(authInfo, session)

  return authInfo
}

export function readMcpSession(authInfo: AuthInfo | undefined): McpSession {
  const session = authInfo ? sessions.get(authInfo) : undefined

  // `handleMcpRequest` authenticates before it hands a request to the SDK and always passes the
  // session, so reaching this line means the two have been wired apart.
  if (!session) throw new Error("MCP request reached the server factory without a session")

  return session
}
