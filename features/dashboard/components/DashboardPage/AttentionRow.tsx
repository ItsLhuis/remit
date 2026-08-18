"use client"

import Link from "next/link"

import { type TFunction, useTranslation } from "@/lib/i18n"

import { formatCurrency } from "@/lib/utils"

import { Badge, Icon, Typography } from "@/components/ui"

import { attentionKindPresentation, attentionSeverityVariant } from "../../labels"
import { type AttentionItem } from "../../services"

// `days` is signed by the item's kind: elapsed for the backward-looking kinds, remaining for the two
// that look forward. The plural forms only ever see a positive count, so the sign chooses the key
// and the magnitude fills it.
function toDetail(item: AttentionItem, t: TFunction): string {
  const days = Math.abs(item.days)

  if (item.kind === "proposalExpiring") {
    return item.days < 0
      ? t("dashboard.attention.details.proposalExpired", { days })
      : t("dashboard.attention.details.proposalExpiring", { days })
  }

  if (item.kind === "taskDue") {
    return item.days < 0
      ? t("dashboard.attention.details.taskOverdue", { days })
      : t("dashboard.attention.details.taskDue", { days })
  }

  return t(`dashboard.attention.details.${item.kind}`, { days })
}

type AttentionRowProps = {
  item: AttentionItem
  locale: string
  // Milliseconds of entrance delay. Rows arrive staggered so the eye reads the ranking as it lands
  // rather than meeting seven finished rows at once; `prefers-reduced-motion` collapses the whole
  // animation globally in app/globals.css.
  delayMilliseconds: number
}

const AttentionRow = ({ item, locale, delayMilliseconds }: AttentionRowProps) => {
  const { t } = useTranslation()

  return (
    <li
      className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-backwards"
      // Duration and easing are set here rather than through `duration-200 ease-out`, because those
      // utilities also set the transition properties and would read as `transition: all` on an
      // element that only ever animates its entrance. The global `prefers-reduced-motion` block in
      // app/globals.css still overrides `animation-duration`, inline value included.
      style={{
        animationDelay: `${delayMilliseconds}ms`,
        animationDuration: "200ms",
        animationTimingFunction: "cubic-bezier(0, 0, 0.2, 1)"
      }}
    >
      <Link
        href={item.href}
        className="hover:bg-muted/60 focus-visible:ring-ring/50 group/attention flex items-start gap-3 rounded-lg px-2 py-2 transition-colors focus-visible:ring-[3px] focus-visible:outline-none"
      >
        <Badge variant={attentionSeverityVariant[item.severity]} className="mt-0.5 size-5 px-0">
          <Icon name={attentionKindPresentation[item.kind].icon} aria-hidden="true" />
          <span className="sr-only">{t(`dashboard.attention.kindLabels.${item.kind}`)}</span>
        </Badge>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-baseline gap-2">
            <Typography affects={["small", "medium"]} className="truncate">
              {item.subject}
            </Typography>
            {item.amountCents !== null && item.currency ? (
              <span className="ml-auto shrink-0 font-mono text-xs tabular-nums">
                {formatCurrency(item.amountCents, item.currency, locale)}
              </span>
            ) : null}
          </span>
          <Typography affects={["muted", "tiny"]} className="truncate">
            {item.context
              ? t("dashboard.attention.contextDetail", {
                  parent: item.context,
                  detail: toDetail(item, t)
                })
              : toDetail(item, t)}
          </Typography>
        </span>
        <Icon
          name="ChevronRight"
          className="text-muted-foreground mt-0.5 size-4 shrink-0 opacity-0 transition-opacity group-hover/attention:opacity-100 group-focus-visible/attention:opacity-100"
          aria-hidden="true"
        />
      </Link>
    </li>
  )
}

export { AttentionRow }
