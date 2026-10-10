"use client"

import { useTranslation } from "@/lib/i18n"

import { formatDay } from "@/lib/utils"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui"

import { ContractStatusBadge } from "@/features/contracts"

import { type ClientPortalList, type ClientPortalContract } from "../../types"

import { PortalDocumentRow } from "./PortalDocumentRow"
import { PortalPager } from "./PortalPager"
import { PortalSectionEmpty } from "./PortalSectionEmpty"

type PortalContractsCardProps = {
  contracts: ClientPortalList<ClientPortalContract>
  locale: string
}

const PortalContractsCard = ({ contracts, locale }: PortalContractsCardProps) => {
  const { t } = useTranslation()

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("clients.public.contracts.title")}</CardTitle>
        <CardDescription>{t("clients.public.contracts.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {contracts.items.length === 0 ? (
          <PortalSectionEmpty
            icon="FileSignature"
            title={t("clients.public.contracts.emptyTitle")}
            description={t("clients.public.contracts.emptyDescription")}
          />
        ) : (
          <ul className="flex flex-col">
            {contracts.items.map((contract) => (
              <PortalDocumentRow
                key={contract.number}
                number={contract.number}
                title={contract.title}
                status={<ContractStatusBadge status={contract.status} />}
                meta={
                  contract.effectiveFrom
                    ? t("clients.public.contracts.effectiveFrom", {
                        date: formatDay(contract.effectiveFrom, locale)
                      })
                    : t("clients.public.contracts.noEffectiveFrom")
                }
                amount={null}
                link={null}
              />
            ))}
          </ul>
        )}
        <PortalPager
          section="contracts"
          page={contracts.page}
          pageCount={contracts.pageCount}
          label={t("clients.public.pager.label", { section: t("clients.public.contracts.title") })}
        />
      </CardContent>
    </Card>
  )
}

export { PortalContractsCard }
