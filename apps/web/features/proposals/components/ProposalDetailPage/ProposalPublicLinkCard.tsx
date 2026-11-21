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

import { revokeProposalPublicLink, rotateProposalPublicLink } from "../../publicLink"
import { type PublicLinkState } from "../../types"

type ProposalPublicLinkCardProps = {
  proposalId: string
  publicPath: string | null
  publicLinkState: PublicLinkState
}

const ProposalPublicLinkCard = ({
  proposalId,
  publicPath,
  publicLinkState
}: ProposalPublicLinkCardProps) => {
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
      const result = await rotateProposalPublicLink({ id: proposalId })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      toast.success(t("proposals.detail.linkRotated"))

      setRotateOpen(false)

      router.refresh()
    })
  }

  const onConfirmRevoke = () => {
    if (isBusy) return

    startRevoking(async () => {
      const result = await revokeProposalPublicLink({ id: proposalId })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      toast.success(t("proposals.detail.linkRevoked"))

      setRevokeOpen(false)

      router.refresh()
    })
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("proposals.detail.publicLinkTitle")}</CardTitle>
        <CardDescription>{t("proposals.detail.publicLinkDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {publicPath ? (
          <CopyLinkField
            path={publicPath}
            label={t("proposals.detail.publicLinkTitle")}
            copyLabel={t("proposals.detail.copyLink")}
            copiedLabel={t("proposals.detail.linkCopied")}
          />
        ) : null}
        {publicLinkState === "revoked" ? (
          <div className="flex flex-col gap-2">
            <Badge variant="secondary" className="w-fit">
              <Icon name="Link2Off" aria-hidden="true" />
              {t("proposals.detail.publicLinkRevoked")}
            </Badge>
            <Typography variant="p" affects={["muted", "small", "removePMargin"]}>
              {t("proposals.detail.publicLinkRevokedDescription")}
            </Typography>
          </div>
        ) : null}
        {publicLinkState === "unissued" ? (
          <Typography variant="p" affects={["muted", "small", "removePMargin"]}>
            {t("proposals.detail.publicLinkHidden")}
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
                ? t("proposals.detail.rotateLink")
                : t("proposals.detail.issueNewLink")}
            </Button>
            {publicLinkState === "live" ? (
              <Button
                type="button"
                variant="outline"
                disabled={isBusy}
                onClick={() => setRevokeOpen(true)}
              >
                {t("proposals.detail.revokeLink")}
              </Button>
            ) : null}
          </div>
        )}
      </CardContent>
      <ConfirmDialog
        open={rotateOpen}
        title={t("proposals.detail.rotateLinkTitle")}
        description={t("proposals.detail.rotateLinkDescription")}
        confirmLabel={t("proposals.detail.rotateLinkConfirm")}
        cancelLabel={t("common.actions.cancel")}
        isPending={isRotating}
        onOpenChange={setRotateOpen}
        onConfirm={onConfirmRotate}
      />
      <ConfirmDialog
        open={revokeOpen}
        title={t("proposals.detail.revokeLinkTitle")}
        description={t("proposals.detail.revokeLinkDescription")}
        confirmLabel={t("proposals.detail.revokeLinkConfirm")}
        cancelLabel={t("common.actions.cancel")}
        isPending={isRevoking}
        variant="destructive"
        onOpenChange={setRevokeOpen}
        onConfirm={onConfirmRevoke}
      />
    </Card>
  )
}

export { ProposalPublicLinkCard }
