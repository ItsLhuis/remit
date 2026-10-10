CREATE TYPE "public"."storage_bucket_role" AS ENUM('public', 'documents', 'exports');--> statement-breakpoint
CREATE TABLE "object_deletions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bucket" "storage_bucket_role" NOT NULL,
	"key" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_object_deletions_attempts" CHECK ("object_deletions"."attempts" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_object_deletions_bucket_key" ON "object_deletions" USING btree ("bucket","key");--> statement-breakpoint
CREATE INDEX "idx_object_deletions_created_at" ON "object_deletions" USING btree ("created_at");