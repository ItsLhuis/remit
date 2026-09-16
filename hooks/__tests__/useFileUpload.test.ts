// @vitest-environment happy-dom

import { act, cleanup, renderHook } from "@testing-library/react"

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { useFileUpload, type UseFileUploadOptions } from "../useFileUpload"

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {},
    ready: true,
    locales: {}
  })
}))

type SentRequest = {
  method: string
  url: string
  contentType: string | null
  filename: string
}

type RouteResponse = {
  status: number
  body: unknown
}

type ProgressListener = (event: {
  lengthComputable: boolean
  loaded: number
  total: number
}) => void

let routeResponses: RouteResponse[] = []
let uploadProgress: { loaded: number; total: number }[] = []
let sentRequests: SentRequest[] = []

// The hook reaches for XMLHttpRequest because it is the only browser API that reports upload
// progress; happy-dom's implementation would open a real socket, so the whole class is replaced
// rather than spied on. A status of 0 stands for a request that never reached the server.
class MockXMLHttpRequest {
  status = 0
  responseText = ""

  private method = ""
  private url = ""
  private contentType: string | null = null
  private listeners = new Map<string, (() => void)[]>()
  private progressListeners: ProgressListener[] = []

  upload = {
    addEventListener: (_type: string, listener: ProgressListener) => {
      this.progressListeners.push(listener)
    }
  }

  open(method: string, url: string): void {
    this.method = method
    this.url = url
  }

  setRequestHeader(name: string, value: string): void {
    if (name === "Content-Type") this.contentType = value
  }

  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  }

  send(file: File): void {
    sentRequests.push({
      method: this.method,
      url: this.url,
      contentType: this.contentType,
      filename: file.name
    })

    for (const event of uploadProgress) {
      for (const listener of this.progressListeners) {
        listener({ lengthComputable: true, ...event })
      }
    }

    const response = routeResponses.shift() ?? { status: 0, body: null }

    this.status = response.status
    this.responseText = JSON.stringify(response.body)

    for (const listener of this.listeners.get(response.status === 0 ? "error" : "load") ?? []) {
      listener()
    }
  }
}

function makeOptions(overrides: Partial<UseFileUploadOptions> = {}): UseFileUploadOptions {
  return {
    type: "attachment",
    maxBytes: 1_000,
    mimeTypes: ["image/png", "application/pdf"],
    ...overrides
  }
}

function makeFile(name: string, type: string, sizeBytes = 4): File {
  return new File(["x".repeat(sizeBytes)], name, { type })
}

function respondWith(status: number, body: unknown): void {
  routeResponses.push({ status, body })
}

