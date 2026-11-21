"use client"

import { useTranslation } from "@/lib/i18n"

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui"

import {
  type TimeEntryFormData,
  type TimeTrackingProjectOption,
  type TimeTrackingTaskOption
} from "../types"

import { TimeEntryForm } from "./TimeEntryForm"

type TimeEntryFormSheetProps = {
  open: boolean
  projectOptions: TimeTrackingProjectOption[]
  taskOptions: TimeTrackingTaskOption[]
  onOpenChange: (open: boolean) => void
  onSuccess?: (entry: { id: string }) => void
} & ({ mode: "create"; entry?: never } | { mode: "edit"; entry: TimeEntryFormData })

const TimeEntryFormSheet = (props: TimeEntryFormSheetProps) => {
  const { t } = useTranslation()

  const isEdit = props.mode === "edit"

  const handleSuccess = (entry: { id: string }) => {
    props.onSuccess?.(entry)
    props.onOpenChange(false)
  }

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-border border-b">
          <SheetTitle>
            {isEdit ? t("timeTracking.form.editTitle") : t("timeTracking.form.createTitle")}
          </SheetTitle>
          <SheetDescription>
            {isEdit
              ? t("timeTracking.form.editDescription")
              : t("timeTracking.form.createDescription")}
          </SheetDescription>
        </SheetHeader>
        {props.mode === "edit" ? (
          <TimeEntryForm
            mode="edit"
            entry={props.entry}
            projectOptions={props.projectOptions}
            taskOptions={props.taskOptions}
            onSuccess={handleSuccess}
            onCancel={() => props.onOpenChange(false)}
          />
        ) : (
          <TimeEntryForm
            mode="create"
            projectOptions={props.projectOptions}
            taskOptions={props.taskOptions}
            onSuccess={handleSuccess}
            onCancel={() => props.onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

export { TimeEntryFormSheet }
