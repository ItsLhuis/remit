-- Narrows the insert-only guard on `contract_signatures` from "no UPDATE ever" to "one UPDATE, and
-- only to fill in the signed PDF".
--
-- Migration 0001 put a blanket BEFORE UPDATE trigger on this table, which made
-- `signed_pdf_upload_id` unwritable: the row is inserted the moment a counterparty signs, and the
-- PDF that records what they signed is rendered afterwards by a background job (ADR-0022/ADR-0023).
-- The column has therefore been NULL on every signature ever stored.
--
-- The replacement stays a guard, not a relaxation. It permits exactly one transition — a NULL
-- `signed_pdf_upload_id` becoming non-NULL — and rejects everything else, including a second write
-- to that column and any change to a legally meaningful field. A signature remains the immutable
-- record of what a counterparty agreed to; only the pointer to its rendered copy may be filled in,
-- once.
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
DROP TRIGGER IF EXISTS contract_signatures_no_update ON "contract_signatures";
--> statement-breakpoint
CREATE TRIGGER contract_signatures_set_signed_pdf
BEFORE UPDATE ON "contract_signatures"
FOR EACH ROW EXECUTE FUNCTION contract_signatures_update_guard();