beforeEach(() => {
  routeResponses = []
  uploadProgress = []
  sentRequests = []

  vi.stubGlobal("XMLHttpRequest", MockXMLHttpRequest)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe("useFileUpload", () => {
  test("stores the file and reports the minted object key when the route stores it", async () => {
    respondWith(200, { objectKey: "attachments/minted.png" })

    const onUploaded = vi.fn()
    const { result } = renderHook(() => useFileUpload(makeOptions({ onUploaded })))

    let uploaded: Awaited<ReturnType<typeof result.current.upload>> = []

    await act(async () => {
      uploaded = await result.current.upload([makeFile("logo.png", "image/png")])
    })

    expect(uploaded).toEqual([
      {
        objectKey: "attachments/minted.png",
        filename: "logo.png",
        mimeType: "image/png",
        sizeBytes: 4
      }
    ])
    expect(onUploaded).toHaveBeenCalledWith(uploaded[0])
    expect(result.current.items[0]).toMatchObject({ status: "done", progress: 100 })
  })

  test("posts the bytes to the upload route for its type, labelled with the file's type", async () => {
    respondWith(200, { objectKey: "attachments/a.png" })

    const { result } = renderHook(() => useFileUpload(makeOptions()))

    await act(async () => {
      await result.current.upload([makeFile("a.png", "image/png")])
    })

    expect(sentRequests).toEqual([
      { method: "POST", url: "/api/upload/attachment", contentType: "image/png", filename: "a.png" }
    ])
  })

  test("rejects a file whose type is outside the allowed list before any request", async () => {
    const { result } = renderHook(() => useFileUpload(makeOptions()))

    await act(async () => {
      await result.current.upload([makeFile("notes.txt", "text/plain")])
    })

    expect(result.current.items[0]).toMatchObject({
      status: "error",
      error: "fileUpload.errors.invalidType"
    })
    expect(sentRequests).toEqual([])
  })

  test("rejects a file over the byte limit before any request", async () => {
    const { result } = renderHook(() => useFileUpload(makeOptions({ maxBytes: 3 })))

    await act(async () => {
      await result.current.upload([makeFile("big.png", "image/png", 8)])
    })

    expect(result.current.items[0]).toMatchObject({
      status: "error",
      error: "fileUpload.errors.tooLarge"
    })
    expect(sentRequests).toEqual([])
  })

  test("surfaces the message the upload route returned when it refuses", async () => {
    respondWith(400, { error: "That file is too large" })

    const { result } = renderHook(() => useFileUpload(makeOptions()))

    await act(async () => {
      await result.current.upload([makeFile("a.png", "image/png")])
    })

    expect(result.current.items[0]).toMatchObject({
      status: "error",
      error: "That file is too large"
    })
  })

  test("falls back to a generic message when the upload route names no reason", async () => {
    respondWith(500, {})

    const { result } = renderHook(() => useFileUpload(makeOptions()))

    await act(async () => {
      await result.current.upload([makeFile("a.png", "image/png")])
    })

    expect(result.current.items[0]).toMatchObject({
      status: "error",
      error: "fileUpload.errors.uploadFailed"
    })
  })

  test("reports a failed upload when the request never reaches the server", async () => {
    const onUploaded = vi.fn()
    const { result } = renderHook(() => useFileUpload(makeOptions({ onUploaded })))

    let uploaded: Awaited<ReturnType<typeof result.current.upload>> = []

    await act(async () => {
      uploaded = await result.current.upload([makeFile("a.png", "image/png")])
    })

    expect(result.current.items[0]).toMatchObject({
      status: "error",
      error: "fileUpload.errors.uploadFailed"
    })
    expect(uploaded).toEqual([])
    expect(onUploaded).not.toHaveBeenCalled()
  })

  test("reports a failed upload when a success response carries no object key", async () => {
    respondWith(200, { stored: true })

    const { result } = renderHook(() => useFileUpload(makeOptions()))

    await act(async () => {
      await result.current.upload([makeFile("a.png", "image/png")])
    })

    expect(result.current.items[0]).toMatchObject({
      status: "error",
      error: "fileUpload.errors.uploadFailed"
    })
  })

  test("tracks the progress reported for the file being sent", async () => {
    respondWith(200, { objectKey: "attachments/a.png" })
    uploadProgress = [{ loaded: 25, total: 100 }]

    const { result } = renderHook(() => useFileUpload(makeOptions()))

    await act(async () => {
      await result.current.upload([makeFile("a.png", "image/png")])
    })

    expect(result.current.items[0]).toMatchObject({ progress: 100, status: "done" })
  })

  // The batch is sequential precisely so that a file rejected in the middle does not cost the
  // caller the files that already reached storage.
  test("keeps the files that already stored when one file in the batch is refused", async () => {
    respondWith(200, { objectKey: "attachments/first.png" })
    respondWith(200, { objectKey: "attachments/third.png" })

    const { result } = renderHook(() => useFileUpload(makeOptions()))

    let uploaded: Awaited<ReturnType<typeof result.current.upload>> = []

    await act(async () => {
      uploaded = await result.current.upload([
        makeFile("first.png", "image/png"),
        makeFile("second.txt", "text/plain"),
        makeFile("third.png", "image/png")
      ])
    })

    expect(uploaded.map((entry) => entry.objectKey)).toEqual([
      "attachments/first.png",
      "attachments/third.png"
    ])
    expect(result.current.items.map((item) => item.status)).toEqual(["done", "error", "done"])
  })

  test("reports nothing in flight and makes no request for an empty batch", async () => {
    const { result } = renderHook(() => useFileUpload(makeOptions()))

    await act(async () => {
      await result.current.upload([])
    })

    expect(result.current.isUploading).toBe(false)
    expect(result.current.items).toEqual([])
    expect(sentRequests).toEqual([])
  })

  test("stops reporting an upload in flight once the batch settles", async () => {
    respondWith(200, { objectKey: "attachments/a.png" })

    const { result } = renderHook(() => useFileUpload(makeOptions()))

    await act(async () => {
      await result.current.upload([makeFile("a.png", "image/png")])
    })

    expect(result.current.isUploading).toBe(false)
  })

  // The flag gates the drop target, so a caller whose persistence throws must not leave the surface
  // permanently disabled.
  test("stops reporting an upload in flight when the caller's persistence throws", async () => {
    respondWith(200, { objectKey: "attachments/a.png" })

    const onUploaded = vi.fn().mockRejectedValue(new Error("action failed"))
    const { result } = renderHook(() => useFileUpload(makeOptions({ onUploaded })))

    await act(async () => {
      await result.current.upload([makeFile("a.png", "image/png")]).catch(() => null)
    })

    expect(result.current.isUploading).toBe(false)
  })

  test("drops a single item when it is dismissed", async () => {
    respondWith(200, { objectKey: "attachments/a.png" })
    respondWith(200, { objectKey: "attachments/b.png" })

    const { result } = renderHook(() => useFileUpload(makeOptions()))

    await act(async () => {
      await result.current.upload([makeFile("a.png", "image/png"), makeFile("b.png", "image/png")])
    })

    act(() => {
      const [first] = result.current.items

      if (first) result.current.dismiss(first.id)
    })

    expect(result.current.items.map((item) => item.filename)).toEqual(["b.png"])
  })

  test("clears every item when the list is reset", async () => {
    respondWith(200, { objectKey: "attachments/a.png" })

    const { result } = renderHook(() => useFileUpload(makeOptions()))

    await act(async () => {
      await result.current.upload([makeFile("a.png", "image/png")])
    })

    act(() => {
      result.current.reset()
    })

    expect(result.current.items).toEqual([])
  })
})
