"use client"

import { type ChangeEvent, useRef, useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { useTranslation } from "@/lib/i18n"

import { resolveStorageUrl } from "@/lib/storage"

import { confirmBusinessLogoUpload } from "../../mutations"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Icon,
  Spinner,
  toast,
  Typography
} from "@/components/ui"

type LogoSectionProps = {
  businessName: string
  businessLogoStorageKey: string | null
}

const LogoSection = ({ businessName, businessLogoStorageKey }: LogoSectionProps) => {
  const { t } = useTranslation()

  const [logoStorageKey, setLogoStorageKey] = useState<string | null>(businessLogoStorageKey)
  const [isPending, startTransition] = useTransition()

  const fileInputRef = useRef<HTMLInputElement>(null)

  const router = useRouter()

  const logoUrl = resolveStorageUrl(logoStorageKey)

  const handleLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) return

    event.target.value = ""

    startTransition(async () => {
      const presignResponse = await fetch("/api/upload/business-logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          sizeBytes: file.size
        })
      })

      if (!presignResponse.ok) {
        const data: unknown = await presignResponse.json()

        toast.error(getErrorMessage(data, t("settings.business.uploadUrlFailed")))

        return
      }

      const uploadData = (await presignResponse.json()) as {
        uploadUrl: string
        objectKey: string
      }

      const putResponse = await fetch(uploadData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file
      })

      if (!putResponse.ok) {
        toast.error(t("settings.business.uploadFailed"))

        return
      }

      const result = await confirmBusinessLogoUpload({
        objectKey: uploadData.objectKey,
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size
      })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      setLogoStorageKey(result.data.storageKey)
      router.refresh()
      toast.success(t("settings.business.logoUpdated"))
    })
  }

  return (
    <section className="space-y-4">
      <Typography variant="h4">{t("settings.business.logo")}</Typography>
      <div className="flex items-center gap-4">
        <Avatar className="size-20 rounded-lg after:rounded-lg">
          <AvatarImage
            src={logoUrl ?? ""}
            alt={t("settings.business.logoAlt", {
              name: businessName || t("settings.business.fallbackBusinessName")
            })}
            className="rounded-lg object-contain"
          />
          <AvatarFallback className="rounded-lg">
            <Icon name="Building2" className="text-muted-foreground size-8" aria-hidden="true" />
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleLogoChange}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            {isPending && <Spinner />}
            {t("settings.business.uploadLogo")}
          </Button>
          <Typography affects={["muted", "tiny"]}>{t("settings.business.logoHelp")}</Typography>
        </div>
      </div>
    </section>
  )
}

function getErrorMessage(data: unknown, fallback: string): string {
  if (typeof data !== "object" || data === null || !("error" in data)) return fallback

  return String(data.error)
}

export { LogoSection }
