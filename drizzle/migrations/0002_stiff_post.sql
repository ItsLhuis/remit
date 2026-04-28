ALTER TABLE "invoices" ALTER COLUMN "subtotal" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "discount_amount" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "tax_amount" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "total" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "line_items" ALTER COLUMN "unit_price" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "line_items" ALTER COLUMN "subtotal" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "line_items" ALTER COLUMN "tax_amount" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "line_items" ALTER COLUMN "total" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "budget" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "proposals" ALTER COLUMN "subtotal" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "proposals" ALTER COLUMN "discount_amount" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "proposals" ALTER COLUMN "tax_amount" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "proposals" ALTER COLUMN "total" SET DATA TYPE bigint;