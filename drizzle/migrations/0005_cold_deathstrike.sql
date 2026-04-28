ALTER TABLE "settings" DROP CONSTRAINT "settings_user_id_unique";--> statement-breakpoint
ALTER TABLE "activity_log" DROP CONSTRAINT "activity_log_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "clients" DROP CONSTRAINT "clients_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "email_logs" DROP CONSTRAINT "email_logs_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "projects" DROP CONSTRAINT "projects_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "proposals" DROP CONSTRAINT "proposals_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "settings" DROP CONSTRAINT "settings_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "tax_rates" DROP CONSTRAINT "tax_rates_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "templates" DROP CONSTRAINT "templates_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "uploads" DROP CONSTRAINT "uploads_user_id_user_id_fk";
--> statement-breakpoint
DROP INDEX "idx_activity_log_user_created";--> statement-breakpoint
DROP INDEX "idx_clients_user_id";--> statement-breakpoint
DROP INDEX "idx_email_logs_user_id";--> statement-breakpoint
DROP INDEX "idx_invoices_user_id";--> statement-breakpoint
DROP INDEX "idx_projects_user_id";--> statement-breakpoint
DROP INDEX "idx_proposals_user_id";--> statement-breakpoint
DROP INDEX "idx_tax_rates_user_id";--> statement-breakpoint
DROP INDEX "idx_templates_user_id";--> statement-breakpoint
DROP INDEX "idx_templates_type_default";--> statement-breakpoint
DROP INDEX "idx_uploads_user_id";--> statement-breakpoint
DROP INDEX "idx_activity_log_unread";--> statement-breakpoint
CREATE INDEX "idx_activity_log_created_at" ON "activity_log" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tax_rates_default" ON "tax_rates" USING btree ("is_default") WHERE "tax_rates"."is_default" = true AND "tax_rates"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_templates_default_per_type" ON "templates" USING btree ("type") WHERE "templates"."is_default" = true AND "templates"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_activity_log_unread" ON "activity_log" USING btree ("id") WHERE "activity_log"."read_at" IS NULL;--> statement-breakpoint
ALTER TABLE "activity_log" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "clients" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "email_logs" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "proposals" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "settings" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "tax_rates" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "templates" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "uploads" DROP COLUMN "user_id";