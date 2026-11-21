"use client"

import { type Control, Controller } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import {
  Field,
  FieldError,
  FieldLabel,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui"

import { type ContractFormInputValues, type ContractFormValues } from "../../schemas"
import { type ContractParentOption } from "../../types"

import { fromSelectValue, toSelectValue, NO_SELECTION } from "./selectValue"

type ContractParentFieldsProps = {
  control: Control<ContractFormInputValues, unknown, ContractFormValues>
  projects: ContractParentOption[]
  clients: ContractParentOption[]
  disabled: boolean
}

const ContractParentFields = ({
  control,
  projects,
  clients,
  disabled
}: ContractParentFieldsProps) => {
  const { t } = useTranslation()

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Controller
        name="projectId"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>{t("contracts.fields.project")}</FieldLabel>
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
                  <SelectItem value={NO_SELECTION}>{t("contracts.form.noProject")}</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="clientId"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>{t("contracts.fields.client")}</FieldLabel>
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
                  <SelectItem value={NO_SELECTION}>{t("contracts.form.noClient")}</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
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
  )
}

export { ContractParentFields }
