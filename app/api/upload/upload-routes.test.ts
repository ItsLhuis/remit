import { beforeEach, describe, expect, test, vi } from "vitest"

import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  getSession: vi.fn(),
  getSignedUrl: vi.fn()
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

vi.mock("@/lib/storage/s3", () => ({
  MINIO_BUCKET: "remit-test",
  s3: {},
  toPublicUploadUrl: (url: string) => url
}))

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: mocks.getSignedUrl
}))

function createRequest(url: string, body: Record<string, unknown>): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  })
}

function avatarParams() {
  return { params: Promise.resolve({ type: "avatar" }) }
}

function logoParams() {
  return { params: Promise.resolve({ type: "business-logo" }) }
}

describe("avatar upload route", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.headers.mockResolvedValue(new Headers())
    mocks.getSession.mockResolvedValue({ user: { id: "user-1" } })
    mocks.getSignedUrl.mockResolvedValue("https://storage.test/upload")
  })

  test("returns a presigned upload URL for an allowed avatar file", async () => {
    const { POST } = await import("./[type]/route")

    const response = await POST(
      createRequest("https://remit.test/api/upload/avatar", {
        filename: "photo.png",
        contentType: "image/png",
        sizeBytes: 1024
      }),
      avatarParams()
    )
    const body = (await response.json()) as { uploadUrl: string; objectKey: string }

    expect(response.status).toBe(200)
    expect(body.uploadUrl).toBe("https://storage.test/upload")
    expect(body.objectKey).toMatch(
      /^avatars\/user-1\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png$/
    )
    expect(mocks.getSignedUrl).toHaveBeenCalled()
  })

  test("rejects unsupported avatar file types without calling storage", async () => {
    const { POST } = await import("./[type]/route")

    const response = await POST(
      createRequest("https://remit.test/api/upload/avatar", {
        filename: "photo.svg",
        contentType: "image/svg+xml",
        sizeBytes: 1024
      }),
      avatarParams()
    )
    const body = (await response.json()) as { error: string }

    expect(response.status).toBe(400)
    expect(body.error).toBe("settings.profile.invalidAvatarFileType")
    expect(mocks.getSignedUrl).not.toHaveBeenCalled()
  })

  test("returns unauthorized when the request has no session", async () => {
    mocks.getSession.mockResolvedValueOnce(null)

    const { POST } = await import("./[type]/route")

    const response = await POST(
      createRequest("https://remit.test/api/upload/avatar", {
        filename: "photo.png",
        contentType: "image/png"
      }),
      avatarParams()
    )
    const body = (await response.json()) as { error: string }

    expect(response.status).toBe(401)
    expect(body.error).toBe("errors.unauthorized")
    expect(mocks.getSignedUrl).not.toHaveBeenCalled()
  })

  test("returns bad request when the body is missing required fields", async () => {
    const { POST } = await import("./[type]/route")

    const response = await POST(
      createRequest("https://remit.test/api/upload/avatar", { filename: "photo.png" }),
      avatarParams()
    )
    const body = (await response.json()) as { error: string }

    expect(response.status).toBe(400)
    expect(body.error).toBeDefined()
    expect(mocks.getSignedUrl).not.toHaveBeenCalled()
  })

  test("returns server error when storage presigning fails", async () => {
    mocks.getSignedUrl.mockRejectedValueOnce(new Error("S3 unreachable"))

    const { POST } = await import("./[type]/route")

    const response = await POST(
      createRequest("https://remit.test/api/upload/avatar", {
        filename: "photo.png",
        contentType: "image/png",
        sizeBytes: 1024
      }),
      avatarParams()
    )
    const body = (await response.json()) as { error: string }

    expect(response.status).toBe(500)
    expect(body.error).toBe("settings.profile.uploadUrlFailed")
  })
})

describe("business logo upload route", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.headers.mockResolvedValue(new Headers())
    mocks.getSession.mockResolvedValue({ user: { id: "user-1" } })
    mocks.getSignedUrl.mockResolvedValue("https://storage.test/upload")
  })

  test("returns a presigned upload URL for an allowed logo file", async () => {
    const { POST } = await import("./[type]/route")

    const response = await POST(
      createRequest("https://remit.test/api/upload/business-logo", {
        filename: "logo.png",
        contentType: "image/png",
        sizeBytes: 1024
      }),
      logoParams()
    )
    const body = (await response.json()) as { uploadUrl: string; objectKey: string }

    expect(response.status).toBe(200)
    expect(body.uploadUrl).toBe("https://storage.test/upload")
    expect(body.objectKey).toMatch(
      /^logos\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png$/
    )
    expect(mocks.getSignedUrl).toHaveBeenCalled()
  })

  test("rejects unsupported logo file types without calling storage", async () => {
    const { POST } = await import("./[type]/route")

    const response = await POST(
      createRequest("https://remit.test/api/upload/business-logo", {
        filename: "logo.svg",
        contentType: "image/svg+xml",
        sizeBytes: 1024
      }),
      logoParams()
    )
    const body = (await response.json()) as { error: string }

    expect(response.status).toBe(400)
    expect(body.error).toBe("settings.business.invalidLogoFileType")
    expect(mocks.getSignedUrl).not.toHaveBeenCalled()
  })

  test("returns unauthorized when the request has no session", async () => {
    mocks.getSession.mockResolvedValueOnce(null)

    const { POST } = await import("./[type]/route")

    const response = await POST(
      createRequest("https://remit.test/api/upload/business-logo", {
        filename: "logo.png",
        contentType: "image/png",
        sizeBytes: 1024
      }),
      logoParams()
    )
    const body = (await response.json()) as { error: string }

    expect(response.status).toBe(401)
    expect(body.error).toBe("errors.unauthorized")
    expect(mocks.getSignedUrl).not.toHaveBeenCalled()
  })

  test("rejects a logo file that exceeds the size limit without calling storage", async () => {
    const { POST } = await import("./[type]/route")

    const response = await POST(
      createRequest("https://remit.test/api/upload/business-logo", {
        filename: "logo.png",
        contentType: "image/png",
        sizeBytes: 6 * 1024 * 1024
      }),
      logoParams()
    )

    expect(response.status).toBe(400)
    expect(mocks.getSignedUrl).not.toHaveBeenCalled()
  })

  test("returns server error when storage presigning fails", async () => {
    mocks.getSignedUrl.mockRejectedValueOnce(new Error("S3 unreachable"))

    const { POST } = await import("./[type]/route")

    const response = await POST(
      createRequest("https://remit.test/api/upload/business-logo", {
        filename: "logo.png",
        contentType: "image/png",
        sizeBytes: 1024
      }),
      logoParams()
    )
    const body = (await response.json()) as { error: string }

    expect(response.status).toBe(500)
    expect(body.error).toBe("settings.business.uploadUrlFailed")
  })
})
