"use client"

import { useState } from "react"

import { useTranslation } from "@/lib/i18n"

import { Typography } from "@/components/ui"

import { type PublicContract } from "../../types"
import { ContractStatusBadge } from "../ContractStatusBadge"

import { PublicContractDocument } from "./PublicContractDocument"
import { PublicContractSigned } from "./PublicContractSigned"
import { PublicContractSignForm } from "./PublicContractSignForm"
import { PublicContractSummary } from "./PublicContractSummary"

type PublicContractPageProps = {
  contract: PublicContract
  token: string
}

const PublicContractPage = ({ contract, token }: PublicContractPageProps) => {
  const { t } = useTranslation()

  const [signedAt, setSignedAt] = useState<Date | null>(null)

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:gap-8 md:p-8">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Typography affects={["muted", "small"]}>{t("contracts.public.fromLabel")}</Typography>
          <Typography affects="medium">{contract.issuer.name}</Typography>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Typography variant="h2" className="font-mono">
            {contract.number}
          </Typography>
          <ContractStatusBadge status={signedAt ? "signed" : contract.status} />
        </div>
        <Typography variant="p" affects={["muted", "removePMargin"]}>
          {contract.clientName
            ? t("contracts.public.preparedFor", { client: contract.clientName })
            : contract.title}
        </Typography>
      </header>
      <div className="grid gap-6 lg:grid-cols-3">
        {/* `min-w-0` is load-bearing: a grid item defaults to `min-width: auto`, so without it the
        fixed-width document widens this column to its content and pushes the whole page sideways on
        a phone instead of scrolling inside its own container. */}
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          <PublicContractDocument document={contract.document} number={contract.number} />
          {signedAt ? (
            <PublicContractSigned
              signedAt={signedAt}
              locale={contract.locale}
              timeZone={contract.timeZone}
            />
          ) : (
            <PublicContractSignForm
              token={token}
              consentText={contract.consentText}
              onSigned={setSignedAt}
            />
          )}
        </div>
        <PublicContractSummary contract={contract} />
      </div>
    </main>
  )
}

export { PublicContractPage }
