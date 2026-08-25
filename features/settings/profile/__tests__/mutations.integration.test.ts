import { eq } from "drizzle-orm"

import { beforeEach, describe, expect, test, vi } from "vitest"

import { uploads } from "@/database/schema"

import { makeUpload, makeUser } from "@/tests/factories"
import { database } from "@/tests/integration/database"

const mocks = vi.hoisted(() => ({
  changeEmail: vi.fn(),
  deleteStorageObject: vi.fn(),
  getStorageObjectBytes: vi.fn(),
  getSession: vi.fn(),
  headers: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
  revalidatePath: vi.fn(),
  updateUser: vi.fn()
}))

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath
}))

vi.mock("next/headers", () => ({
  headers: mocks.headers
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

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError,
    warn: mocks.loggerWarn
  }
}))

vi.mock("@/lib/storage/s3", () => ({
  deleteStorageObject: mocks.deleteStorageObject,
  getStorageObjectBytes: mocks.getStorageObjectBytes
}))

const ownerId = "00000000-0000-4000-8000-000000000021"
const ownerEmail = "owner-profile@example.com"

describe("profile settings mutations", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    await makeUser({ id: ownerId, email: ownerEmail })

    mocks.headers.mockResolvedValue(new Headers({ "user-agent": "Vitest" }))
    mocks.changeEmail.mockResolvedValue(undefined)
    mocks.getSession.mockResolvedValue({
      user: { id: ownerId, email: ownerEmail, image: null }
    })
    mocks.updateUser.mockResolvedValue(undefined)
    mocks.deleteStorageObject.mockResolvedValue(undefined)
    mocks.getStorageObjectBytes.mockResolvedValue(Buffer.from("stored-avatar-bytes"))
  })

  test("requests an email change with the profile callback URL", async () => {
    const { changeEmailAddress } = await import("../mutations")

    const result = await changeEmailAddress({ email: "new-profile@example.com" })

    expect(result).toEqual({ data: { pendingVerification: true } })
    expect(mocks.changeEmail).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: {
        newEmail: "new-profile@example.com",
        callbackURL: "http://localhost:3000/settings/profile"
      }
    })
  })

  test("records an avatar upload and updates the user image through the auth boundary", async () => {
    const { confirmAvatarUpload } = await import("../mutations")

    const result = await confirmAvatarUpload({
      objectKey: "avatars/user/new.png",
      filename: "new.png",
      mimeType: "image/png",
      sizeBytes: 1024
    })
    const uploadRows = await database
      .select()
      .from(uploads)
      .where(eq(uploads.path, "avatars/user/new.png"))

    expect(result).toEqual({ data: { storageKey: "avatars/user/new.png" } })
    expect(uploadRows).toHaveLength(1)
    expect(mocks.updateUser).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: { image: "avatars/user/new.png" }
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/settings/profile")
  })

  test("deletes the previous stored avatar only after the new avatar is confirmed", async () => {
    const { confirmAvatarUpload } = await import("../mutations")

    await makeUpload({ path: "avatars/user/old.png" })
    mocks.getSession.mockResolvedValueOnce({
      user: { id: ownerId, email: ownerEmail, image: "avatars/user/old.png" }
    })

    const result = await confirmAvatarUpload({
      objectKey: "avatars/user/new.png",
      filename: "new.png",
      mimeType: "image/png",
      sizeBytes: 1024
    })
    const oldUploadRows = await database
      .select()
      .from(uploads)
      .where(eq(uploads.path, "avatars/user/old.png"))
    const newUploadRows = await database
      .select()
      .from(uploads)
      .where(eq(uploads.path, "avatars/user/new.png"))

    expect(result).toEqual({ data: { storageKey: "avatars/user/new.png" } })
    expect(oldUploadRows).toHaveLength(0)
    expect(newUploadRows).toHaveLength(1)
    expect(mocks.deleteStorageObject).toHaveBeenCalledWith("avatars/user/old.png")
  })

  test("clears the user avatar and deletes the stored avatar when the avatar is removed", async () => {
    const { removeAvatar } = await import("../mutations")

    await makeUpload({ path: "avatars/user/old.png" })
    mocks.getSession.mockResolvedValueOnce({
      user: { id: ownerId, email: ownerEmail, image: "avatars/user/old.png" }
    })

    const result = await removeAvatar()
    const oldUploadRows = await database
      .select()
      .from(uploads)
      .where(eq(uploads.path, "avatars/user/old.png"))

    expect(result).toEqual({ data: { success: true } })
    expect(oldUploadRows).toHaveLength(0)
    expect(mocks.updateUser).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: { image: null }
    })
    expect(mocks.deleteStorageObject).toHaveBeenCalledWith("avatars/user/old.png")
  })

  test("returns unauthorized without recording an avatar when there is no session", async () => {
    const { confirmAvatarUpload } = await import("../mutations")

    mocks.getSession.mockResolvedValueOnce(null)

    const result = await confirmAvatarUpload({
      objectKey: "avatars/user/new.png",
      filename: "new.png",
      mimeType: "image/png",
      sizeBytes: 1024
    })
    const uploadRows = await database.select().from(uploads)

    expect(result).toEqual({ error: "Unauthorized." })
    expect(uploadRows).toHaveLength(0)
    expect(mocks.updateUser).not.toHaveBeenCalled()
  })
})
