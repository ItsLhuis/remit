"use client"

import { useTranslation } from "@/lib/i18n"

import { Badge, Icon } from "@/components/ui"

import { TEMPLATE_TYPE_ICON_NAMES, TEMPLATE_TYPE_LABEL_KEYS } from "../labels"
import { type TemplateType } from "../schemas"

type TemplateTypeBadgeProps = {
  type: TemplateType
}

const TemplateTypeBadge = ({ type }: TemplateTypeBadgeProps) => {
  const { t } = useTranslation()

  return (
    <Badge variant="secondary">
      <Icon name={TEMPLATE_TYPE_ICON_NAMES[type]} aria-hidden="true" />
      {t(TEMPLATE_TYPE_LABEL_KEYS[type])}
    </Badge>
  )
}

export { TemplateTypeBadge }
