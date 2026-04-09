import { useCallback, useState } from "react"

const useScrollGradients = () => {
  const [showTop, setShowTop] = useState(false)
  const [showBottom, setShowBottom] = useState(false)

  const ref = useCallback((element: HTMLDivElement | null) => {
    if (!element) return

    const update = () => {
      setShowTop(element.scrollTop > 0)
      setShowBottom(element.scrollTop < element.scrollHeight - element.clientHeight - 1)
    }

    update()

    element.addEventListener("scroll", update, { passive: true })

    const observer = new ResizeObserver(update)
    observer.observe(element)

    return () => {
      element.removeEventListener("scroll", update)
      observer.disconnect()
    }
  }, [])

  return { ref, showTop, showBottom }
}

export { useScrollGradients }
