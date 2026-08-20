-- Makes "when a row names both a project and a client, the client is that project's client" a rule
-- the database keeps, for the five tables that carry both columns. See
-- [ADR-0026](../../docs/architecture/adr/0026-document-parentage.md).
--
-- Written by hand because `ON DELETE SET NULL (project_id)` (Postgres 15+) and `ON UPDATE RESTRICT`
-- are not expressible through Drizzle's `foreignKey().onDelete()`. The other half of the rule is:
-- `uq_projects_id_client_id` (the referenced pair Postgres requires) and one
-- `chk_<table>_project_requires_client` per table, both declared in `database/schema/` and created
-- by migration 0000. That check is what closes the MATCH SIMPLE hole beneath these keys: a composite
-- foreign key with any null column is not checked at all, so without it a row could name a project,
-- leave the client null, and skip the agreement rule entirely.
--
-- These tables carry no single-column `project_id` foreign key alongside these, deliberately: with
-- both present, deleting a project is rejected outright instead of nulling `project_id`.
ALTER TABLE "proposals" ADD CONSTRAINT "fk_proposals_project_client" FOREIGN KEY ("project_id","client_id") REFERENCES "public"."projects"("id","client_id") ON DELETE SET NULL ("project_id") ON UPDATE RESTRICT;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "fk_invoices_project_client" FOREIGN KEY ("project_id","client_id") REFERENCES "public"."projects"("id","client_id") ON DELETE SET NULL ("project_id") ON UPDATE RESTRICT;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "fk_expenses_project_client" FOREIGN KEY ("project_id","client_id") REFERENCES "public"."projects"("id","client_id") ON DELETE SET NULL ("project_id") ON UPDATE RESTRICT;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "fk_contracts_project_client" FOREIGN KEY ("project_id","client_id") REFERENCES "public"."projects"("id","client_id") ON DELETE SET NULL ("project_id") ON UPDATE RESTRICT;--> statement-breakpoint
ALTER TABLE "recurring_invoices" ADD CONSTRAINT "fk_recurring_invoices_project_client" FOREIGN KEY ("project_id","client_id") REFERENCES "public"."projects"("id","client_id") ON DELETE SET NULL ("project_id") ON UPDATE RESTRICT;
