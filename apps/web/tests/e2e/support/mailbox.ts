import { z } from "zod"

// Mailpit is the development mail sink from `docker-compose.dev.yml`, and reading it is the only
// way a spec can learn a proposal OTP or a reset link without weakening the application:
// `proposal_otps.code_hash` is a bcrypt hash, `email_logs` records the subject and never the body,
// and Better Auth's reset token is stored hashed too. The catcher observes what the client would
// have received, from outside the app, so nothing about the real path changes to make it visible.
const MAILPIT_URL = process.env.PLAYWRIGHT_MAILPIT_URL ?? "http://localhost:8025"

const POLL_INTERVAL_MS = 250
const POLL_TIMEOUT_MS = 20_000

const searchResponseSchema = z.object({
  messages: z.array(z.object({ ID: z.string() }))
})

const messageSchema = z.object({
  ID: z.string(),
  Subject: z.string(),
  Text: z.string()
})

export type Mail = z.infer<typeof messageSchema>

export async function clearMailbox(): Promise<void> {
  const response = await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: "DELETE" })

  if (!response.ok) throw new Error(`Mailpit refused to clear the mailbox: ${response.status}`)
}

// Newest first is Mailpit's own ordering, so the first hit is the most recent message to that
// address. Callers clear the mailbox before the step that sends, which is what makes "latest" mean
// "the one this step produced" rather than "whichever arrived last".
export async function waitForLatestMailTo(address: string): Promise<Mail> {
  const query = encodeURIComponent(`to:${address}`)
  const deadline = Date.now() + POLL_TIMEOUT_MS

  for (;;) {
    const found = await findLatestMailId(query)

    if (found) return await readMail(found)

    if (Date.now() > deadline) throw new Error(`No mail arrived for ${address} within the timeout`)

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
}

async function findLatestMailId(query: string): Promise<string | null> {
  const response = await fetch(`${MAILPIT_URL}/api/v1/search?query=${query}&limit=1`)

  if (!response.ok) throw new Error(`Mailpit search failed: ${response.status}`)

  const parsed = searchResponseSchema.safeParse(await response.json())

  if (!parsed.success) throw new Error("Mailpit returned an unexpected search payload")

  return parsed.data.messages[0]?.ID ?? null
}

async function readMail(id: string): Promise<Mail> {
  const response = await fetch(`${MAILPIT_URL}/api/v1/message/${id}`)

  if (!response.ok) throw new Error(`Mailpit message read failed: ${response.status}`)

  const parsed = messageSchema.safeParse(await response.json())

  if (!parsed.success) throw new Error("Mailpit returned an unexpected message payload")

  return parsed.data
}
