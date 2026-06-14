"use client"

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useState,
  useSyncExternalStore
} from "react"

type Store<T> = {
  get: () => T
  getServerValue: () => T
  set: (value: T) => void
  subscribe: (onChange: () => void) => () => void
}

function createStore<T>(key: string | null, defaultValue: T): Store<T> {
  const listeners = new Set<() => void>()

  let cache: { raw: string | null; value: T } = { raw: null, value: defaultValue }
  let memoryValue = defaultValue

  const get = (): T => {
    if (key === null) return memoryValue

    let raw: string | null

    try {
      raw = window.localStorage.getItem(key)
    } catch {
      return cache.value
    }

    if (raw === cache.raw) return cache.value

    let value = defaultValue

    if (raw !== null) {
      try {
        value = JSON.parse(raw) as T
      } catch {
        value = defaultValue
      }
    }

    cache = { raw, value }

    return value
  }

  const set = (value: T): void => {
    if (key === null) {
      memoryValue = value
    } else {
      try {
        window.localStorage.setItem(key, JSON.stringify(value))
      } catch {}
    }

    listeners.forEach((listener) => listener())
  }

  const subscribe = (onChange: () => void): (() => void) => {
    listeners.add(onChange)

    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== key) return

      onChange()
    }

    if (key !== null) window.addEventListener("storage", onStorage)

    return () => {
      listeners.delete(onChange)

      if (key !== null) window.removeEventListener("storage", onStorage)
    }
  }

  return { get, getServerValue: () => defaultValue, set, subscribe }
}

export function useLocalStorage<T>(
  key: string | null,
  defaultValue: T
): [T, Dispatch<SetStateAction<T>>] {
  const [store] = useState(() => createStore(key, defaultValue))

  const value = useSyncExternalStore(store.subscribe, store.get, store.getServerValue)

  const setValue = useCallback<Dispatch<SetStateAction<T>>>(
    (next) => {
      store.set(typeof next === "function" ? (next as (previous: T) => T)(store.get()) : next)
    },
    [store]
  )

  return [value, setValue]
}
