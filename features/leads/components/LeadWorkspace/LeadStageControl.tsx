"use client"

import { useState, useTransition } from "react"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldError,
  FieldLabel,
  Icon,
  Spinner,
  Textarea,
  Typography,
  toast
} from "@/components/ui"

import { updateLeadStatus } from "../../mutations"
import { type LeadStatus } from "../../schemas"
import { getNextLeadStatuses } from "../../services"

type LeadStageControlProps = {
  leadId: string
  status: LeadStatus
  onChanged: () => void
}

const LeadStageControl = ({ leadId, status, onChanged }: LeadStageControlProps) => {
  const { t } = useTranslation()

  const [isPending, startTransition] = useTransition()
  const [lostDialogOpen, setLostDialogOpen] = useState(false)
  const [lostReason, setLostReason] = useState("")
  const [lostError, setLostError] = useState<string | null>(null)

  const nextStatuses = getNextLeadStatuses(status)

  const applyStatus = (next: LeadStatus, reason?: string) => {
    startTransition(async () => {
      const result = await updateLeadStatus({ id: leadId, status: next, lostReason: reason ?? "" })

      if ("error" in result) {
        if (next === "lost") setLostError(result.error)
        else toast.error(result.error)

        return
      }

      toast.success(t("leads.stage.changed"))

      setLostDialogOpen(false)
      setLostReason("")
      setLostError(null)

      onChanged()
    })
  }

  const onSelectNext = (next: LeadStatus) => {
    if (next === "lost") {
      setLostError(null)
      setLostDialogOpen(true)

      return
    }

    applyStatus(next)
  }

  const onConfirmLost = () => {
    if (lostReason.trim().length === 0) {
      setLostError(t("leads.validation.lostReasonRequired"))

      return
    }

    applyStatus("lost", lostReason)
  }

  if (nextStatuses.length === 0) {
    return <Typography affects={["muted", "small"]}>{t("leads.stage.terminal")}</Typography>
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {nextStatuses.map((next) => (
        <Button
          key={next}
          variant={next === "won" ? "default" : "outline"}
          size="sm"
          disabled={isPending}
          onClick={() => onSelectNext(next)}
        >
          {isPending ? <Spinner /> : <Icon name="ArrowRight" aria-hidden="true" />}
          {t("leads.stage.moveTo", { stage: t(`leads.status.${next}`) })}
        </Button>
      ))}
      <Dialog
        open={lostDialogOpen}
        onOpenChange={(open) => {
          if (!isPending) setLostDialogOpen(open)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("leads.stage.lostTitle")}</DialogTitle>
            <DialogDescription>{t("leads.stage.lostDescription")}</DialogDescription>
          </DialogHeader>
          <Field data-invalid={Boolean(lostError)} className="py-2">
            <FieldLabel htmlFor="lead-lost-reason">{t("leads.fields.lostReason")}</FieldLabel>
            <Textarea
              id="lead-lost-reason"
              value={lostReason}
              onChange={(event) => setLostReason(event.target.value)}
              placeholder={t("leads.placeholders.lostReason")}
              aria-invalid={Boolean(lostError)}
              disabled={isPending}
              className="min-h-24"
            />
            {lostError ? <FieldError>{lostError}</FieldError> : null}
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setLostDialogOpen(false)}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={onConfirmLost}
            >
              {isPending ? <Spinner /> : null}
              {t("leads.stage.markLost")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export { LeadStageControl }
