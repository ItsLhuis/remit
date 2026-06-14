"use client"

import { useEffect, useMemo, useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { useTranslation } from "@/lib/i18n"

import { formatPercentage } from "@/lib/utils"

import { deleteTaxRate, setDefaultTaxRate } from "../../mutations"
import { type TaxRateListItem } from "../../schemas"

import {
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  FieldError,
  Icon,
  IconButton,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
  Typography
} from "@/components/ui"

import { DeleteTaxRateDialog } from "./DeleteTaxRateDialog"
import { TaxRateFormDialog, type TaxRateFormState } from "./TaxRateFormDialog"

type TaxRatesSettingsFormProps = {
  initialTaxRates: TaxRateListItem[]
}

function sortTaxRates(taxRates: TaxRateListItem[]): TaxRateListItem[] {
  return [...taxRates].sort((first, second) => {
    if (first.isDefault !== second.isDefault) return first.isDefault ? -1 : 1

    return first.name.localeCompare(second.name)
  })
}

const TaxRatesSettingsForm = ({ initialTaxRates }: TaxRatesSettingsFormProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [taxRates, setTaxRates] = useState(initialTaxRates)
  const [formState, setFormState] = useState<TaxRateFormState>(null)
  const [deleteTarget, setDeleteTarget] = useState<TaxRateListItem | null>(null)

  const [actionError, setActionError] = useState<string | null>(null)
  const [pendingDefaultId, setPendingDefaultId] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const [isDefaultPending, startDefaultTransition] = useTransition()
  const [isDeletePending, startDeleteTransition] = useTransition()

  useEffect(() => {
    setTaxRates(initialTaxRates)
  }, [initialTaxRates])

  const sortedTaxRates = useMemo(() => sortTaxRates(taxRates), [taxRates])
  const defaultTaxRate = sortedTaxRates.find((taxRate) => taxRate.isDefault) ?? null

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

    setActionError(null)
    setFormState(null)

    router.refresh()
  }

  const onSetDefault = (taxRate: TaxRateListItem) => {
    if (taxRate.isDefault || isDefaultPending) return

    setActionError(null)
    setPendingDefaultId(taxRate.id)

    startDefaultTransition(async () => {
      try {
        const result = await setDefaultTaxRate({ id: taxRate.id })

        if ("error" in result) {
          setActionError(result.error)

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

        router.refresh()

        toast.success(t("settings.taxRates.defaultUpdated"))
      } finally {
        setPendingDefaultId(null)
      }
    })
  }

  const onDelete = () => {
    if (!deleteTarget || isDeletePending) return

    setActionError(null)
    setPendingDeleteId(deleteTarget.id)

    startDeleteTransition(async () => {
      try {
        const result = await deleteTaxRate({ id: deleteTarget.id })

        if ("error" in result) {
          setActionError(result.error)

          return
        }

        setTaxRates((currentTaxRates) =>
          currentTaxRates.filter((taxRate) => taxRate.id !== result.data.id)
        )
        setDeleteTarget(null)

        router.refresh()

        toast.success(t("settings.taxRates.deleted"))
      } finally {
        setPendingDeleteId(null)
      }
    })
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("settings.taxRates.listTitle")}</CardTitle>
        <CardDescription>
          {defaultTaxRate
            ? t("settings.taxRates.currentDefault", { name: defaultTaxRate.name })
            : t("settings.taxRates.noDefault")}
        </CardDescription>
        <CardAction>
          <Button type="button" onClick={() => setFormState({ mode: "create" })}>
            <Icon name="Plus" />
            {t("settings.taxRates.addRate")}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        {actionError && <FieldError>{actionError}</FieldError>}
        {sortedTaxRates.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Typography affects="small">{t("settings.taxRates.tableName")}</Typography>
                </TableHead>
                <TableHead>
                  <Typography affects="small">{t("settings.taxRates.tableRate")}</Typography>
                </TableHead>
                <TableHead>
                  <Typography affects="small">{t("settings.taxRates.tableStatus")}</Typography>
                </TableHead>
                <TableHead className="text-right">
                  <Typography affects="small">{t("settings.taxRates.tableActions")}</Typography>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTaxRates.map((taxRate) => (
                <TableRow key={taxRate.id}>
                  <TableCell>
                    <Typography affects="medium">{taxRate.name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography>
                      {t("settings.taxRates.percentageValue", {
                        percentage: formatPercentage(taxRate.percentage)
                      })}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {taxRate.isDefault ? (
                      <Badge variant="success">
                        <Icon name="BadgeCheck" />
                        {t("settings.taxRates.defaultBadge")}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">{t("settings.taxRates.notDefaultBadge")}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <IconButton
                        label={t("settings.taxRates.editRate")}
                        size="icon-sm"
                        onClick={() => setFormState({ mode: "edit", taxRate })}
                        disabled={isDefaultPending || isDeletePending}
                      >
                        <Icon name="Pencil" />
                      </IconButton>
                      <IconButton
                        label={t("settings.taxRates.makeDefault")}
                        size="icon-sm"
                        onClick={() => onSetDefault(taxRate)}
                        disabled={taxRate.isDefault || isDefaultPending || isDeletePending}
                      >
                        {pendingDefaultId === taxRate.id ? <Spinner /> : <Icon name="BadgeCheck" />}
                      </IconButton>
                      <IconButton
                        label={t("settings.taxRates.deleteRate")}
                        size="icon-sm"
                        variant="destructive"
                        onClick={() => setDeleteTarget(taxRate)}
                        disabled={isDefaultPending || isDeletePending}
                      >
                        {pendingDeleteId === taxRate.id ? <Spinner /> : <Icon name="Trash2" />}
                      </IconButton>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Icon name="Percent" />
              </EmptyMedia>
              <EmptyTitle>{t("settings.taxRates.emptyTitle")}</EmptyTitle>
              <EmptyDescription>{t("settings.taxRates.emptyDescription")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button type="button" onClick={() => setFormState({ mode: "create" })}>
                <Icon name="Plus" />
                {t("settings.taxRates.addRate")}
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </CardContent>
      <TaxRateFormDialog
        formState={formState}
        onOpenChange={(open) => {
          if (!open) setFormState(null)
        }}
        onSaved={onSaved}
      />
      <DeleteTaxRateDialog
        taxRate={deleteTarget}
        isDeleting={isDeletePending}
        onOpenChange={(open) => {
          if (!open && !isDeletePending) setDeleteTarget(null)
        }}
        onConfirm={onDelete}
      />
    </Card>
  )
}

export { TaxRatesSettingsForm }
