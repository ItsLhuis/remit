export type ErrorTrackingTarget = {
  envelopeUrl: string
  publicKey: string
}

const PUBLIC_KEY_PATTERN = /^[A-Za-z0-9]{1,64}$/
const PROJECT_ID_PATTERN = /^\d{1,20}$/

// A Sentry DSN, `https://<public key>@<host>[/<path>]/<project id>`, which self-hosted Sentry and
// GlitchTip both read the same way. A legacy DSN's `:<secret>` half is parsed past and never kept:
// the envelope endpoint authenticates with the public key alone, so the secret has no reason to
// leave the instance. `lib/config/envSchema.ts` refuses a value this returns null for, so an
// operator's malformed DSN fails at boot rather than switching error tracking off in silence.
export function parseErrorTrackingDsn(value: string): ErrorTrackingTarget | null {
  let url: URL

  try {
    url = new URL(value)
  } catch {
    return null
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null
  if (url.search || url.hash) return null
  if (!PUBLIC_KEY_PATTERN.test(url.username)) return null

  const segments = url.pathname.split("/").filter(Boolean)
  const projectId = segments.pop()

  if (!projectId || !PROJECT_ID_PATTERN.test(projectId)) return null

  const prefix = segments.map((segment) => `/${segment}`).join("")

  return {
    envelopeUrl: `${url.origin}${prefix}/api/${projectId}/envelope/`,
    publicKey: url.username
  }
}
