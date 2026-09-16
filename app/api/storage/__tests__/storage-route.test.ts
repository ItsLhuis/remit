// @vitest-environment node

import { beforeEach, describe, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getPublicObjectStream: vi.fn(),
  loggerError: vi.fn()
}))

vi.mock("@/lib/i18n/server", () => ({
  t: (key: string) => key
}))

vi.mock("@/lib/logger", () => ({
  logger: { error: mocks.loggerError }
}))

vi.mock("@/lib/storage/s3", () => ({
  getPublicObjectStream: mocks.getPublicObjectStream
}))

function storedObject(contentType: string | null, bytes = new Uint8Array([1, 2, 3, 4])) {
  return {
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes)
        controller.close()
      }
    }),
    contentLength: bytes.byteLength,
    contentType
  }
}

async function read(key: string[]): Promise<Response> {
  const { GET } = await import("../[...key]/route")

  return GET(new Request(`https://remit.test/api/storage/${key.join("/")}`), {
    params: Promise.resolve({ key })
  })
}

beforeEach(() => {
  vi.clearAllMocks()

  mocks.getPublicObjectStream.mockResolvedValue(storedObject("image/png"))
})

describe("public storage route", () => {
  test("streams a stored image inline under its own type when the key resolves", async () => {
    const response = await read(["avatars", "user-1", "file.png"])

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("image/png")
    expect(response.headers.get("Content-Disposition")).toBe("inline")
    expect(response.headers.get("Content-Length")).toBe("4")
    expect(mocks.getPublicObjectStream).toHaveBeenCalledWith("avatars/user-1/file.png")
  })

  test("marks a served object immutable and same-origin, and never sniffable", async () => {
    const response = await read(["avatars", "user-1", "file.png"])

    expect(response.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable")
    expect(response.headers.get("Cross-Origin-Resource-Policy")).toBe("same-origin")
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff")
  })

  test("hands over an object of an unadmitted type as an opaque download", async () => {
    mocks.getPublicObjectStream.mockResolvedValue(storedObject("text/html"))

    const response = await read(["logos", "file.png"])

    expect(response.headers.get("Content-Type")).toBe("application/octet-stream")
    expect(response.headers.get("Content-Disposition")).toBe("attachment")
  })

  test("answers not found when the store holds no such object", async () => {
    mocks.getPublicObjectStream.mockResolvedValue(null)

    const response = await read(["avatars", "missing.png"])

    expect(response.status).toBe(404)
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff")
  })

  // The regex is the only thing between an anonymous caller and a key the upload route never
  // minted, so each shape it exists to refuse is pinned: the store must not be asked at all.
  test.each([
    ["a parent-directory segment", ["avatars", "..", "secret.png"]],
    ["an empty segment", ["avatars", "", "file.png"]],
    ["a dotfile segment", ["avatars", ".env"]],
    ["a segment outside the admitted alphabet", ["avatars", "file name.png"]]
  ])("refuses a key with %s without reading the store", async (_shape, key) => {
    const response = await read(key)

    expect(response.status).toBe(404)
    expect(mocks.getPublicObjectStream).not.toHaveBeenCalled()
  })

  test("refuses a key longer than the maximum without reading the store", async () => {
    const response = await read(["a".repeat(1025)])

    expect(response.status).toBe(404)
    expect(mocks.getPublicObjectStream).not.toHaveBeenCalled()
  })

  test("answers a server error and logs when the store read fails", async () => {
    mocks.getPublicObjectStream.mockRejectedValue(new Error("connection reset"))

    const response = await read(["avatars", "file.png"])

    expect(response.status).toBe(500)
    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({ action: "api.storage.GET", objectKey: "avatars/file.png" }),
      expect.any(String)
    )
  })
})
