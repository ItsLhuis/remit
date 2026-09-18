import { describe, expect, test } from "vitest"

import {
  buildErrorEvent,
  WITHHELD_MESSAGE,
  type ErrorEventFacts,
  type ErrorReportContext
} from "../errorEvent"

const CWD = "/app"

const FACTS: ErrorEventFacts = {
  eventId: "0123456789abcdef0123456789abcdef",
  timestamp: 1_758_000_000,
  release: "1.0.0",
  environment: "production",
  runtime: "server",
  cwd: CWD
}

const REQUEST_CONTEXT: ErrorReportContext = {
  source: "request",
  routePath: "/invoices/[invoiceId]",
  routeType: "render",
  renderSource: "react-server-components"
}

// Hardcoded rather than generated: this list is the guard. Every value is something
// ARCHITECTURE.md section 9 or `.agents/rules/security.md` says must never leave the instance, and
// the tests below place each one everywhere an error can carry it.
const BANNED_VALUES = {
  smtpPassword: "smtp-password-8f2kd93",
  resendApiKey: "re_live_4bT9sQx2mZ7pLk",
  stripeSecretKey: "sk_live_51HxQ2eJfK9sLm3N",
  stripeWebhookSecret: "whsec_7GdK2pLq9sXz4Tn",
  paymentIban: "PT50000201231234567890154",
  backupS3AccessKey: "AKIAIOSFODNN7EXAMPLE",
  backupS3SecretKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  webhookSigningSecret: "whsec_c2lnbmluZy1zZWNyZXQtdmFsdWU=",
  clientNote: "Confidential under NDA: Acme merger closes on the 14th",
  encryptionKey: "q3v8Jb0Zp1kR4nT6yW2xL9cF5hM7sD0gA1eU3iO8nPc=",
  betterAuthSecret: "better-auth-secret-7yHn3Kd",
  databaseUrl: "postgresql://remit:db-password-3kD9@database:5432/remit",
  redisUrl: "redis://:redis-password-8sK2@redis:6379",
  minioRootPassword: "minio-root-password-5Lp0",
  publicToken: "Yk3mQ9vT2xL7pR4sN8wZ1cF6hB0jD5gU3eA9iO2nKqM",
  apiToken: "remit_pat_9fK2mQ7vX3pL8sT4nR6w",
  sessionCookie: "better-auth.session_token=ses_4Kd9mQ2xT7pL",
  otpCode: "482913",
  totpSecret: "JBSWY3DPEHPK3PXPJBSWY3DP",
  backupCode: "k9d2m-x7q4p",
  emailAddress: "jane.client@example.com",
  clientName: "Acme Holdings Lda",
  requestBody: '{"lineItems":[{"description":"Brand strategy","unitPriceCents":450000}]}',
  queryString: "?search=acme&token=Yk3mQ9vT2x"
}

function serialized(event: unknown): string {
  return JSON.stringify(event)
}

function expectNoBannedValue(event: unknown): void {
  const text = serialized(event)

  for (const [name, value] of Object.entries(BANNED_VALUES)) {
    expect(text.includes(value), `${name} leaked into the event`).toBe(false)
  }
}

function withEveryBannedValue(message: string): string {
  return `${message}: ${Object.values(BANNED_VALUES).join(" | ")}`
}

describe("the event built from a request error", () => {
  test("carries the error type, the withheld notice, frames and the route tags", () => {
    const error = new TypeError("Cannot read properties of undefined")

    const event = buildErrorEvent({ error, context: REQUEST_CONTEXT }, FACTS)

    expect(event).toMatchObject({
      event_id: FACTS.eventId,
      platform: "node",
      level: "error",
      release: "remit@1.0.0",
      environment: "production",
      transaction: "/invoices/[invoiceId]",
      tags: {
        errorEventId: FACTS.eventId,
        runtime: "server",
        source: "request",
        "route.path": "/invoices/[invoiceId]",
        "route.type": "render",
        "route.render_source": "react-server-components"
      }
    })
    expect(event?.exception.values).toHaveLength(1)
    expect(event?.exception.values[0]).toMatchObject({
      type: "TypeError",
      value: WITHHELD_MESSAGE,
      mechanism: { type: "remit.request", handled: false }
    })
    expect(event?.exception.values[0].stacktrace?.frames.length).toBeGreaterThan(0)
  })

  test("keeps a numeric Next.js digest and drops any other shape", () => {
    const hashed = Object.assign(new Error("boom"), { digest: "2138471093@E394" })
    const redirect = Object.assign(new Error("boom"), {
      digest: `NEXT_REDIRECT;replace;/i/${BANNED_VALUES.publicToken};307;`
    })

    const hashedEvent = buildErrorEvent({ error: hashed, context: REQUEST_CONTEXT }, FACTS)
    const redirectEvent = buildErrorEvent({ error: redirect, context: REQUEST_CONTEXT }, FACTS)

    expect(hashedEvent?.tags.digest).toBe("2138471093@E394")
    expect(redirectEvent).not.toBeNull()
    expect(redirectEvent?.tags.digest).toBeUndefined()
    expectNoBannedValue(redirectEvent)
  })
})

