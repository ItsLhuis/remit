"use client"

import { useTranslation } from "@/lib/i18n"

import { formatDay, getInitials } from "@/lib/utils"

import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardFooter,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Icon,
  IconButton,
  Separator,
  Typography
} from "@/components/ui"

import { type ClientDetail } from "../../types"
import { ClientHealthBadge } from "../ClientHealthBadge"

import { ContactRow } from "./ContactRow"

type ClientSummaryCardProps = {
  client: ClientDetail
  locale: string
  location: string
  websiteHref?: string
  onEdit: () => void
  onCopyEmail: () => void
  onRequestDelete: () => void
}

const ClientSummaryCard = ({
  client,
  locale,
  location,
  websiteHref,
  onEdit,
  onCopyEmail,
  onRequestDelete
}: ClientSummaryCardProps) => {
  const { t } = useTranslation()

  return (
    <Card className="gap-0 py-0 lg:sticky lg:top-8">
      <div className="flex flex-col items-center gap-3 p-6 text-center">
        <Avatar className="size-16">
          <AvatarFallback className="text-lg">{getInitials(client.name)}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col items-center gap-2">
          <Typography variant="h2" className="text-2xl text-balance">
            {client.name}
          </Typography>
          {client.deletedAt ? (
            <Badge variant="outline">{t("clients.status.deleted")}</Badge>
          ) : (
            <ClientHealthBadge health={client.health} />
          )}
        </div>
        <Typography affects={["muted", "small"]}>
          {t("clients.detail.since", { date: formatDay(client.createdAt, locale) })}
        </Typography>
      </div>
      <div className="flex items-center gap-2 px-4 pb-4">
        <Button asChild variant="outline" size="sm" className="flex-1">
          <a href={`mailto:${client.email}`}>
            <Icon name="Mail" aria-hidden="true" />
            {t("clients.detail.quick.email")}
          </a>
        </Button>
        <Button size="sm" className="flex-1" onClick={onEdit}>
          <Icon name="Pencil" aria-hidden="true" />
          {t("clients.actions.edit")}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton variant="outline" size="icon-sm" label={t("clients.list.actions")}>
              <Icon name="EllipsisVertical" />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onSelect={() => void onCopyEmail()}>
              <Icon name="Copy" aria-hidden="true" />
              {t("clients.list.copyEmail")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onRequestDelete}>
              <Icon name="Trash2" aria-hidden="true" />
              {t("clients.actions.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Separator />
      <div className="flex flex-col gap-3 p-4">
        <Typography affects={["muted", "tiny", "uppercase"]}>
          {t("clients.detail.contactTitle")}
        </Typography>
        <dl className="flex flex-col gap-3">
          <ContactRow
            icon="Mail"
            label={t("clients.fields.email")}
            value={client.email}
            href={`mailto:${client.email}`}
          />
          <ContactRow
            icon="Phone"
            label={t("clients.fields.phone")}
            value={client.phone}
            href={client.phone ? `tel:${client.phone}` : undefined}
          />
          <ContactRow
            icon="Globe"
            label={t("clients.fields.website")}
            value={client.website}
            href={websiteHref}
            external
          />
          <ContactRow icon="MapPin" label={t("clients.detail.addressTitle")} value={location} />
        </dl>
      </div>
      <Separator />
      <div className="flex flex-col gap-3 p-4">
        <Typography affects={["muted", "tiny", "uppercase"]}>
          {t("clients.detail.billingTitle")}
        </Typography>
        <dl className="flex flex-col gap-3">
          <ContactRow
            icon="Coins"
            label={t("clients.fields.currency")}
            value={client.currency}
            mono
          />
          <ContactRow icon="Receipt" label={t("clients.fields.taxId")} value={client.taxId} />
        </dl>
      </div>
      <CardFooter className="text-muted-foreground mt-auto gap-1.5 px-4 py-3 text-xs">
        <Icon name="Clock" className="size-3.5 shrink-0" aria-hidden="true" />
        <span>
          {t("clients.detail.updatedLabel")} · {formatDay(client.updatedAt, locale)}
        </span>
      </CardFooter>
    </Card>
  )
}

export { ClientSummaryCard }
