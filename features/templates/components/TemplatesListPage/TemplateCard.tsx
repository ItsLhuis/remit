"use client"

import Link from "next/link"

import { useTranslation } from "@/lib/i18n"

import { formatDay } from "@/lib/utils"

import {
  Badge,
  Card,
  CardContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Icon,
  IconButton,
  Typography
} from "@/components/ui"

import { TEMPLATE_TYPE_LABEL_KEYS } from "../../labels"
import { type TemplateListItem } from "../../types"

import { TemplateCardPreview } from "./TemplateCardPreview"

type TemplateCardProps = {
  template: TemplateListItem
  locale: string
  onSetDefault: (id: string) => void
  onDelete: (template: TemplateListItem) => void
}

const TemplateCard = ({ template, locale, onSetDefault, onDelete }: TemplateCardProps) => {
  const { t } = useTranslation()

  const editHref = `/templates/${template.id}`

  return (
    <Card size="sm" className="hover:ring-foreground/25 gap-0 py-0 transition-shadow">
      <TemplateCardPreview thumbnail={template.thumbnail} name={template.name} />
      <CardContent className="flex items-start justify-between gap-2 py-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Link href={editHref} className="truncate font-medium hover:underline">
            {template.name}
          </Link>
          <Typography affects={["muted", "small"]} className="truncate">
            {t(TEMPLATE_TYPE_LABEL_KEYS[template.type])}
          </Typography>
          {template.subject ? (
            <Typography affects={["muted", "tiny"]} className="truncate">
              {template.subject}
            </Typography>
          ) : null}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {template.isDefault ? (
              <Badge variant="secondary">{t("templates.badges.default")}</Badge>
            ) : null}
            {template.isSystem ? (
              <Badge variant="outline">{t("templates.badges.system")}</Badge>
            ) : null}
            <Typography affects={["muted", "tiny"]} className="whitespace-nowrap">
              {t("templates.card.updated", { date: formatDay(template.updatedAt, locale) })}
            </Typography>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton
              variant="ghost"
              size="icon-sm"
              label={t("templates.card.actionsLabel", { name: template.name })}
            >
              <Icon name="EllipsisVertical" />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={editHref}>
                <Icon name="Pencil" aria-hidden="true" />
                {t("templates.actions.edit")}
              </Link>
            </DropdownMenuItem>
            {template.isDefault ? null : (
              <DropdownMenuItem onClick={() => onSetDefault(template.id)}>
                <Icon name="Star" aria-hidden="true" />
                {t("templates.actions.setDefault")}
              </DropdownMenuItem>
            )}
            {template.isSystem ? null : (
              <DropdownMenuItem variant="destructive" onClick={() => onDelete(template)}>
                <Icon name="Trash2" aria-hidden="true" />
                {t("templates.actions.delete")}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  )
}

export { TemplateCard }
