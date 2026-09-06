"use client"

import { useTranslation } from "@/lib/i18n"

import { formatCurrency } from "@/lib/utils"

import { Alert, AlertDescription, AlertTitle, Button, Icon, Typography } from "@/components/ui"

import { usePublicInvoiceToken } from "../../hooks"
import { type PublicInvoice } from "../../types"

import { PublicInvoicePendingRefresh } from "./PublicInvoicePendingRefresh"

type PublicInvoicePaidPageProps = {
  invoice: PublicInvoice
}

// Where Stripe returns a client after a hosted Checkout Session. It reports what the database
// currently says and nothing else: the return itself is not evidence of a payment, because
// `success_url` is a plain URL the client's own browser follows and can be visited by anyone who
// guesses it. Only the signed webhook in `features/payments/stripeWebhook.ts` records money, so this
// page renders `invoice.outstandingCents` exactly as any other read would.
const PublicInvoicePaidPage = ({ invoice }: PublicInvoicePaidPageProps) => {
  const { t } = useTranslation()

  const token = usePublicInvoiceToken()

  const isSettled = invoice.outstandingCents === 0

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 p-4 md:p-8">
      <Alert>
        <Icon
          name={isSettled ? "CircleCheck" : "Clock"}
          aria-hidden="true"
          className={isSettled ? "text-success-border" : "text-muted-foreground"}
        />
        <AlertTitle>
          {isSettled
            ? t("invoices.public.paid.settledTitle")
            : t("invoices.public.paid.pendingTitle")}
        </AlertTitle>
        <AlertDescription>
          {isSettled
            ? t("invoices.public.paid.settledDescription")
            : t("invoices.public.paid.pendingDescription")}
        </AlertDescription>
      </Alert>
      <div className="flex flex-col gap-2">
        <Typography affects={["muted", "small"]}>
          {t("invoices.public.paid.invoiceLabel")}
        </Typography>
        <Typography variant="h3" className="font-mono">
          {invoice.number}
        </Typography>
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Typography affects={["small", "medium"]}>
          {isSettled
            ? t("invoices.public.payment.amountSettled")
            : t("invoices.public.paid.amountOutstanding")}
        </Typography>
        <span className="font-mono text-2xl font-semibold tabular-nums">
          {formatCurrency(
            isSettled ? invoice.totalCents : invoice.outstandingCents,
            invoice.currency,
            invoice.locale
          )}
        </span>
      </div>
      {isSettled ? null : <PublicInvoicePendingRefresh />}
      <Button asChild variant="outline" className="w-full sm:w-auto sm:self-start">
        <a href={`/i/${token}`}>{t("invoices.public.paid.backToInvoice")}</a>
      </Button>
    </main>
  )
}

export { PublicInvoicePaidPage }
