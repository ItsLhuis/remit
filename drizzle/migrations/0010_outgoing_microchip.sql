ALTER TABLE "settings" ADD COLUMN "contract_prefix" text DEFAULT 'CTR-' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "next_contract_number" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "chk_settings_next_contract_number" CHECK ("settings"."next_contract_number" >= 1);