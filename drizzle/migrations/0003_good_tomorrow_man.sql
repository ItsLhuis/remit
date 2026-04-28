ALTER TABLE "clients" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "line_items" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tax_rates" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "idx_clients_active" ON "clients" USING btree ("id") WHERE "clients"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_invoices_active" ON "invoices" USING btree ("id") WHERE "invoices"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_line_items_active" ON "line_items" USING btree ("id") WHERE "line_items"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_projects_active" ON "projects" USING btree ("id") WHERE "projects"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_proposals_active" ON "proposals" USING btree ("id") WHERE "proposals"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_tax_rates_active" ON "tax_rates" USING btree ("id") WHERE "tax_rates"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_templates_active" ON "templates" USING btree ("id") WHERE "templates"."deleted_at" IS NULL;