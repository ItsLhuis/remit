"use client"

import { Button } from "@/components/ui/Button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/Dialog"
import { Spinner } from "@/components/ui/Spinner"

type ConfirmDialogProps = {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  isPending: boolean
  variant?: "default" | "destructive"
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

// Every string is a prop rather than a key this component looks up: the copy for a confirmation is
// the caller's, and a shared dialog that owned its wording would flatten "this breaks a link your
// client already has" into something generic.
const ConfirmDialog = ({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  isPending,
  variant = "default",
  onOpenChange,
  onConfirm
}: ConfirmDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isPending}>
              {cancelLabel}
            </Button>
          </DialogClose>
          <Button type="button" variant={variant} disabled={isPending} onClick={onConfirm}>
            {isPending && <Spinner />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { ConfirmDialog }
