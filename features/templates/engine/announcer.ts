// Screen-reader announcement channel for canvas gestures. A module-level store keeps the
// announce call reachable from gesture code and keyboard
// handlers without prop plumbing; LiveRegion renders the current message into an aria-live node.

type AnnouncerListener = () => void

let message = ""
let version = 0

const listeners = new Set<AnnouncerListener>()

export function announce(next: string): void {
  message = next
  version += 1

  for (const listener of listeners) listener()
}

export function subscribeToAnnouncer(listener: AnnouncerListener): () => void {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

// Alternates an invisible zero-width suffix so announcing the same message twice still mutates
// the live region's text (aria-live only re-announces on DOM change).
export function getAnnouncement(): string {
  return version % 2 === 0 ? message : message + "​"
}

const GESTURE_PROGRESS_INTERVAL_MS = 500

let lastProgressAt = 0

// Gates the per-frame move/resize/rotate/marquee progress announcements to roughly twice a second:
// screen readers reading every animation frame would be unusable noise, and only one gesture is
// ever in flight at a time, so a single shared gate is enough. Callers check this before formatting
// and announcing their translated message, so the (comparatively expensive) translation call itself
// is skipped on every throttled frame, not just the announcement.
export function shouldAnnounceGestureProgress(): boolean {
  const now = Date.now()

  if (now - lastProgressAt < GESTURE_PROGRESS_INTERVAL_MS) return false

  lastProgressAt = now

  return true
}

// Called when a gesture activates so its first progress update is never muted by a throttle
// window left over from a different, already-finished gesture.
export function resetGestureProgressThrottle(): void {
  lastProgressAt = 0
}
