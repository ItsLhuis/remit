"use client"

import { useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import dynamic from "next/dynamic"
import Link from "next/link"

import { useTranslation } from "@/lib/i18n"

import {
  formatCompactCurrency,
  formatCompactNumber,
  formatCurrency,
  isSafeHttpUrl
} from "@/lib/utils"

import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Icon,
  ScrollArea,
  Separator,
  SidebarTrigger,
  StatCard,
  StatValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Typography,
  toast
} from "@/components/ui"

import { EntityActivityTimeline, type EntityActivityPanelData } from "@/features/activityLog"

import { AttachmentsPanel, type AttachmentListItem } from "@/features/attachments"

import { ClientInvoicesPanel, type InvoiceListItem } from "@/features/invoices"

import { ClientProjectsPanel, type ProjectListItem } from "@/features/projects"

import { softDeleteClient } from "../../mutations"
import { formatLocation } from "../../services"
import { type ClientContact, type ClientDetail, type ClientFormData } from "../../types"
import { ClientContactsPanel } from "../ClientContactsPanel"
import { ClientFormSheet } from "../ClientFormSheet"
import { DeleteClientDialog } from "../DeleteClientDialog"

import { ClientImageSection } from "./ClientImageSection"
import { ClientPortalCard } from "./ClientPortalCard"
import { ClientSummaryCard } from "./ClientSummaryCard"
import { ContactRow } from "./ContactRow"
import { DetailGroup } from "./DetailGroup"

const BilledAreaChart = dynamic(() => import("./charts").then((m) => m.BilledAreaChart), {
  ssr: false
})
const InvoiceBarChart = dynamic(() => import("./charts").then((m) => m.InvoiceBarChart), {
  ssr: false
})
const ProjectBarChart = dynamic(() => import("./charts").then((m) => m.ProjectBarChart), {
  ssr: false
})
const RecurringBarChart = dynamic(() => import("./charts").then((m) => m.RecurringBarChart), {
  ssr: false
})

type ClientWorkspaceProps = {
  client: ClientDetail
  projects: ProjectListItem[]
  invoices: InvoiceListItem[]
  contacts: ClientContact[]
  activity: EntityActivityPanelData
  attachments: AttachmentListItem[]
  canWriteAttachments: boolean
  formData: ClientFormData
  locale: string
}

