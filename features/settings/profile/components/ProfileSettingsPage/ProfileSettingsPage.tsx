"use client"

import { type User } from "@/lib/auth"

import { Separator, SidebarTrigger, Typography } from "@/components/ui"

import { AccountDetailsSection } from "./AccountDetailsSection"
import { AvatarSection } from "./AvatarSection"
import { LogoutSection } from "./LogoutSection"

type ProfileSettingsPageProps = {
  user: User
  emailConfigured: boolean
}

const ProfileSettingsPage = ({ user, emailConfigured }: ProfileSettingsPageProps) => (
  <div className="flex flex-col gap-8 p-4 md:p-8">
    <header className="flex items-center gap-2">
      <SidebarTrigger className="md:hidden" />
      <Typography variant="h2">Profile</Typography>
    </header>
    <div className="space-y-8">
      <AvatarSection user={user} />
      <Separator />
      <AccountDetailsSection user={user} emailConfigured={emailConfigured} />
      <Separator />
      <LogoutSection />
    </div>
  </div>
)

export { ProfileSettingsPage }
