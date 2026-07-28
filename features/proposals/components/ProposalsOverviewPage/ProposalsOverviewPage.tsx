"use client"

import { useMemo, useTransition } from "react"

import { useRouter } from "next/navigation"

import Link from "next/link"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  DataTable,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Icon,
  ScrollArea,
  SidebarTrigger,
  Typography
} from "@/components/ui"

import { useDataTable, type ColumnDef } from "@/hooks"

import { useProposalOverviewState } from "../../hooks"
import { type ProposalOverviewItem, type ProposalOverviewPageData } from "../../types"
import { ProposalsSummaryBand } from "../ProposalsSummaryBand"

import { getProposalOverviewColumns } from "./columns"
import { ProposalsOverviewToolbar } from "./ProposalsOverviewToolbar"

type ProposalsOverviewPageProps = {
  data: ProposalOverviewPageData
}

const ProposalsOverviewPage = ({ data }: ProposalsOverviewPageProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [isPending, startTransition] = useTransition()

  const { search, setSearch } = useProposalOverviewState(startTransition)

  const locale = data.defaults.defaultLocale

  const columns = useMemo<ColumnDef<ProposalOverviewItem>[]>(
    () => getProposalOverviewColumns({ t, locale, clients: data.filterOptions.clients }),
    [t, locale, data.filterOptions.clients]
  )

  const { table } = useDataTable({
    data: data.proposals,
    columns,
    getRowId: (proposal) => proposal.id,
    rowCount: data.rowCount,
    shallow: false,
    startTransition,
    columnVisibilityStorageKey: "proposals-overview:column-visibility",
    initialState: {
      sorting: [{ id: "validUntil", desc: false }],
      columnVisibility: { created: false }
    }
  })

  const hasActiveFilters = search !== "" || table.getState().columnFilters.length > 0
  const hasNoProposals = data.rowCount === 0 && !hasActiveFilters

  const reset = () => {
    void setSearch("")

    table.resetColumnFilters()
  }

  return (
    <ScrollArea className="size-full">
      <div className="flex w-full flex-col gap-6 p-4 md:p-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="md:hidden" />
              <Icon
                name="FileText"
                className="text-muted-foreground size-6 shrink-0"
                aria-hidden="true"
              />
              <Typography variant="h2">{t("proposals.overview.title")}</Typography>
            </div>
            <Typography variant="p" affects={["muted", "removePMargin"]}>
              {t("proposals.overview.description")}
            </Typography>
          </div>
          <Button variant="outline" asChild>
            <Link href="/projects">
              <Icon name="FolderOpen" aria-hidden="true" />
              {t("proposals.overview.browseProjects")}
            </Link>
          </Button>
        </header>
        <ProposalsSummaryBand
          summary={data.summary}
          currency={data.defaults.defaultCurrency}
          locale={locale}
          totalHint={t("proposals.overview.totalHint")}
        />
        <DataTable
          table={table}
          caption={t("proposals.overview.tableTitle")}
          onRowClick={(proposal) =>
            router.push(`/projects/${proposal.projectId}/proposals/${proposal.id}`)
          }
          isLoading={isPending}
          empty={
            hasNoProposals ? (
              <Empty className="border-0 py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Icon name="FileText" />
                  </EmptyMedia>
                  <EmptyTitle>{t("proposals.overview.emptyTitle")}</EmptyTitle>
                  <EmptyDescription>{t("proposals.overview.emptyDescription")}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button asChild>
                    <Link href="/projects">
                      <Icon name="FolderOpen" aria-hidden="true" />
                      {t("proposals.overview.browseProjects")}
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
                  <EmptyTitle>{t("proposals.overview.noMatchTitle")}</EmptyTitle>
                  <EmptyDescription>{t("proposals.overview.noMatchDescription")}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="outline" onClick={reset}>
                    {t("proposals.list.clearFilters")}
                  </Button>
                </EmptyContent>
              </Empty>
            )
          }
        >
          <ProposalsOverviewToolbar
            table={table}
            rowCount={data.rowCount}
            search={search}
            onSearchChange={setSearch}
            onReset={reset}
            hasClientOptions={data.filterOptions.clients.length > 0}
          />
        </DataTable>
      </div>
    </ScrollArea>
  )
}

export { ProposalsOverviewPage }
