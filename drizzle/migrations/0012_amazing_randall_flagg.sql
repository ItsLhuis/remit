ALTER TABLE "clients" ADD COLUMN "default_hourly_rate_cents" bigint;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "default_hourly_rate_cents" bigint;--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "hourly_rate_override_cents" bigint;--> statement-breakpoint
CREATE UNIQUE INDEX "time_entries_running_timer_idx" ON "time_entries" USING btree ("user_id") WHERE "time_entries"."ended_at" IS NULL AND "time_entries"."deleted_at" IS NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "chk_clients_default_hourly_rate" CHECK ("clients"."default_hourly_rate_cents" IS NULL OR "clients"."default_hourly_rate_cents" >= 0);--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "chk_settings_default_hourly_rate" CHECK ("settings"."default_hourly_rate_cents" IS NULL OR "settings"."default_hourly_rate_cents" >= 0);--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "chk_time_entries_rate_override" CHECK ("time_entries"."hourly_rate_override_cents" IS NULL OR "time_entries"."hourly_rate_override_cents" >= 0);