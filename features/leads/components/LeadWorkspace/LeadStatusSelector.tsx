"use client"

import { Fragment, useState, useTransition } from "react"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Field,
  FieldError,
  FieldLabel,
  Icon,
  Spinner,
  Textarea,
  toast
} from "@/components/ui"

import { updateLeadStatus } from "../../mutations"
import { type LeadStatus } from "../../schemas"
import { getNextLeadStatuses } from "../../services"
import { LeadStatusBadge, leadStatusPresentation } from "../LeadStatusBadge"

type LeadStatusSelectorProps = {
  leadId: string
  status: LeadStatus
  onChanged: () => void
}

const LeadStatusSelector = ({ leadId, status, onChanged }: LeadStatusSelectorProps) => {
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
    return <LeadStatusBadge status={status} />
  }

  return (
    <Fragment>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            className="w-full justify-between font-normal"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              {isPending ? (
                <Spinner />
              ) : (
                <Icon name={leadStatusPresentation[status].icon} aria-hidden="true" />
              )}
              <span className="truncate">{t(`leads.status.${status}`)}</span>
            </span>
            <Icon name="ChevronsUpDown" className="text-muted-foreground" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-56">
          <DropdownMenuLabel>{t("leads.stage.changeStatus")}</DropdownMenuLabel>
          <DropdownMenuItem disabled className="justify-between">
            <span className="flex items-center gap-1.5">
              <Icon name={leadStatusPresentation[status].icon} aria-hidden="true" />
              {t(`leads.status.${status}`)}
            </span>
            <Icon name="Check" aria-hidden="true" />
          </DropdownMenuItem>
          {nextStatuses.map((next) => (
            <DropdownMenuItem
              key={next}
              variant={next === "lost" ? "destructive" : "default"}
              onSelect={() => onSelectNext(next)}
            >
              <Icon name={leadStatusPresentation[next].icon} aria-hidden="true" />
              {t(`leads.status.${next}`)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
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
    </Fragment>
  )
}

export { LeadStatusSelector }
