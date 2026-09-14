CREATE TYPE "public"."api_token_scope" AS ENUM('clients:read', 'projects:read', 'invoices:read', 'time_entries:read', 'expenses:read');--> statement-breakpoint
CREATE TYPE "public"."webhook_delivery_status" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "api_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"token_prefix" text NOT NULL,
	"scopes" "api_token_scope"[] NOT NULL,
	"created_by_user_id" uuid,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_api_tokens_scopes" CHECK (cardinality("api_tokens"."scopes") >= 1)
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"event" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "webhook_delivery_status" DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"attempts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_status_code" integer,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_webhook_deliveries_attempt_count" CHECK ("webhook_deliveries"."attempt_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"events" text[] NOT NULL,
	"secret" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"disabled_reason" text,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_webhook_endpoints_events" CHECK (cardinality("webhook_endpoints"."events") >= 1),
	CONSTRAINT "chk_webhook_endpoints_consecutive_failures" CHECK ("webhook_endpoints"."consecutive_failures" >= 0),
	CONSTRAINT "chk_webhook_endpoints_disabled_reason" CHECK (("webhook_endpoints"."active" AND "webhook_endpoints"."disabled_reason" IS NULL) OR (NOT "webhook_endpoints"."active" AND "webhook_endpoints"."disabled_reason" IN ('manual', 'consecutive_failures')))
);
--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_endpoint_id_webhook_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."webhook_endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_api_tokens_token_hash" ON "api_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_api_tokens_created_by_user_id" ON "api_tokens" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_endpoint_created_at" ON "webhook_deliveries" USING btree ("endpoint_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_created_at" ON "webhook_deliveries" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_webhook_endpoints_active" ON "webhook_endpoints" USING btree ("active");