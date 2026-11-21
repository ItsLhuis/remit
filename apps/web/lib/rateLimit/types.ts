export type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetAt: Date
}

export type RateLimitAdapter = {
  consume(key: string, max: number, windowMs: number): Promise<RateLimitResult>
}
