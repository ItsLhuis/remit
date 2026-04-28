import { customType, timestamp } from "drizzle-orm/pg-core"

import { env } from "@/lib/env"

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

export function encryptedColumn(name: string) {
  return customType<{ data: string; driverData: string }>({
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
}
