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
