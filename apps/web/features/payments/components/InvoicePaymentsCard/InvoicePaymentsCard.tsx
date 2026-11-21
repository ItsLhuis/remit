"use client"

import { useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { useTranslation } from "@/lib/i18n"

import { formatCentsForInput, formatCurrency } from "@/lib/utils"

import {
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Icon,
  Typography,
  toast
} from "@/components/ui"

import { softDeletePayment } from "../../mutations"
import { toManualPaymentMethod } from "../../services"
import { type PaymentFormData, type PaymentListItem } from "../../types"
import { DeletePaymentDialog } from "../DeletePaymentDialog"
import { PaymentFormSheet } from "../PaymentFormSheet"

import { PaymentRow } from "./PaymentRow"

// The stored row read back as form input: cents become the decimal string the amount field edits,
// and the instant becomes the "YYYY-MM-DD" the schema re-pins to UTC midnight.
function toPaymentFormData(payment: PaymentListItem): PaymentFormData {
  return {
    id: payment.id,
    amount: formatCentsForInput(payment.amountCents),
    paidAt: payment.paidAt.toISOString().slice(0, 10),
    method: toManualPaymentMethod(payment.method),
    reference: payment.reference,
    notes: payment.notes
  }
}

type InvoicePaymentsCardProps = {
  invoiceId: string
  payments: PaymentListItem[]
  currency: string
  locale: string
  amountPaidCents: number
  outstandingCents: number
  canRecord: boolean
}

const InvoicePaymentsCard = ({
  invoiceId,
  payments,
  currency,
  locale,
  amountPaidCents,
  outstandingCents,
  canRecord
}: InvoicePaymentsCardProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [recordOpen, setRecordOpen] = useState(false)
  const [editing, setEditing] = useState<PaymentFormData | null>(null)
  const [deleting, setDeleting] = useState<PaymentListItem | null>(null)
  const [isDeleting, startDeleting] = useTransition()

  const onConfirmDelete = () => {
    if (isDeleting || !deleting) return

    startDeleting(async () => {
      const result = await softDeletePayment({ id: deleting.id })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      toast.success(t("payments.notifications.deleted"))

      setDeleting(null)

      router.refresh()
    })
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("payments.list.title")}</CardTitle>
        <CardDescription>{t("payments.list.description")}</CardDescription>
        {canRecord ? (
          <CardAction>
            <Button size="sm" onClick={() => setRecordOpen(true)}>
              <Icon name="Plus" aria-hidden="true" />
              {t("payments.actions.record")}
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <Empty className="border-0 py-8">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Icon name="Banknote" />
              </EmptyMedia>
              <EmptyTitle>{t("payments.empty.title")}</EmptyTitle>
              <EmptyDescription>
                {canRecord ? t("payments.empty.description") : t("payments.empty.draftDescription")}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="flex flex-col">
            {payments.map((payment) => (
              <PaymentRow
                key={payment.id}
                payment={payment}
                locale={locale}
                onEdit={(selected) => setEditing(toPaymentFormData(selected))}
                onDelete={setDeleting}
              />
            ))}
          </ul>
        )}
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-1">
        <div className="flex items-baseline justify-between gap-4">
          <Typography affects={["small", "muted"]}>{t("payments.totals.recorded")}</Typography>
          <span className="font-mono text-sm tabular-nums">
            {formatCurrency(amountPaidCents, currency, locale)}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <Typography affects={["small", "medium"]}>{t("payments.totals.outstanding")}</Typography>
          <span className="font-mono text-sm font-semibold tabular-nums">
            {formatCurrency(outstandingCents, currency, locale)}
          </span>
        </div>
      </CardFooter>
      <PaymentFormSheet
        mode="create"
        open={recordOpen}
        invoiceId={invoiceId}
        defaultAmount={formatCentsForInput(outstandingCents)}
        onOpenChange={setRecordOpen}
      />
      {editing ? (
        <PaymentFormSheet
          mode="edit"
          open
          payment={editing}
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
        />
      ) : null}
      <DeletePaymentDialog
        open={deleting !== null}
        amount={deleting ? formatCurrency(deleting.amountCents, deleting.currency, locale) : ""}
        isDeleting={isDeleting}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleting(null)
        }}
        onConfirm={onConfirmDelete}
      />
    </Card>
  )
}

export { InvoicePaymentsCard }
