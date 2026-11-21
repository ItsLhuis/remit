"use client"

import { useEffect, useState } from "react"

// The ticking state is the current instant, not the elapsed count, and the elapsed seconds are
// derived during render. Storing the count instead would mean seeding it from an effect on every
// change of `startedAt`, and it would drift in a backgrounded tab whose interval was throttled;
// re-reading the clock each tick catches up instead.
export function useElapsedSeconds(startedAt: Date | null): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!startedAt) return

    const interval = setInterval(() => setNow(Date.now()), 1000)

    return () => clearInterval(interval)
  }, [startedAt])

  if (!startedAt) return 0

  return Math.max(0, Math.floor((now - startedAt.getTime()) / 1000))
}
