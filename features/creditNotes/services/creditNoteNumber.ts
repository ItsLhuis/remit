export type CreditNoteNumberInput = {
  prefix: string
  paddingWidth: number
  nextSequence: number
}

// Credit notes carry their own sequence, separate from the invoice one: settings
// `credit_note_prefix` and `next_credit_note_number` share only `number_padding_width` with
// invoices. A number wider than the configured padding is never truncated — `CN-` at width 4 yields
// `CN-0042` but still yields `CN-100000` once the counter outgrows the pad. Truncating would mint a
// duplicate against the `credit_notes_number_idx` unique index, and a credit-note number is
// permanent.
export function generateCreditNoteNumber({
  prefix,
  paddingWidth,
  nextSequence
}: CreditNoteNumberInput): string {
  return `${prefix}${String(nextSequence).padStart(paddingWidth, "0")}`
}
