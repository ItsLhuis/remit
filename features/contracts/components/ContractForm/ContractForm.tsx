"use client"

import { useMemo, useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import Link from "next/link"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  Field,
  FieldError,
  FieldLabel,
  FormDateField,
  Icon,
  Input,
  Separator,
  Spinner,
  Typography,
  toast
} from "@/components/ui"

import { createContract, updateContract } from "../../mutations"
import {
  contractFormSchema,
  type ContractFormInputValues,
  type ContractFormValues
} from "../../schemas"
import { type ContractFormData, type ContractParentOptions } from "../../types"

import { ContractContentField } from "./ContractContentField"
import { ContractParentFields } from "./ContractParentFields"

function toDateInput(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : ""
}

type ContractFormProps = {
  options: ContractParentOptions
  contract: ContractFormData | null
  defaultProjectId: string
  defaultClientId: string
}

const ContractForm = ({
  options,
  contract,
  defaultProjectId,
  defaultClientId
}: ContractFormProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [serverError, setServerError] = useState<string | null>(null)
  const [isSaving, startSaving] = useTransition()

  const defaultValues = useMemo<ContractFormInputValues>(() => {
    if (contract) {
      return {
        title: contract.title,
        projectId: contract.projectId ?? "",
        clientId: contract.clientId ?? "",
        templateId: contract.templateId ?? "",
        blocks: contract.blocks,
        effectiveFrom: toDateInput(contract.effectiveFrom),
        effectiveUntil: toDateInput(contract.effectiveUntil)
      }
    }

    return {
      title: "",
      projectId: defaultProjectId,
      clientId: defaultClientId,
      templateId: "",
      blocks: [],
      effectiveFrom: "",
      effectiveUntil: ""
    }
  }, [contract, defaultProjectId, defaultClientId])

  // The one document form in the repository that resolves without `raw: true`: `contractFormSchema`
  // is a bridge, transforming the strings the controls hold into the nullable uuids and `Date`s
  // `createContractSchema` expects, so here the transformed output is what the action wants.
  // Adding `raw: true` to match the invoice, proposal and credit-note forms would send `""` where a
  // uuid or a null is required, and the action would refuse it at the trust boundary (`forms.md`).
  const form = useForm<ContractFormInputValues, unknown, ContractFormValues>({
    resolver: zodResolver(contractFormSchema),
    mode: "onBlur",
    defaultValues
  })

  const { isDirty, isValid } = form.formState

  const blocks = useWatch({ control: form.control, name: "blocks" })

  const submitDisabled = isSaving || !(isDirty && isValid)

  const onSubmit = (values: ContractFormValues) => {
    if (isSaving) return

    setServerError(null)

    startSaving(async () => {
      const result = contract
        ? await updateContract({ id: contract.id, ...values })
        : await createContract(values)

      if ("error" in result) {
        setServerError(result.error)

        return
      }

      toast.success(
        contract ? t("contracts.notifications.updated") : t("contracts.notifications.created")
      )

      router.push(`/contracts/${result.data.contract.id}`)
      router.refresh()
    })
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Typography variant="h3">{t("contracts.form.detailsSection")}</Typography>
          <Typography affects={["muted", "small"]}>
            {t("contracts.form.detailsDescription")}
          </Typography>
        </div>
        <Controller
          name="title"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>{t("contracts.fields.title")}</FieldLabel>
              <Input
                {...field}
                id={field.name}
                aria-invalid={fieldState.invalid}
                disabled={isSaving}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormDateField
            control={form.control}
            name="effectiveFrom"
            label={t("contracts.fields.effectiveFrom")}
            disabled={isSaving}
          />
          <FormDateField
            control={form.control}
            name="effectiveUntil"
            label={t("contracts.fields.effectiveUntil")}
            disabled={isSaving}
          />
        </div>
      </div>
      <Separator />
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Typography variant="h3">{t("contracts.form.parentSection")}</Typography>
          <Typography affects={["muted", "small"]}>
            {t("contracts.form.parentDescription")}
          </Typography>
        </div>
        <ContractParentFields
          control={form.control}
          projects={options.projects}
          clients={options.clients}
          disabled={isSaving}
        />
      </div>
      <Separator />
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Typography variant="h3">{t("contracts.form.contentSection")}</Typography>
        </div>
        <ContractContentField
          control={form.control}
          setValue={form.setValue}
          templates={options.templates}
          blockCount={blocks.length}
          disabled={isSaving}
        />
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={submitDisabled}>
            {isSaving && <Spinner />}
            {contract ? t("contracts.form.saveEdit") : t("contracts.form.saveCreate")}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/contracts">
              <Icon name="ArrowLeft" aria-hidden="true" />
              {t("contracts.form.backToList")}
            </Link>
          </Button>
        </div>
        {serverError ? <FieldError errors={[{ message: serverError }]} /> : null}
      </div>
    </form>
  )
}

export { ContractForm }
