import { beforeEach, describe, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  revalidatePath: vi.fn(),
  changeEmail: vi.fn(),
  getSession: vi.fn(),
  updateUser: vi.fn(),
  insert: vi.fn(),
  insertValues: vi.fn(),
  delete: vi.fn(),
  deleteWhere: vi.fn(),
  eq: vi.fn(),
  deleteStorageObject: vi.fn(),
  verifyUploadedObject: vi.fn(),
  loggerError: vi.fn()
}))

vi.mock("next/headers", () => ({
  headers: mocks.headers
}))

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath
}))

vi.mock("@/lib/i18n/server", () => ({
  t: (key: string) => key
}))

vi.mock("@/lib/config/env", () => ({
  env: {
    BETTER_AUTH_URL: "https://remit.test"
  }
}))

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      changeEmail: mocks.changeEmail,
      getSession: mocks.getSession,
      updateUser: mocks.updateUser
    }
  }
}))

vi.mock("drizzle-orm", () => ({
  eq: mocks.eq
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError
  }
}))

// Mocked at its own module boundary rather than through the s3 client beneath it: this suite is
// about what the mutation does with a verified object, and hashing real bytes would test
// `verifyUploadedObject` a second time.
vi.mock("@/lib/storage/verifyUploadedObject", () => ({
  verifyUploadedObject: mocks.verifyUploadedObject
}))

vi.mock("@/lib/storage/s3", () => ({
  deleteStorageObject: mocks.deleteStorageObject
}))

vi.mock("@/database/schema", () => ({
  uploads: "uploadsTable"
}))

vi.mock("@/database", () => ({
  database: {
    insert: mocks.insert,
    delete: mocks.delete
  }
}))

const validAvatarUpload = {
  objectKey: "avatars/user-1/123.png",
  filename: "photo.png",
  mimeType: "image/png",
  sizeBytes: 1024
}

describe("profile settings mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.headers.mockResolvedValue(new Headers())
    mocks.verifyUploadedObject.mockResolvedValue({
      sizeBytes: 2048,
      checksumSha256: "c".repeat(64)
    })
    mocks.changeEmail.mockResolvedValue(undefined)
    mocks.getSession.mockResolvedValue({ user: { id: "user-1", image: null } })
    mocks.updateUser.mockResolvedValue(undefined)
    mocks.eq.mockReturnValue("uploads-path-predicate")
    mocks.insert.mockReturnValue({
      values: (values: unknown) => {
        mocks.insertValues(values)

        return Promise.resolve()
      }
    })
    mocks.delete.mockReturnValue({
      where: (predicate: unknown) => {
        mocks.deleteWhere(predicate)

        return Promise.resolve()
      }
    })
  })

  test("requests an email change with the profile callback URL", async () => {
    const { changeEmailAddress } = await import("../mutations")

    const result = await changeEmailAddress({ email: "new@example.com" })

    expect(result).toEqual({ data: { pendingVerification: true } })
    expect(mocks.changeEmail).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: {
        newEmail: "new@example.com",
        callbackURL: "https://remit.test/settings/profile"
      }
    })
  })

  test("returns a validation error without calling auth when the email is invalid", async () => {
    const { changeEmailAddress } = await import("../mutations")

    const result = await changeEmailAddress({ email: "not-an-email" })

    expect(result).toEqual({ error: "Enter a valid email address." })
    expect(mocks.changeEmail).not.toHaveBeenCalled()
  })

  test("returns an error when the email change request fails", async () => {
    mocks.changeEmail.mockRejectedValueOnce(new Error("auth service unavailable"))

    const { changeEmailAddress } = await import("../mutations")

    const result = await changeEmailAddress({ email: "new@example.com" })

    expect(result).toEqual({ error: "settings.profile.errors.emailChangeFailed" })
    expect(mocks.loggerError).toHaveBeenCalledOnce()
  })

  test("records an avatar upload and revalidates profile settings", async () => {
    const { confirmAvatarUpload } = await import("../mutations")

    const result = await confirmAvatarUpload(validAvatarUpload)

    expect(result).toEqual({ data: { storageKey: "avatars/user-1/123.png" } })
    expect(mocks.insert).toHaveBeenCalledWith("uploadsTable")
    // The verified size, not the 1024 the request claimed: the row records what the object actually
    // measured server-side.
    expect(mocks.insertValues).toHaveBeenCalledWith({
      filename: "photo.png",
      path: "avatars/user-1/123.png",
      mimeType: "image/png",
      sizeBytes: 2048,
      checksumSha256: "c".repeat(64)
    })
    expect(mocks.updateUser).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: { image: "avatars/user-1/123.png" }
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/settings/profile")
  })

  test("removes the old avatar only after the new image is saved on the user", async () => {
    mocks.getSession.mockResolvedValueOnce({
      user: { id: "user-1", image: "avatars/user-1/old.png" }
    })

    const { confirmAvatarUpload } = await import("../mutations")

    await confirmAvatarUpload(validAvatarUpload)

    expect(mocks.deleteWhere).toHaveBeenCalledWith("uploads-path-predicate")
    expect(mocks.deleteStorageObject).toHaveBeenCalledWith("avatars/user-1/old.png")
  })

  test("returns unauthorized without recording an avatar when there is no session", async () => {
    mocks.getSession.mockResolvedValueOnce(null)

    const { confirmAvatarUpload } = await import("../mutations")

    const result = await confirmAvatarUpload(validAvatarUpload)

    expect(result).toEqual({ error: "settings.profile.errors.unauthorized" })
    expect(mocks.insert).not.toHaveBeenCalled()
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  test("returns an upload error when avatar persistence fails", async () => {
    mocks.insert.mockReturnValueOnce({
      values: () => Promise.reject(new Error("database unavailable"))
    })

    const { confirmAvatarUpload } = await import("../mutations")

    const result = await confirmAvatarUpload(validAvatarUpload)

    expect(result).toEqual({ error: "settings.profile.errors.avatarUpdateFailed" })
    expect(mocks.loggerError).toHaveBeenCalledOnce()
  })

  test("cleans up the new upload when user update fails", async () => {
    mocks.updateUser.mockRejectedValueOnce(new Error("auth service unavailable"))

    const { confirmAvatarUpload } = await import("../mutations")

    const result = await confirmAvatarUpload(validAvatarUpload)

    expect(result).toEqual({ error: "settings.profile.errors.avatarUpdateFailed" })
    expect(mocks.deleteStorageObject).toHaveBeenCalledWith("avatars/user-1/123.png")
  })

  test("clears the user avatar and removes the stored file", async () => {
    mocks.getSession.mockResolvedValueOnce({
      user: { id: "user-1", image: "avatars/user-1/old.png" }
    })

    const { removeAvatar } = await import("../mutations")

    const result = await removeAvatar()

    expect(result).toEqual({ data: { success: true } })
    expect(mocks.updateUser).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: { image: null }
    })
    expect(mocks.deleteStorageObject).toHaveBeenCalledWith("avatars/user-1/old.png")
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/settings/profile")
  })
})
