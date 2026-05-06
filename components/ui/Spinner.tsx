import { type ComponentProps } from "react"

import { cn } from "@/lib/utils"

import { t } from "@/lib/i18n/server"

import { Icon } from "@/components/ui/Icon"

const Spinner = ({ className }: Pick<ComponentProps<"svg">, "className">) => {
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
