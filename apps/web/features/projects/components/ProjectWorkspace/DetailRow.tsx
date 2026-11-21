"use client"

import { type ComponentProps } from "react"

import { useTranslation } from "@/lib/i18n"

import { cn } from "@/lib/utils"

import { Icon, Typography } from "@/components/ui"

type DetailRowProps = {
  icon: ComponentProps<typeof Icon>["name"]
  label: string
  value: string
  href?: string
  mono?: boolean
}

const DetailRow = ({ icon, label, value, href, mono }: DetailRowProps) => {
  const { t } = useTranslation()

  const hasValue = value.trim().length > 0

  return (
    <div className="flex items-start gap-2.5">
      <Icon
        name={icon}
        className="text-muted-foreground mt-0.5 size-4 shrink-0"
        aria-hidden="true"
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <dt>
          <Typography affects={["muted", "tiny"]}>{label}</Typography>
        </dt>
        <dd className={cn("truncate text-sm", mono && "font-mono")}>
          {hasValue ? (
            href ? (
              <a href={href} className="hover:underline">
                {value}
              </a>
            ) : (
              value
            )
          ) : (
            <span className="text-muted-foreground">{t("projects.detail.emptyValue")}</span>
          )}
        </dd>
      </div>
    </div>
  )
}

export { DetailRow }
