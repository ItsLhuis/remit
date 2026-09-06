CREATE TYPE "public"."late_fee_type" AS ENUM('percentage', 'fixed');--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "late_fee_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "late_fee_type" "late_fee_type";--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "late_fee_percentage" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "late_fee_amount_cents" bigint;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "late_fee_grace_days" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "late_fee_max_cents" bigint;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "chk_settings_late_fee_shape" CHECK (("settings"."late_fee_type" IS NULL AND "settings"."late_fee_percentage" IS NULL AND "settings"."late_fee_amount_cents" IS NULL) OR ("settings"."late_fee_type" = 'percentage' AND "settings"."late_fee_percentage" IS NOT NULL AND "settings"."late_fee_amount_cents" IS NULL) OR ("settings"."late_fee_type" = 'fixed' AND "settings"."late_fee_amount_cents" IS NOT NULL AND "settings"."late_fee_percentage" IS NULL));--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "chk_settings_late_fee_enabled_shape" CHECK ("settings"."late_fee_enabled" = false OR "settings"."late_fee_type" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "chk_settings_late_fee_percentage" CHECK ("settings"."late_fee_percentage" IS NULL OR ("settings"."late_fee_percentage" >= 0 AND "settings"."late_fee_percentage" <= 100));--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "chk_settings_late_fee_amount" CHECK ("settings"."late_fee_amount_cents" IS NULL OR "settings"."late_fee_amount_cents" >= 0);--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "chk_settings_late_fee_grace_days" CHECK ("settings"."late_fee_grace_days" >= 0 AND "settings"."late_fee_grace_days" <= 365);--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "chk_settings_late_fee_max" CHECK ("settings"."late_fee_max_cents" IS NULL OR "settings"."late_fee_max_cents" >= 0);