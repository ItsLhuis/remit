"use client"

import { memo } from "react"

import { Controller, useWatch, type Control } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import {
  Card,
  CardContent,
  Field,
  FieldError,
  FieldLabel,
  Icon,
  IconButton,
  Input,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Typography
} from "@/components/ui"

import {
  RECURRING_INVOICE_DISCOUNT_KINDS,
  type RecurringInvoiceFormInputValues
} from "../../schemas"
import { type RecurringInvoiceTaxRateOption } from "../../types"

import { fromSelectValue, toSelectValue, NO_SELECTION } from "./selectSentinel"

type RecurringInvoiceLineItemRowProps = {
  control: Control<RecurringInvoiceFormInputValues>
  index: number
  taxRates: RecurringInvoiceTaxRateOption[]
  canRemove: boolean
  disabled: boolean
  onRemove: (index: number) => void
}

// Memoised so appending or removing a row leaves the rows either side untouched: every prop is a
// primitive or a stable reference (`control`, the tax-rate list, react-hook-form's `remove`), and
// each input subscribes to its own field through its Controller.
const RecurringInvoiceLineItemRow = memo(function RecurringInvoiceLineItemRow({
  control,
  index,
  taxRates,
  canRemove,
  disabled,
  onRemove
}: RecurringInvoiceLineItemRowProps) {
  const { t } = useTranslation()

  // This row's own field, never the whole form: only the two discount inputs below read it, so
  // changing a discount kind re-renders this row and nothing else.
  const discountKind = useWatch({ control, name: `lineItems.${index}.discountKind` })

  return (
    <Card size="sm" aria-label={t("invoices.lineItems.rowLabel", { position: index + 1 })}>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <Typography affects={["small", "medium"]}>
            {t("invoices.lineItems.rowLabel", { position: index + 1 })}
          </Typography>
          <IconButton
            variant="ghost"
            size="icon-sm"
            label={t("recurringInvoices.form.removeLineItem")}
            disabled={disabled || !canRemove}
            onClick={() => onRemove(index)}
          >
            <Icon name="Trash2" />
          </IconButton>
        </div>
        <Controller
          name={`lineItems.${index}.description`}
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>
                {t("invoices.lineItems.descriptionColumn")}
              </FieldLabel>
              <Input
                {...field}
                id={field.name}
                placeholder={t("invoices.placeholders.description")}
                aria-invalid={fieldState.invalid}
                disabled={disabled}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Controller
            name={`lineItems.${index}.quantity`}
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>
                  {t("invoices.lineItems.quantityColumn")}
                </FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  inputMode="decimal"
                  placeholder={t("invoices.placeholders.quantity")}
                  aria-invalid={fieldState.invalid}
                  disabled={disabled}
                  className="text-right font-mono tabular-nums"
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name={`lineItems.${index}.unit`}
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{t("invoices.lineItems.unitColumn")}</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  placeholder={t("invoices.placeholders.unit")}
                  aria-invalid={fieldState.invalid}
                  disabled={disabled}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name={`lineItems.${index}.unitPrice`}
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>
                  {t("invoices.lineItems.unitPriceColumn")}
                </FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  inputMode="decimal"
                  placeholder={t("invoices.placeholders.amount")}
                  aria-invalid={fieldState.invalid}
                  disabled={disabled}
                  className="text-right font-mono tabular-nums"
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name={`lineItems.${index}.taxRateId`}
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{t("invoices.lineItems.taxColumn")}</FieldLabel>
                <Select
                  value={toSelectValue(field.value)}
                  onValueChange={(value) => field.onChange(fromSelectValue(value))}
                  disabled={disabled}
                >
                  <SelectTrigger id={field.name} aria-invalid={fieldState.invalid}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={NO_SELECTION}>
                        {t("invoices.lineItems.noTaxRate")}
                      </SelectItem>
                      {taxRates.map((taxRate) => (
                        <SelectItem key={taxRate.id} value={taxRate.id}>
                          {taxRate.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            name={`lineItems.${index}.discountKind`}
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>
                  {t("invoices.lineItems.discountColumn")}
                </FieldLabel>
                <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                  <SelectTrigger id={field.name} aria-invalid={fieldState.invalid}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {RECURRING_INVOICE_DISCOUNT_KINDS.map((kind) => (
                        <SelectItem key={kind} value={kind}>
                          {t(`invoices.discount.${kind}`)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          {discountKind === "percentage" ? (
            <Controller
              name={`lineItems.${index}.discountPercentage`}
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>
                    {t("invoices.fields.discountPercentage")}
                  </FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    inputMode="decimal"
                    placeholder={t("invoices.placeholders.percentage")}
                    aria-invalid={fieldState.invalid}
                    disabled={disabled}
                    className="text-right font-mono tabular-nums"
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          ) : null}
          {discountKind === "fixed" ? (
            <Controller
              name={`lineItems.${index}.discountAmount`}
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>
                    {t("invoices.fields.discountAmount")}
                  </FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    inputMode="decimal"
                    placeholder={t("invoices.placeholders.amount")}
                    aria-invalid={fieldState.invalid}
                    disabled={disabled}
                    className="text-right font-mono tabular-nums"
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
})

export { RecurringInvoiceLineItemRow }
