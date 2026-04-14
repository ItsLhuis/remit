"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export function useCopyWithFeedback(delay = 2000) {
  const [copied, setCopied] = useState(false)

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text)

        if (timeoutRef.current) clearTimeout(timeoutRef.current)

        setCopied(true)

        timeoutRef.current = setTimeout(() => setCopied(false), delay)
      } catch {}
    },
    [delay]
  )

  return { copied, copy }
}
