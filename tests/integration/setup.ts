import { afterAll, beforeEach } from "vitest"

import { sql } from "drizzle-orm"

import { client, database } from "./database"

beforeEach(async () => {
  await database.execute(sql`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_no_truncate;
      ALTER TABLE contract_signatures DISABLE TRIGGER contract_signatures_no_truncate;

      FOR r IN (
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename <> 'drizzle_migrations'
      ) LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';
      END LOOP;

      ALTER TABLE audit_logs ENABLE TRIGGER audit_logs_no_truncate;
      ALTER TABLE contract_signatures ENABLE TRIGGER contract_signatures_no_truncate;
    END $$
  `)
})

afterAll(async () => {
  await client.end()
})
