import { Suspense } from "react"

import { type Metadata } from "next"

import { t } from "@/lib/i18n/server"

import { DashboardShell, DashboardSkeleton } from "@/features/dashboard"

import { DashboardBackupBanner } from "./DashboardBackupBanner"
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
//
// The backup banner is the exception and has its own boundary with no fallback: it reads one
// settings row rather than an aggregate, and it must not be held behind the money figures — it is
// the surface that says an instance has no recent archive.
const DashboardRoute = ({ searchParams }: DashboardRouteProps) => {
  return (
    <DashboardShell>
      <div className="flex flex-col gap-6 md:gap-8">
        <Suspense fallback={null}>
          <DashboardBackupBanner />
        </Suspense>
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardContent searchParams={searchParams} />
        </Suspense>
      </div>
    </DashboardShell>
  )
}

export default DashboardRoute
