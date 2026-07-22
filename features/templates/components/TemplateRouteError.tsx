"use client"

import { useTranslation } from "@/lib/i18n"

import { Button, Card, CardContent, CardHeader, CardTitle, Icon, Typography } from "@/components/ui"

type TemplateRouteErrorProps = {
  reset: () => void
}

const TemplateRouteError = ({ reset }: TemplateRouteErrorProps) => {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-md" size="sm">
        <CardHeader>
          <CardTitle>{t("errors.page.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Typography affects="muted">{t("errors.page.description")}</Typography>
          <Button type="button" onClick={reset}>
            <Icon name="RotateCcw" />
            {t("common.actions.retry")}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export { TemplateRouteError }
