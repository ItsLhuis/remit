import { randomInt } from "node:crypto"

import { afterAll, expect, test } from "vitest"

import { auth } from "@/lib/auth"

import { env } from "@/lib/config/env"
import { createRateLimitConnection } from "@/lib/rateLimit/connection"

const redis = createRateLimitConnection(env.REDIS_URL)

// An address of its own per run: the sign-in window is fifteen minutes, and the suite's Redis keeps
// counters between runs, which is the property under test.
const callerAddress = `198.51.100.${randomInt(1, 255)}`

function signInRequest(): Request {
  return new Request(`${env.REMIT_PUBLIC_URL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: env.REMIT_PUBLIC_URL,
      "x-forwarded-for": callerAddress
    },
    body: JSON.stringify({ email: "nobody@example.test", password: "WrongPassword123!" })
  })
}

afterAll(async () => {
  await redis.del(`remit:ratelimit:auth:${callerAddress}|/sign-in/email`)

  redis.disconnect()
})

test("refuses the eleventh sign-in in a window from a count Redis holds for every process", async () => {
  const statuses: number[] = []

  for (let attempt = 0; attempt < 11; attempt += 1) {
    statuses.push((await auth.handler(signInRequest())).status)
  }

  const counted = await redis.get(`remit:ratelimit:auth:${callerAddress}|/sign-in/email`)

  expect(statuses.slice(0, 10)).not.toContain(429)
  expect(statuses[10]).toBe(429)
  expect(counted).toBe("11")
})
