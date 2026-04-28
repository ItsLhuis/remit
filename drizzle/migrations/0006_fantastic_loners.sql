ALTER TABLE "line_items" RENAME COLUMN "tax_percentage" TO "tax_percentage_snapshot";--> statement-breakpoint
ALTER TABLE "line_items" DROP CONSTRAINT "chk_line_items_tax_percentage";--> statement-breakpoint
ALTER TABLE "line_items" ADD CONSTRAINT "chk_line_items_tax_percentage" CHECK ("line_items"."tax_percentage_snapshot" >= 0 AND "line_items"."tax_percentage_snapshot" <= 100);