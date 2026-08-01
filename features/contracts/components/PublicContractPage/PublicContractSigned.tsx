"use client"

import { useTranslation } from "@/lib/i18n"

import { formatDate } from "@/lib/utils"

import { Card, CardContent, CardHeader, CardTitle, Icon, Typography } from "@/components/ui"

type PublicContractSignedProps = {
  signedAt: Date
  locale: string
  timeZone: string
}

// Shown in place of the form for the rest of this visit. Reloading the page afterwards returns the
// uniform "unavailable" surface, because a signed contract is no longer reachable through its
// public token — so this panel is the signer's only confirmation and has to carry the timestamp.
const PublicContractSigned = ({ signedAt, locale, timeZone }: PublicContractSignedProps) => {
  const { t } = useTranslation()

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon name="CircleCheck" aria-hidden="true" />
          {t("contracts.public.signed.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Typography variant="p" affects={["muted", "small", "removePMargin"]}>
          {t("contracts.public.signed.description")}
        </Typography>
        <Typography affects={["small", "medium"]}>
          {t("contracts.public.signed.signedAt", {
            date: formatDate(signedAt, { locale, timeZone })
          })}
        </Typography>
      </CardContent>
    </Card>
  )
}

export { PublicContractSigned }
