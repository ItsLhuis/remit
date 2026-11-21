"use client"

import { useTranslation } from "@/lib/i18n"

import { formatCurrency, formatDay } from "@/lib/utils"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Icon,
  IconButton,
  Typography
} from "@/components/ui"

import { isManualPaymentMethod } from "../../services"
import { type PaymentListItem } from "../../types"
import { PaymentMethodBadge } from "../PaymentMethodBadge"

type PaymentRowProps = {
  payment: PaymentListItem
  locale: string
  onEdit: (payment: PaymentListItem) => void
  onDelete: (payment: PaymentListItem) => void
}

const PaymentRow = ({ payment, locale, onEdit, onDelete }: PaymentRowProps) => {
  const { t } = useTranslation()

  const isManual = isManualPaymentMethod(payment.method)

  return (
    <li className="border-border flex items-start justify-between gap-3 border-b py-3 last:border-b-0">
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <PaymentMethodBadge method={payment.method} />
          <Typography affects={["small", "muted"]}>{formatDay(payment.paidAt, locale)}</Typography>
        </div>
        {payment.reference ? (
          <Typography affects={["small", "muted"]} className="truncate font-mono">
            {payment.reference}
          </Typography>
        ) : null}
        {payment.notes ? (
          <Typography affects={["small", "muted"]} className="whitespace-pre-line">
            {payment.notes}
          </Typography>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="font-mono text-sm font-medium tabular-nums">
          {formatCurrency(payment.amountCents, payment.currency, locale)}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton variant="ghost" size="icon-sm" label={t("payments.list.rowActions")}>
              <Icon name="EllipsisVertical" />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={!isManual} onSelect={() => onEdit(payment)}>
              <Icon name="Pencil" aria-hidden="true" />
              {t("payments.actions.edit")}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => onDelete(payment)}>
              <Icon name="Trash2" aria-hidden="true" />
              {t("payments.actions.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  )
}

export { PaymentRow }
