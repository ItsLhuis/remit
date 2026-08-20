import { eq } from "drizzle-orm"

import { projects } from "@/database/schema"

import { database } from "@/tests/integration/database"

// Every dual-parent table carries `chk_<table>_project_requires_client` and the composite
// `fk_<table>_project_client`, so a fixture that names a project must also name that project's own
// client. This is the factories' half of the denormalisation the mutations perform; without it,
// `makeInvoice({ projectId })` would fail the check rather than build a project-level invoice.
export async function resolveProjectClientId(
  projectId: string | null | undefined,
  clientId: string | null | undefined
): Promise<string | null> {
  if (clientId) return clientId
  if (!projectId) return null

  const project = await database.query.projects.findFirst({
    columns: { clientId: true },
    where: eq(projects.id, projectId)
  })

  return project?.clientId ?? null
}
