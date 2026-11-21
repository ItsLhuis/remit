"use client"

import { useTranslation } from "@/lib/i18n"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui"

import { type TopClient, type UpcomingInvoice, type UpcomingSchedule } from "../../services"

import { DueSoonList } from "./DueSoonList"
import { SchedulesList } from "./SchedulesList"
import { TopClientsList } from "./TopClientsList"

type DetailTabsCardProps = {
  invoices: UpcomingInvoice[]
  schedules: UpcomingSchedule[]
  clients: TopClient[]
  currency: string
  locale: string
}

// Three lists in one container rather than three cards. They answer the same question from different
// angles — what is coming, and from whom — and the previous page's failure was exactly this: more
// boxes at equal weight. Tabs also mean only the visible list's chart is mounted, so the top-clients
// chart chunk is fetched on intent rather than on load.
const DetailTabsCard = ({
  invoices,
  schedules,
  clients,
  currency,
  locale
}: DetailTabsCardProps) => {
  const { t } = useTranslation()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("dashboard.detail.title")}</CardTitle>
      </CardHeader>
      <CardContent className="min-w-0">
        <Tabs defaultValue="due" className="gap-4">
          <TabsList>
            <TabsTrigger value="due">{t("dashboard.detail.tabs.due")}</TabsTrigger>
            <TabsTrigger value="schedules">{t("dashboard.detail.tabs.schedules")}</TabsTrigger>
            <TabsTrigger value="clients">{t("dashboard.detail.tabs.clients")}</TabsTrigger>
          </TabsList>
          <TabsContent value="due">
            <DueSoonList invoices={invoices} locale={locale} />
          </TabsContent>
          <TabsContent value="schedules">
            <SchedulesList schedules={schedules} locale={locale} />
          </TabsContent>
          <TabsContent value="clients">
            <TopClientsList clients={clients} locale={locale} currency={currency} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

export { DetailTabsCard }
