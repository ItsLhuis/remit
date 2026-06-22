"use client"

import Link from "next/link"

import { useTranslation } from "@/lib/i18n"

import { formatDay } from "@/lib/utils"

import { Button, Card, CardContent, Icon, Typography } from "@/components/ui"

import { type LeadDetail } from "../../types"

type LeadConversionPanelProps = {
  lead: LeadDetail
  locale: string
  onConvert: () => void
}

const LeadConversionPanel = ({ lead, locale, onConvert }: LeadConversionPanelProps) => {
  const { t } = useTranslation()

  const isConverted = lead.convertedAt !== null
  const canConvert = !isConverted && lead.deletedAt === null

  if (canConvert) {
    return (
      <Card size="sm">
        <CardContent className="flex flex-col items-start gap-3">
          <div className="flex flex-col gap-1">
            <Typography affects="medium">{t("leads.detail.convertTitle")}</Typography>
            <Typography affects={["muted", "small"]}>
              {t("leads.detail.convertDescription")}
            </Typography>
          </div>
          <Button onClick={onConvert}>
            <Icon name="UserPlus" aria-hidden="true" />
            {t("leads.actions.convert")}
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!isConverted) return null

  return (
    <Card size="sm">
      <CardContent className="flex flex-col items-start gap-3">
        <div className="flex flex-col gap-1">
          <Typography affects="medium">{t("leads.detail.convertedTitle")}</Typography>
          {lead.convertedAt ? (
            <Typography affects={["muted", "small"]}>
              {t("leads.detail.convertedOn", { date: formatDay(lead.convertedAt, locale) })}
            </Typography>
          ) : null}
        </div>
        {lead.convertedToClientId ? (
          <Button asChild variant="outline">
            <Link href={`/clients/${lead.convertedToClientId}`}>
              <Icon name="ArrowRight" aria-hidden="true" />
              {t("leads.detail.viewClient")}
            </Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}

export { LeadConversionPanel }
