import { type Metadata } from "next"

import { HealthDashboard, getHealthChecks } from "@/features/health"

import { requireRole } from "@/lib/session"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Health"
}

const AdminHealthPage = async () => {
  await requireRole("owner")

  const checks = await getHealthChecks()

  return <HealthDashboard checks={checks} />
}

export default AdminHealthPage
