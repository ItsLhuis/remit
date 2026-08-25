"use client"

import { type Control, Controller } from "react-hook-form"

import { type ExpenseFormInputValues } from "../../schemas"

import { ExpenseReceiptControl } from "./ExpenseReceiptControl"

type ExpenseReceiptFieldProps = {
  control: Control<ExpenseFormInputValues>
  disabled?: boolean
}

// The one migrated call site that keeps a deliberate difference from the other three: an expense
// receipt is a *form field*, so the upload result goes into `field.value` and is persisted by the
// form's own submit rather than by a server action of its own. `createExpense` re-validates that
// metadata — including the `expenses/` key prefix, see schemas.ts — when the expense is saved.
const ExpenseReceiptField = ({ control, disabled }: ExpenseReceiptFieldProps) => (
  <Controller
    name="receipt"
    control={control}
    render={({ field }) => (
      <ExpenseReceiptControl
        disabled={disabled}
        name={field.name}
        value={field.value}
        onChange={field.onChange}
      />
    )}
  />
)

export { ExpenseReceiptField }
