"use client"

import { useTranslation } from "@/lib/i18n"

import { Icon, Typography } from "@/components/ui"

const TaskColumnEmpty = () => {
  const { t } = useTranslation()

  return (
    <div className="border-foreground/15 flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center">
      <Icon name="Inbox" className="text-muted-foreground size-5" aria-hidden="true" />
      <Typography affects={["muted", "tiny"]}>{t("tasks.columns.dropHint")}</Typography>
    </div>
  )
}

export { TaskColumnEmpty }
