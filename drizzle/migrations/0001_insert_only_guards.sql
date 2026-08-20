-- Two tables in this schema are records of something that happened rather than rows an application
-- owns: `audit_logs` and `contract_signatures`. Neither may be rewritten after the fact, and the
-- guarantee is enforced here rather than by every write path remembering.
--
-- Written by hand because Drizzle has no way to declare a trigger.
--
-- `audit_logs` is absolute: no UPDATE, no DELETE, no TRUNCATE, ever, by anyone. An audit trail a
-- maintenance command can erase is not an audit trail (ADR-0025).
--
-- `contract_signatures` is insert-only with exactly one sanctioned exception. The row is written the
-- moment a counterparty signs; the PDF recording what they signed is rendered afterwards by a
-- background job (ADR-0022/ADR-0023), so `signed_pdf_upload_id` has to become writable once and
-- never again. `contract_signatures_update_guard` permits that single NULL → non-NULL transition
-- and rejects everything else, including a second write to that column and any change to a legally
-- meaningful field. `features/contracts/pdfRenderJob.ts` is the only writer.
--
-- DELETE and TRUNCATE on `contract_signatures` stay blocked, which is why
-- `scripts/core/domainData/deleteDomainRows.ts` lifts the table's triggers inside its transaction
-- before an operator-instructed reset, and never lifts the ones on `audit_logs`.
CREATE OR REPLACE FUNCTION insert_only_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is insert-only: % operations are not permitted', TG_TABLE_NAME, TG_OP;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION contract_signatures_update_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.signed_pdf_upload_id IS NOT NULL THEN
    RAISE EXCEPTION 'contract_signatures.signed_pdf_upload_id is write-once and is already set';
  END IF;

  IF NEW.signed_pdf_upload_id IS NULL THEN
    RAISE EXCEPTION 'contract_signatures is insert-only: % operations are not permitted', TG_OP;
  END IF;

  -- Every other column compared as a whole row, so a column added to this table in future is
  -- protected by default rather than by somebody remembering to extend this list.
  IF (
    NEW.id, NEW.contract_id, NEW.signer_name, NEW.signer_email, NEW.consent_text,
    NEW.ip_address, NEW.user_agent, NEW.signed_at, NEW.created_at
  ) IS DISTINCT FROM (
    OLD.id, OLD.contract_id, OLD.signer_name, OLD.signer_email, OLD.consent_text,
    OLD.ip_address, OLD.user_agent, OLD.signed_at, OLD.created_at
  ) THEN
    RAISE EXCEPTION 'contract_signatures is insert-only: only signed_pdf_upload_id may be set';
  END IF;

  RETURN NEW;
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
CREATE TRIGGER contract_signatures_no_delete
BEFORE DELETE ON "contract_signatures"
FOR EACH ROW EXECUTE FUNCTION insert_only_guard();
--> statement-breakpoint
CREATE TRIGGER contract_signatures_no_truncate
BEFORE TRUNCATE ON "contract_signatures"
FOR EACH STATEMENT EXECUTE FUNCTION insert_only_guard();
--> statement-breakpoint
CREATE TRIGGER contract_signatures_set_signed_pdf
BEFORE UPDATE ON "contract_signatures"
FOR EACH ROW EXECUTE FUNCTION contract_signatures_update_guard();
