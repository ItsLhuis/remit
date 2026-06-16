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
      clear: string
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
    table: {
      selectAll: string
      selectRow: string
      columns: string
      toggleColumns: string
      noResults: string
      sortAscending: string
      sortDescending: string
      clearSelection: string
      selectedCount: string
      rowsPerPage: string
      rowsSelectedOfTotal: string
      page: string
      goToFirstPage: string
      goToPreviousPage: string
      goToNextPage: string
      goToLastPage: string
      goToPage: string
      clearFilter: string
      min: string
      max: string
      export: string
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
    copyManualEntryCode: string
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
  health: {
    dashboard: {
      title: string
      description: string
      readyTitle: string
      readyDescription: string
      attentionTitle: string
      dataAttentionTitle: string
      issueSummary: string
    }
    status: {
      healthy: string
      attention: string
      error: string
      notSetup: string
      optional: string
      info: string
    }
    sections: {
      core: {
        title: string
        description: string
      }
      safety: {
        title: string
        description: string
      }
      integrations: {
        title: string
        description: string
      }
      empty: string
    }
    systemInfo: {
      title: string
      description: string
      versionLabel: string
      versionHint: string
      fingerprintLabel: string
      fingerprintHint: string
    }
    actions: {
      configureEmail: string
      configurePayments: string
    }
    fingerprint: {
      copyLabel: string
      copyTooltip: string
    }
    checks: {
      database: {
        title: string
        reachable: string
        unavailable: string
        reachableDetail: string
        unavailableDetail: string
      }
      email: {
        title: string
        notConfigured: string
        notConfiguredDetail: string
        testedOk: string
        testedDetail: string
        configured: string
        configuredDetail: string
      }
      stripe: {
        title: string
        notConfigured: string
        notConfiguredDetail: string
        testedOk: string
        testedDetail: string
        configured: string
        configuredDetail: string
      }
      storage: {
        title: string
        notConfigured: string
        localWritable: string
        localWritableDetail: string
        localUnavailable: string
        localUnavailableDetail: string
        backupStorageMissing: string
        bucketReachable: string
        bucketReachableDetail: string
        bucketUnavailable: string
        bucketUnavailableDetail: string
      }
      backup: {
        destination: string
        lastFailure: string
        lastFailureReason: string
        title: string
        missing: string
        frequencyDetail: string
        lastSuccess: string
        neverFailed: string
        notRecorded: string
        staleDetail: string
        freshDetail: string
      }
      disk: {
        title: string
        used: string
        usageDetail: string
        highUsageDetail: string
        highInodesDetail: string
        unavailable: string
        unavailableDetail: string
      }
      migrations: {
        title: string
        upToDate: string
        upToDateDetail: string
        pending: string
        pendingDetail: string
        ahead: string
        aheadDetail: string
        unavailable: string
        unavailableDetail: string
      }
      publicUrl: {
        title: string
        detail: string
        invalid: string
        invalidDetail: string
        unreachable: string
        unreachableDetail: string
      }
    }
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
      leads: string
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
  clients: {
    metadata: {
      list: string
      create: string
      detail: string
      edit: string
    }
    actions: {
      create: string
      edit: string
      delete: string
      view: string
    }
    fields: {
      name: string
      email: string
      phone: string
      currency: string
      taxId: string
      addressLine1: string
      addressLine2: string
      city: string
      state: string
      postalCode: string
      country: string
      notes: string
      website: string
    }
    placeholders: {
      name: string
      email: string
      phone: string
      taxId: string
      addressLine1: string
      addressLine2: string
      city: string
      state: string
      postalCode: string
      website: string
      notes: string
    }
    status: {
      active: string
      deleted: string
      all: string
    }
    health: {
      owing: string
      settled: string
      dormant: string
    }
    summary: {
      activeClients: string
      activeClientsHint: string
      owingClients: string
      owingClientsHint: string
      outstanding: string
      outstandingHint: string
      outstandingMultiCurrency: string
      newClients: string
      newClientsHint: string
      monthlyDelta: string
      last6Months: string
      trendNewLabel: string
      trendTotalLabel: string
      healthTitle: string
      healthHint: string
    }
    filters: {
      title: string
      description: string
      search: string
      searchPlaceholder: string
      status: string
      currency: string
      allCurrencies: string
      health: string
      allHealth: string
      reset: string
    }
    list: {
      title: string
      description: string
      tableTitle: string
      tableDescription: string
      count: string
      outstandingBalance: string
      joined: string
      healthColumn: string
      actions: string
      viewProfile: string
      copyEmail: string
      emailCopied: string
      bulkDelete: string
      emptyTitle: string
      emptyDescription: string
      noMatchTitle: string
      noMatchDescription: string
    }
    form: {
      createTitle: string
      createDescription: string
      editTitle: string
      editDescription: string
      profileSection: string
      profileDescription: string
      addressSection: string
      addressDescription: string
      notesSection: string
      notesDescription: string
      saveCreate: string
      saveEdit: string
      created: string
      updated: string
    }
    delete: {
      title: string
      description: string
      confirm: string
      deleted: string
    }
    detail: {
      profileTitle: string
      profileDescription: string
      balanceTitle: string
      balanceDescription: string
      computedBadge: string
      addressTitle: string
      addressDescription: string
      notesTitle: string
      notesDescription: string
      relatedTitle: string
      relatedDescription: string
      emptyValue: string
      backToClients: string
      since: string
      tabs: {
        overview: string
        financials: string
        projects: string
        activity: string
        details: string
      }
      quick: {
        email: string
        call: string
        website: string
      }
      outstandingLabel: string
      outstandingOwing: string
      outstandingSettled: string
      outstandingDormant: string
      atAGlance: string
      statInvoices: string
      statProjects: string
      statRecurring: string
      statInvoicesHint: string
      statProjectsHint: string
      statRecurringHint: string
      trendBilledLabel: string
      trendProjectsLabel: string
      trendRecurringLabel: string
      trendEmpty: string
      notesEmpty: string
      contactTitle: string
      contactDescription: string
      billingTitle: string
      billingDescription: string
      updatedLabel: string
      editDetails: string
      invoicesEmptyTitle: string
      invoicesEmptyDescription: string
      projectsEmptyTitle: string
      projectsEmptyDescription: string
      activityEmptyTitle: string
      activityEmptyDescription: string
    }
    related: {
      projects: string
      projectsCount: string
      invoices: string
      invoicesCount: string
      recurringInvoices: string
      recurringInvoicesCount: string
    }
    errors: {
      notFound: string
      updateFailed: string
    }
    validation: {
      nameRequired: string
      nameTooLong: string
      emailInvalid: string
      emailTooLong: string
      textTooLong: string
      websiteInvalid: string
      currencyInvalid: string
      countryInvalid: string
      idInvalid: string
    }
  }
  leads: {
    metadata: {
      list: string
      create: string
      detail: string
      edit: string
    }
    actions: {
      create: string
      edit: string
      delete: string
      convert: string
    }
    fields: {
      name: string
      firstName: string
      lastName: string
      company: string
      email: string
      phone: string
      source: string
      status: string
      notes: string
      lostReason: string
    }
    placeholders: {
      firstName: string
      lastName: string
      company: string
      email: string
      phone: string
      source: string
      notes: string
      lostReason: string
    }
    status: {
      new: string
      contacted: string
      qualified: string
      proposal_sent: string
      won: string
      lost: string
    }
    statusFilter: {
      active: string
      deleted: string
      all: string
    }
    summary: {
      total: string
      totalHint: string
      newThisMonthDelta: string
      open: string
      openHint: string
      won: string
      wonHint: string
      converted: string
      convertedHint: string
      trendTotalLabel: string
      trendNewLabel: string
    }
    filters: {
      title: string
      search: string
      searchPlaceholder: string
      status: string
      reset: string
    }
    list: {
      title: string
      description: string
      tableTitle: string
      count: string
      created: string
      actions: string
      viewLead: string
      copyEmail: string
      emailCopied: string
      bulkDelete: string
      emptyTitle: string
      emptyDescription: string
      noMatchTitle: string
      noMatchDescription: string
    }
    form: {
      createTitle: string
      createDescription: string
      editTitle: string
      editDescription: string
      contactSection: string
      contactDescription: string
      pipelineSection: string
      pipelineDescription: string
      notesSection: string
      notesDescription: string
      saveCreate: string
      saveEdit: string
      created: string
      updated: string
    }
    delete: {
      title: string
      description: string
      confirm: string
      deleted: string
    }
    detail: {
      backToLeads: string
      backToLead: string
      since: string
      quickEmail: string
      convertedBadge: string
      contactTitle: string
      updatedLabel: string
      emptyValue: string
      statStage: string
      statStageHint: string
      statSourceHint: string
      statConverted: string
      statConvertedHint: string
      convertedYes: string
      convertedNo: string
      pipelineTitle: string
      currentStage: string
      viewClient: string
      lostReasonTitle: string
      notesTitle: string
      notesEmpty: string
      editDetails: string
    }
    stage: {
      changed: string
      terminal: string
      moveTo: string
      lostTitle: string
      lostDescription: string
      markLost: string
    }
    convert: {
      title: string
      description: string
      clientName: string
      currency: string
      confirm: string
      converted: string
    }
    errors: {
      notFound: string
      updateFailed: string
      invalidTransition: string
      alreadyConverted: string
    }
    validation: {
      textTooLong: string
      emailRequired: string
      emailInvalid: string
      emailTooLong: string
      nameRequired: string
      lostReasonRequired: string
      idInvalid: string
      clientNameRequired: string
      currencyInvalid: string
    }
  }
  projects: {
    metadata: {
      list: string
      create: string
      detail: string
      edit: string
    }
    actions: {
      create: string
      edit: string
      delete: string
    }
    fields: {
      name: string
      client: string
      status: string
      budget: string
      hourlyRate: string
      startDate: string
      endDate: string
      description: string
      currency: string
    }
    placeholders: {
      name: string
      client: string
      amount: string
      description: string
    }
    status: {
      active: string
      on_hold: string
      completed: string
      cancelled: string
    }
    statusFilter: {
      active: string
      deleted: string
      all: string
    }
    summary: {
      total: string
      totalHint: string
      newThisMonthDelta: string
      active: string
      activeHint: string
      onHold: string
      onHoldHint: string
      completed: string
      completedHint: string
      trendTotalLabel: string
      trendNewLabel: string
    }
    filters: {
      title: string
      search: string
      searchPlaceholder: string
      status: string
      reset: string
    }
    list: {
      title: string
      description: string
      tableTitle: string
      count: string
      created: string
      actions: string
      viewProject: string
      bulkDelete: string
      emptyTitle: string
      emptyDescription: string
      noMatchTitle: string
      noMatchDescription: string
    }
    form: {
      createTitle: string
      createDescription: string
      editTitle: string
      editDescription: string
      detailsSection: string
      detailsDescription: string
      budgetSection: string
      budgetDescription: string
      descriptionSection: string
      descriptionDescription: string
      saveCreate: string
      saveEdit: string
      created: string
      updated: string
      noClientsTitle: string
      noClientsDescription: string
      createClient: string
    }
    delete: {
      title: string
      description: string
      confirm: string
      deleted: string
    }
    detail: {
      backToProjects: string
      backToProject: string
      since: string
      updatedLabel: string
      emptyValue: string
      statStatus: string
      statStatusHint: string
      statBudgetHint: string
      statHourlyRateHint: string
      overviewTitle: string
      statusTitle: string
      currentStatus: string
      descriptionTitle: string
      descriptionEmpty: string
      editDetails: string
    }
    stage: {
      changed: string
      terminal: string
      moveTo: string
    }
    clientPanel: {
      title: string
      create: string
      emptyTitle: string
      emptyDescription: string
    }
    errors: {
      notFound: string
      clientNotFound: string
      updateFailed: string
      invalidTransition: string
    }
    validation: {
      amountInvalid: string
      dateInvalid: string
      descriptionTooLong: string
      clientRequired: string
      nameRequired: string
      nameTooLong: string
      endBeforeStart: string
      idInvalid: string
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
      email: string
      system: string
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
      system: string
    }
    profile: {
      title: string
      description: string
      avatar: string
      uploadPhoto: string
      removePhoto: string
      avatarHelp: string
      uploadUrlFailed: string
      uploadFailed: string
      avatarUpdated: string
      avatarRemoved: string
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
        avatarRemoveFailed: string
      }
      validation: {
        nameRequired: string
        emailInvalid: string
        avatarFilenameRequired: string
        avatarContentTypeRequired: string
        avatarSizeInvalid: string
        avatarTooLarge: string
      }
    }
    security: {
      title: string
      description: string
      password: string
      changePassword: {
        title: string
        description: string
        currentPassword: string
        newPassword: string
        confirmPassword: string
        currentPasswordPlaceholder: string
        newPasswordPlaceholder: string
        confirmPasswordPlaceholder: string
        submit: string
        changed: string
        changedDescription: string
      }
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
      description: string
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
      description: string
      logo: string
      logoDescription: string
      logoAlt: string
      fallbackBusinessName: string
      uploadLogo: string
      removeLogo: string
      logoHelp: string
      uploadUrlFailed: string
      uploadFailed: string
      logoUpdated: string
      logoRemoved: string
      invalidLogoFileType: string
      saved: string
      saveProfile: string
      profileSaved: string
      saveDefaults: string
      defaultsSaved: string
      saveTaxDetails: string
      taxDetailsSaved: string
      saveAddress: string
      addressSaved: string
      profileSection: string
      profileDescription: string
      localeSection: string
      localeDescription: string
      taxSection: string
      taxDescription: string
      addressSection: string
      addressDescription: string
      businessName: string
      businessNamePlaceholder: string
      businessEmail: string
      businessEmailPlaceholder: string
      businessPhone: string
      businessPhonePlaceholder: string
      businessWebsite: string
      businessWebsitePlaceholder: string
      defaultCurrency: string
      defaultLocale: string
      selectLocale: string
      defaultTimezone: string
      selectTimezone: string
      businessTaxId: string
      businessTaxIdPlaceholder: string
      addressLine1: string
      addressLine1Placeholder: string
      addressLine2: string
      addressLine2Placeholder: string
      city: string
      cityPlaceholder: string
      state: string
      statePlaceholder: string
      postalCode: string
      postalCodePlaceholder: string
      country: string
      errors: {
        updateFailed: string
        logoUpdateFailed: string
        logoRemoveFailed: string
      }
      validation: {
        nameRequired: string
        emailInvalid: string
        websiteInvalid: string
        currencyRequired: string
        localeRequired: string
        localeInvalid: string
        timezoneRequired: string
        timezoneInvalid: string
        countryRequired: string
        logoFilenameRequired: string
        logoContentTypeRequired: string
        logoSizeInvalid: string
        logoTooLarge: string
        logoObjectKeyRequired: string
      }
    }
    payment: {
      title: string
      description: string
      bankSection: string
      bankSectionDescription: string
      bankName: string
      bankNamePlaceholder: string
      iban: string
      ibanPlaceholder: string
      paymentInstructions: string
      paymentInstructionsPlaceholder: string
      paymentInstructionsHelp: string
      stripeSection: string
      stripeSectionDescription: string
      stripePublishableKey: string
      stripePublishableKeyPlaceholder: string
      stripeSecretKey: string
      stripeSecretKeyPlaceholder: string
      stripeWebhookSecret: string
      stripeWebhookSecretPlaceholder: string
      configuredPlaceholder: string
      changeSecret: string
      encryptedValuePreserved: string
      secretPreserved: string
      save: string
      saved: string
      testStripeConnection: string
      stripeTestSucceeded: string
      saveBeforeTest: string
      lastStripeTest: string
      lastStripeTestNever: string
      errors: {
        updateFailed: string
        stripeNotConfigured: string
        stripeTestFailed: string
        stripeAuthFailed: string
        stripeConnectionFailed: string
        stripePermissionFailed: string
        stripeRateLimited: string
        stripeRejected: string
        stripeApiFailed: string
      }
      validation: {
        ibanInvalid: string
        stripePublishableKeyInvalid: string
        stripePublishableKeyRequired: string
        stripeSecretKeyInvalid: string
        stripeSecretKeyRequired: string
        stripeWebhookSecretInvalid: string
      }
    }
    invoicing: {
      title: string
      description: string
      numberingSection: string
      numberingSectionDescription: string
      invoicePrefix: string
      invoicePrefixPlaceholder: string
      invoicePrefixHelp: string
      numberPaddingWidth: string
      numberPaddingWidthHelp: string
      nextInvoiceNumber: string
      nextInvoiceNumberHelp: string
      paymentTermsDays: string
      paymentTermsDaysHelp: string
      documentDefaultsSection: string
      documentDefaultsSectionDescription: string
      defaultNotesInvoice: string
      defaultNotesInvoicePlaceholder: string
      defaultNotesInvoiceHelp: string
      defaultInvoiceFooter: string
      defaultInvoiceFooterPlaceholder: string
      defaultInvoiceFooterHelp: string
      save: string
      saved: string
      errors: {
        updateFailed: string
      }
      validation: {
        invoicePrefixTooLong: string
        invoicePrefixInvalid: string
        numberPaddingWidthInvalid: string
        nextInvoiceNumberInvalid: string
        nextInvoiceNumberForward: string
        paymentTermsDaysInvalid: string
      }
    }
    taxRates: {
      title: string
      description: string
      listTitle: string
      currentDefault: string
      noDefault: string
      addRate: string
      emptyTitle: string
      emptyDescription: string
      tableName: string
      tableRate: string
      tableStatus: string
      tableActions: string
      name: string
      namePlaceholder: string
      percentage: string
      percentageHelp: string
      percentageValue: string
      defaultBadge: string
      notDefaultBadge: string
      createTitle: string
      createDescription: string
      editTitle: string
      editDescription: string
      saveCreate: string
      saveEdit: string
      editRate: string
      makeDefault: string
      deleteRate: string
      deleteTitle: string
      deleteDescription: string
      deleteDescriptionFallback: string
      confirmDelete: string
      created: string
      updated: string
      deleted: string
      defaultUpdated: string
      errors: {
        updateFailed: string
        notFound: string
        defaultConflict: string
      }
      validation: {
        nameRequired: string
        nameTooLong: string
        percentageInvalid: string
        percentageRange: string
        percentagePrecision: string
        idInvalid: string
      }
    }
    email: {
      title: string
      description: string
      provider: string
      providerSmtp: string
      providerSmtpHelp: string
      providerResend: string
      providerResendHelp: string
      senderSection: string
      smtpSection: string
      resendSection: string
      testSection: string
      fromName: string
      fromNamePlaceholder: string
      fromAddress: string
      fromAddressPlaceholder: string
      smtpHost: string
      smtpHostPlaceholder: string
      smtpPort: string
      smtpUser: string
      smtpUserPlaceholder: string
      smtpPassword: string
      smtpPasswordPlaceholder: string
      smtpSecure: string
      smtpSecureHelp: string
      resendApiKey: string
      resendApiKeyPlaceholder: string
      configuredPlaceholder: string
      changeSecret: string
      secretPreserved: string
      save: string
      saved: string
      sendTest: string
      testSent: string
      testRecipient: string
      saveBeforeTest: string
      lastTestSend: string
      lastTestSendNever: string
      testSubject: string
      testText: string
      errors: {
        updateFailed: string
        notConfigured: string
        testSendFailed: string
        smtpAuthFailed: string
        smtpConnectionFailed: string
        smtpTimeout: string
        smtpTlsFailed: string
        resendAuthFailed: string
        resendRejected: string
      }
      validation: {
        providerRequired: string
        fromNameRequired: string
        fromAddressInvalid: string
        smtpHostRequired: string
        smtpPortInvalid: string
        smtpUserRequired: string
        smtpPasswordRequired: string
        resendApiKeyRequired: string
        recipientInvalid: string
      }
    }
    system: {
      title: string
    }
  }
}
