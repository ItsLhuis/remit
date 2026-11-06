import { type GenericEndpointContext } from "better-auth"

import { type WriteAuditOptions } from "@/lib/audit"

import { getIpAddress } from "@/lib/utils"

// The request metadata of an audit entry written from inside Better Auth's pipeline. The route
// reads the same two values from its own request; here they come from the endpoint context, which
// is what `auth.api.*` callers have.
export function buildAuditContext(
  ctx: GenericEndpointContext,
  userId: string | null
): WriteAuditOptions {
  const headers = ctx.headers ?? ctx.request?.headers

  return {
    ...(userId ? { actorUserId: userId, targetEntityType: "user", targetEntityId: userId } : {}),
    ipAddress: headers ? getIpAddress(headers) : null,
    userAgent: headers?.get("user-agent") ?? null
  }
}
