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
        validation: {
          emailInvalid: "Enter a valid email address.",
          passwordRequired: "Password is required."
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
        email: "Email"
      },
      navigation: {
        business: "Business",
        invoicing: "Invoicing",
        email: "Email",
        profile: "Profile",
        security: "Security",
        appearance: "Appearance",
        payment: "Payment",
        taxRates: "Tax Rates"
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
      }
    }
  }
}
