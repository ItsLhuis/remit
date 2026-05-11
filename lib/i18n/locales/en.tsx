import { type Language } from "../types"

export const english: Language = {
  code: "en",
  name: "English",
  isRtl: false,
  translations: {
    common: {
      actions: {
        save: "Save",
        saveChanges: "Save changes",
        cancel: "Cancel",
        delete: "Delete",
        edit: "Edit",
        create: "Create",
        back: "Back",
        next: "Next",
        confirm: "Confirm",
        continue: "Continue",
        close: "Close",
        copy: "Copy",
        download: "Download",
        refresh: "Refresh",
        done: "Done",
        search: "Search",
        retry: "Try again",
        previous: "Previous",
        copyAllCodes: "Copy all codes"
      },
      fields: {
        email: "Email",
        name: "Name",
        password: "Password",
        description: "Description",
        country: "Country",
        optional: "Optional",
        required: "Required",
        selectCountry: "Select a country",
        selectCurrency: "Select currency"
      },
      status: {
        loading: "Loading...",
        saving: "Saving...",
        error: "Error",
        success: "Success",
        empty: "Empty",
        noResults: "No results found.",
        copied: "Copied!",
        yes: "Yes",
        no: "No"
      },
      navigation: {
        account: "Account",
        templates: "Templates",
        more: "More",
        morePages: "More pages",
        commandPalette: "Command Palette",
        commandSearchPlaceholder: "Search for a command to run...",
        pagination: "Pagination",
        goToPreviousPage: "Go to previous page",
        goToNextPage: "Go to next page",
        breadcrumb: "Breadcrumb",
        sidebar: "Sidebar",
        sidebarDescription: "Displays the mobile sidebar.",
        toggleSidebar: "Toggle Sidebar"
      }
    },
    errors: {
      notFound: "Not found",
      unauthorized: "You must be signed in to do that",
      forbidden: "You do not have permission to do that",
      validationFailed: "Please check the form and try again",
      invalidRequestBody: "Invalid request body.",
      somethingWentWrong: "Something went wrong",
      sessionExpired: "Your session has expired - please sign in again",
      networkError: "A network error occurred - please try again",
      emailAlreadyInUse: "Email address is already in use",
      relatedRecordNotFound: "Related record not found",
      page: {
        title: "Something went wrong",
        description: "An unexpected error interrupted this page."
      }
    },
    totp: {
      title: "Two-factor authentication",
      codeLabel: "Verification code",
      verifyCode: "Verify code",
      invalidCode: "Invalid code. Please try again.",
      scanQr: "Scan QR code",
      scanDescription:
        "Scan this code with your authenticator app, then enter the 6-digit verification code below.",
      manualEntryCode: "Manual entry code",
      copyManualEntryCode: "Copy manual entry code",
      useRecoveryCode: "Use a recovery code instead",
      useAuthenticator: "Use authenticator app instead",
      validation: {
        codeLength: "Enter the 6-digit code.",
        codeDigits: "Code must be 6 digits."
      }
    },
    recoveryCode: {
      label: "Recovery code",
      verify: "Verify recovery code",
      invalid: "Invalid recovery code.",
      description: "Enter one of your saved recovery codes.",
      validation: {
        required: "Enter your recovery code.",
        format: "Invalid recovery code format."
      }
    },
    backupCodes: {
      title: "Save your recovery codes",
      description:
        "These single-use codes let you sign in if you lose access to your authenticator app. Store them somewhere safe - they won't be shown again.",
      confirm: "I have saved my recovery codes in a safe place.",
      listTitle: "Recovery codes",
      saveShort: "Save these somewhere safe",
      count: "{count} codes",
      singleUseWarning:
        "Each code can only be used once. Store them offline - they won't be shown again."
    },
    health: {
      dashboard: {
        title: "System",
        description: "Check whether this Remit instance is ready and safe to run.",
        readyTitle: "Core system is ready",
        readyDescription: "Remit can run normally. Optional setup can still be completed later.",
        attentionTitle:
          "{count, plural, one {# item needs attention} other {# items need attention}}",
        dataAttentionTitle: "Your data needs attention",
        issueSummary:
          "{count, plural, one {# important item needs a next step.} other {# important items need next steps.}}"
      },
      status: {
        healthy: "Ready",
        attention: "Needs attention",
        error: "Issue",
        notSetup: "Not set up",
        optional: "Optional",
        info: "Info"
      },
      sections: {
        core: {
          title: "Core system",
          description: "The essentials Remit needs to store data and keep running."
        },
        safety: {
          title: "Data safety",
          description: "Signals that help you protect business data during hosting changes."
        },
        integrations: {
          title: "Sending and payments",
          description: "Optional setup for email delivery and online card payments."
        },
        instance: {
          title: "Instance",
          description: "Basic information that helps with support, links, and upgrades."
        },
        empty: "No checks in this section."
      },
      actions: {
        configureEmail: "Configure email",
        configurePayments: "Configure payments"
      },
      fingerprint: {
        copyLabel: "Copy encryption key fingerprint",
        copyTooltip: "Copy fingerprint"
      },
      checks: {
        database: {
          title: "Database",
          reachable: "Remit can connect to the database.",
          unavailable: "Remit cannot connect to the database.",
          reachableDetail: "Invoices, clients, projects, and settings can be read and saved.",
          unavailableDetail:
            "Check that the database is running and that this Remit instance can reach it."
        },
        email: {
          title: "Email sending",
          notConfigured: "Email is not set up.",
          notConfiguredDetail:
            "Remit uses email for invoices, proposals, contracts, reminders, and account recovery. The app still works without it.",
          testedOk: "Email was tested successfully on {date}.",
          testedDetail: "{provider} is ready to send Remit email.",
          configured: "Email is configured, but has not been tested.",
          configuredDetail: "Send a test email from Settings > Email before relying on {provider}."
        },
        stripe: {
          title: "Online payments",
          notConfigured: "Stripe is not set up.",
          notConfiguredDetail:
            "Manual payments still work. Set up Stripe only if you want clients to pay online by card.",
          testedOk: "Stripe was tested successfully on {date}.",
          testedDetail: "Online card payments are ready. Manual payments still remain available.",
          configured: "Stripe is configured, but has not been tested.",
          configuredDetail: "Test the Stripe connection before adding online payment links."
        },
        storage: {
          title: "File storage",
          notConfigured: "Backup file storage needs setup.",
          localWritable: "Remit can write files for this instance.",
          localWritableDetail: "Uploads and local backups can be saved.",
          localUnavailable: "Remit cannot write files for this instance.",
          localUnavailableDetail:
            "Check that the data folder exists and that Remit has permission to write to it.",
          backupStorageMissing:
            "{destination} backup storage is selected, but the connection settings are incomplete.",
          bucketReachable: "{destination} backup storage is reachable.",
          bucketReachableDetail: "Remit can reach the configured backup storage.",
          bucketUnavailable: "{destination} backup storage is not reachable.",
          bucketUnavailableDetail:
            "Check the backup storage credentials, bucket name, region, and network access."
        },
        backup: {
          title: "Backups",
          missing: "No successful backup has been recorded.",
          frequencyDetail:
            "Run a backup and confirm it completes before trusting this instance with live business data.",
          lastSuccess: "Last successful backup: {date}",
          staleDetail: "Run a fresh backup. The last successful backup is more than 7 days old.",
          freshDetail: "A recent backup exists."
        },
        disk: {
          title: "Disk space",
          used: "{percent}% used",
          usageDetail: "{available} available of {total}.",
          highUsageDetail:
            "{available} available of {total}. Free up space or expand storage soon.",
          unavailable: "Disk space could not be checked.",
          unavailableDetail: "Check the data folder and host permissions."
        },
        encryption: {
          title: "Encryption key fingerprint",
          detail:
            "Use this fingerprint to confirm your encryption key did not change after moving or upgrading the instance."
        },
        version: {
          title: "App version",
          detail: "Use this version when checking release notes or asking for support."
        },
        publicUrl: {
          title: "Public URL",
          detail: "Public invoice, proposal, contract, and portal links should use this address.",
          invalid: "The public URL is not valid.",
          invalidDetail: "Update the configured app URL before sending public links to clients."
        }
      }
    },
    auth: {
      panel: {
        taglineFirst: "Your work.",
        taglineSecond: "Your terms.",
        description:
          "Manage clients, projects, proposals, contracts, time, expenses, invoices and payments in one self-hostable workspace.",
        selfHosted: "Self-hosted",
        openSource: "Open source",
        ownYourData: "Own your data"
      },
      login: {
        metadataTitle: "Sign in",
        title: "Welcome back",
        description: "Enter your email and password to access your account",
        submit: "Sign in",
        invalidCredentials: "Invalid email or password.",
        forgotPassword: "Forgot password?",
        noSmtpHelpPrefix: "Lost access? Run",
        noSmtpHelpCommand: "docker compose exec app pnpm remit:reset-password",
        noSmtpHelpSuffix: "on your server.",
        validation: {
          emailInvalid: "Enter a valid email address.",
          passwordRequired: "Password is required."
        }
      },
      changePassword: {
        metadataTitle: "Change Password",
        title: "Change your password",
        description: "Your account requires a new password before you can continue.",
        currentPassword: "Current temporary password",
        newPassword: "New password",
        confirmPassword: "Confirm new password",
        currentPasswordPlaceholder: "Your current temporary password",
        newPasswordPlaceholder: "Your new password",
        confirmPasswordPlaceholder: "Repeat your new password",
        submit: "Set new password",
        validation: {
          currentPasswordRequired: "Current password is required.",
          passwordMin: "Password must be at least {count} characters.",
          passwordUppercase: "Password must include at least 1 uppercase letter.",
          passwordLowercase: "Password must include at least 1 lowercase letter.",
          passwordNumber: "Password must include at least 1 number.",
          passwordSpecial: "Password must include at least 1 special character.",
          confirmPasswordRequired: "Please confirm your password.",
          passwordsMatch: "Passwords do not match."
        }
      },
      resetPassword: {
        metadataTitle: "Reset password",
        title: "Reset your password",
        description: "Choose a new password for your Remit account.",
        newPassword: "New password",
        confirmPassword: "Confirm new password",
        newPasswordPlaceholder: "Your new password",
        confirmPasswordPlaceholder: "Repeat your new password",
        submit: "Reset password",
        failed: "Failed to reset password.",
        invalidTitle: "Reset link is invalid",
        invalidDescription: "Request a new reset link from the sign-in page.",
        backToLogin: "Back to sign in",
        validation: {
          passwordMin: "Password must be at least {count} characters.",
          passwordUppercase: "Password must include at least 1 uppercase letter.",
          passwordLowercase: "Password must include at least 1 lowercase letter.",
          passwordNumber: "Password must include at least 1 number.",
          passwordSpecial: "Password must include at least 1 special character.",
          confirmPasswordRequired: "Please confirm your password.",
          passwordsMatch: "Passwords do not match."
        }
      },
      register: {
        metadataTitle: "Register",
        title: "Create your account",
        description: "Set up your Remit account to get started.",
        submit: "Create account",
        failed: "Failed to create account.",
        confirmPassword: "Confirm password",
        namePlaceholder: "Your name",
        emailPlaceholder: "Your email",
        passwordPlaceholder: "Your password",
        confirmPasswordPlaceholder: "Repeat your password",
        passwordRequirements: "Password strength requirements",
        passwordRequirementsProgress: "Password requirements completion",
        passwordMinLength: "At least {count} characters",
        passwordUppercase: "1 uppercase letter",
        passwordLowercase: "1 lowercase letter",
        passwordNumber: "1 number",
        passwordSpecial: "1 special character",
        validation: {
          nameRequired: "Name is required.",
          emailInvalid: "Enter a valid email address.",
          passwordMin: "Password must be at least {count} characters.",
          passwordUppercase: "Password must include at least 1 uppercase letter.",
          passwordLowercase: "Password must include at least 1 lowercase letter.",
          passwordNumber: "Password must include at least 1 number.",
          passwordSpecial: "Password must include at least 1 special character.",
          confirmPasswordRequired: "Please confirm your password.",
          passwordsMatch: "Passwords do not match."
        }
      },
      signOut: {
        title: "Sign out",
        description: "Are you sure you want to sign out of your account?",
        submit: "Sign out"
      },
      totp: {
        authenticatorDescription: "Enter the 6-digit code from your authenticator app."
      }
    },
    app: {
      logoAlt: "Remit logo",
      metadata: {
        description: "Self-hosted business management for freelancers.",
        dashboardTitle: "Dashboard",
        setupTitle: "Setup"
      },
      navigation: {
        dashboard: "Dashboard",
        clients: "Clients",
        projects: "Projects",
        proposals: "Proposals",
        invoices: "Invoices",
        settings: "Settings",
        navigation: "Navigation",
        configuration: "Configuration",
        notifications: "Notifications"
      }
    },
    setup: {
      metadataTitle: "Setup",
      progress: "Step {current} of {total}",
      errors: {
        businessSaveFailed: "Something went wrong.",
        totpEnableFailed: "Failed to enable two-factor authentication.",
        totpUriMissing: "Something went wrong. Please try again.",
        recoveryCodesMissing: "Recovery codes could not be generated. Please try again."
      },
      businessProfile: {
        title: "Business profile",
        description: "Tell us about your business to personalize your experience.",
        businessName: "Business name",
        businessNamePlaceholder: "Your business name",
        businessEmail: "Business email",
        businessEmailPlaceholder: "Your business email",
        businessTaxId: "Tax ID",
        businessTaxIdPlaceholder: "Your tax ID",
        defaultCurrency: "Default currency",
        validation: {
          businessNameRequired: "Business name is required.",
          businessEmailInvalid: "Enter a valid email address.",
          businessCountryRequired: "Select a country.",
          defaultCurrencyRequired: "Select a currency."
        }
      },
      totp: {
        description:
          "Add an extra layer of security to your account with a one-time code from your authenticator app.",
        passwordPlaceholder: "Your password",
        setupAuthenticator: "Set up authenticator",
        validation: {
          passwordRequired: "Password is required."
        }
      },
      done: {
        title: "You're all set",
        description: "Remit is ready. Start by adding your first client.",
        goToDashboard: "Go to dashboard"
      }
    },
    settings: {
      metadata: {
        profile: "Profile",
        security: "Security",
        appearance: "Appearance",
        business: "Business",
        payment: "Payment",
        invoicing: "Invoicing",
        taxRates: "Tax Rates",
        templates: "Templates",
        email: "Email",
        system: "System"
      },
      navigation: {
        business: "Business",
        invoicing: "Invoicing",
        email: "Email",
        profile: "Profile",
        security: "Security",
        appearance: "Appearance",
        payment: "Payment",
        taxRates: "Tax Rates",
        system: "System"
      },
      profile: {
        title: "Profile",
        avatar: "Avatar",
        uploadPhoto: "Upload photo",
        avatarHelp: "JPG, PNG, WebP or GIF. Max 5MB.",
        uploadUrlFailed: "Failed to get upload URL.",
        uploadFailed: "Failed to upload file",
        avatarUpdated: "Avatar updated",
        invalidAvatarFileType: "Invalid file type. Use JPG, PNG, WebP, or GIF.",
        accountDetails: "Account details",
        displayName: "Display name",
        emailAddress: "Email address",
        emailVerificationDescription: "A verification email will be sent to the new address.",
        emailProviderRequired:
          "Email changes require an email provider to be configured in Settings > Email.",
        verificationEmailSent: "Verification email sent",
        verificationEmailSentDescription: "Check your inbox to confirm the new address",
        profileUpdated: "Profile updated",
        session: "Session",
        signOutDescription: "Sign out of your account on this device.",
        errors: {
          emailChangeFailed: "Failed to initiate email change.",
          unauthorized: "Unauthorized.",
          avatarUpdateFailed: "Failed to update profile picture."
        },
        validation: {
          nameRequired: "Name is required.",
          emailInvalid: "Enter a valid email address."
        }
      },
      security: {
        title: "Security",
        twoFactor: "Two-factor authentication",
        authenticatorApp: "Authenticator app",
        authenticatorDescription:
          "Replace your authenticator app or migrate to a new device. Your current codes will stop working once reconfiguration is complete.",
        reconfigure: "Reconfigure",
        reconfigured: "Two-factor authentication reconfigured",
        reconfiguredDescription: "Your new TOTP secret and recovery codes are active",
        validation: {
          passwordRequired: "Password is required."
        },
        dialog: {
          confirmTitle: "Reconfigure two-factor authentication",
          confirmDescription:
            "Your current TOTP secret will be replaced immediately. Do not close this dialog until you have scanned the new QR code and saved your recovery codes.",
          confirmPassword: "Confirm your password",
          startFailed: "Failed to start reconfiguration. Check your password.",
          recoveryGenerationFailed:
            "TOTP verified, but recovery codes could not be generated. Please try again from settings."
        }
      },
      appearance: {
        title: "Appearance",
        theme: "Interface theme",
        themeDescription: "Select your preferred interface theme.",
        themeSystem: "System",
        themeLight: "Light",
        themeDark: "Dark",
        fontFamily: "Font family",
        fontFamilyDescription: "Choose the typeface used across the interface.",
        fontFamilySystem: "System",
        fontSize: "Font size",
        fontSizeDescription: "Adjust the base font size of the interface.",
        fontSizeCompact: "Compact",
        fontSizeDefault: "Default",
        fontSizeComfortable: "Comfortable",
        density: "Density",
        densityDescription: "Control the spacing and padding throughout the interface.",
        densityCompact: "Compact",
        densityDefault: "Default",
        densitySpacious: "Spacious",
        fontFamilySample: "Ag",
        fontSizeSample: "Aa"
      },
      business: {
        title: "Business"
      },
      payment: {
        title: "Payment"
      },
      invoicing: {
        title: "Invoicing"
      },
      taxRates: {
        title: "Tax Rates"
      },
      templates: {
        title: "Templates"
      },
      email: {
        title: "Email"
      },
      system: {
        title: "System"
      }
    }
  }
}
