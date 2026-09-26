-- Settles every issued invoice whose live credit notes and recorded payments already cover its total.
-- Written by hand because it is a data correction, not a schema change: from ADR-0044 onwards credit
-- notes count toward settlement (`features/payments/services/paymentSettlement.ts`), and the write
-- paths re-decide settlement whenever a payment or a credit note moves. An invoice covered before that
-- rule existed was left `sent` with no `paid_at`, where it reads as overdue, is reminded and can be
-- charged a late fee for money nobody owes; nothing would ever re-decide it, because "mark as paid"
-- now refuses an invoice with nothing outstanding.
--
-- The predicate is the SQL form of that settlement rule: a positive total, and payments plus credits
-- reaching it. `paid_at` becomes the moment the invoice was covered, the later of its last live
-- payment and its last live credit note. A re-run finds nothing, because every matched row leaves
-- the `sent` status it selects on.
UPDATE "invoices" AS "i"
SET "status" = 'paid',
    "paid_at" = GREATEST(
      (SELECT max("p"."paid_at") FROM "payments" AS "p" WHERE "p"."invoice_id" = "i"."id" AND "p"."deleted_at" IS NULL),
      (SELECT max("c"."issued_at") FROM "credit_notes" AS "c" WHERE "c"."invoice_id" = "i"."id" AND "c"."deleted_at" IS NULL)
    )
WHERE "i"."status" = 'sent'
  AND "i"."deleted_at" IS NULL
  AND "i"."total_cents" > 0
  AND "i"."amount_paid_cents" + COALESCE(
    (SELECT sum("c"."total_cents") FROM "credit_notes" AS "c" WHERE "c"."invoice_id" = "i"."id" AND "c"."deleted_at" IS NULL),
    0
  ) >= "i"."total_cents";
