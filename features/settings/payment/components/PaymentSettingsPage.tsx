import { SidebarTrigger, Typography } from "@/components/ui"

const PaymentSettingsPage = () => {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <header className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        <Typography variant="h2">Payment</Typography>
      </header>
    </div>
  )
}

export { PaymentSettingsPage }
