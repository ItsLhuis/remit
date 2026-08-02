"use client"

import { type Control, Controller, type UseFormSetValue } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Typography
} from "@/components/ui"

import { type ContractFormInputValues, type ContractFormValues } from "../../schemas"
import { type ContractTemplateOption } from "../../types"

import { fromSelectValue, toSelectValue, NO_SELECTION } from "./selectValue"

type ContractContentFieldProps = {
  control: Control<ContractFormInputValues, unknown, ContractFormValues>
  setValue: UseFormSetValue<ContractFormInputValues>
  templates: ContractTemplateOption[]
  blockCount: number
  disabled: boolean
}

// The contract body is authored in the template editor, not here: picking a contract template copies
// its blocks into this draft, and the count below is a read-only confirmation of what was copied.
// The canvas itself is bound to a template row (features/templates' TemplateEditorPage takes a
// TemplateEditorData and saves through the template mutations), so it cannot edit contracts.blocks
// without being reworked.
const ContractContentField = ({
  control,
  setValue,
  templates,
  blockCount,
  disabled
}: ContractContentFieldProps) => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-4">
      <Controller
        name="templateId"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>{t("contracts.fields.template")}</FieldLabel>
            <Select
              value={toSelectValue(field.value)}
              onValueChange={(value) => {
                const templateId = fromSelectValue(value)

                field.onChange(templateId)

                const template = templates.find((option) => option.id === templateId)

                if (template) setValue("blocks", template.blocks, { shouldDirty: true })
              }}
              disabled={disabled}
            >
              <SelectTrigger id={field.name} aria-invalid={fieldState.invalid}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={NO_SELECTION}>{t("contracts.form.noTemplate")}</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldDescription>{t("contracts.form.contentDescription")}</FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Typography affects={["muted", "small"]}>
        {blockCount > 0
          ? t("contracts.form.blockCount", { count: blockCount })
          : t("contracts.form.blocksEmpty")}
      </Typography>
    </div>
  )
}

export { ContractContentField }
