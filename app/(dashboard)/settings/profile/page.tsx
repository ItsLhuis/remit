import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { type Metadata } from "next"

import { auth } from "@/lib/auth"

import { ProfileSettingsPage } from "@/features/settings/profile/components"

export const metadata: Metadata = {
  title: "Profile — Settings"
}

const ProfilePage = async () => {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) redirect("/login")

  return <ProfileSettingsPage user={session.user} />
}

export default ProfilePage
