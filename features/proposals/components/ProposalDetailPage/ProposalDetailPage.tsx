"use client"

import { useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import Link from "next/link"

import { useTranslation } from "@/lib/i18n"

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Icon,
  ScrollArea,
  SidebarTrigger,
  Typography,
  toast
} from "@/components/ui"

import { sendProposal, softDeleteProposal } from "../../mutations"
import { isProposalEditable } from "../../services"
import { type ProposalDetail } from "../../types"
import { DeleteProposalDialog } from "../DeleteProposalDialog"
import { ProposalLineItemsTable } from "../ProposalLineItemsTable"
import { ProposalStatusBadge } from "../ProposalStatusBadge"
import { SendProposalDialog } from "../SendProposalDialog"

import { ProposalPublicLinkCard } from "./ProposalPublicLinkCard"
import { ProposalSummaryCard } from "./ProposalSummaryCard"

type ProposalDetailPageProps = {
  proposal: ProposalDetail
}

const ProposalDetailPage = ({ proposal }: ProposalDetailPageProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [sendOpen, setSendOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isSending, startSending] = useTransition()
  const [isDeleting, startDeleting] = useTransition()

  const isEditable = isProposalEditable(proposal.status)

  // The project-scoped list when the proposal has a project, the instance-wide one otherwise: a
  // client-level proposal has no project page to go back to.
  const listHref = proposal.projectId ? `/projects/${proposal.projectId}/proposals` : "/proposals"
  const editHref = proposal.projectId
    ? `/projects/${proposal.projectId}/proposals/${proposal.id}/edit`
    : `/proposals/${proposal.id}/edit`

  const onConfirmSend = () => {
    if (isSending) return

    startSending(async () => {
      const result = await sendProposal({ id: proposal.id })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      toast.success(t("proposals.notifications.sent"))

      setSendOpen(false)

      router.refresh()
    })
  }

  const onConfirmDelete = () => {
    if (isDeleting) return

    startDeleting(async () => {
      const result = await softDeleteProposal({ id: proposal.id })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      toast.success(t("proposals.notifications.deleted"))

      router.push(listHref)
      router.refresh()
    })
  }

  return (
    <ScrollArea className="size-full">
      <div className="flex w-full flex-col gap-6 p-4 md:p-8">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="md:hidden" />
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link href={listHref}>
              <Icon name="ArrowLeft" aria-hidden="true" />
              {t("proposals.detail.backToList")}
            </Link>
          </Button>
        </div>
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Typography variant="h2" className="font-mono">
                {proposal.number}
              </Typography>
              <ProposalStatusBadge status={proposal.status} />
            </div>
            <Typography variant="p" affects={["muted", "removePMargin"]}>
              {proposal.projectName}
            </Typography>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isEditable ? (
              <Button variant="outline" asChild>
                <Link href={editHref}>
                  <Icon name="Pencil" aria-hidden="true" />
                  {t("proposals.actions.edit")}
                </Link>
              </Button>
            ) : null}
            {isEditable ? (
              <Button onClick={() => setSendOpen(true)}>
                <Icon name="Send" aria-hidden="true" />
                {t("proposals.actions.send")}
              </Button>
            ) : null}
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Icon name="Trash2" aria-hidden="true" />
              {t("proposals.actions.delete")}
            </Button>
          </div>
        </header>
        {isEditable ? null : (
          <Alert>
            <Icon name="Lock" aria-hidden="true" />
            <AlertTitle>{t("proposals.detail.lockedTitle")}</AlertTitle>
            <AlertDescription>{t("proposals.detail.lockedDescription")}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <ProposalLineItemsTable
              lineItems={proposal.lineItems}
              currency={proposal.currency}
              locale={proposal.defaults.defaultLocale}
            />
            {proposal.notes ? (
              <div className="flex flex-col gap-2">
                <Typography affects={["small", "medium"]}>
                  {t("proposals.detail.notesTitle")}
                </Typography>
                <Typography variant="p" affects={["muted", "small", "removePMargin"]}>
                  {proposal.notes}
                </Typography>
              </div>
            ) : null}
          </div>
          <div className="flex flex-col gap-6">
            <ProposalSummaryCard proposal={proposal} />
            <ProposalPublicLinkCard publicPath={proposal.publicPath} />
          </div>
        </div>
        <SendProposalDialog
          open={sendOpen}
          isSending={isSending}
          onOpenChange={(open) => {
            if (!isSending) setSendOpen(open)
          }}
          onConfirm={onConfirmSend}
        />
        <DeleteProposalDialog
          open={deleteOpen}
          isDeleting={isDeleting}
          onOpenChange={(open) => {
            if (!isDeleting) setDeleteOpen(open)
          }}
          onConfirm={onConfirmDelete}
        />
      </div>
    </ScrollArea>
  )
}

export { ProposalDetailPage }
