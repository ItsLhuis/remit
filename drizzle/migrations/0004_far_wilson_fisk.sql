ALTER TABLE "invoices" DROP CONSTRAINT "chk_invoices_discount";--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT "chk_invoices_discount_value";--> statement-breakpoint
ALTER TABLE "line_items" DROP CONSTRAINT "chk_line_items_discount";--> statement-breakpoint
ALTER TABLE "line_items" DROP CONSTRAINT "chk_line_items_discount_value";--> statement-breakpoint
ALTER TABLE "proposals" DROP CONSTRAINT "chk_proposals_discount";--> statement-breakpoint
ALTER TABLE "proposals" DROP CONSTRAINT "chk_proposals_discount_value";--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "discount_percentage" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "discount_amount_cents" bigint;--> statement-breakpoint
ALTER TABLE "line_items" ADD COLUMN "discount_percentage" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "line_items" ADD COLUMN "discount_amount_cents" bigint;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "discount_percentage" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "discount_amount_cents" bigint;--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "discount_value";--> statement-breakpoint
ALTER TABLE "line_items" DROP COLUMN "discount_value";--> statement-breakpoint
ALTER TABLE "proposals" DROP COLUMN "discount_value";--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_discount_percentage_chk" CHECK ("invoices"."discount_percentage" IS NULL OR ("invoices"."discount_percentage" >= 0 AND "invoices"."discount_percentage" <= 100));--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_discount_amount_chk" CHECK ("invoices"."discount_amount_cents" IS NULL OR "invoices"."discount_amount_cents" >= 0);--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_discount_shape_chk" CHECK (("invoices"."discount_type" IS NULL AND "invoices"."discount_percentage" IS NULL AND "invoices"."discount_amount_cents" IS NULL) OR ("invoices"."discount_type" = 'percentage' AND "invoices"."discount_percentage" IS NOT NULL AND "invoices"."discount_amount_cents" IS NULL) OR ("invoices"."discount_type" = 'fixed' AND "invoices"."discount_amount_cents" IS NOT NULL AND "invoices"."discount_percentage" IS NULL));--> statement-breakpoint
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_discount_percentage_chk" CHECK ("line_items"."discount_percentage" IS NULL OR ("line_items"."discount_percentage" >= 0 AND "line_items"."discount_percentage" <= 100));--> statement-breakpoint
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_discount_amount_chk" CHECK ("line_items"."discount_amount_cents" IS NULL OR "line_items"."discount_amount_cents" >= 0);--> statement-breakpoint
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_discount_shape_chk" CHECK (("line_items"."discount_type" IS NULL AND "line_items"."discount_percentage" IS NULL AND "line_items"."discount_amount_cents" IS NULL) OR ("line_items"."discount_type" = 'percentage' AND "line_items"."discount_percentage" IS NOT NULL AND "line_items"."discount_amount_cents" IS NULL) OR ("line_items"."discount_type" = 'fixed' AND "line_items"."discount_amount_cents" IS NOT NULL AND "line_items"."discount_percentage" IS NULL));--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_discount_percentage_chk" CHECK ("proposals"."discount_percentage" IS NULL OR ("proposals"."discount_percentage" >= 0 AND "proposals"."discount_percentage" <= 100));--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_discount_amount_chk" CHECK ("proposals"."discount_amount_cents" IS NULL OR "proposals"."discount_amount_cents" >= 0);--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_discount_shape_chk" CHECK (("proposals"."discount_type" IS NULL AND "proposals"."discount_percentage" IS NULL AND "proposals"."discount_amount_cents" IS NULL) OR ("proposals"."discount_type" = 'percentage' AND "proposals"."discount_percentage" IS NOT NULL AND "proposals"."discount_amount_cents" IS NULL) OR ("proposals"."discount_type" = 'fixed' AND "proposals"."discount_amount_cents" IS NOT NULL AND "proposals"."discount_percentage" IS NULL));