"use client"

import { Fragment, useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import Link from "next/link"

import { useTranslation } from "@/lib/i18n"

import { formatDay, getInitials } from "@/lib/utils"

import {
  ActivityTimeline,
  type ActivityTimelineItem,
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Icon,
  IconButton,
  ScrollArea,
  Separator,
  SidebarTrigger,
  Typography,
  toast
} from "@/components/ui"

import { softDeleteLead } from "../../mutations"
import { type LeadDetail, type LeadFormData } from "../../types"
import { ConvertLeadDialog } from "../ConvertLeadDialog"
import { DeleteLeadDialog } from "../DeleteLeadDialog"
import { LeadFormSheet } from "../LeadFormSheet"

import { ContactRow } from "./ContactRow"
import { DetailGroup } from "./DetailGroup"
import { LeadConversionPanel } from "./LeadConversionPanel"
import { LeadStatusSelector } from "./LeadStatusSelector"

type LeadWorkspaceProps = {
  lead: LeadDetail
  formData: LeadFormData
  locale: string
  defaultCurrency: string
}

const LeadWorkspace = ({ lead, formData, locale, defaultCurrency }: LeadWorkspaceProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [convertOpen, setConvertOpen] = useState(false)
  const [isDeleting, startDelete] = useTransition()

  const isConverted = lead.convertedAt !== null

  const activity: ActivityTimelineItem[] = []

  const onDelete = () => {
    if (isDeleting) return

    startDelete(async () => {
      const result = await softDeleteLead({ id: lead.id })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      toast.success(t("leads.delete.deleted"))

      setDeleteOpen(false)

      router.push("/leads")

      router.refresh()
    })
  }

  const onCopyEmail = async () => {
    await navigator.clipboard.writeText(lead.email)

    toast.success(t("leads.list.emailCopied"))
  }

  return (
    <ScrollArea className="size-full">
      <div className="flex w-full flex-col gap-6 p-4 md:p-8">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="md:hidden" />
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link href="/leads">
              <Icon name="ArrowLeft" aria-hidden="true" />
              {t("leads.detail.backToLeads")}
            </Link>
          </Button>
        </div>
        <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
          <Card className="gap-0 py-0 lg:sticky lg:top-8">
            <div className="flex flex-col items-center gap-3 p-6 text-center">
              <Avatar className="size-16">
                <AvatarFallback className="text-lg">{getInitials(lead.displayName)}</AvatarFallback>
              </Avatar>
              <Typography variant="h2" className="text-2xl text-balance">
                {lead.displayName}
              </Typography>
              <Typography affects={["muted", "small"]}>
                {t("leads.detail.since", { date: formatDay(lead.createdAt, locale) })}
              </Typography>
            </div>
            <div className="flex items-center gap-2 px-4 pb-4">
              <Button asChild variant="outline" size="sm" className="flex-1">
                <a href={`mailto:${lead.email}`}>
                  <Icon name="Mail" aria-hidden="true" />
                  {t("leads.detail.quickEmail")}
                </a>
              </Button>
              <Button size="sm" className="flex-1" onClick={() => setEditOpen(true)}>
                <Icon name="Pencil" aria-hidden="true" />
                {t("leads.actions.edit")}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <IconButton variant="outline" size="icon-sm" label={t("leads.list.actions")}>
                    <Icon name="EllipsisVertical" />
                  </IconButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onSelect={() => void onCopyEmail()}>
                    <Icon name="Copy" aria-hidden="true" />
                    {t("leads.list.copyEmail")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                    <Icon name="Trash2" aria-hidden="true" />
                    {t("leads.actions.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Separator />
            <div className="flex flex-col gap-4 p-4">
              <div className="flex items-start gap-2.5">
                <Icon
                  name="GitBranch"
                  className="text-muted-foreground mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Typography affects={["muted", "tiny"]}>
                    {t("leads.detail.statusLabel")}
                  </Typography>
                  {lead.deletedAt ? (
                    <Badge variant="outline" className="w-fit">
                      {t("leads.statusFilter.deleted")}
                    </Badge>
                  ) : (
                    <LeadStatusSelector
                      leadId={lead.id}
                      status={lead.status}
                      onChanged={() => router.refresh()}
                    />
                  )}
                </div>
              </div>
              <Separator />
              <div className="flex flex-col gap-3">
                <Typography affects={["muted", "tiny", "uppercase"]}>
                  {t("leads.detail.contactTitle")}
                </Typography>
                <dl className="flex flex-col gap-3">
                  <ContactRow
                    icon="Mail"
                    label={t("leads.fields.email")}
                    value={lead.email}
                    href={`mailto:${lead.email}`}
                  />
                  <ContactRow
                    icon="Phone"
                    label={t("leads.fields.phone")}
                    value={lead.phone}
                    href={lead.phone ? `tel:${lead.phone}` : undefined}
                  />
                  <ContactRow
                    icon="Building2"
                    label={t("leads.fields.company")}
                    value={lead.company}
                  />
                  <ContactRow icon="Compass" label={t("leads.fields.source")} value={lead.source} />
                  <ContactRow
                    icon="UserCheck"
                    label={t("leads.detail.statConverted")}
                    value={
                      isConverted ? t("leads.detail.convertedYes") : t("leads.detail.convertedNo")
                    }
                    href={
                      lead.convertedToClientId ? `/clients/${lead.convertedToClientId}` : undefined
                    }
                  />
                </dl>
              </div>
            </div>
            <CardFooter className="text-muted-foreground mt-auto gap-1.5 px-4 py-3 text-xs">
              <Icon name="Clock" className="size-3.5 shrink-0" aria-hidden="true" />
              <span>
                {t("leads.detail.updatedLabel")} · {formatDay(lead.updatedAt, locale)}
              </span>
            </CardFooter>
          </Card>
          <div className="flex min-w-0 flex-col gap-6">
            <LeadConversionPanel
              lead={lead}
              locale={locale}
              onConvert={() => setConvertOpen(true)}
            />
            <Card size="sm">
              <CardHeader>
                <CardTitle>{t("leads.detail.activityTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ActivityTimeline
                  items={activity}
                  emptyTitle={t("leads.detail.activityEmptyTitle")}
                  emptyDescription={t("leads.detail.activityEmpty")}
                />
              </CardContent>
            </Card>
            <Card size="sm" className="gap-0 py-0">
              {lead.status === "lost" && lead.lostReason ? (
                <Fragment>
                  <DetailGroup title={t("leads.detail.lostReasonTitle")}>
                    <Typography className="whitespace-pre-wrap">{lead.lostReason}</Typography>
                  </DetailGroup>
                  <Separator />
                </Fragment>
              ) : null}
              <DetailGroup title={t("leads.detail.notesTitle")}>
                {lead.notes ? (
                  <Typography className="whitespace-pre-wrap">{lead.notes}</Typography>
                ) : (
                  <Typography affects={["muted", "small"]}>
                    {t("leads.detail.notesEmpty")}
                  </Typography>
                )}
              </DetailGroup>
              <CardFooter className="px-4 py-3">
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                  <Icon name="Pencil" aria-hidden="true" />
                  {t("leads.detail.editDetails")}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
      <LeadFormSheet
        mode="edit"
        lead={formData}
        currentStatus={lead.status}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={() => router.refresh()}
      />
      <DeleteLeadDialog
        leadName={lead.displayName}
        open={deleteOpen}
        isDeleting={isDeleting}
        onOpenChange={(open) => {
          if (!isDeleting) setDeleteOpen(open)
        }}
        onConfirm={onDelete}
      />
      <ConvertLeadDialog
        leadId={lead.id}
        defaultName={lead.company || lead.displayName}
        defaultCurrency={defaultCurrency}
        open={convertOpen}
        onOpenChange={setConvertOpen}
        onConverted={(clientId) => {
          toast.success(t("leads.convert.converted"))

          router.push(`/clients/${clientId}`)
          router.refresh()
        }}
      />
    </ScrollArea>
  )
}

export { LeadWorkspace }
