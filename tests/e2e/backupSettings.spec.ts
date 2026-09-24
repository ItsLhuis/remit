import { expect, test } from "@playwright/test"

import {
  isPgDumpAvailable,
  listBackupArchives,
  removeBackupArchives,
  restoreBackupSettings,
  runBackupCommand,
  setBackupState,
  snapshotLocalBackupSettings
} from "./support/backupFixture"
import { addOwnerSessionCookie } from "./support/ownerSession"
import { clickUntilVisible, openRoute } from "./support/pageReadiness"

let snapshot: Awaited<ReturnType<typeof snapshotLocalBackupSettings>> = null
let archivesBefore: string[] = []

test.beforeAll(async () => {
  snapshot = await snapshotLocalBackupSettings()
  archivesBefore = (await listBackupArchives()).map((archive) => archive.name)
})

// Puts the configuration and the status columns back and removes the archive this spec took, so a
// development instance is left as it was found rather than reporting a backup whose file is gone.
test.afterAll(async () => {
  if (!snapshot) return

  const created = (await listBackupArchives()).filter(
    (archive) => !archivesBefore.includes(archive.name)
  )

  await removeBackupArchives(created)
  await restoreBackupSettings(snapshot)
})

test("configures a local backup on its settings page, takes one, and shows it as the last success", async ({
  page,
  baseURL
}) => {
  if (!baseURL) throw new Error("Playwright baseURL is required for this flow")

  test.skip(
    !snapshot,
    "This flow rewrites the backup configuration, so it runs only on an instance that backs up to local disk."
  )
  test.skip(
    !isPgDumpAvailable(),
    "A backup runs pg_dump, which is not on this host's PATH; the e2e workflow installs the PostgreSQL client."
  )

  if (!snapshot) throw new Error("unreachable: skipped above")

  const cadence = snapshot.backupCadence === "daily" ? "Weekly" : "Daily"

  await setBackupState(snapshot, { backupLastSuccessAt: null })

  await addOwnerSessionCookie(page.context(), baseURL)

  await openRoute(page, "/settings/backup", "Backups")

  await expect(page.getByText("No backup has completed on this instance yet")).toBeVisible()

  const localDisk = page.getByRole("option", { name: "Local disk" })

  await clickUntilVisible(page.getByLabel("Destination", { exact: true }), localDisk)
  await localDisk.click()

  const cadenceOption = page.getByRole("option", { name: cadence })

  await clickUntilVisible(page.getByLabel("Cadence", { exact: true }), cadenceOption)
  await cadenceOption.click()
  await page.getByRole("button", { name: "Save", exact: true }).click()

  await expect(page.getByText("Backup settings saved")).toBeVisible()

  await page.getByRole("button", { name: "Test destination" }).click()

  await expect(page.getByText("Destination accepted a test write")).toBeVisible()
  await expect(page.getByText(/^Destination last verified /)).toBeVisible()

  await runBackupCommand()

  await page.reload()

  await expect(page.getByText(/^Last successful backup /)).toBeVisible()
  await expect(page.getByText("No backup has completed on this instance yet")).toHaveCount(0)
  await expect(page.getByLabel("Destination", { exact: true })).toHaveText("Local disk")
  await expect(page.getByLabel("Cadence", { exact: true })).toHaveText(cadence)

  const created = (await listBackupArchives()).filter(
    (archive) => !archivesBefore.includes(archive.name)
  )

  expect(created).toHaveLength(1)
  expect(created[0]?.size).toBeGreaterThan(0)
})
