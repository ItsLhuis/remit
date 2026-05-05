import { type Language } from "../types"

export const english: Language = {
  code: "en",
  name: "English",
  isRtl: false,
  translations: {
    common: {
      cancel: "Cancel",
      save: "Save",
      delete: "Delete",
      edit: "Edit",
      create: "Create",
      loading: "Loading...",
      back: "Back",
      next: "Next",
      confirm: "Confirm",
      continue: "Continue",
      close: "Close",
      search: "Search",
      noResults: "No results found",
      actions: "Actions",
      status: "Status",
      name: "Name",
      email: "Email",
      optional: "Optional",
      required: "Required",
      yes: "Yes",
      no: "No",
      copy: "Copy",
      download: "Download",
      refresh: "Refresh"
    },
    errors: {
      notFound: "Not found",
      unauthorized: "You must be signed in to do that",
      forbidden: "You do not have permission to do that",
      validationFailed: "Please check the form and try again",
      somethingWentWrong: "Something went wrong",
      sessionExpired: "Your session has expired - please sign in again",
      networkError: "A network error occurred - please try again",
      emailAlreadyInUse: "Email address is already in use",
      relatedRecordNotFound: "Related record not found"
    },
    auth: {
      signIn: "Sign in",
      signOut: "Sign out",
      register: "Create account",
      email: "Email",
      password: "Password",
      forgotPassword: "Forgot password?",
      totpCode: "Authenticator code",
      backupCode: "Backup code",
      useBackupCode: "Use a backup code instead",
      useTotpCode: "Use authenticator code instead",
      invalidCredentials: "Invalid email or password"
    },
    setup: {
      title: "Set up Remit",
      steps: {
        businessProfile: "Business profile",
        totp: "Two-factor authentication",
        backupCodes: "Backup codes"
      },
      businessProfile: {
        title: "Tell us about your business",
        description: "This information appears on your invoices and proposals.",
        businessName: "Business name",
        currency: "Default currency",
        locale: "Locale",
        timezone: "Timezone"
      },
      totp: {
        title: "Secure your account",
        description:
          "Scan the QR code with your authenticator app, then enter the six-digit code to verify.",
        scanQr: "Scan QR code",
        enterCode: "Enter code",
        verifyCode: "Verify"
      },
      backupCodes: {
        title: "Save your backup codes",
        description:
          "Store these codes safely. Each can be used once if you lose access to your authenticator app.",
        download: "Download codes",
        confirm: "I have saved my backup codes",
        warning: "You will not be able to see these codes again."
      }
    }
  }
}
