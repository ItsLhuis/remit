"use client"

import { type ReactNode } from "react"

import Link from "next/link"

import { Button, Icon, Typography } from "@/components/ui"

// Shared by the proposal and contract sections, which differ in what their secondary line says and
// in whether they offer a way in at all. `link` is null whenever the document's own public route
// would answer "unavailable" — an expired proposal, a withdrawn link — and always null for a
// contract, which the portal reports on and never opens.
type PortalDocumentRowProps = {
  number: string
  title: string | null
  status: ReactNode
  meta: string
  amount: string | null
  link: { href: string; label: string } | null
}

const PortalDocumentRow = ({
  number,
  title,
  status,
  meta,
  amount,
  link
}: PortalDocumentRowProps) => {
  return (
    <li className="border-border flex items-start justify-between gap-3 border-b py-3 last:border-b-0">
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-medium">{number}</span>
          {status}
        </div>
        {title ? <Typography affects={["small", "medium"]}>{title}</Typography> : null}
        <Typography affects={["small", "muted"]}>{meta}</Typography>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {amount ? (
          <span className="font-mono text-sm font-medium tabular-nums">{amount}</span>
        ) : null}
        {link ? (
          <Button asChild variant="ghost" size="icon-sm">
            <Link href={link.href} aria-label={link.label}>
              <Icon name="ArrowUpRight" aria-hidden="true" />
            </Link>
          </Button>
        ) : null}
      </div>
    </li>
  )
}

export { PortalDocumentRow }
