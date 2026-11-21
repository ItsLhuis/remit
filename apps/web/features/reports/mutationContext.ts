import { headers } from "next/headers"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"
import { getCurrentRole, type Role } from "@/lib/auth/session"

import { getIpAddress } from "@/lib/utils"

// The session and role plumbing the two export paths share, kept beside `mutations.ts` and
// `pdfExport.ts` rather than inside either: a "use server" module may export nothing but async
// functions, so the context and gate types below could not live there.
//
// Reports are read-only, so this is the feature's only gate, and it is the same cut as
// `requireExpenseExport`: a report is the whole book of one dimension in one file, granted to the
// roles that exist to see the books rather than to the assistant role that exists to enter them. The
// PDF is the same disclosure as the CSV in a different container, so it gets the same gate — and the
// download route repeats it, because the artifact outlives the request that asked for it.
export type ReportExportContext = {
  userId: string
  role: Role
  ipAddress: string | null
  userAgent: string | null
}

export type ReportExportGate = { context: ReportExportContext } | { error: string }

export async function requireReportExport(): Promise<ReportExportGate> {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({ headers: requestHeaders })

  if (!session) return { error: t("errors.unauthorized") }

  const role = await getCurrentRole({ headers: requestHeaders, userId: session.user.id })

  if (role !== "owner" && role !== "accountant") return { error: t("errors.forbidden") }

  return {
    context: {
      userId: session.user.id,
      role,
      ipAddress: getIpAddress(requestHeaders),
      userAgent: requestHeaders.get("user-agent")
    }
  }
}
