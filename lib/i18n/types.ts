export type Language = {
  code: string
  name: string
  isRtl: boolean
  translations: Translations
}

export type Translations = {
  common: {
    actions: {
      save: string
      saveChanges: string
      cancel: string
      delete: string
      edit: string
      create: string
      back: string
      next: string
      confirm: string
      continue: string
      close: string
      copy: string
      download: string
      refresh: string
      done: string
      search: string
      retry: string
      previous: string
      copyAllCodes: string
    }
    fields: {
      email: string
      name: string
      password: string
      description: string
      country: string
      optional: string
      required: string
      selectCountry: string
      selectCurrency: string
    }
    status: {
      loading: string
      saving: string
      error: string
      success: string
      empty: string
      noResults: string
      copied: string
      yes: string
      no: string
    }
    navigation: {
      account: string
      templates: string
      more: string
      morePages: string
      commandPalette: string
      commandSearchPlaceholder: string
      pagination: string
      goToPreviousPage: string
      goToNextPage: string
      breadcrumb: string
      sidebar: string
      sidebarDescription: string
      toggleSidebar: string
    }
  }
  errors: {
    notFound: string
    unauthorized: string
    forbidden: string
    validationFailed: string
    invalidRequestBody: string
    somethingWentWrong: string
    sessionExpired: string
    networkError: string
    emailAlreadyInUse: string
    relatedRecordNotFound: string
    page: {
      title: string
      description: string
    }
  }
  totp: {
    title: string
    codeLabel: string
    verifyCode: string
    invalidCode: string
    scanQr: string
    scanDescription: string
    manualEntryCode: string
    useRecoveryCode: string
    useAuthenticator: string
    validation: {
      codeLength: string
      codeDigits: string
    }
  }
  recoveryCode: {
    label: string
    verify: string
    invalid: string
    description: string
    validation: {
      required: string
      format: string
    }
  }
  backupCodes: {
    title: string
    description: string
    confirm: string
    listTitle: string
    saveShort: string
    count: string
    singleUseWarning: string
  }
  auth: {
    panel: {
      taglineFirst: string
      taglineSecond: string
      description: string
      selfHosted: string
      openSource: string
      ownYourData: string
    }
    login: {
      metadataTitle: string
      title: string
      description: string
      submit: string
      invalidCredentials: string
      forgotPassword: string
      noSmtpHelpPrefix: string
      noSmtpHelpCommand: string
      noSmtpHelpSuffix: string
      validation: {
        emailInvalid: string
        passwordRequired: string
      }
    }
    changePassword: {
      metadataTitle: string
      title: string
      description: string
      currentPassword: string
      newPassword: string
      confirmPassword: string
      currentPasswordPlaceholder: string
      newPasswordPlaceholder: string
      confirmPasswordPlaceholder: string
      submit: string
      validation: {
        currentPasswordRequired: string
        passwordMin: string
        passwordUppercase: string
        passwordLowercase: string
        passwordNumber: string
        passwordSpecial: string
        confirmPasswordRequired: string
        passwordsMatch: string
      }
    }
    resetPassword: {
      metadataTitle: string
      title: string
      description: string
      newPassword: string
      confirmPassword: string
      newPasswordPlaceholder: string
      confirmPasswordPlaceholder: string
      submit: string
      failed: string
      invalidTitle: string
      invalidDescription: string
      backToLogin: string
      validation: {
        passwordMin: string
        passwordUppercase: string
        passwordLowercase: string
        passwordNumber: string
        passwordSpecial: string
        confirmPasswordRequired: string
        passwordsMatch: string
      }
    }
    register: {
      metadataTitle: string
      title: string
      description: string
      submit: string
      failed: string
      confirmPassword: string
      namePlaceholder: string
      emailPlaceholder: string
      passwordPlaceholder: string
      confirmPasswordPlaceholder: string
      passwordRequirements: string
      passwordRequirementsProgress: string
      passwordMinLength: string
      passwordUppercase: string
      passwordLowercase: string
      passwordNumber: string
      passwordSpecial: string
      validation: {
        nameRequired: string
        emailInvalid: string
        passwordMin: string
        passwordUppercase: string
        passwordLowercase: string
        passwordNumber: string
        passwordSpecial: string
        confirmPasswordRequired: string
        passwordsMatch: string
      }
    }
    signOut: {
      title: string
      description: string
      submit: string
    }
    totp: {
      authenticatorDescription: string
    }
  }
  app: {
    logoAlt: string
    metadata: {
      description: string
      dashboardTitle: string
      setupTitle: string
    }
    navigation: {
      dashboard: string
      clients: string
      projects: string
      proposals: string
      invoices: string
      settings: string
      navigation: string
      configuration: string
      notifications: string
    }
  }
  setup: {
    metadataTitle: string
    progress: string
    errors: {
      businessSaveFailed: string
      totpEnableFailed: string
      totpUriMissing: string
      recoveryCodesMissing: string
    }
    businessProfile: {
      title: string
      description: string
      businessName: string
      businessNamePlaceholder: string
      businessEmail: string
      businessEmailPlaceholder: string
      businessTaxId: string
      businessTaxIdPlaceholder: string
      defaultCurrency: string
      validation: {
        businessNameRequired: string
        businessEmailInvalid: string
        businessCountryRequired: string
        defaultCurrencyRequired: string
      }
    }
    totp: {
      description: string
      passwordPlaceholder: string
      setupAuthenticator: string
      validation: {
        passwordRequired: string
      }
    }
    done: {
      title: string
      description: string
      goToDashboard: string
    }
  }
  settings: {
    metadata: {
      profile: string
      security: string
      appearance: string
      business: string
      payment: string
      invoicing: string
      taxRates: string
      templates: string
      email: string
    }
    navigation: {
      business: string
      invoicing: string
      email: string
      profile: string
      security: string
      appearance: string
      payment: string
      taxRates: string
    }
    profile: {
      title: string
      avatar: string
      uploadPhoto: string
      avatarHelp: string
      uploadUrlFailed: string
      uploadFailed: string
      avatarUpdated: string
      invalidAvatarFileType: string
      accountDetails: string
      displayName: string
      emailAddress: string
      emailVerificationDescription: string
      emailProviderRequired: string
      verificationEmailSent: string
      verificationEmailSentDescription: string
      profileUpdated: string
      session: string
      signOutDescription: string
      errors: {
        emailChangeFailed: string
        unauthorized: string
        avatarUpdateFailed: string
      }
      validation: {
        nameRequired: string
        emailInvalid: string
      }
    }
    security: {
      title: string
      twoFactor: string
      authenticatorApp: string
      authenticatorDescription: string
      reconfigure: string
      reconfigured: string
      reconfiguredDescription: string
      validation: {
        passwordRequired: string
      }
      dialog: {
        confirmTitle: string
        confirmDescription: string
        confirmPassword: string
        startFailed: string
        recoveryGenerationFailed: string
      }
    }
    appearance: {
      title: string
      theme: string
      themeDescription: string
      themeSystem: string
      themeLight: string
      themeDark: string
      fontFamily: string
      fontFamilyDescription: string
      fontFamilySystem: string
      fontSize: string
      fontSizeDescription: string
      fontSizeCompact: string
      fontSizeDefault: string
      fontSizeComfortable: string
      density: string
      densityDescription: string
      densityCompact: string
      densityDefault: string
      densitySpacious: string
      fontFamilySample: string
      fontSizeSample: string
    }
    business: {
      title: string
    }
    payment: {
      title: string
    }
    invoicing: {
      title: string
    }
    taxRates: {
      title: string
    }
    templates: {
      title: string
    }
    email: {
      title: string
    }
  }
}
