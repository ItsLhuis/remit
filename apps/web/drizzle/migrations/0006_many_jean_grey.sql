CREATE TYPE "public"."report_export_status" AS ENUM('pending', 'running', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "report_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report" text NOT NULL,
	"filters" jsonb NOT NULL,
	"status" "report_export_status" DEFAULT 'pending' NOT NULL,
	"failure_reason" text,
	"requested_by_user_id" uuid,
	"storage_key" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "report_exports" ADD CONSTRAINT "report_exports_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;