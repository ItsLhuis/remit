ALTER TABLE "activity_logs" ALTER COLUMN "entity_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."entity_type";--> statement-breakpoint
CREATE TYPE "public"."entity_type" AS ENUM('client', 'lead', 'project', 'proposal', 'invoice', 'contract', 'credit_note', 'recurring_invoice', 'time_entry', 'expense', 'payment');--> statement-breakpoint
ALTER TABLE "activity_logs" ALTER COLUMN "entity_type" SET DATA TYPE "public"."entity_type" USING "entity_type"::"public"."entity_type";