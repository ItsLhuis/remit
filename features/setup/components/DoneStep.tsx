"use client"

import { useRouter } from "next/navigation"

import Image from "next/image"

import { Button, Typography } from "@/components/ui"

const DoneStep = () => {
  const router = useRouter()

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center text-center">
        <Image src="/logo.png" alt="Remit logo" width={64} height={64} className="mb-4" />
        <Typography variant="h2" className="mb-2">
          You&apos;re all set
        </Typography>
        <Typography variant="p" affects={["muted", "removePMargin"]}>
          Remit is ready. Start by adding your first client.
        </Typography>
      </div>
      <Button size="lg" className="w-full" onClick={() => router.push("/")}>
        Go to dashboard
      </Button>
    </div>
  )
}

export { DoneStep }