describe("what never leaves the instance", () => {
  test("a banned value in the message is withheld", () => {
    const error = new Error(withEveryBannedValue("Failed query"))

    const event = buildErrorEvent({ error, context: REQUEST_CONTEXT }, FACTS)

    expect(event).not.toBeNull()
    expectNoBannedValue(event)
  })

  test("a banned value anywhere in a cause chain is withheld", () => {
    const root = new Error(withEveryBannedValue("connection refused"))
    const middle = new Error("query failed", { cause: root })
    const outer = new Error(withEveryBannedValue("invoice mutation failed"), { cause: middle })

    const event = buildErrorEvent({ error: outer, context: REQUEST_CONTEXT }, FACTS)

    expect(event?.exception.values.map((value) => value.type)).toEqual(["Error", "Error", "Error"])
    expectNoBannedValue(event)
  })

  test("a banned value on an extra property, in an array or in a nested object is withheld", () => {
    const error = Object.assign(new Error("Failed query"), {
      query: `select * from clients where email = '${BANNED_VALUES.emailAddress}'`,
      params: Object.values(BANNED_VALUES),
      detail: { client: { name: BANNED_VALUES.clientName, notes: BANNED_VALUES.clientNote } },
      request: { body: BANNED_VALUES.requestBody, headers: { cookie: BANNED_VALUES.sessionCookie } }
    })

    const event = buildErrorEvent({ error, context: REQUEST_CONTEXT }, FACTS)

    expect(event).not.toBeNull()
    expectNoBannedValue(event)
  })

  test("a serialized environment concatenated into a message is withheld", () => {
    const environment = {
      DATABASE_URL: BANNED_VALUES.databaseUrl,
      REDIS_URL: BANNED_VALUES.redisUrl,
      BETTER_AUTH_SECRET: BANNED_VALUES.betterAuthSecret,
      REMIT_ENCRYPTION_KEY: BANNED_VALUES.encryptionKey,
      MINIO_ROOT_PASSWORD: BANNED_VALUES.minioRootPassword
    }
    const error = new Error(`Startup failed with ${JSON.stringify(environment)}`)

    const event = buildErrorEvent({ error, context: REQUEST_CONTEXT }, FACTS)

    expectNoBannedValue(event)
  })

  test("a thrown value that is not an Error is reported as its kind alone", () => {
    const event = buildErrorEvent(
      { error: withEveryBannedValue("thrown string"), context: REQUEST_CONTEXT },
      FACTS
    )

    expect(event?.exception.values).toEqual([
      {
        type: "NonError",
        value: WITHHELD_MESSAGE,
        mechanism: { type: "remit.request", handled: false }
      }
    ])
    expectNoBannedValue(event)
  })

  test("frames written into a message are not read as frames", () => {
    const error = new Error(
      `Failed query\nparams: ${BANNED_VALUES.emailAddress}\n    at ${BANNED_VALUES.totpSecret} (/app/lib/run.js:1:1)`
    )

    const event = buildErrorEvent({ error, context: REQUEST_CONTEXT }, FACTS)

    expectNoBannedValue(event)
  })

  test("a message changed after the stack was rendered leaves no frames rather than guessing", () => {
    const error = new Error(`Failed query\n    at ${BANNED_VALUES.totpSecret} (evil.js:1:1)`)

    void error.stack
    error.message = "rewritten"

    const event = buildErrorEvent({ error, context: REQUEST_CONTEXT }, FACTS)

    expect(event?.exception.values[0].stacktrace).toBeUndefined()
    expectNoBannedValue(event)
  })

  test("an error name that is not an identifier becomes Error", () => {
    const error = new Error("boom")

    error.name = `Failed for ${BANNED_VALUES.emailAddress}`

    const event = buildErrorEvent({ error, context: REQUEST_CONTEXT }, FACTS)

    expect(event?.exception.values[0].type).toBe("Error")
    expectNoBannedValue(event)
  })

  test("getters that throw on the error do not break the build", () => {
    const error = new Error("boom")

    Object.defineProperty(error, "code", {
      get() {
        throw new Error(BANNED_VALUES.stripeSecretKey)
      }
    })
    Object.defineProperty(error, "cause", {
      get() {
        throw new Error(BANNED_VALUES.stripeSecretKey)
      }
    })

    const event = buildErrorEvent({ error, context: REQUEST_CONTEXT }, FACTS)

    expect(event?.exception.values).toHaveLength(1)
    expectNoBannedValue(event)
  })
})

