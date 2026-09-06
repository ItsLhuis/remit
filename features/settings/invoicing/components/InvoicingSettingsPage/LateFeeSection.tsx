"use client"

import { type Control, Controller, useWatch } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  NumberInput,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Typography
} from "@/components/ui"

import { type InvoicingSettingsInputValues, type InvoicingSettingsValues } from "../../schemas"

type LateFeeSectionProps = {
  control: Control<InvoicingSettingsInputValues, unknown, InvoicingSettingsValues>
  disabled: boolean
}

const LateFeeSection = ({ control, disabled }: LateFeeSectionProps) => {
  const { t } = useTranslation()

  // Only the type is watched: it decides which of the two amount fields is on screen, and watching
  // the switch as well would re-render the section on every toggle for nothing.
  const lateFeeType = useWatch({ control, name: "lateFeeType" })

  return (
    <FieldGroup>
      <div className="space-y-1">
        <Typography variant="h4">{t("settings.invoicing.lateFeeSection")}</Typography>
        <Typography variant="p" affects={["muted", "removePMargin", "small"]}>
          {t("settings.invoicing.lateFeeSectionDescription")}
        </Typography>
      </div>
      <Controller
        name="lateFeeEnabled"
        control={control}
        render={({ field, fieldState }) => (
          <Field orientation="horizontal" data-invalid={fieldState.invalid}>
            <Switch
              id={field.name}
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={disabled}
              aria-invalid={fieldState.invalid}
            />
            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor={field.name}>{t("settings.invoicing.lateFeeEnabled")}</FieldLabel>
              <FieldDescription>{t("settings.invoicing.lateFeeEnabledHelp")}</FieldDescription>
            </div>
          </Field>
        )}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Controller
          name="lateFeeType"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>{t("settings.invoicing.lateFeeType")}</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                <SelectTrigger
                  ref={field.ref}
                  id={field.name}
                  className="w-full"
                  aria-invalid={fieldState.invalid}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="percentage">
                      {t("settings.invoicing.lateFeeTypePercentage")}
                    </SelectItem>
                    <SelectItem value="fixed">
                      {t("settings.invoicing.lateFeeTypeFixed")}
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>{t("settings.invoicing.lateFeeTypeHelp")}</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        {lateFeeType === "percentage" ? (
          <Controller
            name="lateFeePercentage"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>
                  {t("settings.invoicing.lateFeePercentage")}
                </FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  inputMode="decimal"
                  aria-invalid={fieldState.invalid}
                  disabled={disabled}
                  autoComplete="off"
                />
                <FieldDescription>{t("settings.invoicing.lateFeePercentageHelp")}</FieldDescription>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        ) : (
          <Controller
            name="lateFeeAmount"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>
                  {t("settings.invoicing.lateFeeAmount")}
                </FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  inputMode="decimal"
                  aria-invalid={fieldState.invalid}
                  disabled={disabled}
                  autoComplete="off"
                />
                <FieldDescription>{t("settings.invoicing.lateFeeAmountHelp")}</FieldDescription>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        )}
        <Controller
          name="lateFeeGraceDays"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>
                {t("settings.invoicing.lateFeeGraceDays")}
              </FieldLabel>
              <NumberInput
                id={field.name}
                name={field.name}
                ref={field.ref}
                value={field.value}
                onBlur={field.onBlur}
                onChange={(event) => field.onChange(Number(event.target.value))}
                min={0}
                max={365}
                step={1}
                inputMode="numeric"
                aria-invalid={fieldState.invalid}
                disabled={disabled}
              />
              <FieldDescription>{t("settings.invoicing.lateFeeGraceDaysHelp")}</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="lateFeeMax"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>{t("settings.invoicing.lateFeeMax")}</FieldLabel>
              <Input
                {...field}
                id={field.name}
                inputMode="decimal"
                placeholder={t("settings.invoicing.lateFeeMaxPlaceholder")}
                aria-invalid={fieldState.invalid}
                disabled={disabled}
                autoComplete="off"
              />
              <FieldDescription>{t("settings.invoicing.lateFeeMaxHelp")}</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </div>
    </FieldGroup>
  )
}

export { LateFeeSection }
