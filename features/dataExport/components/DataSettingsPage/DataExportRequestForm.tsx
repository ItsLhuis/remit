"use client"

import { useState, useTransition } from "react"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Icon,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  toast
} from "@/components/ui"

import { dataExportScopeLabelKeys } from "../../labels"
import { requestDataExport } from "../../mutations"
import {
  DATA_EXPORT_SCOPE_VALUES,
  requestDataExportSchema,
  type RequestDataExportValues
} from "../../schemas"
import { type DataExportClientOption } from "../../types"

const emptyRequestValues: RequestDataExportValues = {
  scope: "instance",
  clientId: null
}

type DataExportRequestFormProps = {
  clients: DataExportClientOption[]
  hasActiveExport: boolean
  onRequested: () => void
}

const DataExportRequestForm = ({
  clients,
  hasActiveExport,
  onRequested
}: DataExportRequestFormProps) => {
  const { t } = useTranslation()

  const [serverError, setServerError] = useState<string | null>(null)

  const [isRequesting, startRequesting] = useTransition()

  const form = useForm<RequestDataExportValues>({
    resolver: zodResolver(requestDataExportSchema),
    mode: "onChange",
    defaultValues: emptyRequestValues
  })

  const { isValid } = form.formState

  const scope = useWatch({ control: form.control, name: "scope" })

  const submitDisabled = isRequesting || hasActiveExport || !isValid

  const onSubmit = (values: RequestDataExportValues) => {
    if (submitDisabled) return

    setServerError(null)

    startRequesting(async () => {
      const result = await requestDataExport(values)

      if ("error" in result) {
        setServerError(result.error)

        return
      }

      form.reset(emptyRequestValues)

      toast.success(t("settings.data.request.submitted"))

      onRequested()
    })
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("settings.data.request.title")}</CardTitle>
        <CardDescription>{t("settings.data.request.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
          <FieldGroup>
            <Controller
              name="scope"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>
                    {t("settings.data.request.scopeLabel")}
                  </FieldLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value)

                      // Clearing the client when the scope leaves `client` keeps the schema's refine
                      // from failing against a selection the form no longer shows.
                      if (value === "instance") form.setValue("clientId", null)
                    }}
                    disabled={isRequesting}
                  >
                    <SelectTrigger
                      ref={field.ref}
                      id={field.name}
                      className="w-full"
                      aria-invalid={fieldState.invalid}
                    >
                      <SelectValue placeholder={t("settings.data.request.scopeLabel")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {DATA_EXPORT_SCOPE_VALUES.map((value) => (
                          <SelectItem key={value} value={value}>
                            {t(dataExportScopeLabelKeys[value])}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    {field.value === "client"
                      ? t("settings.data.request.scopeClientHelp")
                      : t("settings.data.request.scopeInstanceHelp")}
                  </FieldDescription>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            {scope === "client" && (
              <Controller
                name="clientId"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>
                      {t("settings.data.request.clientLabel")}
                    </FieldLabel>
                    <Select
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                      disabled={isRequesting || clients.length === 0}
                    >
                      <SelectTrigger
                        ref={field.ref}
                        id={field.name}
                        className="w-full"
                        aria-invalid={fieldState.invalid}
                      >
                        <SelectValue placeholder={t("settings.data.request.clientPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {clients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    {clients.length === 0 && (
                      <FieldDescription>{t("settings.data.request.noClients")}</FieldDescription>
                    )}
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            )}
          </FieldGroup>
          <div className="flex flex-col gap-3">
            <Button type="submit" className="self-start" disabled={submitDisabled}>
              {isRequesting ? <Spinner /> : <Icon name="Download" aria-hidden="true" />}
              {t("settings.data.request.submit")}
            </Button>
            {hasActiveExport && (
              <FieldDescription>{t("settings.data.request.activeNotice")}</FieldDescription>
            )}
            {serverError && <FieldError>{serverError}</FieldError>}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export { DataExportRequestForm }
