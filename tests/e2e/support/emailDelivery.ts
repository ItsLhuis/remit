import { eq } from "drizzle-orm"

import { loadAppContext } from "./appContext"

// The host and port as the *application* resolves them, not as Playwright does: the app writes and
// reads these from its own settings row, so on a host `next dev` that is localhost and in the CI
// compose network it is the `mailpit` service name. Playwright reads the mailbox over HTTP through
// `mailbox.ts`, which has its own base URL for the same reason.
const SMTP_HOST = process.env.PLAYWRIGHT_SMTP_HOST ?? "localhost"
const SMTP_PORT = Number(process.env.PLAYWRIGHT_SMTP_PORT ?? 1025)

const FROM_ADDRESS = "no-reply@remit.test"

// Configures SMTP delivery against the mail sink, and reports whether it did. An instance that
// already has a provider configured is left untouched and answers `false`: the only safe way to put
// its settings back afterwards would be to snapshot a real SMTP password to disk, and no test is
// worth writing a credential to a file. The callers turn that `false` into a skip with a reason.
export async function configureMailpitDelivery(): Promise<boolean> {
  const { database, schema } = await loadAppContext()

  const settingsRow = await database.query.settings.findFirst({
    columns: { id: true, emailProvider: true }
  })

  if (!settingsRow) throw new Error("No settings row: complete instance setup before running e2e")

  if (settingsRow.emailProvider !== null) return false

  await database
    .update(schema.settings)
    .set({
      emailProvider: "smtp",
      smtpHost: SMTP_HOST,
      smtpPort: SMTP_PORT,
      smtpUser: "remit",
      smtpPass: "remit",
      // The sink speaks plaintext SMTP on 1025 and advertises no STARTTLS, so a secure transport
      // would fail the handshake before a message is ever accepted.
      smtpSecure: false,
      emailFromName: "Remit E2E",
      emailFromAddress: FROM_ADDRESS
    })
    .where(eq(schema.settings.id, settingsRow.id))

  return true
}

// Only ever called after `configureMailpitDelivery` answered `true`, so clearing the columns
// restores exactly what was there. Leaving them set would silently retire `auth.spec.ts`'s
// unconfigured-instance assertion, which skips itself the moment a provider exists.
export async function clearMailpitDelivery(): Promise<void> {
  const { database, schema } = await loadAppContext()

  const settingsRow = await database.query.settings.findFirst({ columns: { id: true } })

  if (!settingsRow) return

  await database
    .update(schema.settings)
    .set({
      emailProvider: null,
      smtpHost: null,
      smtpPort: null,
      smtpUser: null,
      smtpPass: null,
      smtpSecure: true,
      emailFromName: null,
      emailFromAddress: null
    })
    .where(eq(schema.settings.id, settingsRow.id))
}
