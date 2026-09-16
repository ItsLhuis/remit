// @vitest-environment node

import { NextRequest } from "next/server"

import { beforeEach, describe, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  getSession: vi.fn(),
  putUploadedObject: vi.fn(),
  loggerError: vi.fn()
}))

vi.mock("next/headers", () => ({
  headers: mocks.headers
}))

vi.mock("@/lib/i18n/server", () => ({
  t: (key: string) => key
}))

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: mocks.getSession
    }
  }
}))

vi.mock("@/lib/logger", () => ({
  logger: { error: mocks.loggerError }
}))

vi.mock("@/lib/storage/s3", () => ({
  putUploadedObject: mocks.putUploadedObject
}))

const UUID_PATTERN = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"

type UploadInput = {
  contentType?: string
  sizeBytes?: number
}

function createUpload(type: string, input: UploadInput): NextRequest {
  const requestHeaders = new Headers()

  if (input.contentType) requestHeaders.set("content-type", input.contentType)
  if (input.sizeBytes !== undefined) requestHeaders.set("content-length", String(input.sizeBytes))

  return new NextRequest(`https://remit.test/api/upload/${type}`, {
    method: "POST",
    headers: requestHeaders,
    body: new Uint8Array([1, 2, 3, 4])
  })
}

async function upload(type: string, input: UploadInput): Promise<Response> {
  const { POST } = await import("../[type]/route")

  return POST(createUpload(type, input), { params: Promise.resolve({ type }) })
}

function storedObject(): { bucket: string; objectKey: string; contentLength: number } {
  const [input] = mocks.putUploadedObject.mock.calls[0] ?? []

  return input as { bucket: string; objectKey: string; contentLength: number }
}

beforeEach(() => {
  vi.clearAllMocks()

  mocks.headers.mockResolvedValue(new Headers())
  mocks.getSession.mockResolvedValue({ user: { id: "user-1" } })
  mocks.putUploadedObject.mockResolvedValue(undefined)
})

describe("avatar upload route", () => {
  test("stores an allowed avatar and returns the key it minted", async () => {
    const response = await upload("avatar", { contentType: "image/png", sizeBytes: 1024 })
    const body = (await response.json()) as { objectKey: string }

    expect(response.status).toBe(200)
    expect(body.objectKey).toMatch(new RegExp(`^avatars/user-1/${UUID_PATTERN}\\.png$`))
    expect(mocks.putUploadedObject).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: "public",
        objectKey: body.objectKey,
        contentLength: 1024,
        contentType: "image/png"
      })
    )
  })

  test("reads the file type without its parameters", async () => {
    const response = await upload("avatar", {
      contentType: "image/png; charset=binary",
      sizeBytes: 1024
    })

    expect(response.status).toBe(200)
  })

  test("marks its responses as not to be sniffed, since the proxy does not handle it", async () => {
    const response = await upload("avatar", { contentType: "image/png", sizeBytes: 1024 })

    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff")
  })

  test("rejects unsupported avatar file types without storing anything", async () => {
    const response = await upload("avatar", { contentType: "image/svg+xml", sizeBytes: 1024 })
    const body = (await response.json()) as { error: string }

    expect(response.status).toBe(400)
    expect(body.error).toBe("settings.profile.invalidAvatarFileType")
    expect(mocks.putUploadedObject).not.toHaveBeenCalled()
  })

  test("returns unauthorized when the request has no session", async () => {
    mocks.getSession.mockResolvedValueOnce(null)

    const response = await upload("avatar", { contentType: "image/png", sizeBytes: 1024 })
    const body = (await response.json()) as { error: string }

    expect(response.status).toBe(401)
    expect(body.error).toBe("errors.unauthorized")
    expect(mocks.putUploadedObject).not.toHaveBeenCalled()
  })

  test("returns bad request when the upload declares no length", async () => {
    const response = await upload("avatar", { contentType: "image/png" })

    expect(response.status).toBe(400)
    expect(mocks.putUploadedObject).not.toHaveBeenCalled()
  })

  test("returns not found for an upload type the route does not know", async () => {
    const response = await upload("anything", { contentType: "image/png", sizeBytes: 1024 })

    expect(response.status).toBe(404)
    expect(mocks.putUploadedObject).not.toHaveBeenCalled()
  })

  test("returns server error and logs when storage refuses the write", async () => {
    mocks.putUploadedObject.mockRejectedValueOnce(new Error("S3 unreachable"))

    const response = await upload("avatar", { contentType: "image/png", sizeBytes: 1024 })
    const body = (await response.json()) as { error: string }

    expect(response.status).toBe(500)
    expect(body.error).toBe("settings.profile.uploadUrlFailed")
    expect(mocks.loggerError).toHaveBeenCalledOnce()
  })
})

