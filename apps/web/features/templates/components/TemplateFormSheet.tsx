"use client"

import { useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  Field,
  FieldError,
  FieldLabel,
  FormTextField,
  Icon,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Spinner,
  toast
} from "@/components/ui"

import { TEMPLATE_TYPE_LABEL_KEYS } from "../labels"
import { createTemplate } from "../mutations"
import { createTemplateSchema, TEMPLATE_TYPES, type CreateTemplateValues } from "../schemas"

type TemplateFormSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const TemplateFormSheet = ({ open, onOpenChange }: TemplateFormSheetProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [serverError, setServerError] = useState<string | null>(null)
  const [isSaving, startSaving] = useTransition()

  const form = useForm<CreateTemplateValues>({
    resolver: zodResolver(createTemplateSchema),
    mode: "onChange",
    defaultValues: { name: "", type: "invoice", subject: "" }
  })

  const { isValid } = form.formState

  const selectedType = useWatch({ control: form.control, name: "type" })

  const showSubject = selectedType.startsWith("email_")

  const onSubmit = (values: CreateTemplateValues) => {
    if (!isValid) return

    setServerError(null)

    startSaving(async () => {
      const result = await createTemplate(values)

      if ("error" in result) {
        setServerError(result.error)

        return
      }

      toast.success(t("templates.form.created"))
      onOpenChange(false)
      router.push(`/templates/${result.data.template.id}`)
      router.refresh()
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-border border-b">
          <SheetTitle>{t("templates.form.createTitle")}</SheetTitle>
          <SheetDescription>{t("templates.form.createDescription")}</SheetDescription>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="flex min-h-0 flex-1 flex-col"
        >
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-6 p-4">
              <FormTextField
                control={form.control}
                name="name"
                label={t("templates.fields.name")}
                placeholder={t("templates.fields.namePlaceholder")}
                disabled={isSaving}
              />
              <Controller
                name="type"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>{t("templates.fields.type")}</FieldLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={isSaving}>
                      <SelectTrigger id={field.name} aria-invalid={fieldState.invalid}>
                        <SelectValue placeholder={t("templates.fields.typePlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {TEMPLATE_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {t(TEMPLATE_TYPE_LABEL_KEYS[type])}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              {showSubject ? (
                <FormTextField
                  control={form.control}
                  name="subject"
                  label={t("templates.fields.subject")}
                  placeholder={t("templates.fields.subjectPlaceholder")}
                  disabled={isSaving}
                />
              ) : null}
            </div>
          </ScrollArea>
          <div className="bg-muted/50 flex flex-col gap-3 border-t p-4">
            {serverError ? <FieldError>{serverError}</FieldError> : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
              >
                {t("common.actions.cancel")}
              </Button>
              <Button type="submit" disabled={isSaving || !isValid}>
                {isSaving && <Spinner />}
                <Icon name="Save" aria-hidden="true" />
                {t("templates.form.saveCreate")}
              </Button>
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export { TemplateFormSheet }
