"use client"

import { useRef, useTransition } from "react"

import { useRouter } from "next/navigation"

import { authClient } from "@/lib/authClient"
import { resolveStorageUrl } from "@/lib/storage"
import { getInitials } from "@/lib/utils"

import { type User } from "@/lib/auth"

import { confirmAvatarUpload } from "@/features/settings/profile/actions"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Spinner,
  toast,
  Typography
} from "@/components/ui"

type AvatarSectionProps = {
  user: User
}

const AvatarSection = ({ user }: AvatarSectionProps) => {
  const [isPending, startTransition] = useTransition()

  const fileInputRef = useRef<HTMLInputElement>(null)

  const router = useRouter()

  const { refetch: refetchSession } = authClient.useSession()

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) return

    event.target.value = ""

    startTransition(async () => {
      const presignResponse = await fetch("/api/upload/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type })
      })

      if (!presignResponse.ok) {
        const data: unknown = await presignResponse.json()
        const message =
          typeof data === "object" && data !== null && "error" in data
            ? String((data as Record<string, unknown>).error)
            : "Failed to get upload URL."

        toast.error(message)

        return
      }

      const { uploadUrl, objectKey } = (await presignResponse.json()) as {
        uploadUrl: string
        objectKey: string
      }

      const putResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file
      })

      if (!putResponse.ok) {
        toast.error("Failed to upload file")

        return
      }

      const result = await confirmAvatarUpload(objectKey, file.name, file.type, file.size)

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      const { error: updateError } = await authClient.updateUser({ image: result.storageKey })

      if (updateError) {
        toast.error(updateError.message)

        return
      }

      await refetchSession()

      router.refresh()

      toast.success("Avatar updated")
    })
  }

  return (
    <section className="space-y-4">
      <Typography variant="h4">Avatar</Typography>
      <div className="flex items-center gap-4">
        <Avatar className="size-20 text-base">
          {user.image && <AvatarImage src={resolveStorageUrl(user.image) ?? ""} alt={user.name} />}
          <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            {isPending && <Spinner />}
            Upload photo
          </Button>
          <Typography affects={["muted", "small"]}>JPG, PNG, WebP or GIF. Max 5MB.</Typography>
        </div>
      </div>
    </section>
  )
}

export { AvatarSection }
