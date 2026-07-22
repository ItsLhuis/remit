"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldError,
  FieldLabel,
  Input
} from "@/components/ui"

import { templateNameSchema, type TemplateNameValues } from "../../schemas"

type RenameTemplateDialogProps = {
  open: boolean
  name: string
  onOpenChange: (open: boolean) => void
  onRename: (name: string) => void
}

const RenameTemplateDialog = ({
  open,
  name,
  onOpenChange,
  onRename
}: RenameTemplateDialogProps) => {
  const { t } = useTranslation()

  const form = useForm<TemplateNameValues>({
    resolver: zodResolver(templateNameSchema),
    mode: "onSubmit",
    values: { name }
  })

  const onSubmit = (values: TemplateNameValues) => {
    onRename(values.name)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("templates.editor.renameTemplate")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{t("templates.fields.name")}</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  aria-invalid={fieldState.invalid}
                  placeholder={t("templates.fields.namePlaceholder")}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <DialogFooter>
            <Button type="submit">{t("common.actions.save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { RenameTemplateDialog }
