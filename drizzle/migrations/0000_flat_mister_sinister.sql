CREATE TYPE "public"."backup_cadence" AS ENUM('daily', 'weekly');--> statement-breakpoint
CREATE TYPE "public"."backup_destination" AS ENUM('local', 's3', 'r2', 'b2');--> statement-breakpoint
CREATE TYPE "public"."contract_status" AS ENUM('draft', 'sent', 'signed', 'expired', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."discount_type" AS ENUM('percentage', 'fixed');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('proposal', 'invoice', 'contract');--> statement-breakpoint
CREATE TYPE "public"."email_provider" AS ENUM('smtp', 'resend');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."entity_type" AS ENUM('client', 'project', 'proposal', 'invoice', 'contract', 'task', 'time_entry', 'expense', 'payment');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'sent', 'paid');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'accountant', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('bank_transfer', 'stripe', 'cash', 'other');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('active', 'completed', 'on_hold', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."proposal_action" AS ENUM('accept', 'reject');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('draft', 'sent', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."recurring_cadence" AS ENUM('weekly', 'monthly', 'quarterly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."recurring_invoice_status" AS ENUM('active', 'paused', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('todo', 'doing', 'done');--> statement-breakpoint
CREATE TYPE "public"."template_type" AS ENUM('invoice', 'proposal', 'contract', 'credit_note', 'email_invoice_send', 'email_proposal_send', 'email_contract_send', 'email_payment_receipt', 'email_overdue_reminder', 'email_recurring_generated');--> statement-breakpoint
CREATE TYPE "public"."time_entry_source" AS ENUM('timer', 'manual');--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"message_key" text NOT NULL,
	"message_args" jsonb,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event" text NOT NULL,
	"actor_user_id" uuid,
	"actor_role" "member_role",
	"target_entity_type" text,
	"target_entity_id" uuid,
	"metadata" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"active_organization_id" uuid,
	"user_id" uuid NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "two_factors" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"two_factor_enabled" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"website" text,
	"tax_id" text,
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"state" text,
	"postal_code" text,
	"country" text,
	"currency" varchar(3),
	"notes" text,
	"portal_token" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_type" "document_type",
	"document_id" uuid,
	"template_id" uuid,
	"recipient_email" text NOT NULL,
	"recipient_name" text,
	"subject" text NOT NULL,
	"status" "email_status" DEFAULT 'pending' NOT NULL,
	"pdf_attached" boolean DEFAULT false NOT NULL,
	"provider" "email_provider",
	"provider_message_id" text,
	"sent_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"client_id" uuid,
	"proposal_id" uuid,
	"recurring_invoice_id" uuid,
	"template_id" uuid,
	"number" text NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"exchange_rate" numeric(20, 10),
	"discount_type" "discount_type",
	"discount_percentage" numeric(5, 2),
	"discount_amount_cents" bigint,
	"subtotal_cents" bigint DEFAULT 0 NOT NULL,
	"discount_amount_total_cents" bigint DEFAULT 0 NOT NULL,
	"tax_amount_cents" bigint DEFAULT 0 NOT NULL,
	"total_cents" bigint DEFAULT 0 NOT NULL,
	"amount_paid_cents" bigint DEFAULT 0 NOT NULL,
	"issue_date" date,
	"due_date" date,
	"paid_at" timestamp with time zone,
	"late_fee_cents" bigint,
	"notes" text,
	"public_token" text NOT NULL,
	"first_viewed_at" timestamp with time zone,
	"last_viewed_at" timestamp with time zone,
	"view_count" integer DEFAULT 0 NOT NULL,
	"last_reminder_sent_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_number_unique" UNIQUE("number"),
	CONSTRAINT "chk_invoices_parent" CHECK ("invoices"."project_id" IS NOT NULL OR "invoices"."client_id" IS NOT NULL),
	CONSTRAINT "chk_invoices_discount_percentage" CHECK ("invoices"."discount_percentage" IS NULL OR ("invoices"."discount_percentage" >= 0 AND "invoices"."discount_percentage" <= 100)),
	CONSTRAINT "chk_invoices_discount_amount" CHECK ("invoices"."discount_amount_cents" IS NULL OR "invoices"."discount_amount_cents" >= 0),
	CONSTRAINT "chk_invoices_discount_shape" CHECK (("invoices"."discount_type" IS NULL AND "invoices"."discount_percentage" IS NULL AND "invoices"."discount_amount_cents" IS NULL) OR ("invoices"."discount_type" = 'percentage' AND "invoices"."discount_percentage" IS NOT NULL AND "invoices"."discount_amount_cents" IS NULL) OR ("invoices"."discount_type" = 'fixed' AND "invoices"."discount_amount_cents" IS NOT NULL AND "invoices"."discount_percentage" IS NULL)),
	CONSTRAINT "chk_invoices_totals" CHECK ("invoices"."subtotal_cents" >= 0 AND "invoices"."discount_amount_total_cents" >= 0 AND "invoices"."tax_amount_cents" >= 0 AND "invoices"."total_cents" >= 0),
	CONSTRAINT "chk_invoices_amount_paid" CHECK ("invoices"."amount_paid_cents" >= 0 AND "invoices"."amount_paid_cents" <= "invoices"."total_cents"),
	CONSTRAINT "chk_invoices_dates" CHECK ("invoices"."due_date" IS NULL OR "invoices"."issue_date" IS NULL OR "invoices"."due_date" >= "invoices"."issue_date"),
	CONSTRAINT "chk_invoices_view_count" CHECK ("invoices"."view_count" >= 0),
	CONSTRAINT "chk_invoices_late_fee" CHECK ("invoices"."late_fee_cents" IS NULL OR "invoices"."late_fee_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid,
	"invoice_id" uuid,
	"credit_note_id" uuid,
	"tax_rate_id" uuid,
	"position" integer NOT NULL,
	"description" text NOT NULL,
	"unit" text,
	"quantity" numeric(10, 2) NOT NULL,
	"unit_price_cents" bigint NOT NULL,
	"discount_type" "discount_type",
	"discount_percentage" numeric(5, 2),
	"discount_amount_cents" bigint,
	"tax_percentage_snapshot" numeric(5, 2) DEFAULT '0' NOT NULL,
	"subtotal_cents" bigint DEFAULT 0 NOT NULL,
	"tax_amount_cents" bigint DEFAULT 0 NOT NULL,
	"total_cents" bigint DEFAULT 0 NOT NULL,
	"source_time_entry_id" uuid,
	"source_expense_id" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_line_items_parent" CHECK ((
        ("line_items"."proposal_id" IS NOT NULL)::int +
        ("line_items"."invoice_id" IS NOT NULL)::int +
        ("line_items"."credit_note_id" IS NOT NULL)::int
      ) = 1),
	CONSTRAINT "chk_line_items_discount_percentage" CHECK ("line_items"."discount_percentage" IS NULL OR ("line_items"."discount_percentage" >= 0 AND "line_items"."discount_percentage" <= 100)),
	CONSTRAINT "chk_line_items_discount_amount" CHECK ("line_items"."discount_amount_cents" IS NULL OR "line_items"."discount_amount_cents" >= 0),
	CONSTRAINT "chk_line_items_discount_shape" CHECK (("line_items"."discount_type" IS NULL AND "line_items"."discount_percentage" IS NULL AND "line_items"."discount_amount_cents" IS NULL) OR ("line_items"."discount_type" = 'percentage' AND "line_items"."discount_percentage" IS NOT NULL AND "line_items"."discount_amount_cents" IS NULL) OR ("line_items"."discount_type" = 'fixed' AND "line_items"."discount_amount_cents" IS NOT NULL AND "line_items"."discount_percentage" IS NULL)),
	CONSTRAINT "chk_line_items_quantity" CHECK ("line_items"."quantity" > 0),
	CONSTRAINT "chk_line_items_unit_price" CHECK ("line_items"."unit_price_cents" >= 0),
	CONSTRAINT "chk_line_items_tax_percentage" CHECK ("line_items"."tax_percentage_snapshot" >= 0 AND "line_items"."tax_percentage_snapshot" <= 100),
	CONSTRAINT "chk_line_items_totals" CHECK ("line_items"."subtotal_cents" >= 0 AND "line_items"."tax_amount_cents" >= 0 AND "line_items"."total_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "project_status" DEFAULT 'active' NOT NULL,
	"currency" varchar(3),
	"budget_cents" bigint,
	"hourly_rate_cents" bigint,
	"start_date" date,
	"end_date" date,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_projects_budget" CHECK ("projects"."budget_cents" IS NULL OR "projects"."budget_cents" >= 0),
	CONSTRAINT "chk_projects_hourly_rate" CHECK ("projects"."hourly_rate_cents" IS NULL OR "projects"."hourly_rate_cents" >= 0),
	CONSTRAINT "chk_projects_dates" CHECK ("projects"."end_date" IS NULL OR "projects"."start_date" IS NULL OR "projects"."end_date" >= "projects"."start_date")
);
--> statement-breakpoint
CREATE TABLE "proposal_otps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"action" "proposal_action" NOT NULL,
	"code_hash" text NOT NULL,
	"email" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"used_at" timestamp with time zone,
	"invalidated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_proposal_otps_attempts" CHECK ("proposal_otps"."attempts" >= 0 AND "proposal_otps"."attempts" <= 5),
	CONSTRAINT "chk_proposal_otps_used_invalidated" CHECK (NOT ("proposal_otps"."used_at" IS NOT NULL AND "proposal_otps"."invalidated_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"template_id" uuid,
	"number" text NOT NULL,
	"status" "proposal_status" DEFAULT 'draft' NOT NULL,
	"currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"discount_type" "discount_type",
	"discount_percentage" numeric(5, 2),
	"discount_amount_cents" bigint,
	"subtotal_cents" bigint DEFAULT 0 NOT NULL,
	"discount_amount_total_cents" bigint DEFAULT 0 NOT NULL,
	"tax_amount_cents" bigint DEFAULT 0 NOT NULL,
	"total_cents" bigint DEFAULT 0 NOT NULL,
	"valid_until" date,
	"notes" text,
	"public_token" text NOT NULL,
	"first_viewed_at" timestamp with time zone,
	"last_viewed_at" timestamp with time zone,
	"view_count" integer DEFAULT 0 NOT NULL,
	"issued_at" timestamp with time zone,
	"locked_at" timestamp with time zone,
	"responded_at" timestamp with time zone,
	"responded_ip" text,
	"rejection_reason" text,
	"converted_to_invoice_id" uuid,
	"converted_to_contract_id" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposals_number_unique" UNIQUE("number"),
	CONSTRAINT "chk_proposals_discount_percentage" CHECK ("proposals"."discount_percentage" IS NULL OR ("proposals"."discount_percentage" >= 0 AND "proposals"."discount_percentage" <= 100)),
	CONSTRAINT "chk_proposals_discount_amount" CHECK ("proposals"."discount_amount_cents" IS NULL OR "proposals"."discount_amount_cents" >= 0),
	CONSTRAINT "chk_proposals_discount_shape" CHECK (("proposals"."discount_type" IS NULL AND "proposals"."discount_percentage" IS NULL AND "proposals"."discount_amount_cents" IS NULL) OR ("proposals"."discount_type" = 'percentage' AND "proposals"."discount_percentage" IS NOT NULL AND "proposals"."discount_amount_cents" IS NULL) OR ("proposals"."discount_type" = 'fixed' AND "proposals"."discount_amount_cents" IS NOT NULL AND "proposals"."discount_percentage" IS NULL)),
	CONSTRAINT "chk_proposals_totals" CHECK ("proposals"."subtotal_cents" >= 0 AND "proposals"."discount_amount_total_cents" >= 0 AND "proposals"."tax_amount_cents" >= 0 AND "proposals"."total_cents" >= 0),
	CONSTRAINT "chk_proposals_view_count" CHECK ("proposals"."view_count" >= 0),
	CONSTRAINT "chk_proposals_response" CHECK (("proposals"."status" NOT IN ('accepted', 'rejected')) OR ("proposals"."responded_at" IS NOT NULL AND "proposals"."responded_ip" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_name" text,
	"business_email" text,
	"business_phone" text,
	"business_website" text,
	"business_tax_id" text,
	"business_logo_upload_id" uuid,
	"business_address_line1" text,
	"business_address_line2" text,
	"business_city" text,
	"business_state" text,
	"business_postal_code" text,
	"business_country" text,
	"default_currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"default_locale" text DEFAULT 'en' NOT NULL,
	"default_timezone" text DEFAULT 'UTC' NOT NULL,
	"payment_terms_days" integer DEFAULT 30 NOT NULL,
	"proposal_validity_days" integer DEFAULT 30 NOT NULL,
	"default_notes_invoice" text,
	"default_notes_proposal" text,
	"invoice_prefix" text DEFAULT 'INV-' NOT NULL,
	"proposal_prefix" text DEFAULT 'PROP-' NOT NULL,
	"credit_note_prefix" text DEFAULT 'CN-' NOT NULL,
	"next_invoice_number" integer DEFAULT 1 NOT NULL,
	"next_proposal_number" integer DEFAULT 1 NOT NULL,
	"next_credit_note_number" integer DEFAULT 1 NOT NULL,
	"number_padding_width" integer DEFAULT 4 NOT NULL,
	"payment_iban" text,
	"payment_bank_name" text,
	"payment_instructions" text,
	"stripe_publishable_key" text,
	"stripe_secret_key" text,
	"stripe_webhook_secret" text,
	"stripe_test_connection_at" timestamp with time zone,
	"email_provider" "email_provider",
	"smtp_host" text,
	"smtp_port" integer,
	"smtp_user" text,
	"smtp_pass" text,
	"smtp_secure" boolean DEFAULT true NOT NULL,
	"resend_api_key" text,
	"email_from_name" text,
	"email_from_address" text,
	"email_test_send_at" timestamp with time zone,
	"reminder_before_due_days" integer[] DEFAULT ARRAY[3, 0] NOT NULL,
	"reminder_after_due_days" integer[] DEFAULT ARRAY[7, 14, 30] NOT NULL,
	"base_url" text,
	"sentry_dsn" text,
	"metrics_token" text,
	"hosted_mode" boolean DEFAULT false NOT NULL,
	"backup_destination" "backup_destination" DEFAULT 'local' NOT NULL,
	"backup_cadence" "backup_cadence" DEFAULT 'daily' NOT NULL,
	"backup_retention_daily" integer DEFAULT 7 NOT NULL,
	"backup_retention_weekly" integer DEFAULT 4 NOT NULL,
	"backup_retention_monthly" integer DEFAULT 12 NOT NULL,
	"backup_s3_bucket" text,
	"backup_s3_region" text,
	"backup_s3_endpoint" text,
	"backup_s3_access_key" text,
	"backup_s3_secret_key" text,
	"backup_last_success_at" timestamp with time zone,
	"backup_last_failure_at" timestamp with time zone,
	"backup_last_failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_settings_email_provider" CHECK ("settings"."email_provider" IS NULL OR "settings"."email_provider" IN ('smtp', 'resend')),
	CONSTRAINT "chk_settings_payment_terms_days" CHECK ("settings"."payment_terms_days" >= 0),
	CONSTRAINT "chk_settings_proposal_validity_days" CHECK ("settings"."proposal_validity_days" >= 0),
	CONSTRAINT "chk_settings_next_invoice_number" CHECK ("settings"."next_invoice_number" >= 1),
	CONSTRAINT "chk_settings_next_proposal_number" CHECK ("settings"."next_proposal_number" >= 1),
	CONSTRAINT "chk_settings_next_credit_note_number" CHECK ("settings"."next_credit_note_number" >= 1),
	CONSTRAINT "chk_settings_number_padding_width" CHECK ("settings"."number_padding_width" >= 1 AND "settings"."number_padding_width" <= 10)
);
--> statement-breakpoint
CREATE TABLE "tax_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"percentage" numeric(5, 2) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_tax_rates_percentage" CHECK ("tax_rates"."percentage" >= 0 AND "tax_rates"."percentage" <= 100)
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "template_type" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"subject" text,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filename" text NOT NULL,
	"path" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uploads_path_unique" UNIQUE("path"),
	CONSTRAINT "chk_uploads_size_bytes" CHECK ("uploads"."size_bytes" > 0)
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"inviter_id" uuid NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text,
	"last_name" text,
	"company" text,
	"email" text NOT NULL,
	"phone" text,
	"source" text,
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"notes" text,
	"converted_at" timestamp with time zone,
	"converted_to_client_id" uuid,
	"lost_reason" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "task_status" DEFAULT 'todo' NOT NULL,
	"priority" "task_priority" DEFAULT 'normal' NOT NULL,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"position" integer DEFAULT 0 NOT NULL,
	"hourly_rate_cents" bigint,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"task_id" uuid,
	"user_id" uuid,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"duration_seconds" integer,
	"billable" boolean DEFAULT true NOT NULL,
	"hourly_rate_snapshot_cents" bigint NOT NULL,
	"description" text,
	"source" time_entry_source DEFAULT 'timer' NOT NULL,
	"invoiced_in_id" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_time_entries_duration" CHECK ("time_entries"."duration_seconds" IS NULL OR "time_entries"."duration_seconds" >= 0),
	CONSTRAINT "chk_time_entries_ended" CHECK (("time_entries"."ended_at" IS NULL AND "time_entries"."duration_seconds" IS NULL) OR ("time_entries"."ended_at" IS NOT NULL AND "time_entries"."duration_seconds" IS NOT NULL AND "time_entries"."ended_at" >= "time_entries"."started_at")),
	CONSTRAINT "chk_time_entries_rate" CHECK ("time_entries"."hourly_rate_snapshot_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"client_id" uuid,
	"amount_cents" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"spent_at" date NOT NULL,
	"receipt_upload_id" uuid,
	"rebillable" boolean DEFAULT false NOT NULL,
	"markup_percentage" numeric(5, 2),
	"invoiced_in_id" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_expenses_amount" CHECK ("expenses"."amount_cents" >= 0),
	CONSTRAINT "chk_expenses_markup" CHECK ("expenses"."markup_percentage" IS NULL OR ("expenses"."markup_percentage" >= 0 AND "expenses"."markup_percentage" <= 1000))
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"client_id" uuid,
	"proposal_id" uuid,
	"template_id" uuid,
	"number" text NOT NULL,
	"title" text NOT NULL,
	"status" "contract_status" DEFAULT 'draft' NOT NULL,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"public_token" text NOT NULL,
	"issued_at" timestamp with time zone,
	"effective_from" date,
	"effective_until" date,
	"terminated_at" timestamp with time zone,
	"termination_reason" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contracts_number_unique" UNIQUE("number"),
	CONSTRAINT "chk_contracts_parent" CHECK ("contracts"."project_id" IS NOT NULL OR "contracts"."client_id" IS NOT NULL),
	CONSTRAINT "chk_contracts_dates" CHECK ("contracts"."effective_until" IS NULL OR "contracts"."effective_from" IS NULL OR "contracts"."effective_until" >= "contracts"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "contract_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"signer_name" text NOT NULL,
	"signer_email" text NOT NULL,
	"consent_text" text NOT NULL,
	"ip_address" text NOT NULL,
	"user_agent" text NOT NULL,
	"signed_pdf_upload_id" uuid,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"project_id" uuid,
	"template_id" uuid,
	"name" text NOT NULL,
	"status" "recurring_invoice_status" DEFAULT 'active' NOT NULL,
	"cadence" "recurring_cadence" NOT NULL,
	"cadence_day" integer,
	"next_run_at" date NOT NULL,
	"last_run_at" date,
	"end_after_count" integer,
	"end_by_date" date,
	"occurrences_generated" integer DEFAULT 0 NOT NULL,
	"auto_send" boolean DEFAULT false NOT NULL,
	"currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"line_items_blueprint" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"included_hours" integer,
	"overage_rate_cents" bigint,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_recurring_invoices_end_condition" CHECK ("recurring_invoices"."end_after_count" IS NULL OR "recurring_invoices"."end_by_date" IS NULL),
	CONSTRAINT "chk_recurring_invoices_retainer" CHECK (("recurring_invoices"."included_hours" IS NULL AND "recurring_invoices"."overage_rate_cents" IS NULL) OR ("recurring_invoices"."included_hours" >= 0 AND "recurring_invoices"."overage_rate_cents" >= 0))
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"method" "payment_method" NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reference" text,
	"stripe_payment_intent_id" text,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_payments_amount" CHECK ("payments"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "credit_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"number" text NOT NULL,
	"reason" text,
	"currency" varchar(3) NOT NULL,
	"subtotal_cents" bigint DEFAULT 0 NOT NULL,
	"tax_amount_cents" bigint DEFAULT 0 NOT NULL,
	"total_cents" bigint DEFAULT 0 NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_credit_notes_totals" CHECK ("credit_notes"."subtotal_cents" >= 0 AND "credit_notes"."tax_amount_cents" >= 0 AND "credit_notes"."total_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_active_organization_id_organizations_id_fk" FOREIGN KEY ("active_organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factors" ADD CONSTRAINT "two_factors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_recurring_invoice_id_recurring_invoices_id_fk" FOREIGN KEY ("recurring_invoice_id") REFERENCES "public"."recurring_invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_credit_note_id_credit_notes_id_fk" FOREIGN KEY ("credit_note_id") REFERENCES "public"."credit_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_tax_rate_id_tax_rates_id_fk" FOREIGN KEY ("tax_rate_id") REFERENCES "public"."tax_rates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_source_time_entry_id_time_entries_id_fk" FOREIGN KEY ("source_time_entry_id") REFERENCES "public"."time_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_source_expense_id_expenses_id_fk" FOREIGN KEY ("source_expense_id") REFERENCES "public"."expenses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_otps" ADD CONSTRAINT "proposal_otps_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_converted_to_invoice_id_invoices_id_fk" FOREIGN KEY ("converted_to_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_converted_to_contract_id_contracts_id_fk" FOREIGN KEY ("converted_to_contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_business_logo_upload_id_uploads_id_fk" FOREIGN KEY ("business_logo_upload_id") REFERENCES "public"."uploads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_to_client_id_clients_id_fk" FOREIGN KEY ("converted_to_client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_invoiced_in_id_invoices_id_fk" FOREIGN KEY ("invoiced_in_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_receipt_upload_id_uploads_id_fk" FOREIGN KEY ("receipt_upload_id") REFERENCES "public"."uploads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_invoiced_in_id_invoices_id_fk" FOREIGN KEY ("invoiced_in_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_signatures" ADD CONSTRAINT "contract_signatures_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_signatures" ADD CONSTRAINT "contract_signatures_signed_pdf_upload_id_uploads_id_fk" FOREIGN KEY ("signed_pdf_upload_id") REFERENCES "public"."uploads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_invoices" ADD CONSTRAINT "recurring_invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_invoices" ADD CONSTRAINT "recurring_invoices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_invoices" ADD CONSTRAINT "recurring_invoices_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "activity_logs_entity_idx" ON "activity_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "activity_logs_unread_idx" ON "activity_logs" USING btree ("id") WHERE "activity_logs"."read_at" IS NULL;--> statement-breakpoint
CREATE INDEX "audit_logs_event_created_at_idx" ON "audit_logs" USING btree ("event","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_target_idx" ON "audit_logs" USING btree ("target_entity_type","target_entity_id");--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "two_factors_user_id_idx" ON "two_factors" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "two_factors_secret_idx" ON "two_factors" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "clients_name_idx" ON "clients" USING btree ("name");--> statement-breakpoint
CREATE INDEX "clients_email_idx" ON "clients" USING btree ("email");--> statement-breakpoint
CREATE INDEX "clients_active_idx" ON "clients" USING btree ("id") WHERE "clients"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "clients_portal_token_idx" ON "clients" USING btree ("portal_token") WHERE "clients"."portal_token" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "email_logs_document_idx" ON "email_logs" USING btree ("document_type","document_id");--> statement-breakpoint
CREATE INDEX "email_logs_status_idx" ON "email_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "email_logs_created_at_idx" ON "email_logs" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "invoices_project_id_idx" ON "invoices" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "invoices_client_id_idx" ON "invoices" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "invoices_proposal_id_idx" ON "invoices" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "invoices_recurring_invoice_id_idx" ON "invoices" USING btree ("recurring_invoice_id");--> statement-breakpoint
CREATE INDEX "invoices_template_id_idx" ON "invoices" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invoices_due_date_idx" ON "invoices" USING btree ("due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_public_token_idx" ON "invoices" USING btree ("public_token");--> statement-breakpoint
CREATE INDEX "line_items_proposal_id_idx" ON "line_items" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "line_items_invoice_id_idx" ON "line_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_line_items_credit_note_id" ON "line_items" USING btree ("credit_note_id");--> statement-breakpoint
CREATE INDEX "line_items_tax_rate_id_idx" ON "line_items" USING btree ("tax_rate_id");--> statement-breakpoint
CREATE INDEX "line_items_source_time_entry_id_idx" ON "line_items" USING btree ("source_time_entry_id");--> statement-breakpoint
CREATE INDEX "line_items_source_expense_id_idx" ON "line_items" USING btree ("source_expense_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_line_items_proposal_position" ON "line_items" USING btree ("proposal_id","position") WHERE "line_items"."proposal_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_line_items_invoice_position" ON "line_items" USING btree ("invoice_id","position") WHERE "line_items"."invoice_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_line_items_credit_note_position" ON "line_items" USING btree ("credit_note_id","position") WHERE "line_items"."credit_note_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "projects_client_id_idx" ON "projects" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "projects_active_idx" ON "projects" USING btree ("id") WHERE "projects"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "proposal_otps_proposal_id_idx" ON "proposal_otps" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "proposal_otps_active_idx" ON "proposal_otps" USING btree ("proposal_id") WHERE "proposal_otps"."used_at" IS NULL AND "proposal_otps"."invalidated_at" IS NULL;--> statement-breakpoint
CREATE INDEX "proposals_project_id_idx" ON "proposals" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "proposals_template_id_idx" ON "proposals" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "proposals_status_idx" ON "proposals" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "proposals_public_token_idx" ON "proposals" USING btree ("public_token");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tax_rates_default" ON "tax_rates" USING btree ("is_default") WHERE "tax_rates"."is_default" = true AND "tax_rates"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "templates_type_idx" ON "templates" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_templates_default_per_type" ON "templates" USING btree ("type") WHERE "templates"."is_default" = true AND "templates"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "invitation_organization_id_idx" ON "invitations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_status_idx" ON "invitations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "member_user_id_idx" ON "members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "member_organization_id_idx" ON "members" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "member_user_organization_idx" ON "members" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_member_owner_per_org" ON "members" USING btree ("organization_id") WHERE "members"."role" = 'owner';--> statement-breakpoint
CREATE UNIQUE INDEX "organization_slug_idx" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "leads_email_idx" ON "leads" USING btree ("email");--> statement-breakpoint
CREATE INDEX "leads_status_idx" ON "leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "leads_created_at_idx" ON "leads" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "tasks_project_id_idx" ON "tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "tasks_status_idx" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tasks_due_at_idx" ON "tasks" USING btree ("due_at") WHERE "tasks"."due_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "time_entries_project_id_idx" ON "time_entries" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "time_entries_task_id_idx" ON "time_entries" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "time_entries_user_id_idx" ON "time_entries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "time_entries_started_at_idx" ON "time_entries" USING btree ("started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "time_entries_unbilled_idx" ON "time_entries" USING btree ("project_id") WHERE "time_entries"."invoiced_in_id" IS NULL AND "time_entries"."billable" = true;--> statement-breakpoint
CREATE INDEX "expenses_project_id_idx" ON "expenses" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "expenses_client_id_idx" ON "expenses" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "expenses_spent_at_idx" ON "expenses" USING btree ("spent_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "expenses_unbilled_rebillable_idx" ON "expenses" USING btree ("project_id") WHERE "expenses"."invoiced_in_id" IS NULL AND "expenses"."rebillable" = true;--> statement-breakpoint
CREATE INDEX "contracts_project_id_idx" ON "contracts" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "contracts_client_id_idx" ON "contracts" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "contracts_proposal_id_idx" ON "contracts" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "contracts_status_idx" ON "contracts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "contracts_public_token_idx" ON "contracts" USING btree ("public_token");--> statement-breakpoint
CREATE INDEX "contract_signatures_contract_id_idx" ON "contract_signatures" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "recurring_invoices_client_id_idx" ON "recurring_invoices" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "recurring_invoices_status_idx" ON "recurring_invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "recurring_invoices_next_run_at_idx" ON "recurring_invoices" USING btree ("next_run_at") WHERE "recurring_invoices"."status" = 'active';--> statement-breakpoint
CREATE INDEX "payments_invoice_id_idx" ON "payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "payments_paid_at_idx" ON "payments" USING btree ("paid_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "payments_stripe_payment_intent_idx" ON "payments" USING btree ("stripe_payment_intent_id") WHERE "payments"."stripe_payment_intent_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "credit_notes_invoice_id_idx" ON "credit_notes" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_notes_number_idx" ON "credit_notes" USING btree ("number");