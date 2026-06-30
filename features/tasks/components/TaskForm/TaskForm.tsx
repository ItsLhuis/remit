"use client"

import { useMemo, useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FormDateField,
  FormTextField,
  Icon,
  ScrollArea,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Textarea,
  toast
} from "@/components/ui"

import { createTask, updateTask } from "../../mutations"
import {
  taskFormSchema,
  TASK_PRIORITY_VALUES,
  TASK_STATUS_VALUES,
  type TaskFormInputValues,
  type TaskFormValues
} from "../../schemas"
import { type TaskFormData } from "../../types"

type TaskFormCallbacks = {
  onSuccess?: (task: { id: string }) => void
  onCancel?: () => void
}

type TaskFormProps = TaskFormCallbacks & { currency: string } & (
    | { mode: "create"; projectId: string; task?: never }
    | { mode: "edit"; projectId?: never; task: TaskFormData }
  )

const TaskForm = (props: TaskFormProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [serverError, setServerError] = useState<string | null>(null)
  const [isSaving, startSaving] = useTransition()

  const defaultValues = useMemo<TaskFormInputValues>(() => {
    if (props.mode === "edit") return props.task

    return {
      title: "",
      description: "",
      status: "todo",
      priority: "normal",
      dueDate: "",
      hourlyRate: ""
    }
  }, [props])

  const form = useForm<TaskFormInputValues, unknown, TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    mode: "onChange",
    defaultValues
  })

  const { isDirty, isValid } = form.formState

  const isEdit = props.mode === "edit"

  const submitDisabled = isSaving || !isValid || (isEdit && !isDirty)

  const onSubmit = () => {
    if (submitDisabled) return

    const values = form.getValues()

    setServerError(null)

    startSaving(async () => {
      const result = isEdit
        ? await updateTask({ id: props.task.id, ...values })
        : await createTask({ ...values, projectId: props.projectId })

      if ("error" in result) {
        setServerError(result.error)

        return
      }

      toast.success(isEdit ? t("tasks.notifications.updated") : t("tasks.notifications.created"))

      props.onSuccess?.(result.data.task)
      router.refresh()
    })
  }

  const onCancel = () => {
    props.onCancel?.()
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="flex min-h-0 flex-1 flex-col"
    >
      <ScrollArea className="min-h-0 flex-1">
        <FieldGroup className="grid gap-4 p-4">
          <FormTextField
            control={form.control}
            name="title"
            label={t("tasks.fields.title")}
            placeholder={t("tasks.placeholders.title")}
            disabled={isSaving}
          />
          <Controller
            name="description"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{t("tasks.fields.description")}</FieldLabel>
                <Textarea
                  {...field}
                  id={field.name}
                  placeholder={t("tasks.placeholders.description")}
                  aria-invalid={fieldState.invalid}
                  disabled={isSaving}
                  className="min-h-28"
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              name="status"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>{t("tasks.fields.status")}</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={isSaving}>
                    <SelectTrigger id={field.name}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {TASK_STATUS_VALUES.map((value) => (
                          <SelectItem key={value} value={value}>
                            {t(`tasks.status.${value}`)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />
            <Controller
              name="priority"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>{t("tasks.fields.priority")}</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={isSaving}>
                    <SelectTrigger id={field.name}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {TASK_PRIORITY_VALUES.map((value) => (
                          <SelectItem key={value} value={value}>
                            {t(`tasks.priority.${value}`)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />
            <FormDateField
              control={form.control}
              name="dueDate"
              label={t("tasks.fields.dueDate")}
              disabled={isSaving}
            />
            <FormTextField
              control={form.control}
              name="hourlyRate"
              label={`${t("tasks.fields.hourlyRate")} (${props.currency})`}
              placeholder={t("tasks.placeholders.amount")}
              inputMode="decimal"
              disabled={isSaving}
            />
          </div>
        </FieldGroup>
      </ScrollArea>
      <div className="bg-muted/50 flex flex-col gap-3 border-t p-4">
        {serverError ? <FieldError>{serverError}</FieldError> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
            {t("common.actions.cancel")}
          </Button>
          <Button type="submit" disabled={submitDisabled}>
            {isSaving && <Spinner />}
            <Icon name="Save" aria-hidden="true" />
            {isEdit ? t("tasks.form.saveEdit") : t("tasks.form.saveCreate")}
          </Button>
        </div>
      </div>
    </form>
  )
}

export { TaskForm }
