"use client"

import { useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import Link from "next/link"

import { useTranslation } from "@/lib/i18n"

import { formatDate } from "@/lib/utils"

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Icon,
  ScrollArea,
  SidebarTrigger,
  Typography,
  toast
} from "@/components/ui"

import { sendContract, softDeleteContract, terminateContract } from "../../mutations"
import { getNextContractStatuses, isContractEditable } from "../../services"
import { type ContractDetail } from "../../types"
import { ContractStatusBadge } from "../ContractStatusBadge"
import { DeleteContractDialog } from "../DeleteContractDialog"
import { SendContractDialog } from "../SendContractDialog"
import { TerminateContractDialog } from "../TerminateContractDialog"

import { ContractPublicLinkCard } from "./ContractPublicLinkCard"
import { ContractSummaryCard } from "./ContractSummaryCard"

type ContractDetailPageProps = {
  contract: ContractDetail
  locale: string
  timeZone: string
}

const ContractDetailPage = ({ contract, locale, timeZone }: ContractDetailPageProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [sendOpen, setSendOpen] = useState(false)
  const [terminateOpen, setTerminateOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isSending, startSending] = useTransition()
  const [isTerminating, startTerminating] = useTransition()
  const [isDeleting, startDeleting] = useTransition()

  const isEditable = isContractEditable(contract.status)
  const canTerminate = getNextContractStatuses(contract.status).includes("terminated")

  const onConfirmSend = () => {
    if (isSending) return

    startSending(async () => {
      const result = await sendContract({ id: contract.id })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      toast.success(t("contracts.notifications.sent"))

      setSendOpen(false)

      router.refresh()
    })
  }

  const onConfirmTerminate = (terminationReason: string) => {
    if (isTerminating) return

    startTerminating(async () => {
      const result = await terminateContract({ id: contract.id, terminationReason })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      toast.success(t("contracts.notifications.terminated"))

      setTerminateOpen(false)

      router.refresh()
    })
  }

  const onConfirmDelete = () => {
    if (isDeleting) return

    startDeleting(async () => {
      const result = await softDeleteContract({ id: contract.id })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      toast.success(t("contracts.notifications.deleted"))

      router.push("/contracts")
      router.refresh()
    })
  }

  return (
    <ScrollArea className="size-full">
      <div className="flex w-full flex-col gap-6 p-4 md:p-8">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="md:hidden" />
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link href="/contracts">
              <Icon name="ArrowLeft" aria-hidden="true" />
              {t("contracts.detail.backToList")}
            </Link>
          </Button>
        </div>
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Typography variant="h2" className="font-mono">
                {contract.number}
              </Typography>
              <ContractStatusBadge status={contract.displayStatus} />
            </div>
            <Typography variant="p" affects={["muted", "removePMargin"]}>
              {contract.title}
            </Typography>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isEditable ? (
              <Button variant="outline" asChild>
                <Link href={`/contracts/${contract.id}/edit`}>
                  <Icon name="Pencil" aria-hidden="true" />
                  {t("contracts.actions.edit")}
                </Link>
              </Button>
            ) : null}
            {isEditable ? (
              <Button onClick={() => setSendOpen(true)}>
                <Icon name="Send" aria-hidden="true" />
                {t("contracts.actions.send")}
              </Button>
            ) : null}
            {canTerminate ? (
              <Button variant="outline" onClick={() => setTerminateOpen(true)}>
                <Icon name="Ban" aria-hidden="true" />
                {t("contracts.actions.terminate")}
              </Button>
            ) : null}
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Icon name="Trash2" aria-hidden="true" />
              {t("contracts.actions.delete")}
            </Button>
          </div>
        </header>
        {isEditable ? null : (
          <Alert>
            <Icon name="Lock" aria-hidden="true" />
            <AlertTitle>{t("contracts.detail.lockedTitle")}</AlertTitle>
            <AlertDescription>{t("contracts.detail.lockedDescription")}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <Card size="sm">
              <CardHeader>
                <CardTitle>{t("contracts.detail.contentTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                <Typography affects={["muted", "small"]}>
                  {contract.blocks.length > 0
                    ? t("contracts.form.blockCount", { count: contract.blocks.length })
                    : t("contracts.form.blocksEmpty")}
                </Typography>
              </CardContent>
            </Card>
            {contract.terminationReason ? (
              <Card size="sm">
                <CardHeader>
                  <CardTitle>{t("contracts.detail.terminationTitle")}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <Typography affects={["muted", "small"]}>
                    {contract.terminatedAt
                      ? formatDate(contract.terminatedAt, { locale, timeZone })
                      : ""}
                  </Typography>
                  <Typography variant="p" affects={["small", "removePMargin"]}>
                    {contract.terminationReason}
                  </Typography>
                </CardContent>
              </Card>
            ) : null}
          </div>
          <div className="flex flex-col gap-6">
            <ContractSummaryCard contract={contract} locale={locale} timeZone={timeZone} />
            <ContractPublicLinkCard
              contractId={contract.id}
              publicPath={contract.publicPath}
              publicLinkState={contract.publicLinkState}
            />
          </div>
        </div>
        <SendContractDialog
          open={sendOpen}
          isSending={isSending}
          onOpenChange={(open) => {
            if (!isSending) setSendOpen(open)
          }}
          onConfirm={onConfirmSend}
        />
        <TerminateContractDialog
          open={terminateOpen}
          isTerminating={isTerminating}
          onOpenChange={(open) => {
            if (!isTerminating) setTerminateOpen(open)
          }}
          onConfirm={onConfirmTerminate}
        />
        <DeleteContractDialog
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

export { ContractDetailPage }
