"use client"

import { useTranslation } from "@/lib/i18n"

import { Button, Icon, Typography } from "@/components/ui"

// Rendered only when the instance has a Stripe secret key stored, and deliberately inert: Remit has
// no path yet that records what a Checkout Session collects, so a working button would take a
// client's money and leave the invoice reading unpaid. The disabled state is never the only signal —
// the line beneath it says so in words.
const PublicInvoiceCardPayment = () => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Icon name="CreditCard" aria-hidden="true" className="text-muted-foreground" />
        <Typography affects={["small", "medium"]}>
          {t("invoices.public.payment.cardTitle")}
        </Typography>
      </div>
      <Button variant="outline" disabled className="w-full sm:w-auto">
        {t("invoices.public.payment.cardButton")}
      </Button>
      <Typography variant="p" affects={["muted", "small", "removePMargin"]}>
        {t("invoices.public.payment.cardUnavailable")}
      </Typography>
    </div>
  )
}

export { PublicInvoiceCardPayment }
