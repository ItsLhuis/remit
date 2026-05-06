"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"

import { useTranslation } from "@/lib/i18n"

import { Button, Typography } from "@/components/ui"

const DoneStep = () => {
  const { t } = useTranslation()

  const router = useRouter()

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center text-center">
        <Image src="/logo.png" alt={t("app.logoAlt")} width={64} height={64} className="mb-4" />
        <Typography variant="h2" className="mb-2">
          {t("setup.done.title")}
        </Typography>
        <Typography variant="p" affects={["muted", "removePMargin"]}>
          {t("setup.done.description")}
        </Typography>
      </div>
      <Button size="lg" className="w-full" onClick={() => router.push("/")}>
        {t("setup.done.goToDashboard")}
      </Button>
    </div>
  )
}

export { DoneStep }
