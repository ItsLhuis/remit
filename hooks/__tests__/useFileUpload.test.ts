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

type PutRequest = {
  url: string
  contentType: string | null
  filename: string
}

type ProgressListener = (event: {
  lengthComputable: boolean
  loaded: number
  total: number
}) => void

let putStatus = 200
let putProgress: { loaded: number; total: number }[] = []
let putRequests: PutRequest[] = []

// The hook reaches for XMLHttpRequest because it is the only browser API that reports upload
// progress; happy-dom's implementation would open a real socket, so the whole class is replaced
// rather than spied on.
class MockXMLHttpRequest {
  status = 0

  private url = ""
  private contentType: string | null = null
  private listeners = new Map<string, (() => void)[]>()
  private progressListeners: ProgressListener[] = []

  upload = {
    addEventListener: (_type: string, listener: ProgressListener) => {
      this.progressListeners.push(listener)
    }
  }

  open(_method: string, url: string): void {
    this.url = url
  }

  setRequestHeader(name: string, value: string): void {
    if (name === "Content-Type") this.contentType = value
  }

  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  }

  send(file: File): void {
    putRequests.push({ url: this.url, contentType: this.contentType, filename: file.name })

    for (const event of putProgress) {
      for (const listener of this.progressListeners) {
        listener({ lengthComputable: true, ...event })
      }
    }

    this.status = putStatus

    for (const listener of this.listeners.get(putStatus === 0 ? "error" : "load") ?? []) {
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

function mockPresign(body: unknown, ok = true): void {
  vi.mocked(globalThis.fetch).mockResolvedValueOnce({
    ok,
    json: async () => body
  } as Response)
}

beforeEach(() => {
  putStatus = 200
  putProgress = []
  putRequests = []

  vi.stubGlobal("fetch", vi.fn())
  vi.stubGlobal("XMLHttpRequest", MockXMLHttpRequest)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe("useFileUpload", () => {
  test("stores the file and reports the minted object key when presign and PUT succeed", async () => {
    mockPresign({ uploadUrl: "https://storage.test/put", objectKey: "attachments/minted.png" })

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

  test("puts the bytes to the presigned url the route returned", async () => {
    mockPresign({ uploadUrl: "https://storage.test/signed-put", objectKey: "attachments/a.png" })

    const { result } = renderHook(() => useFileUpload(makeOptions()))

    await act(async () => {
      await result.current.upload([makeFile("a.png", "image/png")])
    })

    expect(putRequests).toEqual([
      { url: "https://storage.test/signed-put", contentType: "image/png", filename: "a.png" }
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
    expect(globalThis.fetch).not.toHaveBeenCalled()
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
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  test("surfaces the message the presign route returned when it refuses", async () => {
    mockPresign({ error: "That file is too large" }, false)

    const { result } = renderHook(() => useFileUpload(makeOptions()))

    await act(async () => {
      await result.current.upload([makeFile("a.png", "image/png")])
    })

    expect(result.current.items[0]).toMatchObject({
      status: "error",
      error: "That file is too large"
    })
  })

  test("falls back to a generic message when the presign route names no reason", async () => {
    mockPresign({}, false)

    const { result } = renderHook(() => useFileUpload(makeOptions()))

    await act(async () => {
      await result.current.upload([makeFile("a.png", "image/png")])
    })

    expect(result.current.items[0]).toMatchObject({
      status: "error",
      error: "fileUpload.errors.presignFailed"
    })
  })

  test("reports a failed upload when the presign request itself cannot be made", async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error("offline"))

    const { result } = renderHook(() => useFileUpload(makeOptions()))

    await act(async () => {
      await result.current.upload([makeFile("a.png", "image/png")])
    })

    expect(result.current.items[0]).toMatchObject({
      status: "error",
      error: "fileUpload.errors.presignFailed"
    })
  })

  test("reports a failed upload when storage rejects the PUT", async () => {
    mockPresign({ uploadUrl: "https://storage.test/put", objectKey: "attachments/a.png" })
    putStatus = 500

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

  test("tracks the progress storage reports for the file being sent", async () => {
    mockPresign({ uploadUrl: "https://storage.test/put", objectKey: "attachments/a.png" })
    putProgress = [{ loaded: 25, total: 100 }]

    const { result } = renderHook(() => useFileUpload(makeOptions()))

    await act(async () => {
      await result.current.upload([makeFile("a.png", "image/png")])
    })

    expect(result.current.items[0]).toMatchObject({ progress: 100, status: "done" })
  })

  // The batch is sequential precisely so that a file rejected in the middle does not cost the
  // caller the files that already reached storage.
  test("keeps the files that already stored when one file in the batch is refused", async () => {
    mockPresign({ uploadUrl: "https://storage.test/put", objectKey: "attachments/first.png" })
    mockPresign({ uploadUrl: "https://storage.test/put", objectKey: "attachments/third.png" })

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
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  test("stops reporting an upload in flight once the batch settles", async () => {
    mockPresign({ uploadUrl: "https://storage.test/put", objectKey: "attachments/a.png" })

    const { result } = renderHook(() => useFileUpload(makeOptions()))

    await act(async () => {
      await result.current.upload([makeFile("a.png", "image/png")])
    })

    expect(result.current.isUploading).toBe(false)
  })

  // The flag gates the drop target, so a caller whose persistence throws must not leave the surface
  // permanently disabled.
  test("stops reporting an upload in flight when the caller's persistence throws", async () => {
    mockPresign({ uploadUrl: "https://storage.test/put", objectKey: "attachments/a.png" })

    const onUploaded = vi.fn().mockRejectedValue(new Error("action failed"))
    const { result } = renderHook(() => useFileUpload(makeOptions({ onUploaded })))

    await act(async () => {
      await result.current.upload([makeFile("a.png", "image/png")]).catch(() => null)
    })

    expect(result.current.isUploading).toBe(false)
  })

  test("drops a single item when it is dismissed", async () => {
    mockPresign({ uploadUrl: "https://storage.test/put", objectKey: "attachments/a.png" })
    mockPresign({ uploadUrl: "https://storage.test/put", objectKey: "attachments/b.png" })

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
    mockPresign({ uploadUrl: "https://storage.test/put", objectKey: "attachments/a.png" })

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
