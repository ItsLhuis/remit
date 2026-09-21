// The only tool argument that carries free text. `__tests__/tools.test.ts` walks every tool's input
// schema and fails when a string argument that is not an id, a day or an enum appears under any
// other name, so a new free-text argument cannot reach the audit trail by being overlooked here.
export const FREE_TEXT_TOOL_ARGUMENTS = ["search"] as const

// What an audit entry records about a tool call's arguments. `audit_logs` is insert-only and
// survives a client's erasure, which promises to leave "no personal detail" behind, so a search the
// assistant typed — usually a client's name — is recorded only as having been made. Everything else
// a tool accepts is an id, a day, a flag, a page or an enum value, none of which is what the
// assistant read.
export function toAuditArguments(
  input: Readonly<Record<string, unknown>>
): Record<string, unknown> {
  const recorded: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue

    if (isFreeTextArgument(key)) {
      recorded.searched = true

      continue
    }

    recorded[key] = value
  }

  return recorded
}

function isFreeTextArgument(key: string): boolean {
  return (FREE_TEXT_TOOL_ARGUMENTS as readonly string[]).includes(key)
}
