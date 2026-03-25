CREATE TYPE "public"."discount_type" AS ENUM('percentage', 'fixed');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('proposal', 'invoice');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."entity_type" AS ENUM('client', 'project', 'proposal', 'invoice');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'sent', 'paid', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('active', 'completed', 'on_hold', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."proposal_action" AS ENUM('accept', 'reject');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('draft', 'sent', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."template_type" AS ENUM('invoice', 'proposal', 'email_invoice', 'email_proposal');--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entity_type" "entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"description" text,
	"metadata" jsonb,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
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
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"document_type" "document_type" NOT NULL,
	"document_id" uuid NOT NULL,
	"template_id" uuid,
	"recipient_email" text NOT NULL,
	"recipient_name" text,
	"subject" text NOT NULL,
	"status" "email_status" DEFAULT 'pending' NOT NULL,
	"pdf_attached" boolean DEFAULT false NOT NULL,
	"sent_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"proposal_id" uuid,
	"template_id" uuid,
	"number" text NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"discount_type" "discount_type",
	"discount_value" numeric(10, 2),
	"subtotal" integer DEFAULT 0 NOT NULL,
	"discount_amount" integer DEFAULT 0 NOT NULL,
	"tax_amount" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"issue_date" date,
	"due_date" date,
	"paid_at" timestamp with time zone,
	"notes" text,
	"public_token" text NOT NULL,
	"first_viewed_at" timestamp with time zone,
	"last_viewed_at" timestamp with time zone,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_number_unique" UNIQUE("number"),
	CONSTRAINT "invoices_public_token_unique" UNIQUE("public_token"),
	CONSTRAINT "chk_invoices_discount" CHECK (("invoices"."discount_type" IS NULL AND "invoices"."discount_value" IS NULL) OR ("invoices"."discount_type" IS NOT NULL AND "invoices"."discount_value" IS NOT NULL)),
	CONSTRAINT "chk_invoices_discount_value" CHECK ("invoices"."discount_value" IS NULL OR "invoices"."discount_value" >= 0),
	CONSTRAINT "chk_invoices_totals" CHECK ("invoices"."subtotal" >= 0 AND "invoices"."discount_amount" >= 0 AND "invoices"."tax_amount" >= 0 AND "invoices"."total" >= 0),
	CONSTRAINT "chk_invoices_dates" CHECK ("invoices"."due_date" IS NULL OR "invoices"."issue_date" IS NULL OR "invoices"."due_date" >= "invoices"."issue_date"),
	CONSTRAINT "chk_invoices_view_count" CHECK ("invoices"."view_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid,
	"invoice_id" uuid,
	"tax_rate_id" uuid,
	"position" integer NOT NULL,
	"description" text NOT NULL,
	"unit" text,
	"quantity" numeric(10, 2) NOT NULL,
	"unit_price" integer NOT NULL,
	"discount_type" "discount_type",
	"discount_value" numeric(10, 2),
	"tax_percentage" numeric(5, 2) DEFAULT '0' NOT NULL,
	"subtotal" integer DEFAULT 0 NOT NULL,
	"tax_amount" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_line_items_parent" CHECK (("line_items"."proposal_id" IS NOT NULL AND "line_items"."invoice_id" IS NULL) OR ("line_items"."proposal_id" IS NULL AND "line_items"."invoice_id" IS NOT NULL)),
	CONSTRAINT "chk_line_items_discount" CHECK (("line_items"."discount_type" IS NULL AND "line_items"."discount_value" IS NULL) OR ("line_items"."discount_type" IS NOT NULL AND "line_items"."discount_value" IS NOT NULL)),
	CONSTRAINT "chk_line_items_discount_value" CHECK ("line_items"."discount_value" IS NULL OR "line_items"."discount_value" >= 0),
	CONSTRAINT "chk_line_items_quantity" CHECK ("line_items"."quantity" > 0),
	CONSTRAINT "chk_line_items_unit_price" CHECK ("line_items"."unit_price" >= 0),
	CONSTRAINT "chk_line_items_tax_percentage" CHECK ("line_items"."tax_percentage" >= 0 AND "line_items"."tax_percentage" <= 100),
	CONSTRAINT "chk_line_items_totals" CHECK ("line_items"."subtotal" >= 0 AND "line_items"."tax_amount" >= 0 AND "line_items"."total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "project_status" DEFAULT 'active' NOT NULL,
	"budget" integer,
	"start_date" date,
	"end_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_projects_budget" CHECK ("projects"."budget" IS NULL OR "projects"."budget" >= 0),
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
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"template_id" uuid,
	"number" text NOT NULL,
	"status" "proposal_status" DEFAULT 'draft' NOT NULL,
	"currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"discount_type" "discount_type",
	"discount_value" numeric(10, 2),
	"subtotal" integer DEFAULT 0 NOT NULL,
	"discount_amount" integer DEFAULT 0 NOT NULL,
	"tax_amount" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposals_number_unique" UNIQUE("number"),
	CONSTRAINT "proposals_public_token_unique" UNIQUE("public_token"),
	CONSTRAINT "chk_proposals_discount" CHECK (("proposals"."discount_type" IS NULL AND "proposals"."discount_value" IS NULL) OR ("proposals"."discount_type" IS NOT NULL AND "proposals"."discount_value" IS NOT NULL)),
	CONSTRAINT "chk_proposals_discount_value" CHECK ("proposals"."discount_value" IS NULL OR "proposals"."discount_value" >= 0),
	CONSTRAINT "chk_proposals_totals" CHECK ("proposals"."subtotal" >= 0 AND "proposals"."discount_amount" >= 0 AND "proposals"."tax_amount" >= 0 AND "proposals"."total" >= 0),
	CONSTRAINT "chk_proposals_view_count" CHECK ("proposals"."view_count" >= 0),
	CONSTRAINT "chk_proposals_response" CHECK (("proposals"."status" NOT IN ('accepted', 'rejected')) OR ("proposals"."responded_at" IS NOT NULL AND "proposals"."responded_ip" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"business_name" text,
	"business_email" text,
	"business_phone" text,
	"business_website" text,
	"business_tax_id" text,
	"business_logo_url" text,
	"business_address_line1" text,
	"business_address_line2" text,
	"business_city" text,
	"business_state" text,
	"business_postal_code" text,
	"business_country" text,
	"default_currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"payment_terms_days" integer DEFAULT 30 NOT NULL,
	"proposal_validity_days" integer DEFAULT 30 NOT NULL,
	"default_notes_invoice" text,
	"default_notes_proposal" text,
	"payment_iban" text,
	"payment_bank_name" text,
	"payment_instructions" text,
	"email_provider" text,
	"smtp_host" text,
	"smtp_port" integer,
	"smtp_user" text,
	"smtp_pass" text,
	"smtp_secure" boolean DEFAULT true NOT NULL,
	"resend_api_key" text,
	"email_from_name" text,
	"email_from_address" text,
	"base_url" text,
	"next_invoice_number" integer DEFAULT 1 NOT NULL,
	"next_proposal_number" integer DEFAULT 1 NOT NULL,
	"invoice_prefix" text DEFAULT 'INV-' NOT NULL,
	"proposal_prefix" text DEFAULT 'PROP-' NOT NULL,
	"number_padding_width" integer DEFAULT 4 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "chk_settings_email_provider" CHECK ("settings"."email_provider" IS NULL OR "settings"."email_provider" IN ('smtp', 'resend')),
	CONSTRAINT "chk_settings_payment_terms_days" CHECK ("settings"."payment_terms_days" >= 0),
	CONSTRAINT "chk_settings_proposal_validity_days" CHECK ("settings"."proposal_validity_days" >= 0),
	CONSTRAINT "chk_settings_next_invoice_number" CHECK ("settings"."next_invoice_number" >= 1),
	CONSTRAINT "chk_settings_next_proposal_number" CHECK ("settings"."next_proposal_number" >= 1),
	CONSTRAINT "chk_settings_number_padding_width" CHECK ("settings"."number_padding_width" >= 1 AND "settings"."number_padding_width" <= 10)
);
--> statement-breakpoint
CREATE TABLE "tax_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"percentage" numeric(5, 2) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_tax_rates_percentage" CHECK ("tax_rates"."percentage" >= 0 AND "tax_rates"."percentage" <= 100)
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "template_type" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"subject" text,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"path" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uploads_path_unique" UNIQUE("path"),
	CONSTRAINT "chk_uploads_size_bytes" CHECK ("uploads"."size_bytes" > 0)
);
--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_tax_rate_id_tax_rates_id_fk" FOREIGN KEY ("tax_rate_id") REFERENCES "public"."tax_rates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_otps" ADD CONSTRAINT "proposal_otps_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_activity_log_user_created" ON "activity_log" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_activity_log_entity" ON "activity_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_activity_log_unread" ON "activity_log" USING btree ("user_id") WHERE "activity_log"."read_at" IS NULL;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "idx_clients_user_id" ON "clients" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_clients_name" ON "clients" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_email_logs_user_id" ON "email_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_email_logs_document" ON "email_logs" USING btree ("document_type","document_id");--> statement-breakpoint
CREATE INDEX "idx_email_logs_status" ON "email_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_invoices_user_id" ON "invoices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_project_id" ON "invoices" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_proposal_id" ON "invoices" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_template_id" ON "invoices" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_status" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_invoices_due_date" ON "invoices" USING btree ("due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_invoices_public_token" ON "invoices" USING btree ("public_token");--> statement-breakpoint
CREATE INDEX "idx_line_items_proposal_id" ON "line_items" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "idx_line_items_invoice_id" ON "line_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_line_items_tax_rate_id" ON "line_items" USING btree ("tax_rate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_line_items_proposal_position" ON "line_items" USING btree ("proposal_id","position") WHERE "line_items"."proposal_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_line_items_invoice_position" ON "line_items" USING btree ("invoice_id","position") WHERE "line_items"."invoice_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_projects_user_id" ON "projects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_projects_client_id" ON "projects" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_projects_status" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_proposal_otps_proposal_id" ON "proposal_otps" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "idx_proposal_otps_active" ON "proposal_otps" USING btree ("proposal_id") WHERE "proposal_otps"."used_at" IS NULL AND "proposal_otps"."invalidated_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_proposals_user_id" ON "proposals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_proposals_project_id" ON "proposals" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_proposals_template_id" ON "proposals" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "idx_proposals_status" ON "proposals" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_proposals_public_token" ON "proposals" USING btree ("public_token");--> statement-breakpoint
CREATE INDEX "idx_tax_rates_user_id" ON "tax_rates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_templates_user_id" ON "templates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_templates_type" ON "templates" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_templates_type_default" ON "templates" USING btree ("user_id","type") WHERE "templates"."is_default" = true;--> statement-breakpoint
CREATE INDEX "idx_uploads_user_id" ON "uploads" USING btree ("user_id");