"use client"

import { useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { useTranslation } from "@/lib/i18n"

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  CopyLinkField,
  Icon,
  Typography,
  toast
} from "@/components/ui"

import { revokeContractPublicLink, rotateContractPublicLink } from "../../publicLink"
import { type PublicLinkState } from "../../types"

type ContractPublicLinkCardProps = {
  contractId: string
  publicPath: string | null
  publicLinkState: PublicLinkState
}

const ContractPublicLinkCard = ({
  contractId,
  publicPath,
  publicLinkState
}: ContractPublicLinkCardProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [rotateOpen, setRotateOpen] = useState(false)
  const [revokeOpen, setRevokeOpen] = useState(false)
  const [isRotating, startRotating] = useTransition()
  const [isRevoking, startRevoking] = useTransition()

  const isBusy = isRotating || isRevoking

  const onConfirmRotate = () => {
    if (isBusy) return

    startRotating(async () => {
      const result = await rotateContractPublicLink({ id: contractId })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      toast.success(t("contracts.detail.linkRotated"))

      setRotateOpen(false)

      router.refresh()
    })
  }

  const onConfirmRevoke = () => {
    if (isBusy) return

    startRevoking(async () => {
      const result = await revokeContractPublicLink({ id: contractId })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      toast.success(t("contracts.detail.linkRevoked"))

      setRevokeOpen(false)

      router.refresh()
    })
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("contracts.detail.publicLinkTitle")}</CardTitle>
        <CardDescription>{t("contracts.detail.publicLinkDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {publicPath ? (
          <CopyLinkField
            path={publicPath}
            label={t("contracts.detail.publicLinkTitle")}
            copyLabel={t("contracts.detail.copyLink")}
            copiedLabel={t("contracts.detail.linkCopied")}
          />
        ) : null}
        {publicLinkState === "revoked" ? (
          <div className="flex flex-col gap-2">
            <Badge variant="secondary" className="w-fit">
              <Icon name="Link2Off" aria-hidden="true" />
              {t("contracts.detail.publicLinkRevoked")}
            </Badge>
            <Typography variant="p" affects={["muted", "small", "removePMargin"]}>
              {t("contracts.detail.publicLinkRevokedDescription")}
            </Typography>
          </div>
        ) : null}
        {publicLinkState === "unissued" ? (
          <Typography variant="p" affects={["muted", "small", "removePMargin"]}>
            {t("contracts.detail.publicLinkHidden")}
          </Typography>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isBusy}
              onClick={() => setRotateOpen(true)}
            >
              {publicLinkState === "live"
                ? t("contracts.detail.rotateLink")
                : t("contracts.detail.issueNewLink")}
            </Button>
            {publicLinkState === "live" ? (
              <Button
                type="button"
                variant="outline"
                disabled={isBusy}
                onClick={() => setRevokeOpen(true)}
              >
                {t("contracts.detail.revokeLink")}
              </Button>
            ) : null}
          </div>
        )}
      </CardContent>
      <ConfirmDialog
        open={rotateOpen}
        title={t("contracts.detail.rotateLinkTitle")}
        description={t("contracts.detail.rotateLinkDescription")}
        confirmLabel={t("contracts.detail.rotateLinkConfirm")}
        cancelLabel={t("common.actions.cancel")}
        isPending={isRotating}
        onOpenChange={setRotateOpen}
        onConfirm={onConfirmRotate}
      />
      <ConfirmDialog
        open={revokeOpen}
        title={t("contracts.detail.revokeLinkTitle")}
        description={t("contracts.detail.revokeLinkDescription")}
        confirmLabel={t("contracts.detail.revokeLinkConfirm")}
        cancelLabel={t("common.actions.cancel")}
        isPending={isRevoking}
        variant="destructive"
        onOpenChange={setRevokeOpen}
        onConfirm={onConfirmRevoke}
      />
    </Card>
  )
}

export { ContractPublicLinkCard }
