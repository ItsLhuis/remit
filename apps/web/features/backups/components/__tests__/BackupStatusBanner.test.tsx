import { cleanup, render, screen } from "@testing-library/react"

import { afterEach, expect, test, vi } from "vitest"

import { formatDate } from "@/lib/utils"

import { type BackupBanner } from "../../types"
import { BackupStatusBanner } from "../BackupStatusBanner"

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, params?: { date?: string }) => (params?.date ? `${key} ${params.date}` : key),
    i18n: {},
    ready: true,
    locales: {}
  })
}))

const lastSuccessAt = new Date("2026-09-28T01:30:00.000Z")
const lastFailureAt = new Date("2026-10-04T01:30:00.000Z")

function makeBanner(overrides: Partial<BackupBanner>): BackupBanner {
  return {
    state: "overdue",
    lastFailureReason: null,
    lastFailureAt: null,
    lastSuccessAt,
    locale: "en-GB",
    timeZone: "Europe/Lisbon",
    ...overrides
  }
}

function instanceDate(date: Date): string {
  return formatDate(date, { locale: "en-GB", timeZone: "Europe/Lisbon" })
}

afterEach(() => {
  cleanup()
})

test("states when the last backup succeeded when backups are overdue", () => {
  render(<BackupStatusBanner banner={makeBanner({ state: "overdue" })} />)

  expect(
    screen.getByText(`backups.banner.lastSuccessAt ${instanceDate(lastSuccessAt)}`)
  ).toBeInTheDocument()
})

test("states when the last run failed and when the last one succeeded", () => {
  render(
    <BackupStatusBanner
      banner={makeBanner({
        state: "lastRunFailed",
        lastFailureAt,
        lastFailureReason: "Bucket gone"
      })}
    />
  )

  expect(
    screen.getByText(
      `backups.banner.lastFailureAt ${instanceDate(lastFailureAt)} backups.banner.lastSuccessAt ${instanceDate(lastSuccessAt)}`
    )
  ).toBeInTheDocument()
})

test("says no backup has completed when none ever has", () => {
  render(<BackupStatusBanner banner={makeBanner({ state: "overdue", lastSuccessAt: null })} />)

  expect(screen.getByText("backups.banner.lastSuccessNever")).toBeInTheDocument()
})
