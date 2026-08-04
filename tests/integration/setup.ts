import { sql } from "drizzle-orm"

import { afterAll, beforeEach } from "vitest"

import { client, database } from "./database"

// The two `DISABLE TRIGGER` statements below are the only sanctioned place in the repository where
// the insert-only guards are switched off. Migration 0001 puts BEFORE UPDATE / DELETE / TRUNCATE
// triggers on `audit_logs` and `contract_signatures` that raise instead of applying the statement,
// so a per-test truncation aborts without them. A third insert-only table added to the schema has
// to be named here too, or every integration test starts failing on this reset rather than on
// anything it asserts.
beforeEach(async () => {
  await database.execute(sql`
    DO $$ DECLARE
      table_names TEXT;
    BEGIN
      SELECT string_agg(format('%I.%I', schemaname, tablename), ', ' ORDER BY tablename)
      INTO table_names
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename <> 'drizzle_migrations';

      IF table_names IS NULL THEN
        RETURN;
      END IF;

      ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_no_truncate;
      ALTER TABLE contract_signatures DISABLE TRIGGER contract_signatures_no_truncate;

      EXECUTE 'TRUNCATE TABLE ' || table_names || ' RESTART IDENTITY CASCADE';

      ALTER TABLE audit_logs ENABLE TRIGGER audit_logs_no_truncate;
      ALTER TABLE contract_signatures ENABLE TRIGGER contract_signatures_no_truncate;
    END $$
  `)
})

afterAll(async () => {
  await client.end()
})
