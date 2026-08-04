"use client"

import { useTranslation } from "@/lib/i18n"

import { Button, Typography } from "@/components/ui"

// Next.js passes `{ error, reset }`; only `reset` is accepted here, so the error object cannot be
// rendered by accident. A message or digest reaching this screen would leak internals of whatever
// failed to a signed-in user's browser and, from there, to a screenshot in a support thread.
type ErrorPageProps = {
  reset: () => void
}

const ErrorPage = ({ reset }: ErrorPageProps) => {
  const { t } = useTranslation()

  return (
    <main className="flex min-h-svh items-center justify-center px-6 py-12">
      <div className="flex max-w-sm flex-col items-center text-center">
        <Typography variant="h1">{t("errors.page.title")}</Typography>
        <Typography variant="p" affects={["muted"]}>
          {t("errors.page.description")}
        </Typography>
        <Button className="mt-6" onClick={reset}>
          {t("common.actions.retry")}
        </Button>
      </div>
    </main>
  )
}

export default ErrorPage
