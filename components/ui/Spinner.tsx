"use client"

import { type ComponentProps } from "react"

import { useTranslation } from "@/lib/i18n"

import { cn } from "@/lib/utils"

import { Icon } from "@/components/ui/Icon"

const Spinner = ({ className }: Pick<ComponentProps<"svg">, "className">) => {
  const { t } = useTranslation()

  return (
    <Icon
      name="Loader2"
      role="status"
      aria-label={t("common.status.loading")}
      className={cn("size-4 animate-spin", className)}
    />
  )
}

export { Spinner }
