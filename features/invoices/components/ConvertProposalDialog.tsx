"use client"

import { useState } from "react"

import { useTranslation } from "@/lib/i18n"

import { formatCurrency } from "@/lib/utils"

import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldLabel,
  Icon,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Typography
} from "@/components/ui"

import { type ConvertibleProposalOption } from "../types"

type ConvertProposalDialogProps = {
  open: boolean
  proposals: ConvertibleProposalOption[]
  locale: string
  isConverting: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (proposalId: string) => void
}

const ConvertProposalDialog = ({
  open,
  proposals,
  locale,
  isConverting,
  onOpenChange,
  onConfirm
}: ConvertProposalDialogProps) => {
  const { t } = useTranslation()

  const [proposalId, setProposalId] = useState("")

  const hasProposals = proposals.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("invoices.convert.title")}</DialogTitle>
          <DialogDescription>{t("invoices.convert.description")}</DialogDescription>
        </DialogHeader>
        {hasProposals ? (
          <Field>
            <FieldLabel htmlFor="convert-proposal">
              {t("invoices.convert.proposalLabel")}
            </FieldLabel>
            <Select value={proposalId} onValueChange={setProposalId} disabled={isConverting}>
              <SelectTrigger id="convert-proposal">
                <SelectValue placeholder={t("invoices.convert.proposalPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {proposals.map((proposal) => (
                    <SelectItem key={proposal.id} value={proposal.id}>
                      {t("invoices.convert.proposalOption", {
                        number: proposal.number,
                        total: formatCurrency(proposal.totalCents, proposal.currency, locale)
                      })}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        ) : (
          <Typography variant="p" affects={["muted", "small", "removePMargin"]}>
            {t("invoices.convert.empty")}
          </Typography>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isConverting}>
              {t("common.actions.cancel")}
            </Button>
          </DialogClose>
          <Button
            type="button"
            disabled={isConverting || !hasProposals || proposalId === ""}
            onClick={() => onConfirm(proposalId)}
          >
            {isConverting && <Spinner />}
            <Icon name="FileInput" aria-hidden="true" />
            {t("invoices.convert.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { ConvertProposalDialog }
