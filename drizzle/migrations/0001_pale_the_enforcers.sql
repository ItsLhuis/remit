CREATE OR REPLACE FUNCTION insert_only_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is insert-only: % operations are not permitted', TG_TABLE_NAME, TG_OP;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER audit_logs_no_update
BEFORE UPDATE ON "audit_logs"
FOR EACH ROW EXECUTE FUNCTION insert_only_guard();
--> statement-breakpoint
CREATE TRIGGER audit_logs_no_delete
BEFORE DELETE ON "audit_logs"
FOR EACH ROW EXECUTE FUNCTION insert_only_guard();
--> statement-breakpoint
CREATE TRIGGER audit_logs_no_truncate
BEFORE TRUNCATE ON "audit_logs"
FOR EACH STATEMENT EXECUTE FUNCTION insert_only_guard();
--> statement-breakpoint
CREATE TRIGGER contract_signatures_no_update
BEFORE UPDATE ON "contract_signatures"
FOR EACH ROW EXECUTE FUNCTION insert_only_guard();
--> statement-breakpoint
CREATE TRIGGER contract_signatures_no_delete
BEFORE DELETE ON "contract_signatures"
FOR EACH ROW EXECUTE FUNCTION insert_only_guard();
--> statement-breakpoint
CREATE TRIGGER contract_signatures_no_truncate
BEFORE TRUNCATE ON "contract_signatures"
FOR EACH STATEMENT EXECUTE FUNCTION insert_only_guard();