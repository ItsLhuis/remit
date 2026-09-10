import { headers } from "next/headers"

import { getCurrentRole, getSession } from "@/lib/auth/session"

import { env } from "@/lib/config/env"

import { database } from "@/database"

import { evaluateBackupBannerState } from "./services"
import { type BackupBanner } from "./types"

// Returns null when there is nothing to say, so the surface renders a banner or renders nothing and
// never has to know the healthy case exists.
//
// Owner-only, matching the write gating on `/settings/backup` and `/settings/system`
// (ARCHITECTURE.md section 10): an accountant or an assistant cannot configure a destination, run a
// backup, or even open the page this banner points at, so warning them describes a risk they have no
// move against. Hosted instances are excluded for the same reason — the destination is the
// operator's there, and `features/settings/backup/mutations.ts` already refuses the edit.
export async function getBackupBanner(): Promise<BackupBanner | null> {
  if (env.REMIT_HOSTED_MODE) return null

  const requestHeaders = await headers()
  const session = await getSession(requestHeaders)

  if (!session) return null

  const role = await getCurrentRole({ headers: requestHeaders, userId: session.user.id })

  if (role !== "owner") return null

  const settingsRow = await database.query.settings.findFirst({
    columns: {
      backupCadence: true,
      backupLastFailureAt: true,
      backupLastFailureReason: true,
      backupLastSuccessAt: true
    }
  })

  if (!settingsRow) return null

  const state = evaluateBackupBannerState({
    cadence: settingsRow.backupCadence,
    lastFailureAt: settingsRow.backupLastFailureAt,
    lastSuccessAt: settingsRow.backupLastSuccessAt,
    now: new Date()
  })

  if (state === "healthy") return null

  return { state, lastFailureReason: settingsRow.backupLastFailureReason }
}
