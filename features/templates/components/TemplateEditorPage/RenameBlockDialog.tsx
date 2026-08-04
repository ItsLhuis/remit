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

import { renameBlockSchema, type RenameBlockValues } from "../../schemas"

type RenameBlockDialogProps = {
  open: boolean
  name: string
  onOpenChange: (open: boolean) => void
  onRename: (name: string) => void
}

const RenameBlockDialog = ({ open, name, onOpenChange, onRename }: RenameBlockDialogProps) => {
  const { t } = useTranslation()

  // `values`, not the `defaultValues` every other form in the repository uses: this dialog stays
  // mounted for the whole editor session and is pointed at a different block each time it opens, so
  // seed-once defaults would show the previously renamed block's name and save that back over the
  // one the user actually picked. `values` re-syncs the field whenever the prop changes.
  const form = useForm<RenameBlockValues>({
    resolver: zodResolver(renameBlockSchema),
    mode: "onSubmit",
    values: { name }
  })

  const onSubmit = (values: RenameBlockValues) => {
    onRename(values.name ?? "")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("templates.editor.renameBlock")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{t("templates.fields.name")}</FieldLabel>
                <Input {...field} id={field.name} aria-invalid={fieldState.invalid} />
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

export { RenameBlockDialog }
