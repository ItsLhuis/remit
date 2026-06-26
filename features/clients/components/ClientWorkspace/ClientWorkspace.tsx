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
  formatDay,
  getInitials,
  isSafeHttpUrl
} from "@/lib/utils"

import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Icon,
  IconButton,
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

import { ClientProjectsPanel, type ProjectListItem } from "@/features/projects"

import { softDeleteClient } from "../../mutations"
import { formatLocation } from "../../services"
import { type ClientDetail, type ClientFormData } from "../../types"
import { ClientFormSheet } from "../ClientFormSheet"
import { ClientHealthBadge } from "../ClientHealthBadge"
import { DeleteClientDialog } from "../DeleteClientDialog"

import { ContactRow } from "./ContactRow"
import { DetailGroup } from "./DetailGroup"
import { TeachingEmpty } from "./TeachingEmpty"

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
  formData: ClientFormData
  locale: string
}

const ClientWorkspace = ({ client, projects, formData, locale }: ClientWorkspaceProps) => {
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
          <Card className="gap-0 py-0 lg:sticky lg:top-8">
            <div className="flex flex-col items-center gap-3 p-6 text-center">
              <Avatar className="size-16">
                <AvatarFallback className="text-lg">{getInitials(client.name)}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-center gap-2">
                <Typography variant="h2" className="text-2xl text-balance">
                  {client.name}
                </Typography>
                {client.deletedAt ? (
                  <Badge variant="outline">{t("clients.status.deleted")}</Badge>
                ) : (
                  <ClientHealthBadge health={client.health} />
                )}
              </div>
              <Typography affects={["muted", "small"]}>
                {t("clients.detail.since", { date: formatDay(client.createdAt, locale) })}
              </Typography>
            </div>
            <div className="flex items-center gap-2 px-4 pb-4">
              <Button asChild variant="outline" size="sm" className="flex-1">
                <a href={`mailto:${client.email}`}>
                  <Icon name="Mail" aria-hidden="true" />
                  {t("clients.detail.quick.email")}
                </a>
              </Button>
              <Button size="sm" className="flex-1" onClick={() => setEditOpen(true)}>
                <Icon name="Pencil" aria-hidden="true" />
                {t("clients.actions.edit")}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <IconButton variant="outline" size="icon-sm" label={t("clients.list.actions")}>
                    <Icon name="EllipsisVertical" />
                  </IconButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onSelect={() => void onCopyEmail()}>
                    <Icon name="Copy" aria-hidden="true" />
                    {t("clients.list.copyEmail")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                    <Icon name="Trash2" aria-hidden="true" />
                    {t("clients.actions.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Separator />
            <div className="flex flex-col gap-3 p-4">
              <Typography affects={["muted", "tiny", "uppercase"]}>
                {t("clients.detail.contactTitle")}
              </Typography>
              <dl className="flex flex-col gap-3">
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
                <ContactRow
                  icon="MapPin"
                  label={t("clients.detail.addressTitle")}
                  value={location}
                />
              </dl>
            </div>
            <Separator />
            <div className="flex flex-col gap-3 p-4">
              <Typography affects={["muted", "tiny", "uppercase"]}>
                {t("clients.detail.billingTitle")}
              </Typography>
              <dl className="flex flex-col gap-3">
                <ContactRow
                  icon="Coins"
                  label={t("clients.fields.currency")}
                  value={client.currency}
                  mono
                />
                <ContactRow icon="Receipt" label={t("clients.fields.taxId")} value={client.taxId} />
              </dl>
            </div>
            <CardFooter className="text-muted-foreground mt-auto gap-1.5 px-4 py-3 text-xs">
              <Icon name="Clock" className="size-3.5 shrink-0" aria-hidden="true" />
              <span>
                {t("clients.detail.updatedLabel")} · {formatDay(client.updatedAt, locale)}
              </span>
            </CardFooter>
          </Card>
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
                <TeachingEmpty
                  icon="ReceiptText"
                  title={t("clients.detail.invoicesEmptyTitle")}
                  description={t("clients.detail.invoicesEmptyDescription")}
                />
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
                <TeachingEmpty
                  icon="Activity"
                  title={t("clients.detail.activityEmptyTitle")}
                  description={t("clients.detail.activityEmptyDescription")}
                />
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
