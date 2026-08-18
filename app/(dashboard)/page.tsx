import { Suspense } from "react"

import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { DashboardShell, DashboardSkeleton } from "@/features/dashboard"

import { DashboardContent } from "./DashboardContent"

export const metadata: Metadata = {
  title: t("app.metadata.dashboardTitle")
}

type DashboardRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

// The shell paints in the first response so the title and the period control are usable before any
// aggregate has been read; the body streams in behind one boundary with a skeleton shaped like the
// page it replaces. Splitting the reads into several boundaries was rejected: they are independent
// and issued together, so a second boundary would buy a round trip's worth of nothing.
const DashboardRoute = ({ searchParams }: DashboardRouteProps) => {
  return (
    <DashboardShell>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent searchParams={searchParams} />
      </Suspense>
    </DashboardShell>
  )
}

export default DashboardRoute
