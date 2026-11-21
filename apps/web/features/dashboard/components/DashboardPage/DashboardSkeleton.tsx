"use client"

import { useTranslation } from "@/lib/i18n"

import { Card, CardContent, Skeleton } from "@/components/ui"

import { DashboardSkeletonCard } from "./DashboardSkeletonCard"

const METRIC_TILE_COUNT = 4

// Shaped like the page it replaces, tier for tier, so nothing moves when the data lands: the same
// grid, the same column spans, the same card heights. A spinner here would cost the page a layout
// shift at exactly the moment the reader starts looking at it.
const DashboardSkeleton = () => {
  const { t } = useTranslation()

  return (
    <div
      className="flex flex-col gap-6 md:gap-8"
      aria-busy="true"
      aria-label={t("dashboard.loading")}
    >
      <DashboardSkeletonCard bodyClassName="h-28" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: METRIC_TILE_COUNT }, (_, index) => (
          <Card key={index} size="sm" className="min-w-0">
            <CardContent className="flex flex-col gap-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-3 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <DashboardSkeletonCard className="lg:col-span-2" bodyClassName="h-64" />
        <DashboardSkeletonCard bodyClassName="h-64" />
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-5">
        <DashboardSkeletonCard className="lg:col-span-3" bodyClassName="h-56" />
        <DashboardSkeletonCard className="lg:col-span-2" bodyClassName="h-56" />
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <DashboardSkeletonCard bodyClassName="h-48" />
        <DashboardSkeletonCard bodyClassName="h-48" />
      </div>
    </div>
  )
}

export { DashboardSkeleton }
