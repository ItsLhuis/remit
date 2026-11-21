"use client"

import { useState } from "react"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { toast } from "sonner"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  FieldError,
  Spinner,
  Typography
} from "@/components/ui"

import { saveRetentionPolicy } from "../../mutations"
import { retentionPolicyFormSchema, type RetentionPolicyFormInputValues } from "../../schemas"
import { type RetentionPolicy } from "../../services"

import { RetentionDaysField } from "./RetentionDaysField"

type RetentionPolicyFormProps = {
  policy: RetentionPolicy
  // What the saved windows would remove on the next run. Computed server-side by
  // `planRetentionPurge`, so the owner reads the consequence of a destructive setting before the
  // sweep applies it rather than afterwards.
  pendingPurgeCount: number
}

const RetentionPolicyForm = ({ policy, pendingPurgeCount }: RetentionPolicyFormProps) => {
  const { t } = useTranslation()

  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<RetentionPolicyFormInputValues>({
    resolver: zodResolver(retentionPolicyFormSchema, {}, { raw: true }),
    mode: "onBlur",
    defaultValues: {
      trashDays: policy.trashDays === null ? "" : String(policy.trashDays),
      financialDays: policy.financialDays === null ? "" : String(policy.financialDays)
    }
  })

  const { isSubmitting, isDirty, isValid } = form.formState

  const onSubmit = async (values: RetentionPolicyFormInputValues) => {
    if (!isDirty || !isValid) return

    setServerError(null)

    const result = await saveRetentionPolicy(values)

    if ("error" in result) {
      setServerError(result.error)

      return
    }

    form.reset(values)

    toast.success(t("trash.retention.saved"))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("trash.retention.title")}</CardTitle>
        <CardDescription>{t("trash.retention.description")}</CardDescription>
      </CardHeader>
      <form noValidate onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <RetentionDaysField
            control={form.control}
            name="trashDays"
            label={t("trash.retention.trashLabel")}
            description={t("trash.retention.trashDescription")}
            disabled={isSubmitting}
          />
          <RetentionDaysField
            control={form.control}
            name="financialDays"
            label={t("trash.retention.financialLabel")}
            description={t("trash.retention.financialDescription")}
            disabled={isSubmitting}
          />
        </CardContent>
        <CardFooter className="flex flex-col items-start gap-2">
          <Typography affects={["muted", "small"]}>
            {pendingPurgeCount > 0
              ? t("trash.retention.preview", { count: pendingPurgeCount })
              : t("trash.retention.previewEmpty")}
          </Typography>
          <Button type="submit" disabled={isSubmitting || !(isDirty && isValid)}>
            {isSubmitting && <Spinner />}
            {t("common.actions.save")}
          </Button>
          {serverError ? <FieldError errors={[{ message: serverError }]} /> : null}
        </CardFooter>
      </form>
    </Card>
  )
}

export { RetentionPolicyForm }
