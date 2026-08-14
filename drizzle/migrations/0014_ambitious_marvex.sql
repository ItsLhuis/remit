CREATE TYPE "public"."storage_bucket" AS ENUM('public', 'documents');--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "pdf_upload_id" uuid;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "pdf_upload_id" uuid;--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "bucket" "storage_bucket" DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "pdf_upload_id" uuid;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "pdf_upload_id" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_pdf_upload_id_uploads_id_fk" FOREIGN KEY ("pdf_upload_id") REFERENCES "public"."uploads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_pdf_upload_id_uploads_id_fk" FOREIGN KEY ("pdf_upload_id") REFERENCES "public"."uploads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_pdf_upload_id_uploads_id_fk" FOREIGN KEY ("pdf_upload_id") REFERENCES "public"."uploads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_pdf_upload_id_uploads_id_fk" FOREIGN KEY ("pdf_upload_id") REFERENCES "public"."uploads"("id") ON DELETE set null ON UPDATE no action;