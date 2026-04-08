import { useEffect, useState, type RefObject } from "react"

const useScrollGradients = (ref: RefObject<HTMLDivElement | null>) => {
  const [showTop, setShowTop] = useState(false)
  const [showBottom, setShowBottom] = useState(false)

  useEffect(() => {
    const el = ref.current

    if (!el) return

    const update = () => {
      setShowTop(el.scrollTop > 0)
      setShowBottom(el.scrollTop < el.scrollHeight - el.clientHeight - 1)
    }

    update()

    el.addEventListener("scroll", update, { passive: true })

    const observer = new ResizeObserver(update)
    observer.observe(el)

    return () => {
      el.removeEventListener("scroll", update)
      observer.disconnect()
    }
  }, [ref])

  return { showTop, showBottom }
}

export { useScrollGradients }
