"use client"

import { Controller, type Control } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import { formatCurrency } from "@/lib/utils"

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
  INVOICE_DISCOUNT_KINDS,
  type InvoiceFormInputValues,
  type InvoiceFormValues
} from "../../schemas"
import { type InvoiceTaxRateOption } from "../../types"

import { fromSelectValue, toSelectValue, NO_SELECTION } from "./selectSentinel"

type InvoiceLineItemRowProps = {
  control: Control<InvoiceFormInputValues, unknown, InvoiceFormValues>
  index: number
  taxRates: InvoiceTaxRateOption[]
  currency: string
  locale: string
  lineTotalCents: number
  discountKind: string
  canRemove: boolean
  disabled: boolean
  onRemove: () => void
}

const InvoiceLineItemRow = ({
  control,
  index,
  taxRates,
  currency,
  locale,
  lineTotalCents,
  discountKind,
  canRemove,
  disabled,
  onRemove
}: InvoiceLineItemRowProps) => {
  const { t } = useTranslation()

  return (
    <Card size="sm" aria-label={t("invoices.lineItems.rowLabel", { position: index + 1 })}>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <Typography affects={["small", "medium"]}>
            {t("invoices.lineItems.rowLabel", { position: index + 1 })}
          </Typography>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium tabular-nums">
              {formatCurrency(lineTotalCents, currency, locale)}
            </span>
            <IconButton
              variant="ghost"
              size="icon-sm"
              label={t("invoices.lineItems.removeButton")}
              disabled={disabled || !canRemove}
              onClick={onRemove}
            >
              <Icon name="Trash2" />
            </IconButton>
          </div>
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
                      {INVOICE_DISCOUNT_KINDS.map((kind) => (
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
}

export { InvoiceLineItemRow }
