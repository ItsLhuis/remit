"use client"

import { useMemo, useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import Link from "next/link"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  DataTable,
  DataTableViewOptions,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Icon,
  ScrollArea,
  SidebarTrigger,
  Typography,
  toast
} from "@/components/ui"

import { useDataTable, type ColumnDef } from "@/hooks"

import { softDeleteProposal } from "../../mutations"
import { type ProposalListItem, type ProposalListPageData } from "../../types"
import { DeleteProposalDialog } from "../DeleteProposalDialog"
import { ProposalsSummaryBand } from "../ProposalsSummaryBand"

import { getProposalColumns } from "./columns"

type ProposalsListPageProps = {
  data: ProposalListPageData
}

const ProposalsListPage = ({ data }: ProposalsListPageProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, startDeleting] = useTransition()
  const [isPending, startTransition] = useTransition()

  const locale = data.defaults.defaultLocale

  const columns = useMemo<ColumnDef<ProposalListItem>[]>(
    () => getProposalColumns({ t, locale, projectId: data.projectId, onDelete: setDeleteId }),
    [t, locale, data.projectId]
  )

  const { table } = useDataTable({
    data: data.proposals,
    columns,
    getRowId: (proposal) => proposal.id,
    rowCount: data.proposals.length,
    shallow: false,
    startTransition,
    columnVisibilityStorageKey: "proposals:column-visibility",
    initialState: { sorting: [{ id: "created", desc: true }] }
  })

  const hasFilters = table.getState().columnFilters.length > 0

  const createHref = `/projects/${data.projectId}/proposals/new`

  const onConfirmDelete = () => {
    if (isDeleting || !deleteId) return

    startDeleting(async () => {
      const result = await softDeleteProposal({ id: deleteId })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      toast.success(t("proposals.notifications.deleted"))

      setDeleteId(null)

      router.refresh()
    })
  }

  return (
    <ScrollArea className="size-full">
      <div className="flex w-full flex-col gap-6 p-4 md:p-8">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="md:hidden" />
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link href={`/projects/${data.projectId}`}>
              <Icon name="ArrowLeft" aria-hidden="true" />
              {t("proposals.list.backToProject")}
            </Link>
          </Button>
        </div>
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Icon
                name="FileText"
                className="text-muted-foreground size-6 shrink-0"
                aria-hidden="true"
              />
              <Typography variant="h2">{t("proposals.list.title")}</Typography>
            </div>
            <Typography variant="p" affects={["muted", "removePMargin"]}>
              {t("proposals.list.description")}
            </Typography>
          </div>
          <Button asChild>
            <Link href={createHref}>
              <Icon name="Plus" aria-hidden="true" />
              {t("proposals.list.createButton")}
            </Link>
          </Button>
        </header>
        <ProposalsSummaryBand
          summary={data.summary}
          currency={data.currency}
          locale={locale}
          totalHint={t("proposals.summary.totalHint")}
        />
        <DataTable
          table={table}
          caption={t("proposals.list.title")}
          onRowClick={(proposal) =>
            router.push(`/projects/${data.projectId}/proposals/${proposal.id}`)
          }
          isLoading={isPending}
          empty={
            data.proposals.length === 0 ? (
              <Empty className="border-0 py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Icon name="FileText" />
                  </EmptyMedia>
                  <EmptyTitle>{t("proposals.empty.title")}</EmptyTitle>
                  <EmptyDescription>{t("proposals.empty.description")}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button asChild>
                    <Link href={createHref}>
                      <Icon name="Plus" aria-hidden="true" />
                      {t("proposals.actions.create")}
                    </Link>
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <Empty className="border-0 py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Icon name="SearchX" />
                  </EmptyMedia>
                  <EmptyTitle>{t("proposals.empty.title")}</EmptyTitle>
                  <EmptyDescription>{t("proposals.empty.description")}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="outline" onClick={() => table.resetColumnFilters()}>
                    {t("proposals.list.clearFilters")}
                  </Button>
                </EmptyContent>
              </Empty>
            )
          }
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-0.5">
              <Typography affects={["small", "medium"]}>{t("proposals.list.title")}</Typography>
              <Typography affects={["muted", "tiny"]}>
                {t("proposals.list.count", { count: data.proposals.length })}
              </Typography>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {hasFilters ? (
                <Button variant="ghost" size="sm" onClick={() => table.resetColumnFilters()}>
                  <Icon name="X" aria-hidden="true" />
                  {t("proposals.list.clearFilters")}
                </Button>
              ) : null}
              <DataTableViewOptions table={table} />
            </div>
          </div>
        </DataTable>
        <DeleteProposalDialog
          open={deleteId !== null}
          isDeleting={isDeleting}
          onOpenChange={(open) => {
            if (!open && !isDeleting) setDeleteId(null)
          }}
          onConfirm={onConfirmDelete}
        />
      </div>
    </ScrollArea>
  )
}

export { ProposalsListPage }
