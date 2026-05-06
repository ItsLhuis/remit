import Link from "next/link"

import { t } from "@/lib/i18n/server"

import { Button, Typography } from "@/components/ui"

const NotFoundPage = () => (
  <main className="flex min-h-svh items-center justify-center px-6 py-12">
    <div className="flex max-w-sm flex-col items-center text-center">
      <Typography variant="h1">{t("errors.notFound")}</Typography>
      <Typography variant="p" affects={["muted"]}>
        {t("errors.somethingWentWrong")}
      </Typography>
      <Button asChild className="mt-6">
        <Link href="/">{t("setup.done.goToDashboard")}</Link>
      </Button>
    </div>
  </main>
)

export default NotFoundPage
