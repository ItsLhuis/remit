ALTER TABLE "sessions" DROP CONSTRAINT "sessions_active_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "proposals" DROP CONSTRAINT "proposals_converted_to_invoice_id_invoices_id_fk";
--> statement-breakpoint
ALTER TABLE "proposals" DROP CONSTRAINT "proposals_converted_to_contract_id_contracts_id_fk";
--> statement-breakpoint
ALTER TABLE "proposals" DROP COLUMN "converted_to_invoice_id";--> statement-breakpoint
ALTER TABLE "proposals" DROP COLUMN "converted_to_contract_id";