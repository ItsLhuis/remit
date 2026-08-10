"use client"

import Link from "next/link"

import { useTranslation } from "@/lib/i18n"

import {
  ActivityTimeline,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui"

import { useActivityTimelineItems, type ActivityEntry } from "@/features/activityLog"

type RecentActivityCardProps = {
  entries: ActivityEntry[]
  locale: string
  timeZone: string
}

const RecentActivityCard = ({ entries, locale, timeZone }: RecentActivityCardProps) => {
  const { t } = useTranslation()

  const items = useActivityTimelineItems({ entries, locale, timeZone })

  return (
    <Card className="xl:col-span-2">
      <CardHeader>
        <CardTitle>{t("dashboard.activity.title")}</CardTitle>
        <CardDescription>{t("dashboard.activity.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ActivityTimeline
          items={items}
          emptyTitle={t("dashboard.activity.emptyTitle")}
          emptyDescription={t("dashboard.activity.emptyDescription")}
        />
      </CardContent>
      {items.length > 0 ? (
        <CardFooter>
          <Button asChild variant="outline" size="sm">
            <Link href="/activity">{t("dashboard.activity.viewAll")}</Link>
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  )
}

export { RecentActivityCard }
