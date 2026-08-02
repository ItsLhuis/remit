// Screen-reader announcements for canvas gestures. A module-level store keeps announce reachable
// from gesture and keyboard code without prop plumbing; LiveRegion renders it into an aria-live
// node.

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

// Roughly twice a second: a screen reader reading every animation frame would be unusable noise,
// and only one gesture is ever in flight, so one shared gate is enough. Callers check this before
// formatting, so the translation call is skipped on a throttled frame too, not just the
// announcement.
export function shouldAnnounceGestureProgress(): boolean {
  const now = Date.now()

  if (now - lastProgressAt < GESTURE_PROGRESS_INTERVAL_MS) return false

  lastProgressAt = now

  return true
}

// So a gesture's first update is never muted by a window left over from an earlier gesture.
export function resetGestureProgressThrottle(): void {
  lastProgressAt = 0
}
