"use client"

import { useTranslation } from "@/lib/i18n"

import { formatDate } from "@/lib/utils"

import {
  Alert,
  AlertDescription,
  AlertTitle,
  FieldDescription,
  Icon,
  Typography
} from "@/components/ui"

type StripeConnectionStatusProps = {
  cardPaymentsIncomplete: boolean
  stripeTestConnectionAt: string | null
  locale: string
  isDirty: boolean
}

// Everything the operator can learn about the Stripe connection without leaving the form: whether
// the last credential test succeeded, whether unsaved edits make that reading stale, and whether the
// configuration is one that would take a client's money without recording it.
const StripeConnectionStatus = ({
  cardPaymentsIncomplete,
  stripeTestConnectionAt,
  locale,
  isDirty
}: StripeConnectionStatusProps) => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-3">
      {cardPaymentsIncomplete ? (
        <Alert>
          <Icon name="TriangleAlert" aria-hidden="true" />
          <AlertTitle>{t("settings.payment.cardPaymentsOffTitle")}</AlertTitle>
          <AlertDescription>{t("settings.payment.cardPaymentsOffDescription")}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-1" aria-live="polite">
        {stripeTestConnectionAt ? (
          <Typography variant="p" affects={["muted", "removePMargin", "small"]}>
            {t("settings.payment.lastStripeTest", {
              date: formatDate(new Date(stripeTestConnectionAt), { locale })
            })}
          </Typography>
        ) : (
          <Typography variant="p" affects={["muted", "removePMargin", "small"]}>
            {t("settings.payment.lastStripeTestNever")}
          </Typography>
        )}
        {isDirty ? (
          <FieldDescription>{t("settings.payment.saveBeforeTest")}</FieldDescription>
        ) : null}
      </div>
    </div>
  )
}

export { StripeConnectionStatus }
