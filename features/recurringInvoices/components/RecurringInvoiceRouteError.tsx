"use client"

import { useTranslation } from "@/lib/i18n"

import { Button, Card, CardContent, CardHeader, CardTitle, Icon, Typography } from "@/components/ui"

type RecurringInvoiceRouteErrorProps = {
  reset: () => void
}

const RecurringInvoiceRouteError = ({ reset }: RecurringInvoiceRouteErrorProps) => {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-md" size="sm">
        <CardHeader>
          <CardTitle>{t("recurringInvoices.routeError.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Typography affects="muted">{t("recurringInvoices.routeError.description")}</Typography>
          <Button type="button" onClick={reset}>
            <Icon name="RotateCcw" />
            {t("common.actions.retry")}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export { RecurringInvoiceRouteError }
