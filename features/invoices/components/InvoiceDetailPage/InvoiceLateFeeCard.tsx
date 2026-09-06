"use client"

import { useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import { formatCentsForInput, formatCurrency, formatDate } from "@/lib/utils"

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldError,
  FieldLabel,
  Input,
  Spinner,
  toast,
  Typography
} from "@/components/ui"

import { adjustInvoiceLateFee } from "../../mutations"
import { adjustInvoiceLateFeeSchema, type AdjustInvoiceLateFeeValues } from "../../schemas"
import { type InvoiceLateFee } from "../../types"

// The three copy variants arrive as callbacks rather than the helper importing `t` itself, because a
// file-private helper sits above the component and cannot reach its `useTranslation` hook.
type LateFeePolicyCopy = {
  unknown: string
  percentage: (percentage: number) => string
  fixed: (amount: string) => string
}

function describeLateFeePolicy(
  policy: InvoiceLateFee["policy"],
  currency: string,
  locale: string,
  copy: LateFeePolicyCopy
): string {
  if (policy === null) return copy.unknown

  if (policy.kind === "percentage") return copy.percentage(policy.percentage)

  return copy.fixed(formatCurrency(policy.amountCents, currency, locale))
}

type InvoiceLateFeeCardProps = {
  invoiceId: string
  currency: string
  locale: string
  timeZone: string
  lateFee: InvoiceLateFee
}

const InvoiceLateFeeCard = ({
  invoiceId,
  currency,
  locale,
  timeZone,
  lateFee
}: InvoiceLateFeeCardProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [adjustOpen, setAdjustOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSaving, startSaving] = useTransition()

  const form = useForm<AdjustInvoiceLateFeeValues>({
    resolver: zodResolver(adjustInvoiceLateFeeSchema),
    mode: "onSubmit",
    defaultValues: { id: invoiceId, lateFee: formatCentsForInput(lateFee.feeCents) }
  })

  const { isSubmitting } = form.formState

  const isWaived = lateFee.feeCents === 0

  const policyDescription = describeLateFeePolicy(lateFee.policy, currency, locale, {
    unknown: t("invoices.detail.lateFeeUnknownPolicy"),
    percentage: (percentage) => t("invoices.detail.lateFeePercentagePolicy", { percentage }),
    fixed: (amount) => t("invoices.detail.lateFeeFixedPolicy", { amount })
  })

  const onOpenChange = (open: boolean) => {
    if (isSaving) return

    setServerError(null)
    form.reset({ id: invoiceId, lateFee: formatCentsForInput(lateFee.feeCents) })
    setAdjustOpen(open)
  }

  const onWaive = () => {
    setServerError(null)
    form.reset({ id: invoiceId, lateFee: formatCentsForInput(0) })
    setAdjustOpen(true)
  }

  const onSubmit = (values: AdjustInvoiceLateFeeValues) => {
    setServerError(null)

    startSaving(async () => {
      const result = await adjustInvoiceLateFee(values)

      if ("error" in result) {
        setServerError(result.error)

        return
      }

      toast.success(t("invoices.notifications.lateFeeUpdated"))

      setAdjustOpen(false)

      router.refresh()
    })
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("invoices.detail.lateFeeTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <span className="font-mono text-lg font-semibold tabular-nums" aria-live="polite">
            {formatCurrency(lateFee.feeCents, currency, locale)}
          </span>
          {isWaived ? (
            <Badge variant="secondary">{t("invoices.detail.lateFeeWaived")}</Badge>
          ) : null}
        </div>
        <Typography variant="p" affects={["muted", "small", "removePMargin"]}>
          {lateFee.appliedAt && lateFee.daysLate !== null
            ? t("invoices.detail.lateFeeChargedOn", {
                date: formatDate(lateFee.appliedAt, { locale, timeZone }),
                days: lateFee.daysLate
              })
            : t("invoices.detail.lateFeeDescription")}
        </Typography>
        <Typography variant="p" affects={["muted", "small", "removePMargin"]}>
          {policyDescription}
        </Typography>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(true)}>
            {t("invoices.detail.lateFeeAdjust")}
          </Button>
          {isWaived ? null : (
            <Button type="button" variant="outline" size="sm" onClick={onWaive}>
              {t("invoices.detail.lateFeeWaive")}
            </Button>
          )}
        </div>
        <Dialog open={adjustOpen} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>{t("invoices.detail.lateFeeDialogTitle")}</DialogTitle>
                <DialogDescription>
                  {t("invoices.detail.lateFeeDialogDescription")}
                </DialogDescription>
              </DialogHeader>
              <Controller
                name="lateFee"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>
                      {t("invoices.detail.lateFeeAmountLabel")}
                    </FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      inputMode="decimal"
                      aria-invalid={fieldState.invalid}
                      disabled={isSaving}
                      autoComplete="off"
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <DialogFooter>
                {serverError && <FieldError className="sm:mr-auto">{serverError}</FieldError>}
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={isSaving}>
                    {t("common.actions.cancel")}
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={isSaving || isSubmitting}>
                  {isSaving && <Spinner />}
                  {t("invoices.detail.lateFeeSave")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

export { InvoiceLateFeeCard }