describe("the error code", () => {
  test("keeps SQLSTATE and system error codes from anywhere in the chain", () => {
    const postgres = Object.assign(new Error("duplicate key"), { code: "23505" })
    const wrapped = new Error("Failed query", { cause: postgres })
    const refused = Object.assign(new Error("connect failed"), { code: "ECONNREFUSED" })

    const wrappedEvent = buildErrorEvent({ error: wrapped, context: REQUEST_CONTEXT }, FACTS)
    const refusedEvent = buildErrorEvent({ error: refused, context: REQUEST_CONTEXT }, FACTS)

    expect(wrappedEvent?.tags["error.code"]).toBe("23505")
    expect(refusedEvent?.tags["error.code"]).toBe("ECONNREFUSED")
  })

  test("drops a code that could be a secret rather than a class of failure", () => {
    const error = Object.assign(new Error("totp"), { code: BANNED_VALUES.totpSecret })

    const event = buildErrorEvent({ error, context: REQUEST_CONTEXT }, FACTS)

    expect(event?.tags["error.code"]).toBeUndefined()
    expectNoBannedValue(event)
  })
})

describe("the cause chain", () => {
  test("stops at a cycle", () => {
    const first = new Error("first")
    const second = new Error("second", { cause: first })

    Object.defineProperty(first, "cause", { value: second })

    const event = buildErrorEvent({ error: second, context: REQUEST_CONTEXT }, FACTS)

    expect(event?.exception.values).toHaveLength(2)
  })

  test("stops at five links, innermost first", () => {
    let error = new Error("root")

    for (let depth = 0; depth < 8; depth += 1) {
      error = new RangeError(`level ${depth}`, { cause: error })
    }

    const event = buildErrorEvent({ error, context: REQUEST_CONTEXT }, FACTS)

    expect(event?.exception.values).toHaveLength(5)
    expect(event?.exception.values.at(-1)?.mechanism).toEqual({
      type: "remit.request",
      handled: false
    })
    expect(event?.exception.values.slice(0, -1).every((value) => !value.mechanism)).toBe(true)
  })
})

describe("the job and process contexts", () => {
  test("a job that exhausted its attempts is attributed to the worker and the job", () => {
    const event = buildErrorEvent(
      {
        error: new Error("render failed"),
        context: { source: "job", jobName: "invoice.pdf.render", attempts: 5 }
      },
      { ...FACTS, runtime: "worker" }
    )

    expect(event?.transaction).toBe("invoice.pdf.render")
    expect(event?.tags).toMatchObject({
      runtime: "worker",
      source: "job",
      "job.name": "invoice.pdf.render",
      "job.attempts": "5"
    })
  })

  test("a failed worker start is tagged with its phase", () => {
    const event = buildErrorEvent(
      { error: new Error("redis unreachable"), context: { source: "process", phase: "start" } },
      { ...FACTS, runtime: "worker" }
    )

    expect(event?.transaction).toBe("process.start")
    expect(event?.tags["process.phase"]).toBe("start")
  })
})

describe("fails closed", () => {
  const error = new Error("boom")

  test.each([
    ["a requested path with an id", `/invoices/3f2a1b9c-5d4e-4f6a-8b7c-9d0e1f2a3b4c`],
    ["a requested path with a public token", `/i/${BANNED_VALUES.publicToken}`],
    ["a requested path with a query string", `/clients${BANNED_VALUES.queryString}`],
    ["a requested path with an email address", `/leads/${BANNED_VALUES.emailAddress}`],
    ["a relative path", "app/(dashboard)/page"]
  ])("drops the event when the route path is %s", (_label, routePath) => {
    const event = buildErrorEvent({ error, context: { ...REQUEST_CONTEXT, routePath } }, FACTS)

    expect(event).toBeNull()
  })

  test("drops the event when the context carries a field it does not know", () => {
    const context = { ...REQUEST_CONTEXT, path: `/i/${BANNED_VALUES.publicToken}` }

    const event = buildErrorEvent({ error, context }, FACTS)

    expect(event).toBeNull()
  })

  test("drops the event when the source is unknown", () => {
    const context = { source: "browser", routePath: "/" } as unknown as ErrorReportContext

    const event = buildErrorEvent({ error, context }, FACTS)

    expect(event).toBeNull()
  })

  test("drops the event when a job name is not a job name", () => {
    const event = buildErrorEvent(
      { error, context: { source: "job", jobName: BANNED_VALUES.emailAddress, attempts: 5 } },
      FACTS
    )

    expect(event).toBeNull()
  })

  test("drops the event when a fact does not match its vocabulary", () => {
    const event = buildErrorEvent(
      { error, context: REQUEST_CONTEXT },
      { ...FACTS, release: BANNED_VALUES.databaseUrl }
    )

    expect(event).toBeNull()
  })
})
