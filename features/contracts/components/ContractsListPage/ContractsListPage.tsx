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

import { useContractListState } from "../../hooks"
import { type ContractListItem, type ContractsPageData } from "../../types"
import { getContractColumns } from "../contractColumns"

import { ContractsListToolbar } from "./ContractsListToolbar"
import { ContractsSummaryBand } from "./ContractsSummaryBand"

type ContractsListPageProps = {
  data: ContractsPageData
}

const ContractsListPage = ({ data }: ContractsListPageProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [isPending, startTransition] = useTransition()

  const { search, setSearch } = useContractListState(startTransition)

  const locale = data.defaults.defaultLocale

  const columns = useMemo<ColumnDef<ContractListItem>[]>(
    () => getContractColumns({ t, locale, clients: data.filterOptions.clients }),
    [t, locale, data.filterOptions.clients]
  )

  const { table } = useDataTable({
    data: data.contracts,
    columns,
    getRowId: (contract) => contract.id,
    rowCount: data.rowCount,
    shallow: false,
    startTransition,
    columnVisibilityStorageKey: "contracts-list:column-visibility",
    initialState: {
      sorting: [{ id: "created", desc: true }],
      columnVisibility: { client: false }
    }
  })

  const hasActiveFilters = search !== "" || table.getState().columnFilters.length > 0
  const hasNoContracts = data.rowCount === 0 && !hasActiveFilters

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
                name="FileSignature"
                className="text-muted-foreground size-6 shrink-0"
                aria-hidden="true"
              />
              <Typography variant="h2">{t("contracts.title")}</Typography>
            </div>
            <Typography variant="p" affects={["muted", "removePMargin"]}>
              {t("contracts.subtitle")}
            </Typography>
          </div>
          <Button asChild>
            <Link href="/contracts/new">
              <Icon name="Plus" aria-hidden="true" />
              {t("contracts.actions.create")}
            </Link>
          </Button>
        </header>
        <ContractsSummaryBand summary={data.summary} locale={locale} />
        <DataTable
          table={table}
          caption={t("contracts.title")}
          onRowClick={(contract) => router.push(`/contracts/${contract.id}`)}
          isLoading={isPending}
          empty={
            hasNoContracts ? (
              <Empty className="border-0 py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Icon name="FileSignature" />
                  </EmptyMedia>
                  <EmptyTitle>{t("contracts.empty.title")}</EmptyTitle>
                  <EmptyDescription>{t("contracts.empty.description")}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button asChild>
                    <Link href="/contracts/new">
                      <Icon name="Plus" aria-hidden="true" />
                      {t("contracts.actions.create")}
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
                  <EmptyTitle>{t("contracts.empty.noMatchTitle")}</EmptyTitle>
                  <EmptyDescription>{t("contracts.empty.noMatchDescription")}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="outline" onClick={reset}>
                    {t("contracts.filters.clearFilters")}
                  </Button>
                </EmptyContent>
              </Empty>
            )
          }
        >
          <ContractsListToolbar
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

export { ContractsListPage }
