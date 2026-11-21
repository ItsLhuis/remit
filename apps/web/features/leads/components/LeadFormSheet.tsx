"use client"

import { useTranslation } from "@/lib/i18n"

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui"

import { type LeadStatus } from "../schemas"
import { type LeadFormData } from "../types"

import { LeadForm } from "./LeadForm"

type LeadFormSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (lead: { id: string }) => void
} & (
  | { mode: "create"; lead?: never; currentStatus?: never }
  | { mode: "edit"; lead: LeadFormData; currentStatus: LeadStatus }
)

const LeadFormSheet = (props: LeadFormSheetProps) => {
  const { t } = useTranslation()

  const isEdit = props.mode === "edit"

  const handleSuccess = (lead: { id: string }) => {
    props.onSuccess?.(lead)
    props.onOpenChange(false)
  }

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-border border-b">
          <SheetTitle>
            {isEdit ? t("leads.form.editTitle") : t("leads.form.createTitle")}
          </SheetTitle>
          <SheetDescription>
            {isEdit ? t("leads.form.editDescription") : t("leads.form.createDescription")}
          </SheetDescription>
        </SheetHeader>
        {props.mode === "edit" ? (
          <LeadForm
            mode="edit"
            layout="panel"
            lead={props.lead}
            currentStatus={props.currentStatus}
            onSuccess={handleSuccess}
            onCancel={() => props.onOpenChange(false)}
          />
        ) : (
          <LeadForm
            mode="create"
            layout="panel"
            onSuccess={handleSuccess}
            onCancel={() => props.onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

export { LeadFormSheet }
