"use client"

import { Fragment, useEffect, useMemo, useState, useTransition } from "react"

import { useRouter } from "next/navigation"

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
  Typography,
  toast
} from "@/components/ui"

import { useDataTable, type ColumnDef } from "@/hooks"

import { deleteTaxRate, setDefaultTaxRate } from "../../mutations"
import { type TaxRateListItem } from "../../schemas"

import { getTaxRateColumns } from "./columns"
import { DeleteTaxRateDialog } from "./DeleteTaxRateDialog"
import { TaxRateFormDialog, type TaxRateFormState } from "./TaxRateFormDialog"

type TaxRatesSettingsFormProps = {
  initialTaxRates: TaxRateListItem[]
}

function sortTaxRates(taxRates: TaxRateListItem[]): TaxRateListItem[] {
  return taxRates.toSorted((first, second) => {
    if (first.isDefault !== second.isDefault) return first.isDefault ? -1 : 1

    return first.name.localeCompare(second.name)
  })
}

const TaxRatesSettingsForm = ({ initialTaxRates }: TaxRatesSettingsFormProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [taxRates, setTaxRates] = useState(initialTaxRates)
  const [activeDialog, setActiveDialog] = useState<
    | { kind: "form"; state: NonNullable<TaxRateFormState> }
    | { kind: "delete"; taxRate: TaxRateListItem }
    | null
  >(null)

  const [isDefaultPending, startDefaultTransition] = useTransition()
  const [isDeletePending, startDeleteTransition] = useTransition()

  useEffect(() => {
    setTaxRates(initialTaxRates)
  }, [initialTaxRates])

  const sortedTaxRates = useMemo(() => sortTaxRates(taxRates), [taxRates])
  const defaultTaxRate = sortedTaxRates.find((taxRate) => taxRate.isDefault) ?? null

  const formState = activeDialog?.kind === "form" ? activeDialog.state : null
  const deleteTarget = activeDialog?.kind === "delete" ? activeDialog.taxRate : null

  const isBusy = isDefaultPending || isDeletePending

  const columns = useMemo<ColumnDef<TaxRateListItem>[]>(() => {
    const onSetDefault = (taxRate: TaxRateListItem) => {
      if (taxRate.isDefault || isBusy) return

      startDefaultTransition(async () => {
        const result = await setDefaultTaxRate({ id: taxRate.id })

        if ("error" in result) {
          toast.error(result.error)

          return
        }

        setTaxRates((currentTaxRates) =>
          sortTaxRates(
            currentTaxRates.map((currentTaxRate) => ({
              ...currentTaxRate,
              isDefault: currentTaxRate.id === result.data.taxRate.id
            }))
          )
        )

        toast.success(t("settings.taxRates.defaultUpdated"))

        router.refresh()
      })
    }

    return getTaxRateColumns({
      t,
      isBusy,
      onEdit: (taxRate) => setActiveDialog({ kind: "form", state: { mode: "edit", taxRate } }),
      onSetDefault,
      onDelete: (taxRate) => setActiveDialog({ kind: "delete", taxRate })
    })
  }, [t, isBusy, router])

  const { table } = useDataTable({
    data: sortedTaxRates,
    columns,
    getRowId: (taxRate) => taxRate.id,
    enableRowSelection: false,
    columnVisibilityStorageKey: "tax-rates:column-visibility",
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } }
  })

  const onSaved = (taxRate: TaxRateListItem) => {
    setTaxRates((currentTaxRates) => {
      const existing = currentTaxRates.some((currentTaxRate) => currentTaxRate.id === taxRate.id)

      if (existing) {
        return sortTaxRates(
          currentTaxRates.map((currentTaxRate) =>
            currentTaxRate.id === taxRate.id ? taxRate : currentTaxRate
          )
        )
      }

      return sortTaxRates([...currentTaxRates, taxRate])
    })

    setActiveDialog(null)

    router.refresh()
  }

  const onDelete = () => {
    if (!deleteTarget || isDeletePending) return

    startDeleteTransition(async () => {
      const result = await deleteTaxRate({ id: deleteTarget.id })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      setTaxRates((currentTaxRates) =>
        currentTaxRates.filter((taxRate) => taxRate.id !== result.data.id)
      )
      setActiveDialog(null)

      toast.success(t("settings.taxRates.deleted"))

      router.refresh()
    })
  }

  return (
    <Fragment>
      <DataTable
        table={table}
        caption={t("settings.taxRates.listTitle")}
        empty={
          <Empty className="border-0 py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Icon name="Percent" />
              </EmptyMedia>
              <EmptyTitle>{t("settings.taxRates.emptyTitle")}</EmptyTitle>
              <EmptyDescription>{t("settings.taxRates.emptyDescription")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                type="button"
                onClick={() => setActiveDialog({ kind: "form", state: { mode: "create" } })}
              >
                <Icon name="Plus" aria-hidden="true" />
                {t("settings.taxRates.addRate")}
              </Button>
            </EmptyContent>
          </Empty>
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-0.5">
            <Typography affects={["small", "medium"]}>
              {t("settings.taxRates.listTitle")}
            </Typography>
            <Typography affects={["muted", "tiny"]}>
              {defaultTaxRate
                ? t("settings.taxRates.currentDefault", { name: defaultTaxRate.name })
                : t("settings.taxRates.noDefault")}
            </Typography>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <DataTableViewOptions table={table} />
            <Button
              type="button"
              size="sm"
              onClick={() => setActiveDialog({ kind: "form", state: { mode: "create" } })}
            >
              <Icon name="Plus" aria-hidden="true" />
              {t("settings.taxRates.addRate")}
            </Button>
          </div>
        </div>
      </DataTable>
      <TaxRateFormDialog
        formState={formState}
        onOpenChange={(open) => {
          if (!open) setActiveDialog(null)
        }}
        onSaved={onSaved}
      />
      <DeleteTaxRateDialog
        taxRate={deleteTarget}
        isDeleting={isDeletePending}
        onOpenChange={(open) => {
          if (!open && !isDeletePending) setActiveDialog(null)
        }}
        onConfirm={onDelete}
      />
    </Fragment>
  )
}

export { TaxRatesSettingsForm }
