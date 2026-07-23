import { getTableName, type Table } from "drizzle-orm"
import { customType, timestamp } from "drizzle-orm/pg-core"

import { env } from "@/lib/config/env"
import { decryptString, encryptString } from "@/lib/encryption/aes"

const encryptionKey = Buffer.from(env.REMIT_ENCRYPTION_KEY, "base64")

export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date())
}

export const softDelete = {
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" })
}

export type EncryptedColumn = {
  table: string
  column: string
}

const encryptedColumnRegistry = new Map<string, EncryptedColumn>()

// Wrapping `build` is the only hook Drizzle offers that runs once the column knows which table it
// belongs to, which is what makes the registry below complete and self-maintaining: declaring a
// column with this helper is all it takes for the key-rotation script to find it. That is a real
// contract, not an optimisation — `scripts/core/keyRotation/runRotation.ts` re-encrypts exactly
// what `getEncryptedColumns` returns, so a column encrypted by any other means is silently left
// on the old key during a rotation.
export function encryptedColumn(name: string) {
  const builder = customType<{ data: string; driverData: string }>({
    dataType() {
      return "text"
    },
    toDriver(value) {
      return encryptString(value, encryptionKey)
    },
    fromDriver(value) {
      try {
        return decryptString(value, encryptionKey)
      } catch {
        // The underlying error is dropped rather than chained: it carries ciphertext and cipher
        // details that must not reach a log or a response.
        throw new Error(`Failed to decrypt encrypted column "${name}".`)
      }
    }
  })(name)

  type Buildable = { build: (table: Table) => { name: string } }

  const buildable = builder as unknown as Buildable
  const originalBuild = buildable.build.bind(buildable)

  buildable.build = (table) => {
    const column = originalBuild(table)
    const tableName = getTableName(table)

    encryptedColumnRegistry.set(`${tableName}.${column.name}`, {
      table: tableName,
      column: column.name
    })

    return column
  }

  return builder
}

export function getEncryptedColumns(): ReadonlyArray<EncryptedColumn> {
  return Array.from(encryptedColumnRegistry.values()).sort((left, right) =>
    left.table === right.table
      ? left.column.localeCompare(right.column)
      : left.table.localeCompare(right.table)
  )
}
