"use client"

import { useTranslation } from "@/lib/i18n"

import { Typography } from "@/components/ui"

import { type ClientPortal } from "../../types"

import { PortalContractsCard } from "./PortalContractsCard"
import { PortalInvoicesCard } from "./PortalInvoicesCard"
import { PortalProjectsCard } from "./PortalProjectsCard"
import { PortalProposalsCard } from "./PortalProposalsCard"

type PublicClientPortalPageProps = {
  portal: ClientPortal
}

const PublicClientPortalPage = ({ portal }: PublicClientPortalPageProps) => {
  const { t } = useTranslation()

  const { locale } = portal

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:gap-8 md:p-8">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Typography affects={["muted", "small"]}>{t("clients.public.fromLabel")}</Typography>
          <Typography affects="medium">{portal.issuer.name}</Typography>
        </div>
        <Typography variant="h2">{portal.clientName}</Typography>
        <Typography variant="p" affects={["muted", "removePMargin"]}>
          {t("clients.public.intro")}
        </Typography>
      </header>
      <PortalInvoicesCard
        invoices={portal.invoices}
        outstanding={portal.outstanding}
        locale={locale}
      />
      <PortalProposalsCard proposals={portal.proposals} locale={locale} />
      <PortalContractsCard contracts={portal.contracts} locale={locale} />
      <PortalProjectsCard projects={portal.projects} locale={locale} />
      {portal.issuer.email ? (
        <footer className="flex flex-col gap-1">
          <Typography affects={["muted", "small"]}>{t("clients.public.contactLabel")}</Typography>
          <Typography affects={["small", "medium"]}>{portal.issuer.email}</Typography>
        </footer>
      ) : null}
    </main>
  )
}

export { PublicClientPortalPage }
