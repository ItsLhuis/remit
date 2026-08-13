CREATE TYPE "public"."data_export_scope" AS ENUM('instance', 'client');--> statement-breakpoint
CREATE TYPE "public"."data_export_status" AS ENUM('pending', 'running', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "data_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" "data_export_scope" NOT NULL,
	"client_id" uuid,
	"status" "data_export_status" DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"failure_reason" text,
	"requested_by_user_id" uuid,
	"filename" text,
	"storage_key" text,
	"size_bytes" bigint,
	"entry_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_data_exports_progress" CHECK ("data_exports"."progress" BETWEEN 0 AND 100),
	CONSTRAINT "chk_data_exports_size_bytes" CHECK ("data_exports"."size_bytes" IS NULL OR "data_exports"."size_bytes" >= 0),
	CONSTRAINT "chk_data_exports_scope_client" CHECK (("data_exports"."scope" = 'instance' AND "data_exports"."client_id" IS NULL) OR "data_exports"."scope" = 'client')
);
--> statement-breakpoint
ALTER TABLE "data_exports" ADD CONSTRAINT "data_exports_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_exports" ADD CONSTRAINT "data_exports_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_data_exports_status" ON "data_exports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_data_exports_created_at" ON "data_exports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_data_exports_client_id" ON "data_exports" USING btree ("client_id");