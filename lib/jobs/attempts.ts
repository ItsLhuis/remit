// BullMQ fires `failed` on every attempt, retries included, and has already counted the attempt that
// just failed in `attemptsMade` when it does. Only the attempt that reaches the budget is the job
// failing; one a later retry may still recover is not. A job enqueued without an attempts option
// runs once.
export function isFinalJobAttempt(attemptsMade: number, attempts: number | undefined): boolean {
  return attemptsMade >= (attempts ?? 1)
}
