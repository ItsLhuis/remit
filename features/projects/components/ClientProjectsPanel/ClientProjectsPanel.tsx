"use client"

import { useMemo, useState } from "react"

import { useRouter } from "next/navigation"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  DataTable,
  DataTableFacetedFilter,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Icon,
  Typography
} from "@/components/ui"

import { useDataTable, type ColumnDef } from "@/hooks"

import { type ProjectListItem } from "../../types"
import { ProjectFormSheet } from "../ProjectFormSheet"

import { getClientProjectColumns } from "./columns"

type ClientProjectsPanelProps = {
  clientId: string
  clientName: string
  clientCurrency: string
  projects: ProjectListItem[]
  locale: string
}

const ClientProjectsPanel = ({
  clientId,
  clientName,
  clientCurrency,
  projects,
  locale
}: ClientProjectsPanelProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [createOpen, setCreateOpen] = useState(false)

  const columns = useMemo<ColumnDef<ProjectListItem>[]>(
    () => getClientProjectColumns(t, locale),
    [t, locale]
  )

  const { table } = useDataTable({
    data: projects,
    columns,
    getRowId: (project) => project.id,
    enableRowSelection: false,
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } }
  })

  const stageColumn = table.getColumn("stage")

  return (
    <>
      <DataTable
        table={table}
        caption={t("projects.clientPanel.title")}
        onRowClick={(project) => router.push(`/projects/${project.id}`)}
        empty={
          <Empty className="border-0 py-8">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Icon name="FolderOpen" />
              </EmptyMedia>
              <EmptyTitle>{t("projects.clientPanel.emptyTitle")}</EmptyTitle>
              <EmptyDescription>{t("projects.clientPanel.emptyDescription")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Typography affects={["small", "medium"]}>{t("projects.clientPanel.title")}</Typography>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {stageColumn ? (
              <DataTableFacetedFilter column={stageColumn} title={t("projects.fields.status")} />
            ) : null}
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
              <Icon name="Plus" aria-hidden="true" />
              {t("projects.clientPanel.create")}
            </Button>
          </div>
        </div>
      </DataTable>
      <ProjectFormSheet
        mode="create"
        clients={[{ id: clientId, name: clientName, currency: clientCurrency }]}
        defaultClientId={clientId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={(project) => {
          setCreateOpen(false)

          router.push(`/projects/${project.id}`)
          router.refresh()
        }}
      />
    </>
  )
}

export { ClientProjectsPanel }
