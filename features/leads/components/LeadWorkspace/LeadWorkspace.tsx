"use client"

import { useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import Link from "next/link"

import { useTranslation } from "@/lib/i18n"

import { formatDay, getInitials } from "@/lib/utils"

import {
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
  StatCard,
  StatValue,
  Typography,
  toast
} from "@/components/ui"

import { softDeleteLead } from "../../mutations"
import { type LeadDetail, type LeadFormData } from "../../types"

import { ConvertLeadDialog } from "../ConvertLeadDialog"
import { DeleteLeadDialog } from "../DeleteLeadDialog"
import { LeadFormSheet } from "../LeadFormSheet"
import { LeadStatusBadge } from "../LeadStatusBadge"

import { ContactRow } from "./ContactRow"
import { DetailGroup } from "./DetailGroup"
import { LeadStageControl } from "./LeadStageControl"

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
  const canConvert = !isConverted && lead.deletedAt === null

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
              <div className="flex flex-col items-center gap-2">
                <Typography variant="h2" className="text-2xl text-balance">
                  {lead.displayName}
                </Typography>
                {lead.deletedAt ? (
                  <Badge variant="outline">{t("leads.statusFilter.deleted")}</Badge>
                ) : (
                  <LeadStatusBadge status={lead.status} />
                )}
                {isConverted ? (
                  <Badge variant="success">
                    <Icon name="UserCheck" aria-hidden="true" />
                    {t("leads.detail.convertedBadge")}
                  </Badge>
                ) : null}
              </div>
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
            <div className="flex flex-col gap-3 p-4">
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
              </dl>
            </div>
            <CardFooter className="text-muted-foreground mt-auto gap-1.5 px-4 py-3 text-xs">
              <Icon name="Clock" className="size-3.5 shrink-0" aria-hidden="true" />
              <span>
                {t("leads.detail.updatedLabel")} · {formatDay(lead.updatedAt, locale)}
              </span>
            </CardFooter>
          </Card>
          <div className="flex min-w-0 flex-col gap-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard icon="GitBranch" label={t("leads.detail.statStage")}>
                <StatValue
                  value={t(`leads.status.${lead.status}`)}
                  title={t(`leads.status.${lead.status}`)}
                  hint={t("leads.detail.statStageHint")}
                />
              </StatCard>
              <StatCard icon="Compass" label={t("leads.fields.source")}>
                <StatValue
                  value={lead.source || t("leads.detail.emptyValue")}
                  title={lead.source || t("leads.detail.emptyValue")}
                  hint={t("leads.detail.statSourceHint")}
                />
              </StatCard>
              <StatCard icon="UserCheck" label={t("leads.detail.statConverted")}>
                <StatValue
                  value={
                    isConverted ? t("leads.detail.convertedYes") : t("leads.detail.convertedNo")
                  }
                  title={
                    isConverted ? t("leads.detail.convertedYes") : t("leads.detail.convertedNo")
                  }
                  hint={
                    isConverted && lead.convertedAt
                      ? formatDay(lead.convertedAt, locale)
                      : t("leads.detail.statConvertedHint")
                  }
                />
              </StatCard>
            </div>
            <Card size="sm">
              <CardHeader>
                <CardTitle>{t("leads.detail.pipelineTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Typography affects={["muted", "small"]}>
                    {t("leads.detail.currentStage")}
                  </Typography>
                  <LeadStatusBadge status={lead.status} />
                </div>
                {lead.deletedAt ? null : (
                  <LeadStageControl
                    leadId={lead.id}
                    status={lead.status}
                    onChanged={() => router.refresh()}
                  />
                )}
                {canConvert ? (
                  <div className="border-t pt-4">
                    <Button onClick={() => setConvertOpen(true)}>
                      <Icon name="UserPlus" aria-hidden="true" />
                      {t("leads.actions.convert")}
                    </Button>
                  </div>
                ) : null}
                {isConverted && lead.convertedToClientId ? (
                  <div className="border-t pt-4">
                    <Button asChild variant="outline">
                      <Link href={`/clients/${lead.convertedToClientId}`}>
                        <Icon name="ArrowRight" aria-hidden="true" />
                        {t("leads.detail.viewClient")}
                      </Link>
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
            {lead.status === "lost" && lead.lostReason ? (
              <Card size="sm">
                <CardHeader>
                  <CardTitle>{t("leads.detail.lostReasonTitle")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Typography className="whitespace-pre-wrap">{lead.lostReason}</Typography>
                </CardContent>
              </Card>
            ) : null}
            <Card size="sm" className="gap-0 py-0">
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