const ClientWorkspace = ({
  client,
  projects,
  invoices,
  contacts,
  activity,
  attachments,
  canWriteAttachments,
  formData,
  locale
}: ClientWorkspaceProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, startDelete] = useTransition()

  const onDelete = () => {
    if (isDeleting) return

    startDelete(async () => {
      const result = await softDeleteClient({ id: client.id })

      if ("error" in result) {
        toast.error(result.error)

        return
      }

      toast.success(t("clients.delete.deleted"))

      setDeleteOpen(false)

      router.push("/clients")

      router.refresh()
    })
  }

  const onCopyEmail = async () => {
    await navigator.clipboard.writeText(client.email)

    toast.success(t("clients.list.emailCopied"))
  }

  const outstandingContextKey =
    client.health === "owing"
      ? "clients.detail.outstandingOwing"
      : client.health === "settled"
        ? "clients.detail.outstandingSettled"
        : "clients.detail.outstandingDormant"

  const location = formatLocation(client)

  const websiteHref = client.website && isSafeHttpUrl(client.website) ? client.website : undefined

  return (
    <ScrollArea className="size-full">
      <div className="flex w-full flex-col gap-6 p-4 md:p-8">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="md:hidden" />
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link href="/clients">
              <Icon name="ArrowLeft" aria-hidden="true" />
              {t("clients.detail.backToClients")}
            </Link>
          </Button>
        </div>
        <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
          <div className="flex flex-col gap-6">
            <ClientSummaryCard
              client={client}
              locale={locale}
              location={location}
              websiteHref={websiteHref}
              onEdit={() => setEditOpen(true)}
              onCopyEmail={onCopyEmail}
              onRequestDelete={() => setDeleteOpen(true)}
            />
            <ClientPortalCard clientId={client.id} portalPath={client.portalPath} />
          </div>
          <div className="flex min-w-0 flex-col gap-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard icon="Wallet" label={t("clients.detail.outstandingLabel")}>
                <StatValue
                  value={formatCompactCurrency(
                    client.outstandingBalanceCents,
                    client.currency,
                    locale
                  )}
                  title={formatCurrency(client.outstandingBalanceCents, client.currency, locale)}
                  hint={t(outstandingContextKey)}
                  mono
                />
                <BilledAreaChart
                  data={client.billingTrend}
                  locale={locale}
                  currency={client.currency}
                  label={t("clients.detail.trendBilledLabel")}
                  emptyLabel={t("clients.detail.trendEmpty")}
                />
              </StatCard>
              <StatCard icon="ReceiptText" label={t("clients.detail.statInvoices")}>
                <StatValue
                  value={formatCompactNumber(client.relatedResources.invoices, locale)}
                  title={String(client.relatedResources.invoices)}
                  hint={t("clients.detail.statInvoicesHint")}
                />
                <InvoiceBarChart
                  data={client.billingTrend}
                  locale={locale}
                  label={t("clients.detail.statInvoices")}
                  emptyLabel={t("clients.detail.trendEmpty")}
                />
              </StatCard>
              <StatCard icon="FolderKanban" label={t("clients.detail.statProjects")}>
                <StatValue
                  value={formatCompactNumber(client.relatedResources.projects, locale)}
                  title={String(client.relatedResources.projects)}
                  hint={t("clients.detail.statProjectsHint")}
                />
                <ProjectBarChart
                  data={client.billingTrend}
                  locale={locale}
                  label={t("clients.detail.trendProjectsLabel")}
                  emptyLabel={t("clients.detail.trendEmpty")}
                />
              </StatCard>
              <StatCard icon="Repeat" label={t("clients.detail.statRecurring")}>
                <StatValue
                  value={formatCompactNumber(client.relatedResources.recurringInvoices, locale)}
                  title={String(client.relatedResources.recurringInvoices)}
                  hint={t("clients.detail.statRecurringHint")}
                />
                <RecurringBarChart
                  data={client.billingTrend}
                  locale={locale}
                  label={t("clients.detail.trendRecurringLabel")}
                  emptyLabel={t("clients.detail.trendEmpty")}
                />
              </StatCard>
            </div>
            <Tabs defaultValue="overview" className="gap-6">
              <TabsList variant="line" className="bg-background sticky top-0 z-10 w-full">
                <TabsTrigger value="overview">{t("clients.detail.tabs.overview")}</TabsTrigger>
                <TabsTrigger value="financials">{t("clients.detail.tabs.financials")}</TabsTrigger>
                <TabsTrigger value="projects">{t("clients.detail.tabs.projects")}</TabsTrigger>
                <TabsTrigger value="activity">{t("clients.detail.tabs.activity")}</TabsTrigger>
                <TabsTrigger value="contacts">{t("clients.detail.tabs.contacts")}</TabsTrigger>
                <TabsTrigger value="files">{t("clients.detail.tabs.files")}</TabsTrigger>
                <TabsTrigger value="details">{t("clients.detail.tabs.details")}</TabsTrigger>
              </TabsList>
              <TabsContent value="overview">
                <Card size="sm">
                  <CardHeader>
                    <CardTitle>{t("clients.detail.notesTitle")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {client.notes ? (
                      <Typography className="whitespace-pre-wrap">{client.notes}</Typography>
                    ) : (
                      <Typography affects={["muted", "small"]}>
                        {t("clients.detail.notesEmpty")}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="financials">
                <ClientInvoicesPanel invoices={invoices} locale={locale} />
              </TabsContent>
              <TabsContent value="projects">
                <ClientProjectsPanel
                  clientId={client.id}
                  clientName={client.name}
                  clientCurrency={client.currency}
                  projects={projects}
                  locale={locale}
                />
              </TabsContent>
              <TabsContent value="activity">
                <Card size="sm">
                  <CardHeader>
                    <CardTitle>{t("clients.detail.tabs.activity")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <EntityActivityTimeline data={activity} />
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="contacts">
                <ClientContactsPanel
                  clientId={client.id}
                  clientEmail={client.email}
                  contacts={contacts}
                />
              </TabsContent>
              <TabsContent value="files">
                <div className="flex flex-col gap-8">
                  <ClientImageSection
                    clientId={client.id}
                    clientName={client.name}
                    imageStorageKey={client.imageStorageKey}
                    locale={locale}
                    canWrite={canWriteAttachments}
                  />
                  <Separator />
                  <AttachmentsPanel
                    parent={{ parentType: "client", parentId: client.id }}
                    attachments={attachments}
                    locale={locale}
                    canWrite={canWriteAttachments}
                  />
                </div>
              </TabsContent>
              <TabsContent value="details">
                <Card size="sm" className="gap-0 py-0">
                  <DetailGroup title={t("clients.detail.contactTitle")}>
                    <ContactRow icon="User" label={t("clients.fields.name")} value={client.name} />
                    <ContactRow
                      icon="Mail"
                      label={t("clients.fields.email")}
                      value={client.email}
                      href={`mailto:${client.email}`}
                    />
                    <ContactRow
                      icon="Phone"
                      label={t("clients.fields.phone")}
                      value={client.phone}
                      href={client.phone ? `tel:${client.phone}` : undefined}
                    />
                    <ContactRow
                      icon="Globe"
                      label={t("clients.fields.website")}
                      value={client.website}
                      href={websiteHref}
                      external
                    />
                  </DetailGroup>
                  <Separator />
                  <DetailGroup title={t("clients.detail.billingTitle")}>
                    <ContactRow
                      icon="Coins"
                      label={t("clients.fields.currency")}
                      value={client.currency}
                      mono
                    />
                    <ContactRow
                      icon="Receipt"
                      label={t("clients.fields.taxId")}
                      value={client.taxId}
                    />
                  </DetailGroup>
                  <Separator />
                  <DetailGroup title={t("clients.detail.addressTitle")}>
                    <ContactRow
                      icon="MapPin"
                      label={t("clients.fields.addressLine1")}
                      value={client.address.line1}
                    />
                    <ContactRow
                      icon="MapPin"
                      label={t("clients.fields.addressLine2")}
                      value={client.address.line2}
                    />
                    <ContactRow
                      icon="Building2"
                      label={t("clients.fields.city")}
                      value={client.address.city}
                    />
                    <ContactRow
                      icon="Map"
                      label={t("clients.fields.state")}
                      value={client.address.state}
                    />
                    <ContactRow
                      icon="Mailbox"
                      label={t("clients.fields.postalCode")}
                      value={client.address.postalCode}
                    />
                    <ContactRow
                      icon="Flag"
                      label={t("clients.fields.country")}
                      value={client.address.country}
                    />
                  </DetailGroup>
                  <CardFooter className="px-4 py-3">
                    <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                      <Icon name="Pencil" aria-hidden="true" />
                      {t("clients.detail.editDetails")}
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
      <ClientFormSheet
        mode="edit"
        client={formData}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={() => router.refresh()}
      />
      <DeleteClientDialog
        clientName={client.name}
        open={deleteOpen}
        isDeleting={isDeleting}
        onOpenChange={(open) => {
          if (!isDeleting) setDeleteOpen(open)
        }}
        onConfirm={onDelete}
      />
    </ScrollArea>
  )
}

export { ClientWorkspace }
