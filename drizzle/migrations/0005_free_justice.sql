ALTER TABLE "settings" DROP CONSTRAINT "chk_settings_payment_terms_days";--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "default_invoice_footer" text;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "chk_settings_invoice_prefix" CHECK (length("settings"."invoice_prefix") <= 24 AND "settings"."invoice_prefix" ~ '^[ -~]*$');--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "chk_settings_payment_terms_days" CHECK ("settings"."payment_terms_days" >= 0 AND "settings"."payment_terms_days" <= 365);