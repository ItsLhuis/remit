"use client"

import { useState, useTransition } from "react"

import { useTranslation } from "@/lib/i18n"

import { Button, Icon, Spinner, Typography } from "@/components/ui"

import { usePublicInvoiceToken } from "../../hooks"

// The response body is `unknown` because it crossed the network. Narrowing it here rather than
// asserting a shape means a route that ever answers something else sends the client to the error
// line instead of to `undefined`.
function getCheckoutUrl(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("url" in body)) return null

  return typeof body.url === "string" ? body.url : null
}

const PublicInvoiceCardPayment = () => {
  const { t } = useTranslation()

  const token = usePublicInvoiceToken()

  const [error, setError] = useState<string | null>(null)

  const [isStarting, startCheckout] = useTransition()

  const onPay = () => {
    setError(null)

    startCheckout(async () => {
      try {
        const response = await fetch(`/i/${token}/pay`, { method: "POST" })
        const body: unknown = await response.json()
        const url = getCheckoutUrl(body)

        if (!response.ok || !url) {
          setError(t("invoices.public.payment.startFailed"))

          return
        }

        // `assign` rather than `replace`: Stripe's `cancel_url` returns the client to this same
        // invoice, and leaving the history entry in place means the browser back button does the
        // same thing the cancel button does.
        window.location.assign(url)
      } catch {
        setError(t("invoices.public.payment.startFailed"))
      }
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Icon name="CreditCard" aria-hidden="true" className="text-muted-foreground" />
        <Typography affects={["small", "medium"]}>
          {t("invoices.public.payment.cardTitle")}
        </Typography>
      </div>
      <Button onClick={onPay} disabled={isStarting} className="w-full sm:w-auto">
        {isStarting ? <Spinner /> : null}
        {t("invoices.public.payment.cardButton")}
      </Button>
      <div aria-live="polite" className="empty:hidden">
        {isStarting ? (
          <Typography variant="p" affects={["muted", "small", "removePMargin"]}>
            {t("invoices.public.payment.cardStarting")}
          </Typography>
        ) : null}
        {error ? (
          <Typography variant="p" affects={["small", "removePMargin"]} className="text-destructive">
            {error}
          </Typography>
        ) : null}
      </div>
    </div>
  )
}

export { PublicInvoiceCardPayment }
