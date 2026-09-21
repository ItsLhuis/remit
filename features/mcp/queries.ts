import { database } from "@/database"

// Read on every request with nothing cached in between, which is what makes switching the server off
// take effect on the assistant's very next call.
export async function isMcpEnabled(): Promise<boolean> {
  const settingsRow = await database.query.settings.findFirst({ columns: { mcpEnabled: true } })

  return settingsRow?.mcpEnabled ?? false
}
