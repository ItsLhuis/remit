import { Icon, type IconProps, SidebarTrigger, Typography } from "@/components/ui"

type SettingsPageHeaderProps = {
  title: string
  description: string
  icon: IconProps["name"]
}

const SettingsPageHeader = ({ title, description, icon }: SettingsPageHeaderProps) => (
  <header className="space-y-1">
    <div className="flex items-center gap-3">
      <SidebarTrigger className="md:hidden" />
      <Icon name={icon} className="text-muted-foreground size-6 shrink-0" aria-hidden="true" />
      <Typography variant="h2">{title}</Typography>
    </div>
    <Typography variant="p" affects={["muted", "removePMargin"]}>
      {description}
    </Typography>
  </header>
)

export { SettingsPageHeader }
