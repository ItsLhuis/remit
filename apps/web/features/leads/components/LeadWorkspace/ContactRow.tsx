"use client"

import { type ComponentProps } from "react"

import { useTranslation } from "@/lib/i18n"

import { Icon, Typography } from "@/components/ui"

type ContactRowProps = {
  icon: ComponentProps<typeof Icon>["name"]
  label: string
  value: string
  href?: string
}

const ContactRow = ({ icon, label, value, href }: ContactRowProps) => {
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
        <dd className="truncate text-sm">
          {hasValue ? (
            href ? (
              <a href={href} className="hover:underline">
                {value}
              </a>
            ) : (
              value
            )
          ) : (
            <span className="text-muted-foreground">{t("leads.detail.emptyValue")}</span>
          )}
        </dd>
      </div>
    </div>
  )
}

export { ContactRow }
