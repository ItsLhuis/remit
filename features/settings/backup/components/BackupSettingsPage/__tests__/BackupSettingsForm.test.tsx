import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { axe } from "vitest-axe"

import { type BackupSettingsStatus } from "../../../queries"
import { type BackupSettingsValues } from "../../../schemas"
import { BackupSettingsForm } from "../BackupSettingsForm"

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  saveBackupSettings: vi.fn(),
  testBackupConnection: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn()
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mocks.refresh
  })
}))

vi.mock("../../../mutations", () => ({
  saveBackupSettings: mocks.saveBackupSettings,
  testBackupConnection: mocks.testBackupConnection
}))

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {},
    ready: true,
    locales: {}
  })
}))

vi.mock("@/components/ui", async () => {
  const actual = await vi.importActual<typeof import("@/components/ui")>("@/components/ui")

  return {
    ...actual,
    toast: {
      error: mocks.toastError,
      success: mocks.toastSuccess
    }
  }
})

const localSettings: BackupSettingsValues = {
  backupDestination: "local",
  backupCadence: "daily",
  backupRetentionDaily: 7,
  backupRetentionWeekly: 4,
  backupRetentionMonthly: 12,
  backupS3Bucket: "",
  backupS3Region: "",
  backupS3Endpoint: "",
  backupS3AccessKey: "",
  backupS3AccessKeyConfigured: false,
  backupS3SecretKey: "",
  backupS3SecretKeyConfigured: false
}

const configuredS3Settings: BackupSettingsValues = {
  ...localSettings,
  backupDestination: "s3",
  backupS3Bucket: "remit-backups",
  backupS3Region: "eu-west-1",
  backupS3AccessKeyConfigured: true,
  backupS3SecretKeyConfigured: true
}

const emptyStatus: BackupSettingsStatus = {
  backupTestConnectionAt: null,
  backupLastSuccessAt: null,
  backupLastFailureAt: null,
  backupLastFailureReason: null
}

function renderBackupSettingsForm(
  initialValues: BackupSettingsValues = localSettings,
  hostedMode = false
): HTMLElement {
  const { container } = render(
    <BackupSettingsForm
      initialValues={initialValues}
      status={emptyStatus}
      hostedMode={hostedMode}
    />
  )

  return container
}

beforeEach(() => {
  vi.clearAllMocks()

  mocks.saveBackupSettings.mockResolvedValue({
    data: { settings: localSettings, status: emptyStatus }
  })
  mocks.testBackupConnection.mockResolvedValue({
    data: { backupTestConnectionAt: "2026-09-09T10:00:00.000Z" }
  })
})

afterEach(() => {
  cleanup()
})

test("hides the credential fields when the destination is local", () => {
  renderBackupSettingsForm()

  expect(screen.queryByLabelText("settings.backup.bucket")).not.toBeInTheDocument()
  expect(screen.getByLabelText("settings.backup.destination")).toBeInTheDocument()
})

test("shows the credential fields when the destination is remote", () => {
  renderBackupSettingsForm(configuredS3Settings)

  expect(screen.getByLabelText("settings.backup.bucket")).toBeInTheDocument()
  expect(screen.getByLabelText("settings.backup.region")).toBeInTheDocument()
})

test("renders no stored credential value for a configured destination", () => {
  const container = renderBackupSettingsForm(configuredS3Settings)

  const accessKeyInput = screen.getByLabelText("settings.backup.accessKey")

  expect(accessKeyInput).toHaveValue("")
  expect(container.innerHTML).not.toContain("access-key")
})

test("submits blank credentials for a configured destination so stored values survive", async () => {
  const user = userEvent.setup()

  renderBackupSettingsForm(configuredS3Settings)

  await user.clear(screen.getByLabelText("settings.backup.retentionDaily"))
  await user.type(screen.getByLabelText("settings.backup.retentionDaily"), "3")
  await user.click(screen.getByRole("button", { name: "common.actions.save" }))

  await waitFor(() => expect(mocks.saveBackupSettings).toHaveBeenCalledTimes(1))

  expect(mocks.saveBackupSettings).toHaveBeenCalledWith(
    expect.objectContaining({
      backupRetentionDaily: "3",
      backupS3AccessKey: "",
      backupS3AccessKeyConfigured: true,
      backupS3SecretKey: "",
      backupS3SecretKeyConfigured: true
    })
  )
})

test("surfaces a refused connection test without saving anything", async () => {
  const user = userEvent.setup()

  mocks.testBackupConnection.mockResolvedValue({ error: "settings.backup.errors.authFailed" })

  renderBackupSettingsForm(configuredS3Settings)

  await user.click(screen.getByRole("button", { name: /settings.backup.testConnection/ }))

  await waitFor(() =>
    expect(mocks.toastError).toHaveBeenCalledWith("settings.backup.errors.authFailed")
  )
  expect(mocks.saveBackupSettings).not.toHaveBeenCalled()
})

test("renders read-only with no actions on a hosted instance", () => {
  renderBackupSettingsForm(configuredS3Settings, true)

  expect(screen.getByLabelText("settings.backup.bucket")).toBeDisabled()
  expect(screen.queryByRole("button", { name: "common.actions.save" })).not.toBeInTheDocument()
  expect(screen.getByText("settings.backup.hostedTitle")).toBeInTheDocument()
})

test("has no accessibility violations", async () => {
  const container = renderBackupSettingsForm(configuredS3Settings)

  expect((await axe(container)).violations).toEqual([])
})
