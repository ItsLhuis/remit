"use client"

import { useMemo, useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import { fromDateTimeLocalValue, toDateTimeLocalValue } from "@/lib/utils"

import {
  Button,
  FieldError,
  FieldGroup,
  FormTextField,
  Icon,
  ScrollArea,
  Spinner,
  toast
} from "@/components/ui"

import { createManualTimeEntry, updateTimeEntry } from "../../mutations"
import { timeEntryFormSchema, type TimeEntryFormInputValues } from "../../schemas"
import {
  type TimeEntryFormData,
  type TimeTrackingProjectOption,
  type TimeTrackingTaskOption
} from "../../types"
import { TimeEntryBillableField } from "../TimeEntryBillableField"
import { TimeEntryDateTimeField } from "../TimeEntryDateTimeField"
import { TimeEntryProjectField } from "../TimeEntryProjectField"
import { TimeEntryTaskField } from "../TimeEntryTaskField"

type TimeEntryFormProps = {
  projectOptions: TimeTrackingProjectOption[]
  taskOptions: TimeTrackingTaskOption[]
  onSuccess?: (entry: { id: string }) => void
  onCancel?: () => void
} & ({ mode: "create"; entry?: never } | { mode: "edit"; entry: TimeEntryFormData })

const TimeEntryForm = (props: TimeEntryFormProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [serverError, setServerError] = useState<string | null>(null)
  const [isSaving, startSaving] = useTransition()

  // Converted here rather than in `queries.ts` because the instants only become wall-clock readings
  // in the reader's zone, which the server does not know (see `lib/utils/datetime.ts`).
  const defaultValues = useMemo<TimeEntryFormInputValues>(() => {
    if (props.mode === "edit") {
      return {
        ...props.entry,
        startedAt: toDateTimeLocalValue(props.entry.startedAt),
        endedAt: toDateTimeLocalValue(props.entry.endedAt)
      }
    }

    return {
      projectId: "",
      taskId: "",
      description: "",
      startedAt: "",
      endedAt: "",
      billable: true,
      hourlyRate: ""
    }
  }, [props.mode, props.entry])

  const form = useForm<TimeEntryFormInputValues>({
    resolver: zodResolver(timeEntryFormSchema, {}, { raw: true }),
    mode: "onChange",
    defaultValues
  })

  const { isDirty, isValid } = form.formState

  const projectId = useWatch({ control: form.control, name: "projectId" })

  const isEdit = props.mode === "edit"

  const availableTasks = props.taskOptions.filter((task) => task.projectId === projectId)

  const submitDisabled = isSaving || !isValid || (isEdit && !isDirty)

  const onSubmit = (values: TimeEntryFormInputValues) => {
    if (submitDisabled) return

    const startedAt = fromDateTimeLocalValue(values.startedAt)
    const endedAt = fromDateTimeLocalValue(values.endedAt)

    if (!startedAt || !endedAt) {
      setServerError(t("timeTracking.validation.dateTimeInvalid"))

      return
    }

    setServerError(null)

    startSaving(async () => {
      const payload = { ...values, startedAt, endedAt }
      const result =
        props.mode === "edit"
          ? await updateTimeEntry({ ...payload, id: props.entry.id })
          : await createManualTimeEntry(payload)

      if ("error" in result) {
        setServerError(result.error)

        return
      }

      toast.success(isEdit ? t("timeTracking.form.updated") : t("timeTracking.form.created"))

      props.onSuccess?.({ id: result.data.entry.id })

      router.refresh()
    })
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="flex min-h-0 flex-1 flex-col"
    >
      <ScrollArea className="min-h-0 flex-1">
        <FieldGroup className="grid gap-4 p-4">
          <TimeEntryProjectField
            control={form.control}
            name="projectId"
            options={props.projectOptions}
            disabled={isSaving}
          />
          <TimeEntryTaskField
            control={form.control}
            name="taskId"
            options={availableTasks}
            disabled={isSaving}
          />
          <TimeEntryDateTimeField
            control={form.control}
            name="startedAt"
            label={t("timeTracking.fields.startedAt")}
            disabled={isSaving}
          />
          <TimeEntryDateTimeField
            control={form.control}
            name="endedAt"
            label={t("timeTracking.fields.endedAt")}
            disabled={isSaving}
          />
          <FormTextField
            control={form.control}
            name="description"
            label={t("timeTracking.fields.description")}
            placeholder={t("timeTracking.placeholders.description")}
            disabled={isSaving}
          />
          <FormTextField
            control={form.control}
            name="hourlyRate"
            label={t("timeTracking.fields.hourlyRate")}
            placeholder={t("timeTracking.placeholders.hourlyRate")}
            inputMode="decimal"
            disabled={isSaving}
          />
          <TimeEntryBillableField control={form.control} name="billable" disabled={isSaving} />
        </FieldGroup>
      </ScrollArea>
      <div className="bg-muted/50 flex flex-col gap-3 border-t p-4">
        {serverError ? <FieldError>{serverError}</FieldError> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={props.onCancel} disabled={isSaving}>
            {t("common.actions.cancel")}
          </Button>
          <Button type="submit" disabled={submitDisabled}>
            {isSaving && <Spinner />}
            <Icon name="Save" aria-hidden="true" />
            {isEdit ? t("timeTracking.form.saveEdit") : t("timeTracking.form.saveCreate")}
          </Button>
        </div>
      </div>
    </form>
  )
}

export { TimeEntryForm }
