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

import { revokeClientPortalLink, rotateClientPortalLink } from "../../mutations"

type ClientPortalCardProps = {
  clientId: string
  portalPath: string | null
}

const ClientPortalCard = ({ clientId, portalPath }: ClientPortalCardProps) => {
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
      const result = await rotateClientPortalLink({ id: clientId })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      toast.success(portalPath ? t("clients.portal.rotated") : t("clients.portal.enabled"))

      setRotateOpen(false)

      router.refresh()
    })
  }

  const onConfirmRevoke = () => {
    if (isBusy) return

    startRevoking(async () => {
      const result = await revokeClientPortalLink({ id: clientId })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      toast.success(t("clients.portal.disabled"))

      setRevokeOpen(false)

      router.refresh()
    })
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("clients.portal.title")}</CardTitle>
        <CardDescription>{t("clients.portal.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {portalPath ? (
          <CopyLinkField
            path={portalPath}
            label={t("clients.portal.title")}
            copyLabel={t("clients.portal.copyLink")}
            copiedLabel={t("clients.portal.linkCopied")}
          />
        ) : (
          <div className="flex flex-col gap-2">
            <Badge variant="secondary" className="w-fit">
              <Icon name="Link2Off" aria-hidden="true" />
              {t("clients.portal.offBadge")}
            </Badge>
            <Typography variant="p" affects={["muted", "small", "removePMargin"]}>
              {t("clients.portal.offDescription")}
            </Typography>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isBusy}
            onClick={() => setRotateOpen(true)}
          >
            {portalPath ? t("clients.portal.rotate") : t("clients.portal.enable")}
          </Button>
          {portalPath ? (
            <Button
              type="button"
              variant="outline"
              disabled={isBusy}
              onClick={() => setRevokeOpen(true)}
            >
              {t("clients.portal.disable")}
            </Button>
          ) : null}
        </div>
      </CardContent>
      <ConfirmDialog
        open={rotateOpen}
        title={portalPath ? t("clients.portal.rotateTitle") : t("clients.portal.enableTitle")}
        description={
          portalPath ? t("clients.portal.rotateDescription") : t("clients.portal.enableDescription")
        }
        confirmLabel={portalPath ? t("clients.portal.rotate") : t("clients.portal.enable")}
        cancelLabel={t("common.actions.cancel")}
        isPending={isRotating}
        onOpenChange={setRotateOpen}
        onConfirm={onConfirmRotate}
      />
      <ConfirmDialog
        open={revokeOpen}
        title={t("clients.portal.disableTitle")}
        description={t("clients.portal.disableDescription")}
        confirmLabel={t("clients.portal.disable")}
        cancelLabel={t("common.actions.cancel")}
        isPending={isRevoking}
        variant="destructive"
        onOpenChange={setRevokeOpen}
        onConfirm={onConfirmRevoke}
      />
    </Card>
  )
}

export { ClientPortalCard }
