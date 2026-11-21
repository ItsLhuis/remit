"use client"

import { useSyncExternalStore } from "react"

import { getAnnouncement, subscribeToAnnouncer } from "./announcer"

// The aria-live surface for gesture and keyboard announcements. Polite: gesture feedback should
// queue behind whatever the screen reader is currently speaking, never interrupt it.
const LiveRegion = () => {
  const announcement = useSyncExternalStore(subscribeToAnnouncer, getAnnouncement, getAnnouncement)

  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {announcement}
    </div>
  )
}

export { LiveRegion }
