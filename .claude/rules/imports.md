---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# Import Rules

## Group order

Imports are organized into five groups separated by a blank line, in this order:

1. **React and Next** - `react`, `next/*`
2. **External packages** - any package from `node_modules`, alphabetical
3. **Internal absolute** - paths starting with `@/`, alphabetical
4. **Relative** - paths starting with `./` or `../`

Type-only imports stay inline with the value imports they belong to using the `type` modifier (see
`types.md`). They are not grouped separately.

Within each group, sort alphabetically.

## Feature-internal vs. cross-feature imports

Sibling files within the same feature import by direct path to avoid circular dependencies.
Cross-feature imports always use the feature's public barrel.

```ts
// within features/invoicing/components/InvoiceForm.tsx

// ✓ - sibling import inside the same feature: direct path
import { createInvoiceSchema } from "@/features/invoicing/schemas"
import { calculateInvoiceTotal } from "@/features/invoicing/services/calculateInvoiceTotal"

// ✓ - cross-feature import: barrel only
import { type Client } from "@/features/clients"
```

## Canonical example

```ts
// ✓ - correctly ordered import header for a feature component
import { Fragment, useState } from "react"

import { useRouter } from "next/navigation"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { useInvoiceTotals } from "./useInvoiceTotals"

import { createInvoiceSchema, type CreateInvoiceValues } from "@/features/invoicing/schemas"

import { createInvoice } from "@/features/invoicing/mutations"

import { InvoiceLineItemRow } from "./InvoiceLineItemRow"

import { Button, Field, FieldError, FieldLabel, Input, Spinner } from "@/components/ui"

import { type Client } from "@/features/clients"

// ✗ - groups mixed, no blank-line separation, type import separate
import type { CreateInvoiceValues } from "@/features/invoicing/schemas"
import { useRouter } from "next/navigation"
import { InvoiceLineItemRow } from "./InvoiceLineItemRow"
import { Button } from "@/components/ui"
import { Fragment, useState } from "react"
import { createInvoice } from "@/features/invoicing/mutations"
import { zodResolver } from "@hookform/resolvers/zod"
```
