"use client"

import { useCallback, useRef, useState } from "react"

import { useTranslation } from "@/lib/i18n"

export { IMAGE_UPLOAD_MAX_BYTES, IMAGE_UPLOAD_MIME_TYPES } from "@/lib/storage"

// The `/api/upload/[type]` variants, restated here rather than imported from the route for the same
// reason `app/api/upload/[type]/route.ts` restates the expense constants instead of importing them:
// that module reaches `@/database` and `@/lib/auth` through its own graph, and this hook runs in the
// browser. A value added there and not here fails to compile at the call site, which is the loud
// half of the tradeoff.
export type FileUploadType =
  | "attachment"
  | "avatar"
  | "business-logo"
  | "client-image"
  | "expense-receipt"
  | "template-image"

// What the caller persists. The file itself never travels through a server action: it is PUT
// straight to storage against a key the presign route mints, and only this metadata goes on to the
// action, which re-validates all four fields at the trust boundary.
export type FileUploadResult = {
  objectKey: string
  filename: string
  mimeType: string
  sizeBytes: number
}

export type FileUploadItem = {
  id: string
  filename: string
  sizeBytes: number
  mimeType: string
  status: "uploading" | "done" | "error"
  progress: number
  error: string | null
  result: FileUploadResult | null
}

export type UseFileUploadOptions = {
  type: FileUploadType
  maxBytes: number
  mimeTypes: readonly string[]
  onUploaded?: (result: FileUploadResult) => void | Promise<void>
}

type PresignResponse = {
  uploadUrl: string
  objectKey: string
}

function toErrorMessage(body: unknown, fallback: string): string {
  if (typeof body !== "object" || body === null || !("error" in body)) return fallback

  const message = (body as { error: unknown }).error

  return typeof message === "string" && message.length > 0 ? message : fallback
}

// `fetch` cannot report upload progress — its `ReadableStream` request bodies are download-side
// only — so the PUT goes through XMLHttpRequest, which is the sole browser API that fires
// `upload.progress`. Resolves false rather than rejecting: a failed PUT is an ordinary per-file
// outcome the caller renders, not an exception.
function putWithProgress(
  url: string,
  file: File,
  onProgress: (progress: number) => void
): Promise<boolean> {
  return new Promise((resolve) => {
    const request = new XMLHttpRequest()

    request.open("PUT", url)
    request.setRequestHeader("Content-Type", file.type)

    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    })

    request.addEventListener("load", () => resolve(request.status >= 200 && request.status < 300))
    request.addEventListener("error", () => resolve(false))
    request.addEventListener("abort", () => resolve(false))

    request.send(file)
  })
}

export function useFileUpload(options: UseFileUploadOptions) {
  const { t } = useTranslation()

  const [items, setItems] = useState<FileUploadItem[]>([])
  const [isUploading, setIsUploading] = useState(false)

  // Monotonic rather than `crypto.randomUUID()`: the id only has to be stable across the renders of
  // one batch, and a counter keeps the hook usable in a test environment with no WebCrypto.
  const nextItemId = useRef(0)

  const patchItem = useCallback((id: string, patch: Partial<FileUploadItem>) => {
    setItems((previous) => previous.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }, [])

  const reset = useCallback(() => {
    setItems([])
  }, [])

  const dismiss = useCallback((id: string) => {
    setItems((previous) => previous.filter((item) => item.id !== id))
  }, [])

  const upload = useCallback(
    async (files: readonly File[]): Promise<FileUploadResult[]> => {
      if (files.length === 0) return []

      const queued = files.map((file) => {
        const id = `upload-${(nextItemId.current += 1)}`

        return {
          id,
          file,
          item: {
            id,
            filename: file.name,
            sizeBytes: file.size,
            mimeType: file.type,
            status: "uploading" as const,
            progress: 0,
            error: null,
            result: null
          }
        }
      })

      setItems((previous) => [...previous, ...queued.map((entry) => entry.item)])
      setIsUploading(true)

      const uploaded: FileUploadResult[] = []

      // The loop is wrapped only so `isUploading` is released whatever happens: the flag disables the
      // drop target, and a caller's `onUploaded` throwing would otherwise leave it stuck on for the
      // life of the page.
      try {
        // Sequential, not `Promise.all`: a batch of large files opening one PUT each saturates the
        // connection and makes every progress bar move at once and finish nowhere. One at a time also
        // means a mid-batch failure leaves the earlier files genuinely stored.
        for (const entry of queued) {
          const { file, id } = entry

          if (!options.mimeTypes.includes(file.type)) {
            patchItem(id, { status: "error", error: t("fileUpload.errors.invalidType") })
            continue
          }

          if (file.size > options.maxBytes) {
            patchItem(id, { status: "error", error: t("fileUpload.errors.tooLarge") })
            continue
          }

          const presignResponse = await fetch(`/api/upload/${options.type}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filename: file.name,
              contentType: file.type,
              sizeBytes: file.size
            })
          }).catch(() => null)

          if (!presignResponse?.ok) {
            const body: unknown = (await presignResponse?.json().catch(() => null)) ?? null

            patchItem(id, {
              status: "error",
              error: toErrorMessage(body, t("fileUpload.errors.presignFailed"))
            })
            continue
          }

          const presigned = (await presignResponse.json()) as PresignResponse

          const succeeded = await putWithProgress(presigned.uploadUrl, file, (progress) =>
            patchItem(id, { progress })
          )

          if (!succeeded) {
            patchItem(id, { status: "error", error: t("fileUpload.errors.uploadFailed") })
            continue
          }

          const result: FileUploadResult = {
            objectKey: presigned.objectKey,
            filename: file.name,
            mimeType: file.type,
            sizeBytes: file.size
          }

          patchItem(id, { status: "done", progress: 100, result })
          uploaded.push(result)

          // Awaited inside the loop so the caller's persistence for one file finishes before the next
          // PUT starts. A caller that throws here leaves the object stored with nothing pointing at
          // it, which is the orphan case ADR-0028 accepts rather than sweeps.
          await options.onUploaded?.(result)
        }
      } finally {
        setIsUploading(false)
      }

      return uploaded
    },
    [options, patchItem, t]
  )

  return { items, isUploading, upload, reset, dismiss }
}
