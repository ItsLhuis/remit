"use client"

import { cn } from "@/lib/utils"

import { Card, CardContent, Skeleton } from "@/components/ui"

type DashboardSkeletonCardProps = {
  className?: string
  bodyClassName?: string
}

const DashboardSkeletonCard = ({ className, bodyClassName }: DashboardSkeletonCardProps) => (
  <Card className={className}>
    <CardContent className="flex flex-col gap-3">
      <Skeleton className="h-4 w-32" />
      <Skeleton className={cn("h-40 w-full", bodyClassName)} />
    </CardContent>
  </Card>
)

export { DashboardSkeletonCard }
