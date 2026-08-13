"use server"

import { revalidatePath } from "next/cache"

import { headers } from "next/headers"

import { eq, inArray } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"
import { getCurrentRole, type Role } from "@/lib/auth/session"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { getIpAddress } from "@/lib/utils"

import { enqueueJob } from "@/lib/jobs"

import { database } from "@/database"
import { clients, dataExports } from "@/database/schema"

import { requestDataExportSchema, type DataExportScope } from "./schemas"
import { ACTIVE_DATA_EXPORT_STATUSES } from "./services"

type DataExportContext = {
  userId: string
  role: Role
  ipAddress: string | null
  userAgent: string | null
}

type DataExportGate = { context: DataExportContext } | { error: string }

type RequestDataExportResult = { data: { exportId: string } } | { error: string }

const dataPath = "/settings/data"

export async function requestDataExport(input: unknown): Promise<RequestDataExportResult> {
  const gate = await requireDataExportWrite()

  if ("error" in gate) return gate

  const parsed = requestDataExportSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate
  const { scope, clientId } = parsed.data

  if (clientId && !(await clientExists(clientId))) {
    return { error: t("settings.data.errors.clientNotFound") }
  }

  // Re-derived here rather than trusted from the page: the form's disabled state was computed when the
  // page rendered, and a second tab or a second owner session can have queued an export since. Two
  // concurrent assemblies would read the same tables twice for no gain and race each other's storage
  // write.
  if (await hasActiveDataExport()) {
    return { error: t("settings.data.errors.alreadyRunning") }
  }

  try {
    const [row] = await database
      .insert(dataExports)
      .values({
        scope,
        clientId: scope === "client" ? clientId : null,
        requestedByUserId: context.userId
      })
      .returning({ id: dataExports.id })

    if (!row) return { error: t("settings.data.errors.requestFailed") }

    // Written before the archive exists, not after it is downloaded: the auditable event is that an
    // owner asked for the instance's books to be packaged, and that has already happened by this
    // point. The worker writes a second entry when the archive lands.
    await writeDataExportRequestAudit(context, row.id, scope, clientId)

    // A deterministic job id so a double submit collapses onto the queued job. It is not the guard —
    // BullMQ frees the id once the job completes — the handler's conditional claim on
    // `status = 'pending'` is (see `jobs.ts`).
    //
    // Dot-separated, never colon-separated: BullMQ rejects a custom id containing `:` (it is the
    // separator in its own Redis keys), and `enqueueJob` swallows that rejection into a log line, so a
    // colon here would leave every export queued in the database and never picked up.
    await enqueueJob(
      "data_export.assemble",
      { exportId: row.id },
      { jobId: `data_export.assemble.${row.id}` }
    )

    revalidatePath(dataPath)

    return { data: { exportId: row.id } }
  } catch (error) {
    logger.error(
      { action: "requestDataExport", userId: context.userId, scope, err: error },
      "Data export request failed"
    )

    return { error: t("settings.data.errors.requestFailed") }
  }
}

// Owner-only, and the same cut as the page's own `requireRole("owner")`: an instance export is every
// business record in one file, and the accountant role that may read the books through the app has no
// reason to be able to walk out with all of them. Registered in `doctor.config.ts` so react-doctor
// recognises this action as guarded.
async function requireDataExportWrite(): Promise<DataExportGate> {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({ headers: requestHeaders })

  if (!session) return { error: t("errors.unauthorized") }

  const role = await getCurrentRole({ headers: requestHeaders, userId: session.user.id })

  if (role !== "owner") return { error: t("errors.forbidden") }

  return {
    context: {
      userId: session.user.id,
      role,
      ipAddress: getIpAddress(requestHeaders),
      userAgent: requestHeaders.get("user-agent")
    }
  }
}

async function clientExists(clientId: string): Promise<boolean> {
  const client = await database.query.clients.findFirst({
    columns: { id: true },
    where: eq(clients.id, clientId)
  })

  return Boolean(client)
}

async function hasActiveDataExport(): Promise<boolean> {
  const active = await database.query.dataExports.findFirst({
    columns: { id: true },
    where: inArray(dataExports.status, [...ACTIVE_DATA_EXPORT_STATUSES])
  })

  return Boolean(active)
}

async function writeDataExportRequestAudit(
  context: DataExportContext,
  exportId: string,
  scope: DataExportScope,
  clientId: string | null
): Promise<void> {
  await writeAudit("data_export.requested", {
    actorUserId: context.userId,
    actorRole: context.role,
    // A client-scoped export is an event about that client — it is what a later portability or
    // offboarding question is asked about — so the client is the target and the export id travels in
    // metadata. An instance export has no subject but itself.
    targetEntityType: scope === "client" ? "client" : "data_export",
    targetEntityId: scope === "client" ? clientId : exportId,
    metadata: { exportId, scope, clientId },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent
  })
}
