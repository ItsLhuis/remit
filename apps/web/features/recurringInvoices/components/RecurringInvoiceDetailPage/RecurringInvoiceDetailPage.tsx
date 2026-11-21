"use client"

import { useState } from "react"

import Link from "next/link"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Icon,
  ScrollArea,
  SidebarTrigger,
  Typography
} from "@/components/ui"

import { canTransitionRecurringInvoiceStatus } from "../../services"
import { type RecurringInvoiceDetail } from "../../types"
import { CancelRecurringInvoiceDialog } from "../CancelRecurringInvoiceDialog"
import { DeleteRecurringInvoiceDialog } from "../DeleteRecurringInvoiceDialog"
import { PauseRecurringInvoiceDialog } from "../PauseRecurringInvoiceDialog"
import { RecurringInvoiceStatusBadge } from "../RecurringInvoiceStatusBadge"
import { ResumeRecurringInvoiceDialog } from "../ResumeRecurringInvoiceDialog"

import { GeneratedInvoicesCard } from "./GeneratedInvoicesCard"
import { RecurringInvoiceSummaryCard } from "./RecurringInvoiceSummaryCard"

type RecurringInvoiceDetailPageProps = {
  schedule: RecurringInvoiceDetail
  locale: string
  timeZone: string
}

const RecurringInvoiceDetailPage = ({
  schedule,
  locale,
  timeZone
}: RecurringInvoiceDetailPageProps) => {
  const { t } = useTranslation()

  const [pauseOpen, setPauseOpen] = useState(false)
  const [resumeOpen, setResumeOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const projectLabel = schedule.projectName ?? t("recurringInvoices.detail.noProject")
  const parentLabel = `${schedule.clientName} · ${projectLabel}`

  const canPause = canTransitionRecurringInvoiceStatus(schedule.status, "paused").allowed
  const canResume = canTransitionRecurringInvoiceStatus(schedule.status, "active").allowed
  const canCancel = canTransitionRecurringInvoiceStatus(schedule.status, "cancelled").allowed

  // A terminal schedule is history: updateRecurringInvoice refuses to write one, so the edit route
  // is not offered either.
  const isEditable = schedule.status === "active" || schedule.status === "paused"

  return (
    <ScrollArea className="size-full">
      <div className="flex w-full flex-col gap-6 p-4 md:p-8">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="md:hidden" />
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link href="/recurring-invoices">
              <Icon name="ArrowLeft" aria-hidden="true" />
              {t("recurringInvoices.list.title")}
            </Link>
          </Button>
        </div>
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Typography variant="h2">{schedule.name}</Typography>
              <RecurringInvoiceStatusBadge status={schedule.status} />
            </div>
            <Typography variant="p" affects={["muted", "removePMargin"]}>
              {parentLabel}
            </Typography>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isEditable ? (
              <Button variant="outline" asChild>
                <Link href={`/recurring-invoices/${schedule.id}/edit`}>
                  <Icon name="Pencil" aria-hidden="true" />
                  {t("common.actions.edit")}
                </Link>
              </Button>
            ) : null}
            {canPause ? (
              <Button variant="outline" onClick={() => setPauseOpen(true)}>
                <Icon name="Pause" aria-hidden="true" />
                {t("recurringInvoices.dialogs.pause.confirm")}
              </Button>
            ) : null}
            {canResume ? (
              <Button onClick={() => setResumeOpen(true)}>
                <Icon name="Play" aria-hidden="true" />
                {t("recurringInvoices.dialogs.resume.confirm")}
              </Button>
            ) : null}
            {canCancel ? (
              <Button variant="outline" onClick={() => setCancelOpen(true)}>
                <Icon name="CircleSlash" aria-hidden="true" />
                {t("recurringInvoices.dialogs.cancel.confirm")}
              </Button>
            ) : null}
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Icon name="Trash2" aria-hidden="true" />
              {t("common.actions.delete")}
            </Button>
          </div>
        </header>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <GeneratedInvoicesCard
              invoices={schedule.invoices}
              projectId={schedule.projectId}
              locale={locale}
            />
            {schedule.notes ? (
              <Card size="sm">
                <CardHeader>
                  <CardTitle>{t("recurringInvoices.fields.notes")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Typography
                    variant="p"
                    affects={["muted", "small", "removePMargin"]}
                    className="whitespace-pre-line"
                  >
                    {schedule.notes}
                  </Typography>
                </CardContent>
              </Card>
            ) : null}
          </div>
          <RecurringInvoiceSummaryCard schedule={schedule} locale={locale} timeZone={timeZone} />
        </div>
        <PauseRecurringInvoiceDialog
          recurringInvoiceId={schedule.id}
          open={pauseOpen}
          onOpenChange={setPauseOpen}
        />
        <ResumeRecurringInvoiceDialog
          recurringInvoiceId={schedule.id}
          open={resumeOpen}
          onOpenChange={setResumeOpen}
        />
        <CancelRecurringInvoiceDialog
          recurringInvoiceId={schedule.id}
          open={cancelOpen}
          onOpenChange={setCancelOpen}
        />
        <DeleteRecurringInvoiceDialog
          recurringInvoiceId={schedule.id}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
        />
      </div>
    </ScrollArea>
  )
}

export { RecurringInvoiceDetailPage }