describe("business logo upload route", () => {
  test("stores an allowed logo under the logos prefix", async () => {
    const response = await upload("business-logo", { contentType: "image/png", sizeBytes: 1024 })
    const body = (await response.json()) as { objectKey: string }

    expect(response.status).toBe(200)
    expect(body.objectKey).toMatch(new RegExp(`^logos/${UUID_PATTERN}\\.png$`))
  })

  test("rejects unsupported logo file types without storing anything", async () => {
    const response = await upload("business-logo", {
      contentType: "image/svg+xml",
      sizeBytes: 1024
    })
    const body = (await response.json()) as { error: string }

    expect(response.status).toBe(400)
    expect(body.error).toBe("settings.business.invalidLogoFileType")
    expect(mocks.putUploadedObject).not.toHaveBeenCalled()
  })

  test("rejects a logo file that exceeds the size limit without storing anything", async () => {
    const response = await upload("business-logo", {
      contentType: "image/png",
      sizeBytes: 6 * 1024 * 1024
    })

    expect(response.status).toBe(400)
    expect(mocks.putUploadedObject).not.toHaveBeenCalled()
  })

  test("returns server error when storage refuses the write", async () => {
    mocks.putUploadedObject.mockRejectedValueOnce(new Error("S3 unreachable"))

    const response = await upload("business-logo", { contentType: "image/png", sizeBytes: 1024 })
    const body = (await response.json()) as { error: string }

    expect(response.status).toBe(500)
    expect(body.error).toBe("settings.business.uploadUrlFailed")
  })
})

describe("expense receipt upload route", () => {
  // The prefix is half of a contract `features/expenses/schemas.ts` enforces from the other side:
  // an expense refuses any receipt key outside it, so a key minted anywhere else cannot be attached.
  test("mints a receipt key under the expenses prefix", async () => {
    const response = await upload("expense-receipt", {
      contentType: "application/pdf",
      sizeBytes: 24_000
    })
    const body = (await response.json()) as { objectKey: string }

    expect(response.status).toBe(200)
    expect(body.objectKey).toMatch(new RegExp(`^expenses/${UUID_PATTERN}\\.pdf$`))
  })

  test("accepts a photographed receipt as well as a PDF", async () => {
    const response = await upload("expense-receipt", {
      contentType: "image/jpeg",
      sizeBytes: 400_000
    })
    const body = (await response.json()) as { objectKey: string }

    expect(response.status).toBe(200)
    expect(body.objectKey).toMatch(/\.jpg$/)
  })

  test("rejects an unsupported receipt file type without storing anything", async () => {
    const response = await upload("expense-receipt", { contentType: "text/html", sizeBytes: 1024 })
    const body = (await response.json()) as { error: string }

    expect(response.status).toBe(400)
    expect(body.error).toBe("expenses.errors.invalidFileType")
    expect(mocks.putUploadedObject).not.toHaveBeenCalled()
  })

  test("rejects a receipt larger than the receipt limit without storing anything", async () => {
    const response = await upload("expense-receipt", {
      contentType: "application/pdf",
      sizeBytes: 11 * 1024 * 1024
    })

    expect(response.status).toBe(400)
    expect(mocks.putUploadedObject).not.toHaveBeenCalled()
  })

  test("allows a receipt larger than the image limit the other routes enforce", async () => {
    const response = await upload("expense-receipt", {
      contentType: "application/pdf",
      sizeBytes: 8 * 1024 * 1024
    })

    expect(response.status).toBe(200)
  })
})

describe("attachment upload route", () => {
  test("mints an attachment key under the prefix the feature schema requires", async () => {
    const response = await upload("attachment", { contentType: "application/pdf", sizeBytes: 2048 })
    const body = (await response.json()) as { objectKey: string }

    expect(response.status).toBe(200)
    expect(body.objectKey).toMatch(new RegExp(`^attachments/${UUID_PATTERN}\\.pdf$`))
  })

  test("stores an attachment in the private documents bucket, never the public one", async () => {
    await upload("attachment", { contentType: "image/png", sizeBytes: 2048 })

    expect(storedObject().bucket).toBe("documents")
  })

  // Twenty-five megabytes is above the proxy's ten-megabyte body buffer, which is why this route is
  // outside the proxy matcher; the ceiling itself is enforced here.
  test("accepts an attachment up to the attachment ceiling", async () => {
    const response = await upload("attachment", {
      contentType: "application/pdf",
      sizeBytes: 25 * 1024 * 1024
    })

    expect(response.status).toBe(200)
    expect(storedObject().contentLength).toBe(25 * 1024 * 1024)
  })

  test("refuses a file larger than the attachment ceiling without storing anything", async () => {
    const response = await upload("attachment", {
      contentType: "application/pdf",
      sizeBytes: 26 * 1024 * 1024
    })

    expect(response.status).toBe(400)
    expect(mocks.putUploadedObject).not.toHaveBeenCalled()
  })

  test("refuses an archive, which would carry anything past the mime allowlist", async () => {
    const response = await upload("attachment", { contentType: "application/zip", sizeBytes: 2048 })

    expect(response.status).toBe(400)
    expect(mocks.putUploadedObject).not.toHaveBeenCalled()
  })
})

describe("client image upload route", () => {
  test("mints a client image key under the prefix the feature schema requires", async () => {
    const response = await upload("client-image", { contentType: "image/png", sizeBytes: 2048 })
    const body = (await response.json()) as { objectKey: string }

    expect(response.status).toBe(200)
    expect(body.objectKey).toMatch(new RegExp(`^clients/${UUID_PATTERN}\\.png$`))
  })

  test("stores a client image in the public bucket, where resolveStorageUrl can read it", async () => {
    await upload("client-image", { contentType: "image/png", sizeBytes: 2048 })

    expect(storedObject().bucket).toBe("public")
  })

  test("refuses a PDF, which is not an image", async () => {
    const response = await upload("client-image", {
      contentType: "application/pdf",
      sizeBytes: 2048
    })

    expect(response.status).toBe(400)
    expect(mocks.putUploadedObject).not.toHaveBeenCalled()
  })
})
