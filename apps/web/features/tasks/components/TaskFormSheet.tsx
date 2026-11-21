"use client"

import { useTranslation } from "@/lib/i18n"

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui"

import { type TaskFormData } from "../types"

import { TaskForm } from "./TaskForm"

type TaskFormSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currency: string
  onSuccess?: (task: { id: string }) => void
} & (
  | { mode: "create"; projectId: string; task?: never }
  | { mode: "edit"; projectId?: never; task: TaskFormData }
)

const TaskFormSheet = (props: TaskFormSheetProps) => {
  const { t } = useTranslation()

  const isEdit = props.mode === "edit"

  const handleSuccess = (task: { id: string }) => {
    props.onSuccess?.(task)
    props.onOpenChange(false)
  }

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-border border-b">
          <SheetTitle>
            {isEdit ? t("tasks.form.editTitle") : t("tasks.form.createTitle")}
          </SheetTitle>
          <SheetDescription>
            {isEdit ? t("tasks.form.editDescription") : t("tasks.form.createDescription")}
          </SheetDescription>
        </SheetHeader>
        {props.mode === "edit" ? (
          <TaskForm
            mode="edit"
            currency={props.currency}
            task={props.task}
            onSuccess={handleSuccess}
            onCancel={() => props.onOpenChange(false)}
          />
        ) : (
          <TaskForm
            mode="create"
            currency={props.currency}
            projectId={props.projectId}
            onSuccess={handleSuccess}
            onCancel={() => props.onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

export { TaskFormSheet }
