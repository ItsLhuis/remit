import { SidebarTrigger, Typography } from "@/components/ui"

const EmailSettingsPage = () => {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <header className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        <Typography variant="h2">Email</Typography>
      </header>
    </div>
  )
}

export { EmailSettingsPage }
