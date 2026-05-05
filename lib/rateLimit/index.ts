import { createInMemoryAdapter } from "./inMemoryAdapter"

export { createInMemoryAdapter } from "./inMemoryAdapter"
export { type RateLimitAdapter, type RateLimitResult } from "./types"

export const rateLimitInstance = createInMemoryAdapter()
