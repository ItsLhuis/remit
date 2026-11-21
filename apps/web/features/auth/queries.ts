import { database } from "@/database"

export async function hasRegisteredUser(): Promise<boolean> {
  const existingUser = await database.query.users.findFirst({ columns: { id: true } })

  return Boolean(existingUser)
}
