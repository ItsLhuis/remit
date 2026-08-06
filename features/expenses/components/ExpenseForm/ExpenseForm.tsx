"use client"

import { useMemo, useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  CurrencySelect,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FormDateField,
  FormTextField,
  Icon,
  ScrollArea,
  Spinner,
  toast
} from "@/components/ui"

import { createExpense, updateExpense } from "../../mutations"
import { expenseFormSchema, type ExpenseFormInputValues } from "../../schemas"
import {
  type ExpenseClientOption,
  type ExpenseFormData,
  type ExpenseProjectOption
} from "../../types"
import { ExpenseCategoryField } from "../ExpenseCategoryField"
import { ExpenseClientField } from "../ExpenseClientField"
import { ExpenseProjectField } from "../ExpenseProjectField"
import { ExpenseRebillableField } from "../ExpenseRebillableField"
import { ExpenseReceiptField } from "../ExpenseReceiptField"

type ExpenseFormProps = {
  projectOptions: ExpenseProjectOption[]
  clientOptions: ExpenseClientOption[]
  categoryOptions: string[]
  defaultCurrency: string
  onSuccess?: (expense: { id: string }) => void
  onCancel?: () => void
} & ({ mode: "create"; expense?: never } | { mode: "edit"; expense: ExpenseFormData })

const ExpenseForm = (props: ExpenseFormProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [serverError, setServerError] = useState<string | null>(null)
  const [isSaving, startSaving] = useTransition()

  const defaultValues = useMemo<ExpenseFormInputValues>(() => {
    if (props.mode === "edit") return props.expense

    return {
      projectId: "",
      clientId: "",
      spentAt: new Date().toISOString().slice(0, 10),
      amount: "",
      currency: props.defaultCurrency,
      category: "",
      description: "",
      rebillable: false,
      markupPercentage: "",
      receipt: null
    }
  }, [props.mode, props.expense, props.defaultCurrency])

  const form = useForm<ExpenseFormInputValues>({
    resolver: zodResolver(expenseFormSchema, {}, { raw: true }),
    mode: "onChange",
    defaultValues
  })

  const { isDirty, isValid } = form.formState

  const [projectId, rebillable] = useWatch({
    control: form.control,
    name: ["projectId", "rebillable"]
  })

  const isEdit = props.mode === "edit"

  const submitDisabled = isSaving || !isValid || (isEdit && !isDirty)

  // An expense on a project belongs to that project's client, and `resolveExpenseScope` in
  // mutations.ts refuses any other pairing. Deriving the client here rather than letting the user
  // pick one keeps that rule from surfacing as a server error they cannot act on.
  const handleProjectSelect = (nextProjectId: string) => {
    const project = props.projectOptions.find((option) => option.id === nextProjectId)

    form.setValue("clientId", project?.clientId ?? "", {
      shouldDirty: true,
      shouldValidate: true
    })
  }

  const handleRebillableToggle = (nextRebillable: boolean) => {
    if (nextRebillable) return

    form.setValue("markupPercentage", "", { shouldDirty: true, shouldValidate: true })
  }

  const onSubmit = (values: ExpenseFormInputValues) => {
    if (submitDisabled) return

    setServerError(null)

    startSaving(async () => {
      const result = isEdit
        ? await updateExpense({ ...values, id: props.expense.id })
        : await createExpense(values)

      if ("error" in result) {
        setServerError(result.error)

        return
      }

      toast.success(isEdit ? t("expenses.form.updated") : t("expenses.form.created"))

      props.onSuccess?.({ id: result.data.expense.id })

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
          <FormDateField
            control={form.control}
            name="spentAt"
            label={t("expenses.fields.spentAt")}
            disabled={isSaving}
          />
          <ExpenseCategoryField
            control={form.control}
            usedCategories={props.categoryOptions}
            disabled={isSaving}
          />
          <FormTextField
            control={form.control}
            name="description"
            label={t("expenses.fields.description")}
            placeholder={t("expenses.placeholders.description")}
            disabled={isSaving}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormTextField
              control={form.control}
              name="amount"
              label={t("expenses.fields.amount")}
              placeholder={t("expenses.placeholders.amount")}
              inputMode="decimal"
              disabled={isSaving}
            />
            <Controller
              name="currency"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>{t("expenses.fields.currency")}</FieldLabel>
                  <CurrencySelect
                    id={field.name}
                    ref={field.ref}
                    value={field.value}
                    onValueChangeAction={field.onChange}
                    valid={!fieldState.invalid}
                    disabled={isSaving}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </div>
          <ExpenseProjectField
            control={form.control}
            options={props.projectOptions}
            disabled={isSaving}
            onSelect={handleProjectSelect}
          />
          <ExpenseClientField
            control={form.control}
            options={props.clientOptions}
            followsProject={projectId !== ""}
            disabled={isSaving}
          />
          <ExpenseRebillableField
            control={form.control}
            disabled={isSaving}
            onToggle={handleRebillableToggle}
          />
          {rebillable ? (
            <FormTextField
              control={form.control}
              name="markupPercentage"
              label={t("expenses.fields.markupPercentage")}
              placeholder={t("expenses.placeholders.markupPercentage")}
              inputMode="decimal"
              disabled={isSaving}
            />
          ) : null}
          <ExpenseReceiptField control={form.control} disabled={isSaving} />
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
            {isEdit ? t("expenses.form.saveEdit") : t("expenses.form.saveCreate")}
          </Button>
        </div>
      </div>
    </form>
  )
}

export { ExpenseForm }
