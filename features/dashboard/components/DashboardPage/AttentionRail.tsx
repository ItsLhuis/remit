"use client"

import { useTranslation } from "@/lib/i18n"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  ScrollArea,
  Typography
} from "@/components/ui"

import { type AttentionItem } from "../../services"

import { AttentionRow } from "./AttentionRow"
import { DashboardCardEmpty } from "./DashboardCardEmpty"

const STAGGER_MILLISECONDS = 40

type AttentionRailProps = {
  items: AttentionItem[]
  totalCount: number
  locale: string
}

// The rail is capped and scrolls rather than growing, so its height is set by the design and never
// by how much is wrong this week — the cashflow chart beside it keeps its own height either way.
// Empty here is celebratory and carries no call to action: there is nothing to create when nothing
// needs doing, and a button would invent work.
const AttentionRail = ({ items, totalCount, locale }: AttentionRailProps) => {
  const { t } = useTranslation()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("dashboard.attention.title")}</CardTitle>
        <CardDescription>{t("dashboard.attention.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length > 0 ? (
          <ScrollArea className="-mx-2 lg:max-h-72">
            <ul className="flex flex-col">
              {items.map((item, index) => (
                <AttentionRow
                  key={item.id}
                  item={item}
                  locale={locale}
                  delayMilliseconds={index * STAGGER_MILLISECONDS}
                />
              ))}
            </ul>
          </ScrollArea>
        ) : (
          <DashboardCardEmpty
            icon="CircleCheck"
            title={t("dashboard.attention.emptyTitle")}
            description={t("dashboard.attention.emptyDescription")}
          />
        )}
      </CardContent>
      {totalCount > items.length ? (
        <CardFooter>
          <Typography affects={["muted", "small"]}>
            {t("dashboard.attention.more", { count: totalCount - items.length })}
          </Typography>
        </CardFooter>
      ) : null}
    </Card>
  )
}

export { AttentionRail }
