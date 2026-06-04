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
        empty: "No checks in this section."
      },
      systemInfo: {
        title: "Instance details",
        description: "Reference information for support, public links, and upgrades.",
        versionLabel: "App version",
        versionHint: "Use this version when checking release notes or asking for support.",
        fingerprintLabel: "Encryption key fingerprint",
        fingerprintHint:
          "Use this fingerprint to confirm your encryption key did not change after moving or upgrading the instance."
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
          destination: "Destination: {destination}",
          lastFailure: "Last failure: {date}",
          lastFailureReason: "Failure reason: {reason}",
          title: "Backups",
          missing: "No successful backup has been recorded.",
          frequencyDetail:
            "Run a backup and confirm it completes before trusting this instance with live business data.",
          lastSuccess: "Last successful backup: {date}",
          neverFailed: "Last failure: none recorded.",
          notRecorded: "Last successful backup: not recorded.",
          staleDetail: "Run a fresh backup. The last successful backup is more than 7 days old.",
          freshDetail: "A recent backup exists."
        },
        disk: {
          title: "Disk space",
          used: "{percent}% used",
          usageDetail: "{available} available of {total}.",
          highUsageDetail:
            "{available} available of {total}. Free up space or expand storage soon.",
          highInodesDetail:
            "{available, number} of {total, number} inodes free. Remove unused files before the disk rejects new writes.",
          unavailable: "Disk space could not be checked.",
          unavailableDetail: "Check the data folder and host permissions."
        },
        migrations: {
          title: "Database schema",
          upToDate: "{count, plural, one {# migration applied} other {# migrations applied}}.",
          upToDateDetail: "The database schema matches this build of Remit.",
          pending:
            "{count, plural, one {# migration is pending} other {# migrations are pending}}.",
          pendingDetail:
            "Apply pending migrations before using this instance. Run the database migration command on your server.",
          ahead: "The database schema is newer than this build.",
          aheadDetail:
            "This instance is running an older build than the database expects. Upgrade the app or restore a matching backup.",
          unavailable: "Schema status could not be checked.",
          unavailableDetail: "Confirm the database is reachable and that migrations have been run."
        },
        publicUrl: {
          title: "Public URL",
          detail: "Public invoice, proposal, contract, and portal links should use this address.",
          invalid: "The public URL is not valid.",
          invalidDetail: "Update the configured app URL before sending public links to clients.",
          unreachable: "{origin} could not be reached from the server.",
          unreachableDetail:
            "This can be normal behind a reverse proxy. Confirm clients can open public links from outside your network."
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
        description: "Manage your identity, account details, and current session.",
        avatar: "Avatar",
        uploadPhoto: "Upload photo",
        removePhoto: "Remove photo",
        avatarHelp: "JPG, PNG, WebP or GIF. Max 5MB.",
        uploadUrlFailed: "Failed to get upload URL.",
        uploadFailed: "Failed to upload file",
        avatarUpdated: "Avatar updated",
        avatarRemoved: "Avatar removed",
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
          avatarUpdateFailed: "Failed to update profile picture.",
          avatarRemoveFailed: "Failed to remove profile picture."
        },
        validation: {
          nameRequired: "Name is required.",
          emailInvalid: "Enter a valid email address.",
          avatarFilenameRequired: "Avatar filename is required.",
          avatarContentTypeRequired: "Avatar file type is required.",
          avatarSizeInvalid: "Avatar file size is invalid.",
          avatarTooLarge: "Avatar must be 5MB or smaller."
        }
      },
      security: {
        title: "Security",
        description: "Control password access and two-factor authentication for your account.",
        password: "Password",
        changePassword: {
          title: "Change password",
          description:
            "Update the password you use to sign in. Other active sessions will be signed out after the change.",
          currentPassword: "Current password",
          newPassword: "New password",
          confirmPassword: "Confirm new password",
          currentPasswordPlaceholder: "Your current password",
          newPasswordPlaceholder: "Your new password",
          confirmPasswordPlaceholder: "Repeat your new password",
          submit: "Change password",
          changed: "Password changed",
          changedDescription: "Other active sessions have been signed out"
        },
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
        description: "Adjust the theme, typography, and interface density for your workspace.",
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
        title: "Business",
        description: "Manage the business identity and regional defaults used across Remit.",
        logo: "Logo",
        logoDescription: "Shown on documents and mirrored to the instance organization.",
        logoAlt: "{name} logo",
        fallbackBusinessName: "Business",
        uploadLogo: "Upload logo",
        removeLogo: "Remove logo",
        logoHelp: "JPG, PNG, WebP or GIF. Max 5MB.",
        uploadUrlFailed: "Failed to get upload URL.",
        uploadFailed: "Failed to upload file",
        logoUpdated: "Business logo updated",
        logoRemoved: "Business logo removed",
        invalidLogoFileType: "Invalid file type. Use JPG, PNG, WebP, or GIF.",
        saved: "Business settings saved",
        saveProfile: "Save profile",
        profileSaved: "Business profile saved",
        saveDefaults: "Save defaults",
        defaultsSaved: "Regional defaults saved",
        saveTaxDetails: "Save tax details",
        taxDetailsSaved: "Tax details saved",
        saveAddress: "Save address",
        addressSaved: "Business address saved",
        profileSection: "Profile",
        profileDescription: "These details appear on client-facing documents and emails.",
        localeSection: "Business defaults",
        localeDescription:
          "Set the currency, locale, and timezone used for business records and generated documents.",
        taxSection: "Tax details",
        taxDescription: "Store the registration or VAT number used for documents.",
        addressSection: "Address",
        addressDescription: "The registered business address used on invoices and contracts.",
        businessName: "Name",
        businessNamePlaceholder: "Your business name",
        businessEmail: "Email",
        businessEmailPlaceholder: "billing@example.com",
        businessPhone: "Phone",
        businessPhonePlaceholder: "+1 555 0100",
        businessWebsite: "Website",
        businessWebsitePlaceholder: "https://example.com",
        defaultCurrency: "Currency",
        defaultLocale: "Document locale",
        selectLocale: "Select locale",
        defaultTimezone: "Timezone",
        selectTimezone: "Select timezone",
        businessTaxId: "VAT / tax ID",
        businessTaxIdPlaceholder: "Tax registration number",
        addressLine1: "Address line 1",
        addressLine1Placeholder: "Street address",
        addressLine2: "Address line 2",
        addressLine2Placeholder: "Apartment, suite, or unit",
        city: "City",
        cityPlaceholder: "City",
        state: "State",
        statePlaceholder: "State or region",
        postalCode: "Postal code",
        postalCodePlaceholder: "Postal code",
        country: "Country",
        errors: {
          updateFailed: "Failed to update business settings",
          logoUpdateFailed: "Failed to update business logo",
          logoRemoveFailed: "Failed to remove business logo"
        },
        validation: {
          nameRequired: "Business name is required.",
          emailInvalid: "Enter a valid email address.",
          websiteInvalid: "Enter a valid URL.",
          currencyRequired: "Select a currency.",
          localeRequired: "Select a document locale.",
          localeInvalid: "Select a valid document locale.",
          timezoneRequired: "Select a timezone.",
          timezoneInvalid: "Select a valid timezone.",
          countryRequired: "Select a country.",
          logoFilenameRequired: "Logo filename is required.",
          logoContentTypeRequired: "Logo file type is required.",
          logoSizeInvalid: "Logo file size is invalid.",
          logoTooLarge: "Logo must be 5MB or smaller.",
          logoObjectKeyRequired: "Logo upload key is required."
        }
      },
      payment: {
        title: "Payment",
        description: "Configure payment providers and defaults for getting paid.",
        bankSection: "Bank transfer",
        bankSectionDescription:
          "Store the manual payment details shown on client-facing invoice pages.",
        bankName: "Bank name",
        bankNamePlaceholder: "Your bank",
        iban: "IBAN",
        ibanPlaceholder: "PT50 0002 0123 1234 5678 9015 4",
        paymentInstructions: "Payment instructions",
        paymentInstructionsPlaceholder:
          "Include transfer references, payment timing, or extra remittance details.",
        paymentInstructionsHelp:
          "These instructions can appear on public invoice pages. Do not include Stripe secrets.",
        stripeSection: "Stripe",
        stripeSectionDescription:
          "Connect Stripe for future online card payments and webhook processing.",
        stripePublishableKey: "Publishable key",
        stripePublishableKeyPlaceholder: "pk_test_...",
        stripeSecretKey: "Secret key",
        stripeSecretKeyPlaceholder: "sk_test_...",
        stripeWebhookSecret: "Webhook signing secret",
        stripeWebhookSecretPlaceholder: "whsec_...",
        configuredPlaceholder: "Configured",
        changeSecret: "Change",
        encryptedValuePreserved: "Leave blank to keep the existing encrypted value.",
        secretPreserved: "Leave blank to keep the existing configured secret.",
        save: "Save payment settings",
        saved: "Payment settings saved",
        testStripeConnection: "Test Stripe connection",
        stripeTestSucceeded: "Stripe connection tested",
        saveBeforeTest: "Save changes before testing the Stripe connection.",
        lastStripeTest: "Last successful Stripe test: {date}",
        lastStripeTestNever: "No successful Stripe test has been recorded.",
        errors: {
          updateFailed: "Failed to update payment settings",
          stripeNotConfigured: "Stripe is not configured",
          stripeTestFailed: "Stripe could not complete the connection test",
          stripeAuthFailed: "Stripe rejected the secret key",
          stripeConnectionFailed: "Remit could not connect to Stripe",
          stripePermissionFailed: "Stripe refused access for this key",
          stripeRateLimited: "Stripe rate limited the connection test",
          stripeRejected: "Stripe rejected the connection test request",
          stripeApiFailed: "Stripe is temporarily unavailable"
        },
        validation: {
          ibanInvalid: "Enter a valid IBAN.",
          stripePublishableKeyInvalid: "Enter a valid Stripe publishable key.",
          stripePublishableKeyRequired: "Enter a Stripe publishable key.",
          stripeSecretKeyInvalid: "Enter a valid Stripe secret key.",
          stripeSecretKeyRequired: "Stripe secret key is required.",
          stripeWebhookSecretInvalid: "Enter a valid Stripe webhook signing secret."
        }
      },
      invoicing: {
        title: "Invoicing",
        description: "Set invoice numbering, document defaults, and billing preferences.",
        numberingSection: "Numbering",
        numberingSectionDescription:
          "These defaults are applied when a new invoice draft is created.",
        invoicePrefix: "Invoice number prefix",
        invoicePrefixPlaceholder: "INV-",
        invoicePrefixHelp: "Use printable ASCII characters only.",
        numberPaddingWidth: "Number padding width",
        numberPaddingWidthHelp: "Controls how many digits appear after the prefix.",
        nextInvoiceNumber: "Next invoice number",
        nextInvoiceNumberHelp:
          "The next number cannot be lower than the current next number: {number}.",
        paymentTermsDays: "Default payment terms",
        paymentTermsDaysHelp: "Days added to the issue date when calculating the due date.",
        documentDefaultsSection: "Document defaults",
        documentDefaultsSectionDescription:
          "These notes and footer text are copied into new invoice drafts.",
        defaultNotesInvoice: "Default invoice notes",
        defaultNotesInvoicePlaceholder: "Thank you for your business.",
        defaultNotesInvoiceHelp: "Shown in the notes area of new invoice drafts.",
        defaultInvoiceFooter: "Default invoice footer",
        defaultInvoiceFooterPlaceholder: "Payment is due according to the terms above.",
        defaultInvoiceFooterHelp: "Shown in the footer area of new invoice drafts.",
        save: "Save invoicing settings",
        saved: "Invoicing settings saved",
        errors: {
          updateFailed: "Failed to update invoicing settings"
        },
        validation: {
          invoicePrefixTooLong:
            "Invoice number prefix must be {count, plural, one {# character} other {# characters}} or fewer.",
          invoicePrefixInvalid: "Invoice number prefix can use printable ASCII characters only.",
          numberPaddingWidthInvalid: "Padding width must be a whole number from 1 to 10.",
          nextInvoiceNumberInvalid: "Next invoice number must be a positive whole number.",
          nextInvoiceNumberForward:
            "Next invoice number cannot be lower than the current next number ({number}).",
          paymentTermsDaysInvalid: "Payment terms must be a whole number from 0 to 365."
        }
      },
      taxRates: {
        title: "Tax Rates",
        description: "Manage reusable tax rates for invoices, proposals, and client documents.",
        listTitle: "Reusable rates",
        currentDefault: "{name} is the current default rate.",
        noDefault: "No default tax rate is selected.",
        addRate: "Add rate",
        emptyTitle: "No tax rates yet",
        emptyDescription: "Create reusable rates before building invoice or proposal line items.",
        tableName: "Name",
        tableRate: "Rate",
        tableStatus: "Status",
        tableActions: "Actions",
        name: "Name",
        namePlaceholder: "IVA 23%",
        percentage: "Percentage",
        percentageHelp: "Use a value from 0 to 100 with up to two decimal places.",
        percentageValue: "{percentage}%",
        defaultBadge: "Default",
        notDefaultBadge: "Available",
        createTitle: "Add tax rate",
        createDescription: "Create a reusable tax rate for future document line items.",
        editTitle: "Edit tax rate",
        editDescription:
          "Changes apply to future use only. Existing document totals stay unchanged.",
        saveCreate: "Create rate",
        saveEdit: "Save rate",
        editRate: "Edit tax rate",
        makeDefault: "Make default",
        deleteRate: "Delete tax rate",
        deleteTitle: "Delete tax rate",
        deleteDescription:
          "Delete {name}? Existing document totals keep their captured tax snapshot.",
        deleteDescriptionFallback:
          "Delete this tax rate? Existing document totals keep their captured tax snapshot.",
        confirmDelete: "Delete rate",
        created: "Tax rate created",
        updated: "Tax rate updated",
        deleted: "Tax rate deleted",
        defaultUpdated: "Default tax rate updated",
        errors: {
          updateFailed: "Failed to update tax rates",
          notFound: "Tax rate not found",
          defaultConflict: "Only one default tax rate can be active"
        },
        validation: {
          nameRequired: "Tax rate name is required.",
          nameTooLong:
            "Tax rate name must be {count, plural, one {# character} other {# characters}} or fewer.",
          percentageInvalid: "Tax rate percentage must be a number.",
          percentageRange: "Tax rate percentage must be from 0 to 100.",
          percentagePrecision: "Tax rate percentage can use at most two decimal places.",
          idInvalid: "Invalid tax rate."
        }
      },
      templates: {
        title: "Templates",
        description: "Maintain reusable document templates for client-facing workflows."
      },
      email: {
        title: "Email",
        description: "Configure transactional email delivery for notifications and account flows.",
        provider: "Provider",
        providerSmtp: "SMTP",
        providerSmtpHelp: "Use your own mail server credentials.",
        providerResend: "Resend",
        providerResendHelp: "Use Resend's email API.",
        senderSection: "Sender",
        smtpSection: "SMTP settings",
        resendSection: "Resend settings",
        testSection: "Test delivery",
        fromName: "From name",
        fromNamePlaceholder: "Acme Studio",
        fromAddress: "From address",
        fromAddressPlaceholder: "billing@example.com",
        smtpHost: "Host",
        smtpHostPlaceholder: "smtp.example.com",
        smtpPort: "Port",
        smtpUser: "Username",
        smtpUserPlaceholder: "mailer@example.com",
        smtpPassword: "Password",
        smtpPasswordPlaceholder: "SMTP password",
        smtpSecure: "Use implicit TLS",
        smtpSecureHelp:
          "Enable for SMTPS ports such as 465. Disable for STARTTLS ports such as 587.",
        resendApiKey: "API key",
        resendApiKeyPlaceholder: "Resend API key",
        configuredPlaceholder: "Configured",
        changeSecret: "Change",
        secretPreserved: "Leave blank to keep the existing configured secret.",
        save: "Save email settings",
        saved: "Email settings saved",
        sendTest: "Send test email",
        testSent: "Test email sent",
        testRecipient: "Recipient",
        saveBeforeTest: "Save changes before sending a test email.",
        lastTestSend: "Last successful test: {date}",
        lastTestSendNever: "No successful test email has been recorded.",
        testSubject: "Remit test email",
        testText: "This is a test email from Remit. Your email provider is configured correctly.",
        errors: {
          updateFailed: "Failed to update email settings",
          notConfigured: "Email delivery is not configured",
          testSendFailed: "The email provider could not send the test email",
          smtpAuthFailed: "SMTP authentication failed. Check the username and password",
          smtpConnectionFailed: "Remit could not connect to the SMTP server",
          smtpTimeout: "The SMTP server did not respond in time",
          smtpTlsFailed: "SMTP TLS negotiation failed. Check the TLS setting and port",
          resendAuthFailed: "Resend rejected the API key",
          resendRejected: "Resend rejected the sender or recipient address"
        },
        validation: {
          providerRequired: "Select an email provider.",
          fromNameRequired: "From name is required.",
          fromAddressInvalid: "Enter a valid from address.",
          smtpHostRequired: "SMTP host is required.",
          smtpPortInvalid: "Enter a valid SMTP port.",
          smtpUserRequired: "SMTP username is required.",
          smtpPasswordRequired: "SMTP password is required.",
          resendApiKeyRequired: "Resend API key is required.",
          recipientInvalid: "Enter a valid recipient email address."
        }
      },
      system: {
        title: "System"
      }
    }
  }
}
