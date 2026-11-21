"use client"

import Link from "next/link"

import { useTranslation } from "@/lib/i18n"

import { formatCurrency, formatDay } from "@/lib/utils"

import { Button, Icon, Typography } from "@/components/ui"

import { type CreditNoteListItem } from "../../types"

// `href` is null for an invoice with no project: the credit-note detail route is nested under one,
// so there is nowhere to link to and the row shows the figures without an opener.
type CreditNoteRowProps = {
  creditNote: CreditNoteListItem
  href: string | null
  locale: string
}

const CreditNoteRow = ({ creditNote, href, locale }: CreditNoteRowProps) => {
  const { t } = useTranslation()

  return (
    <li className="border-border flex items-start justify-between gap-3 border-b py-3 last:border-b-0">
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-medium">{creditNote.number}</span>
          <Typography affects={["small", "muted"]}>
            {t("creditNotes.card.issuedOn", { date: formatDay(creditNote.issuedAt, locale) })}
          </Typography>
        </div>
        {creditNote.reason ? (
          <Typography affects={["small", "muted"]} className="whitespace-pre-line">
            {creditNote.reason}
          </Typography>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="font-mono text-sm font-medium tabular-nums">
          {formatCurrency(-creditNote.totalCents, creditNote.currency, locale)}
        </span>
        {href ? (
          <Button asChild variant="ghost" size="icon-sm">
            <Link href={href} aria-label={t("creditNotes.actions.view")}>
              <Icon name="ArrowUpRight" aria-hidden="true" />
            </Link>
          </Button>
        ) : null}
      </div>
    </li>
  )
}

export { CreditNoteRow }
