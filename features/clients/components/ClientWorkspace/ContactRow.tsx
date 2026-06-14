"use client"

import { type ComponentProps } from "react"

import { useTranslation } from "@/lib/i18n"

import { cn } from "@/lib/utils"

import { Icon, Typography } from "@/components/ui"

type ContactRowProps = {
  icon: ComponentProps<typeof Icon>["name"]
  label: string
  value: string
  href?: string
  external?: boolean
  mono?: boolean
}

const ContactRow = ({ icon, label, value, href, external, mono }: ContactRowProps) => {
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
        <dd className={cn("truncate text-sm", mono && "font-mono tabular-nums")}>
          {hasValue ? (
            href ? (
              <a
                href={href}
                {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
                className="hover:underline"
              >
                {value}
              </a>
            ) : (
              value
            )
          ) : (
            <span className="text-muted-foreground">{t("clients.detail.emptyValue")}</span>
          )}
        </dd>
      </div>
    </div>
  )
}

export { ContactRow }
