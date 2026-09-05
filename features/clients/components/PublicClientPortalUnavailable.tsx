"use client"

import { useTranslation } from "@/lib/i18n"

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle, Icon } from "@/components/ui"

// The single surface behind every dead-end on `/s/[token]`: an unknown token, a portal that was
// never enabled, one that was revoked, an archived client, a tripped rate limit and a server fault
// all render exactly this. Adding a case-specific message here would undo the whole point — see
// `getClientPortal`.
const PublicClientPortalUnavailable = () => {
  const { t } = useTranslation()

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Empty className="ring-foreground/10 max-w-md rounded-xl ring-1">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon name="Link2Off" aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t("clients.public.unavailable.title")}</EmptyTitle>
          <EmptyDescription>{t("clients.public.unavailable.description")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </main>
  )
}

export { PublicClientPortalUnavailable }
