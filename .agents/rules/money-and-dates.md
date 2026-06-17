---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# Money and Date Rules

Money and dates are parsed and formatted through shared helpers in `lib/utils`, never with ad-hoc
`Intl` calls or floating-point math scattered across features. Storage rules live in `database.md`;
this file covers how the values move and render at the application boundary.

## Money is integer minor units

Monetary amounts are integer minor units (cents), stored as `bigint` (see `database.md` and
`docs/architecture/adr/0009-money-as-integer-minor-units.md`). Never represent money as a float and
never do money math with floats.

- Convert a `bigint` money column to `number` at the query boundary with `Number(...)` (see
  `queries.md`).
- Parse a user-entered amount with `parseAmountToCents` and render cents back into an input with
  `formatCentsForInput`, both from `lib/utils`.
- Round inside pure `services/` with `Math.round` when deriving totals or tax (see
  `architecture.md`); orchestrators and components receive already-computed cents.

## Format at the boundary through `lib/utils`

Display formatting uses the locale-aware helpers in `lib/utils/format.ts`, exported from
`lib/utils`. Reach for these instead of constructing `new Intl.NumberFormat` or
`new Intl.DateTimeFormat` in a feature component.

| Need                       | Helper                                          |
| -------------------------- | ----------------------------------------------- |
| Currency from cents        | `formatCurrency(cents, currency, locale)`       |
| Compact currency or number | `formatCompactCurrency` / `formatCompactNumber` |
| Percentage                 | `formatPercentage(value, locale)`               |
| Date and time              | `formatDate(date, { locale, timeZone })`        |
| Date only                  | `formatDay(date, locale)`                       |
| File size                  | `formatBytes(bytes, locale)`                    |

```ts
// Good - shared, locale-aware formatter
import { formatCurrency } from "@/lib/utils"

formatCurrency(invoice.totalCents, invoice.currency, locale)

// Bad - inline Intl in a feature component drifts from the shared formatters
new Intl.NumberFormat(locale, { style: "currency", currency }).format(invoice.totalCents / 100)
```

When a needed format does not exist, add a named formatter to `lib/utils/format.ts` and export it
rather than inlining `Intl` at the call site (see helper discipline in `code-style.md`). A genuinely
one-off `Intl` use inside a UI primitive in `components/ui/` may stay local when no shared formatter
fits; leave a short comment when it does.

## Dates are stored in UTC, formatted with a locale and time zone

Timestamps are stored with time zone in UTC (see `database.md`). Format them for display by passing
the instance's `locale` and `defaultTimezone` (from settings) to `formatDate`. Compute date math —
windows, next-run dates, reporting ranges — in pure `services/` using explicit UTC construction such
as `Date.UTC(...)`; never derive a scheduling or reporting date inside a component.

A locale and a time zone always accompany a formatted date, and the ISO 4217 currency code always
accompanies a formatted amount. Formatting without them silently falls back to the server's
defaults.
