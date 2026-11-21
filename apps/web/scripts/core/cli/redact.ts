const REDACTORS: ReadonlyArray<{ pattern: RegExp; replacement: string }> = [
  { pattern: /postgres(?:ql)?:\/\/[^@\s]+@/gi, replacement: "postgresql://[redacted]@" },
  {
    pattern: /(REMIT_(?:OLD_KEY|NEW_KEY|ENCRYPTION_KEY)=)[^\s]+/g,
    replacement: "$1[redacted]"
  },
  {
    pattern: /(iv|tag|authTag|key|fingerprint)=?[A-Fa-f0-9+/=]{16,}/g,
    replacement: "$1=[redacted]"
  },
  {
    pattern: /\b(accessKey|secretKey|access_key|secret_key)\b\s*[=:]\s*[^\s&]+/gi,
    replacement: "[redacted credential]"
  },
  {
    pattern: /X-Amz-(Credential|Signature|Security-Token)=[^&\s]+/g,
    replacement: "X-Amz-$1=[redacted]"
  },
  {
    pattern: /\b(?:AKIA|ASIA|AROA|AIDA|AGPA|AIPA|ANPA|ANVA|ASCA)[A-Z0-9]{16}\b/g,
    replacement: "[redacted credential]"
  }
]

export type RedactionHint = (message: string) => string | null

export type RedactOptions = {
  hint?: RedactionHint
  stripStackFrames?: boolean
  maxLength?: number
}

export function redactOperationalError(error: unknown, options: RedactOptions = {}): string {
  const message = error instanceof Error ? error.message : String(error)
  const hinted = options.hint?.(message)

  if (hinted) return hinted

  let result = message

  for (const { pattern, replacement } of REDACTORS) {
    result = result.replace(pattern, replacement)
  }

  if (options.stripStackFrames) {
    result = result.replace(/\s+at\s+.+/g, "")
  }

  return result
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, options.maxLength ?? 500)
}
