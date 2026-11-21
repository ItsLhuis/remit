export type RebillableExpense = {
  amountCents: number
  rebillable: boolean
  markupPercentage: number | null
}

// What the client is charged for an expense, in whole cents. The rounding happens once, on the
// marked-up total rather than per component, so a 33.33% markup on 10.00 is 13.33 and not 13.34.
// A non-rebillable expense contributes nothing: it is the freelancer's own cost, and returning its
// amount here would make every caller re-check the flag before adding it up.
export function calculateRebillableCents(expense: RebillableExpense): number {
  if (!expense.rebillable) return 0

  if (expense.markupPercentage === null) return expense.amountCents

  return Math.round(expense.amountCents * (1 + expense.markupPercentage / 100))
}
