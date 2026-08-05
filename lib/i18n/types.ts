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
      showPassword: string
      hidePassword: string
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
      selectDate: string
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
    chart: {
      noData: string
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
      passwordStrengthLabel: string
      passwordStrengthEmpty: string
      passwordStrengthWeak: string
      passwordStrengthMedium: string
      passwordStrengthStrong: string
      passwordStrengthVeryStrong: string
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
      time: string
      proposals: string
      contracts: string
      invoices: string
      recurringInvoices: string
      creditNotes: string
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
      defaultHourlyRate: string
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
      defaultHourlyRate: string
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
      trendEmpty: string
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
      hourlyRateInvalid: string
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
      trendEmpty: string
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
      statusLabel: string
      contactTitle: string
      updatedLabel: string
      emptyValue: string
      statConverted: string
      convertedYes: string
      convertedNo: string
      activityTitle: string
      activityEmptyTitle: string
      activityEmpty: string
      convertTitle: string
      convertDescription: string
      convertedTitle: string
      convertedOn: string
      viewClient: string
      lostReasonTitle: string
      notesTitle: string
      notesEmpty: string
      editDetails: string
    }
    stage: {
      changed: string
      changeStatus: string
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
      trendEmpty: string
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
      overviewTitle: string
      activityTitle: string
      activityEmptyTitle: string
      activityEmpty: string
      descriptionTitle: string
      descriptionEmpty: string
      editDetails: string
    }
    stage: {
      changed: string
      changeStatus: string
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
  tasks: {
    metadata: {
      board: string
    }
    board: {
      title: string
      description: string
      backToProject: string
      createButton: string
      count: string
      searchPlaceholder: string
      searchLabel: string
      priorityFilter: string
      clearFilters: string
    }
    view: {
      label: string
      kanban: string
      table: string
    }
    status: {
      backlog: string
      todo: string
      in_progress: string
      done: string
      cancelled: string
    }
    priority: {
      low: string
      normal: string
      high: string
      urgent: string
    }
    card: {
      actions: string
      changeStatus: string
      moveUp: string
      moveDown: string
      edit: string
      delete: string
      dragHandle: string
      dueLabel: string
      noDue: string
    }
    columns: {
      empty: string
      dropHint: string
    }
    quickAdd: {
      button: string
      placeholder: string
      submit: string
      cancel: string
    }
    dnd: {
      instructions: string
      onDragStart: string
      onDragOver: string
      onDragEnd: string
      onDragCancel: string
    }
    table: {
      titleColumn: string
      statusColumn: string
      priorityColumn: string
      dueColumn: string
      rateColumn: string
      actions: string
    }
    fields: {
      title: string
      description: string
      status: string
      priority: string
      dueDate: string
      hourlyRate: string
    }
    placeholders: {
      title: string
      description: string
      amount: string
    }
    form: {
      createTitle: string
      createDescription: string
      editTitle: string
      editDescription: string
      saveCreate: string
      saveEdit: string
    }
    delete: {
      title: string
      description: string
      confirm: string
      deleted: string
    }
    empty: {
      title: string
      description: string
    }
    actions: {
      create: string
      edit: string
      delete: string
    }
    notifications: {
      created: string
      updated: string
      statusChanged: string
      reordered: string
    }
    validation: {
      titleRequired: string
      titleTooLong: string
      descriptionTooLong: string
      amountInvalid: string
      dateInvalid: string
      idInvalid: string
      projectRequired: string
      positionInvalid: string
    }
    errors: {
      notFound: string
      projectNotFound: string
      invalidTransition: string
      updateFailed: string
    }
  }
  timeTracking: {
    metadata: {
      list: string
    }
    list: {
      title: string
      description: string
      tableTitle: string
      count: string
      actions: string
      edit: string
      bulkDelete: string
      emptyTitle: string
      emptyDescription: string
      noProjectsDescription: string
      noMatchTitle: string
      noMatchDescription: string
    }
    actions: {
      logManually: string
      delete: string
    }
    filters: {
      title: string
      search: string
      searchPlaceholder: string
      status: string
      reset: string
    }
    status: {
      active: string
      deleted: string
      all: string
    }
    fields: {
      project: string
      projectOption: string
      task: string
      noTask: string
      description: string
      startedAt: string
      endedAt: string
      duration: string
      billable: string
      billableHelp: string
      hourlyRate: string
      invoiced: string
      source: string
      amount: string
    }
    placeholders: {
      project: string
      description: string
      hourlyRate: string
    }
    billable: {
      billable: string
      nonBillable: string
    }
    invoiced: {
      unbilled: string
      invoiced: string
    }
    source: {
      timer: string
      manual: string
    }
    duration: {
      hoursMinutes: string
      withSeconds: string
    }
    timer: {
      idleTitle: string
      idleDescription: string
      runningTitle: string
      runningDescription: string
      running: string
      rateHint: string
      start: string
      stop: string
      started: string
      stopped: string
    }
    summary: {
      tracked: string
      trackedHint: string
      billable: string
      billableHint: string
      unbilled: string
      unbilledHint: string
    }
    form: {
      createTitle: string
      createDescription: string
      editTitle: string
      editDescription: string
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
    validation: {
      projectRequired: string
      taskInvalid: string
      idInvalid: string
      amountInvalid: string
      descriptionTooLong: string
      dateTimeInvalid: string
      endBeforeStart: string
    }
    errors: {
      notFound: string
      projectNotFound: string
      taskNotFound: string
      taskProjectMismatch: string
      timerAlreadyRunning: string
      timerNotRunning: string
      timerRunning: string
      endBeforeStart: string
      alreadyInvoiced: string
      updateFailed: string
    }
  }
  proposals: {
    metadata: {
      list: string
      detail: string
      create: string
      edit: string
    }
    list: {
      title: string
      description: string
      backToProject: string
      createButton: string
      count: string
      searchPlaceholder: string
      searchLabel: string
      statusFilter: string
      clearFilters: string
    }
    overview: {
      title: string
      description: string
      tableTitle: string
      totalHint: string
      projectColumn: string
      clientColumn: string
      openProject: string
      browseProjects: string
      searchPlaceholder: string
      searchLabel: string
      filters: string
      emptyTitle: string
      emptyDescription: string
      noMatchTitle: string
      noMatchDescription: string
    }
    status: {
      draft: string
      sent: string
      accepted: string
      rejected: string
    }
    summary: {
      total: string
      totalHint: string
      draft: string
      draftHint: string
      awaiting: string
      awaitingHint: string
      accepted: string
      acceptedMultiCurrency: string
      acceptedValue: string
    }
    table: {
      numberColumn: string
      statusColumn: string
      validUntilColumn: string
      totalColumn: string
      createdColumn: string
      actions: string
      noValidUntil: string
    }
    fields: {
      number: string
      status: string
      template: string
      currency: string
      validUntil: string
      notes: string
      discountType: string
      discountPercentage: string
      discountAmount: string
    }
    lineItems: {
      title: string
      addButton: string
      removeButton: string
      moveUp: string
      moveDown: string
      descriptionColumn: string
      quantityColumn: string
      unitColumn: string
      unitPriceColumn: string
      discountColumn: string
      taxColumn: string
      totalColumn: string
      actionsColumn: string
      rowLabel: string
      empty: string
      noTaxRate: string
    }
    placeholders: {
      description: string
      unit: string
      amount: string
      quantity: string
      notes: string
      percentage: string
      search: string
    }
    discount: {
      none: string
      percentage: string
      fixed: string
    }
    totals: {
      subtotal: string
      discount: string
      tax: string
      total: string
    }
    template: {
      none: string
    }
    form: {
      backToList: string
      backToProposal: string
      createTitle: string
      createDescription: string
      editTitle: string
      editDescription: string
      saveCreate: string
      saveEdit: string
      detailsSection: string
      detailsDescription: string
      lineItemsSection: string
      lineItemsDescription: string
      notesSection: string
      notesDescription: string
    }
    detail: {
      backToList: string
      issuedAt: string
      notIssued: string
      viewsLabel: string
      viewCount: string
      lockedTitle: string
      lockedDescription: string
      notesTitle: string
      summaryTitle: string
      publicLinkTitle: string
      publicLinkDescription: string
      publicLinkHidden: string
      copyLink: string
      linkCopied: string
    }
    send: {
      title: string
      description: string
      confirm: string
    }
    delete: {
      title: string
      description: string
      confirm: string
    }
    empty: {
      title: string
      description: string
    }
    actions: {
      create: string
      edit: string
      send: string
      delete: string
      view: string
      rowActions: string
    }
    notifications: {
      created: string
      updated: string
      sent: string
      deleted: string
    }
    validation: {
      descriptionRequired: string
      descriptionTooLong: string
      quantityInvalid: string
      amountInvalid: string
      amountRequired: string
      percentageInvalid: string
      dateInvalid: string
      idInvalid: string
      projectRequired: string
      lineItemsRequired: string
      notesTooLong: string
      unitTooLong: string
      currencyInvalid: string
      taxRateInvalid: string
      discountAmountRequired: string
      discountPercentageRequired: string
    }
    public: {
      metadataTitle: string
      fromLabel: string
      preparedFor: string
      unavailable: {
        title: string
        description: string
      }
      summary: {
        title: string
        issuedAt: string
        validUntil: string
        noValidUntil: string
      }
      respond: {
        title: string
        description: string
        accept: string
        reject: string
        back: string
        resend: string
      }
      identity: {
        acceptTitle: string
        acceptDescription: string
        rejectTitle: string
        rejectDescription: string
        emailLabel: string
        emailPlaceholder: string
        reasonLabel: string
        reasonPlaceholder: string
        submit: string
      }
      code: {
        title: string
        description: string
        label: string
        submit: string
      }
      outcome: {
        acceptedTitle: string
        acceptedDescription: string
        rejectedTitle: string
        rejectedDescription: string
        reasonLabel: string
        respondedAt: string
      }
      email: {
        subject: string
        body: string
      }
      validation: {
        action: string
        tokenInvalid: string
        emailInvalid: string
        codeInvalid: string
        reasonRequired: string
        reasonTooLong: string
      }
      errors: {
        unavailable: string
        alreadyResponded: string
        requestFailed: string
        emailFailed: string
        responseFailed: string
        codeInvalid: string
        codeExpired: string
        codeConsumed: string
        codeAttemptsExhausted: string
        rateLimited: string
      }
    }
    errors: {
      notFound: string
      projectNotFound: string
      notDraft: string
      invalidTransition: string
      updateFailed: string
      sendFailed: string
    }
  }
  contracts: {
    metadata: {
      list: string
      detail: string
      create: string
      edit: string
    }
    title: string
    subtitle: string
    actions: {
      create: string
      createFromProposal: string
      edit: string
      send: string
      terminate: string
      delete: string
      view: string
      rowActions: string
    }
    fields: {
      number: string
      title: string
      status: string
      parent: string
      project: string
      client: string
      template: string
      effectiveFrom: string
      effectiveUntil: string
      issuedAt: string
      terminatedAt: string
      terminationReason: string
    }
    status: {
      draft: string
      sent: string
      signed: string
      expired: string
      terminated: string
    }
    summary: {
      total: string
      totalHint: string
      draft: string
      draftHint: string
      sent: string
      sentHint: string
      signed: string
      signedHint: string
    }
    table: {
      numberColumn: string
      titleColumn: string
      parentColumn: string
      statusColumn: string
      effectiveColumn: string
      createdColumn: string
      actions: string
      noParent: string
      noEffectiveRange: string
    }
    filters: {
      count: string
      searchPlaceholder: string
      searchLabel: string
      statusFilter: string
      allStatuses: string
      clearFilters: string
    }
    empty: {
      title: string
      description: string
      noMatchTitle: string
      noMatchDescription: string
    }
    form: {
      backToList: string
      createTitle: string
      createDescription: string
      editTitle: string
      editDescription: string
      saveCreate: string
      saveEdit: string
      detailsSection: string
      detailsDescription: string
      parentSection: string
      parentDescription: string
      contentSection: string
      contentDescription: string
      noProject: string
      noClient: string
      noTemplate: string
      blockCount: string
      blocksEmpty: string
    }
    detail: {
      backToList: string
      issuedAt: string
      notIssued: string
      effectiveWindow: string
      openParent: string
      lockedTitle: string
      lockedDescription: string
      contentTitle: string
      summaryTitle: string
      terminationTitle: string
    }
    dialogs: {
      send: {
        title: string
        description: string
        confirm: string
      }
      terminate: {
        title: string
        description: string
        confirm: string
        reasonLabel: string
        reasonPlaceholder: string
      }
      delete: {
        title: string
        description: string
        confirm: string
      }
    }
    notifications: {
      created: string
      updated: string
      sent: string
      terminated: string
      deleted: string
    }
    public: {
      metadataTitle: string
      fromLabel: string
      preparedFor: string
      unavailable: {
        title: string
        description: string
      }
      document: {
        title: string
        frameTitle: string
        empty: string
      }
      summary: {
        title: string
        issuedAt: string
        effectiveFrom: string
        effectiveUntil: string
        none: string
      }
      sign: {
        title: string
        description: string
        nameLabel: string
        namePlaceholder: string
        emailLabel: string
        emailPlaceholder: string
        consentLabel: string
        submit: string
      }
      consent: {
        text: string
      }
      signed: {
        title: string
        description: string
        signedAt: string
      }
      validation: {
        tokenInvalid: string
        nameRequired: string
        nameTooLong: string
        emailInvalid: string
        consentRequired: string
      }
      errors: {
        unavailable: string
        alreadySigned: string
        signFailed: string
        requestFailed: string
        rateLimited: string
      }
    }
    validation: {
      idInvalid: string
      proposalIdInvalid: string
      titleRequired: string
      parentRequired: string
      effectiveRangeInvalid: string
      terminationReasonRequired: string
      blocksRequired: string
    }
    errors: {
      notFound: string
      notDraft: string
      invalidTransition: string
      parentNotFound: string
      proposalNotConvertible: string
      proposalAlreadyConverted: string
      createFailed: string
      updateFailed: string
      sendFailed: string
      terminateFailed: string
      deleteFailed: string
    }
  }
  invoices: {
    metadata: {
      list: string
      detail: string
      create: string
      edit: string
    }
    reminders: {
      subjectBefore: string
      subjectAfter: string
      bodyBefore: string
      bodyAfter: string
    }
    list: {
      title: string
      description: string
      backToProject: string
      createButton: string
      moreActions: string
      count: string
      clearFilters: string
    }
    overview: {
      title: string
      description: string
      tableTitle: string
      totalHint: string
      parentColumn: string
      clientColumn: string
      outstandingColumn: string
      noParent: string
      noClient: string
      openProject: string
      openClient: string
      browseProjects: string
      searchPlaceholder: string
      searchLabel: string
      filters: string
      emptyTitle: string
      emptyDescription: string
      noMatchTitle: string
      noMatchDescription: string
    }
    status: {
      draft: string
      sent: string
      paid: string
      overdue: string
      partially_paid: string
    }
    summary: {
      total: string
      totalHint: string
      draft: string
      draftHint: string
      overdue: string
      overdueHint: string
      outstanding: string
      outstandingHint: string
      outstandingMultiCurrency: string
    }
    table: {
      numberColumn: string
      statusColumn: string
      issueDateColumn: string
      dueDateColumn: string
      totalColumn: string
      notIssued: string
      noDueDate: string
    }
    fields: {
      currency: string
      template: string
      issueDate: string
      dueDate: string
      notes: string
      discountType: string
      discountPercentage: string
      discountAmount: string
    }
    lineItems: {
      title: string
      addButton: string
      removeButton: string
      descriptionColumn: string
      quantityColumn: string
      unitColumn: string
      unitPriceColumn: string
      discountColumn: string
      taxColumn: string
      totalColumn: string
      rowLabel: string
      empty: string
      noTaxRate: string
    }
    placeholders: {
      description: string
      unit: string
      amount: string
      quantity: string
      notes: string
      percentage: string
    }
    discount: {
      none: string
      percentage: string
      fixed: string
    }
    totals: {
      subtotal: string
      discount: string
      tax: string
      total: string
      amountPaid: string
      outstanding: string
      credited: string
      effectiveReceivable: string
    }
    template: {
      none: string
    }
    form: {
      backToList: string
      backToInvoice: string
      createTitle: string
      createDescription: string
      editTitle: string
      editDescription: string
      saveCreate: string
      saveEdit: string
      detailsSection: string
      detailsDescription: string
      lineItemsSection: string
      lineItemsDescription: string
      notesSection: string
      notesDescription: string
    }
    detail: {
      backToList: string
      notIssued: string
      paidAt: string
      notPaid: string
      viewsLabel: string
      viewCount: string
      lockedTitle: string
      lockedDescription: string
      notesTitle: string
      summaryTitle: string
      publicLinkTitle: string
      publicLinkDescription: string
      publicLinkHidden: string
      copyLink: string
      linkCopied: string
    }
    send: {
      title: string
      description: string
      confirm: string
    }
    markPaid: {
      title: string
      description: string
      confirm: string
    }
    convert: {
      title: string
      description: string
      proposalLabel: string
      proposalPlaceholder: string
      proposalOption: string
      confirm: string
      empty: string
    }
    delete: {
      title: string
      description: string
      confirm: string
    }
    empty: {
      title: string
      description: string
    }
    actions: {
      create: string
      edit: string
      send: string
      markPaid: string
      delete: string
      view: string
      rowActions: string
      convertProposal: string
    }
    notifications: {
      created: string
      updated: string
      sent: string
      markedPaid: string
      deleted: string
      converted: string
    }
    validation: {
      descriptionRequired: string
      descriptionTooLong: string
      quantityInvalid: string
      amountInvalid: string
      amountRequired: string
      percentageInvalid: string
      dateInvalid: string
      dueDateBeforeIssueDate: string
      idInvalid: string
      proposalIdInvalid: string
      projectRequired: string
      lineItemsRequired: string
      notesTooLong: string
      unitTooLong: string
      currencyInvalid: string
      taxRateInvalid: string
      discountAmountRequired: string
      discountPercentageRequired: string
    }
    public: {
      metadataTitle: string
      fromLabel: string
      preparedFor: string
      unavailable: {
        title: string
        description: string
      }
      summary: {
        title: string
        issueDate: string
        dueDate: string
        paidAt: string
        noDate: string
      }
      payment: {
        title: string
        description: string
        settledTitle: string
        settledDescription: string
        settledNote: string
        amountDue: string
        amountSettled: string
        bankTitle: string
        bankName: string
        iban: string
        reference: string
        cardTitle: string
        cardButton: string
        cardUnavailable: string
        noMethods: string
      }
      validation: {
        tokenInvalid: string
      }
    }
    errors: {
      notFound: string
      projectNotFound: string
      notDraft: string
      invalidTransition: string
      createFailed: string
      updateFailed: string
      sendFailed: string
      markPaidFailed: string
      deleteFailed: string
      proposalNotConvertible: string
      proposalAlreadyConverted: string
      proposalHasNoLineItems: string
    }
  }
  creditNotes: {
    metadata: {
      list: string
      detail: string
      create: string
    }
    overview: {
      title: string
      description: string
      tableTitle: string
      count: string
      numberColumn: string
      invoiceColumn: string
      clientColumn: string
      issuedColumn: string
      totalColumn: string
      rowActions: string
      noClient: string
      openInvoice: string
      openClient: string
      browseInvoices: string
      searchPlaceholder: string
      searchLabel: string
      filters: string
      clearFilters: string
      emptyTitle: string
      emptyDescription: string
      noMatchTitle: string
      noMatchDescription: string
    }
    summary: {
      total: string
      totalHint: string
      credited: string
      creditedHint: string
      creditedMultiCurrency: string
      invoicesCredited: string
      invoicesCreditedHint: string
      average: string
      averageHint: string
    }
    card: {
      title: string
      description: string
      issuedOn: string
    }
    empty: {
      title: string
      description: string
      lockedDescription: string
    }
    actions: {
      create: string
      view: string
      delete: string
      backToInvoice: string
      backToList: string
    }
    fields: {
      reason: string
      invoice: string
      client: string
      issuedAt: string
    }
    placeholders: {
      reason: string
      description: string
      quantity: string
      unit: string
      amount: string
      percentage: string
    }
    form: {
      createTitle: string
      createDescription: string
      creditingInvoice: string
      lineItemsSection: string
      lineItemsDescription: string
      reasonSection: string
      reasonDescription: string
      saveCreate: string
    }
    lineItems: {
      empty: string
      addButton: string
      removeButton: string
      rowLabel: string
      tableTitle: string
      descriptionColumn: string
      quantityColumn: string
      unitPriceColumn: string
      taxColumn: string
      totalColumn: string
      unitColumn: string
      discountColumn: string
      noTaxRate: string
    }
    discount: {
      none: string
      percentage: string
      fixed: string
    }
    totals: {
      subtotal: string
      tax: string
      total: string
      invoiceTotal: string
      alreadyCredited: string
      outstanding: string
    }
    detail: {
      summaryTitle: string
      reasonTitle: string
      noReason: string
    }
    delete: {
      title: string
      description: string
      confirm: string
    }
    notifications: {
      created: string
      deleted: string
    }
    validation: {
      descriptionRequired: string
      descriptionTooLong: string
      unitTooLong: string
      quantityInvalid: string
      amountRequired: string
      amountInvalid: string
      percentageInvalid: string
      discountPercentageRequired: string
      discountAmountRequired: string
      reasonTooLong: string
      lineItemsRequired: string
      taxRateInvalid: string
      invoiceIdInvalid: string
      idInvalid: string
    }
    errors: {
      notFound: string
      invoiceNotFound: string
      invoiceNotIssued: string
      totalNotPositive: string
      settingsMissing: string
      createFailed: string
      deleteFailed: string
    }
    routeError: {
      title: string
      description: string
    }
  }
  recurringInvoices: {
    metadata: {
      list: string
      detail: string
      create: string
      edit: string
    }
    list: {
      title: string
      description: string
      createButton: string
      searchPlaceholder: string
      moreActions: string
      columns: {
        name: string
        client: string
        project: string
        cadence: string
        nextRun: string
        status: string
        occurrences: string
      }
      empty: {
        title: string
        description: string
        action: string
      }
    }
    filters: {
      status: string
      cadence: string
      client: string
      clear: string
    }
    status: {
      active: string
      paused: string
      completed: string
      cancelled: string
    }
    cadence: {
      weekly: string
      monthly: string
      quarterly: string
      yearly: string
    }
    fields: {
      name: string
      client: string
      project: string
      template: string
      cadence: string
      cadenceDay: string
      nextRunAt: string
      endCondition: string
      endAfterCount: string
      endByDate: string
      autoSend: string
      currency: string
      includedHours: string
      overageRate: string
      notes: string
      lineItems: string
    }
    fieldHints: {
      cadenceDayWeekly: string
      cadenceDayMonthly: string
      autoSend: string
      includedHours: string
      overageRate: string
    }
    endCondition: {
      never: string
      after_count: string
      by_date: string
    }
    form: {
      createTitle: string
      createDescription: string
      editTitle: string
      editDescription: string
      sections: {
        details: string
        schedule: string
        retainer: string
        lineItems: string
        notes: string
      }
      addLineItem: string
      removeLineItem: string
      submitCreate: string
      submitEdit: string
      cancel: string
      retainerToggle: string
      retainerDescription: string
    }
    detail: {
      title: string
      scheduleSummary: string
      nextRun: string
      lastRun: string
      occurrences: string
      endCondition: string
      retainer: string
      retainerNone: string
      generatedInvoices: string
      generatedInvoicesEmpty: string
      noProject: string
    }
    dialogs: {
      pause: {
        title: string
        description: string
        confirm: string
      }
      resume: {
        title: string
        description: string
        confirm: string
      }
      cancel: {
        title: string
        description: string
        confirm: string
      }
      delete: {
        title: string
        description: string
        confirm: string
      }
    }
    toasts: {
      created: string
      updated: string
      paused: string
      resumed: string
      cancelled: string
      deleted: string
    }
    validation: {
      nameRequired: string
      nameTooLong: string
      clientRequired: string
      referenceInvalid: string
      cadenceDayInvalid: string
      cadenceDayOutOfRange: string
      nextRunRequired: string
      dateInvalid: string
      occurrenceCountRequired: string
      occurrenceCountInvalid: string
      endDateRequired: string
      endDateBeforeNextRun: string
      currencyInvalid: string
      includedHoursInvalid: string
      retainerIncomplete: string
      notesTooLong: string
      lineItemsRequired: string
      descriptionRequired: string
      descriptionTooLong: string
      unitTooLong: string
      quantityInvalid: string
      amountRequired: string
      amountInvalid: string
      percentageInvalid: string
    }
    overage: {
      lineDescription: string
      lineUnit: string
    }
    errors: {
      notFound: string
      clientNotFound: string
      projectNotFound: string
      taxRateInvalid: string
      invalidTransition: string
      terminal: string
      createFailed: string
      updateFailed: string
      deleteFailed: string
    }
    routeError: {
      title: string
      description: string
    }
  }
  payments: {
    method: {
      bank_transfer: string
      stripe: string
      cash: string
      other: string
    }
    list: {
      title: string
      description: string
      rowActions: string
    }
    actions: {
      record: string
      edit: string
      delete: string
    }
    empty: {
      title: string
      description: string
      draftDescription: string
    }
    totals: {
      recorded: string
      outstanding: string
    }
    fields: {
      amount: string
      paidAt: string
      method: string
      reference: string
      notes: string
    }
    placeholders: {
      amount: string
      reference: string
      notes: string
    }
    form: {
      createTitle: string
      createDescription: string
      editTitle: string
      editDescription: string
      saveCreate: string
      saveEdit: string
      recorded: string
      updated: string
    }
    delete: {
      title: string
      description: string
      confirm: string
    }
    notifications: {
      deleted: string
    }
    validation: {
      amountRequired: string
      amountInvalid: string
      amountPositive: string
      dateInvalid: string
      referenceTooLong: string
      notesTooLong: string
      invoiceIdInvalid: string
      idInvalid: string
    }
    errors: {
      notFound: string
      invoiceNotFound: string
      invoiceNotIssued: string
      currencyMismatch: string
      overpayment: string
      providerOwned: string
      alreadySettled: string
      recordFailed: string
      updateFailed: string
      deleteFailed: string
    }
    webhook: {
      rateLimited: string
      rejected: string
    }
  }
  templates: {
    metadataTitle: string
    title: string
    description: string
    list: {
      tableTitle: string
      count: string
      actions: string
      updatedColumn: string
      noMatchTitle: string
      noMatchDescription: string
    }
    summary: {
      total: string
      totalHint: string
      customDelta: string
      documents: string
      documentsHint: string
      emails: string
      emailsHint: string
      otherEmails: string
      defaults: string
      defaultsValue: string
      defaultsHint: string
      defaultsMissingHint: string
      defaultsCovered: string
      defaultsMissing: string
      breakdownEmpty: string
    }
    filters: {
      title: string
      search: string
      searchPlaceholder: string
      origin: string
      reset: string
    }
    origin: {
      all: string
      custom: string
      system: string
    }
    preview: {
      frameTitle: string
      empty: string
    }
    types: {
      invoice: string
      proposal: string
      contract: string
      credit_note: string
      email_invoice_send: string
      email_proposal_send: string
      email_contract_send: string
      email_payment_receipt: string
      email_overdue_reminder: string
      email_recurring_generated: string
    }
    actions: {
      create: string
      edit: string
      preview: string
      duplicate: string
      delete: string
      setDefault: string
      backToList: string
    }
    badges: {
      default: string
      system: string
    }
    empty: {
      title: string
      description: string
    }
    form: {
      createTitle: string
      createDescription: string
      saveCreate: string
      created: string
    }
    delete: {
      description: string
    }
    fields: {
      name: string
      namePlaceholder: string
      type: string
      typePlaceholder: string
      subject: string
      subjectPlaceholder: string
    }
    blocks: {
      text: string
      image: string
      table: string
      frame: string
      group: string
      shape: string
      shapeVariant: {
        rectangle: string
        ellipse: string
        line: string
      }
    }
    editor: {
      previewTab: string
      previewTitle: string
      previewEmpty: string
      emptyCanvasTitle: string
      emptyCanvasDescription: string
      save: string
      unsaved: string
      selectBlock: string
      duplicateBlock: string
      removeBlock: string
      moveUp: string
      moveDown: string
      moveLeft: string
      moveRight: string
      hideBlock: string
      showBlock: string
      lockBlock: string
      unlockBlock: string
      bringToFront: string
      bringForward: string
      sendBackward: string
      sendToBack: string
      layersTitle: string
      layersEmpty: string
      pageLayer: string
      renameBlock: string
      layerDragHandle: string
      layerMoved: string
      layerReparented: string
      groupCreated: string
      frameCreated: string
      ungroupedBlocks: string
      duplicated: string
      pasted: string
      broughtToFront: string
      broughtForward: string
      sentBackward: string
      sentToBack: string
      zoomIn: string
      zoomOut: string
      zoomFit: string
      fullscreen: string
      exitFullscreen: string
      showGrid: string
      undo: string
      redo: string
      renameTemplate: string
      toolSelect: string
      toolPan: string
      insertMenu: string
      statusNoSelection: string
      statusSize: string
      statusPosition: string
      gridSize: string
      sectionLayout: string
      sectionSpacing: string
      sectionAppearance: string
      sectionTypography: string
      sectionContent: string
      sizeWidth: string
      sizeHeight: string
      positionX: string
      positionY: string
      paddingAll: string
      paddingTop: string
      paddingRight: string
      paddingBottom: string
      paddingLeft: string
      backgroundColor: string
      backgroundNone: string
      backgroundSolid: string
      borderWidth: string
      borderColor: string
      borderRadius: string
      fontFamily: string
      fontSize: string
      fontWeight: string
      textColor: string
      textAlign: string
      alignLeft: string
      alignCenter: string
      alignRight: string
      lineHeight: string
      weight300: string
      weight400: string
      weight500: string
      weight600: string
      weight700: string
      pageDefault: string
      richText: string
      imageAlt: string
      imageSource: string
      imageSourceUpload: string
      imageSourceBusinessLogo: string
      businessLogoMissing: string
      uploadImage: string
      replaceImage: string
      imageEmpty: string
      tableSource: string
      tableSourceManual: string
      tableSourceLineItems: string
      tableBinding: string
      tableHeaderPlaceholder: string
      tableCellPlaceholder: string
      tableAddColumn: string
      tableRemoveColumn: string
      tableAddRow: string
      tableRemoveRow: string
      frameClip: string
      frameChildMoveUp: string
      frameChildMoveDown: string
      shapeVariant: string
      resizeHandle: string
      rotateHandle: string
      rotationBadge: string
      rotation: string
      mixedValue: string
      multiSelectionTitle: string
      ungroup: string
      sectionConstraints: string
      constraintHorizontal: string
      constraintVertical: string
      constraintStart: string
      constraintEnd: string
      constraintCenter: string
      constraintStretch: string
      constraintScale: string
      contextMenu: {
        copy: string
        paste: string
        pasteHere: string
        groupSelection: string
        wrapInFrame: string
        selectLayerUnderCursor: string
        copyStyle: string
        pasteStyle: string
      }
      gesture: {
        instructions: string
        start: string
        move: string
        resize: string
        rotate: string
        end: string
        cancel: string
      }
      textEdit: {
        enter: string
        exit: string
        editingLabel: string
        mergeVariableSuggestionsLabel: string
      }
      selection: {
        marquee: string
        marqueeCancel: string
      }
    }
    pageSettings: {
      title: string
      description: string
      margins: string
      marginTop: string
      marginRight: string
      marginBottom: string
      marginLeft: string
      fontFamily: string
      baseFontSize: string
      fonts: {
        sans: string
        serif: string
        mono: string
      }
    }
    mergeVariables: {
      title: string
      insertVariable: string
      searchPlaceholder: string
      noResults: string
      labels: {
        clientName: string
        clientEmail: string
        clientPhone: string
        clientWebsite: string
        clientTaxId: string
        clientAddressLine1: string
        clientAddressLine2: string
        clientCity: string
        clientState: string
        clientPostalCode: string
        clientCountry: string
        clientCurrency: string
        businessName: string
        businessEmail: string
        businessPhone: string
        businessWebsite: string
        businessTaxId: string
        businessAddressLine1: string
        businessAddressLine2: string
        businessCity: string
        businessState: string
        businessPostalCode: string
        businessCountry: string
        paymentIban: string
        paymentBankName: string
        paymentInstructions: string
        paymentTermsDays: string
        invoiceNumber: string
        invoiceStatus: string
        invoiceCurrency: string
        invoiceSubtotal: string
        invoiceDiscount: string
        invoiceTax: string
        invoiceTotal: string
        invoiceAmountPaid: string
        invoiceAmountDue: string
        invoiceIssueDate: string
        invoiceDueDate: string
        invoicePaidAt: string
        invoiceNotes: string
        invoiceLateFee: string
        invoiceExchangeRate: string
        proposalNumber: string
        proposalStatus: string
        proposalCurrency: string
        proposalSubtotal: string
        proposalDiscount: string
        proposalTax: string
        proposalTotal: string
        proposalValidUntil: string
        proposalNotes: string
        proposalIssueDate: string
        contractNumber: string
        contractTitle: string
        contractStatus: string
        contractEffectiveFrom: string
        contractEffectiveUntil: string
        contractIssuedAt: string
        contractTerminationReason: string
        creditNoteNumber: string
        creditNoteReason: string
        creditNoteCurrency: string
        creditNoteSubtotal: string
        creditNoteTax: string
        creditNoteTotal: string
        creditNoteIssueDate: string
        lineItemDescription: string
        lineItemUnit: string
        lineItemQuantity: string
        lineItemUnitPrice: string
        lineItemDiscount: string
        lineItemTaxPercentage: string
        lineItemSubtotal: string
        lineItemTaxAmount: string
        lineItemTotal: string
      }
    }
    validation: {
      nameRequired: string
      nameTooLong: string
      blockNameTooLong: string
      typeInvalid: string
      idInvalid: string
      subjectTooLong: string
      textTooLong: string
      imageAltTooLong: string
      imageUploadInvalid: string
      imageUploadMissing: string
      imageUploadFailed: string
      imageObjectKeyRequired: string
      imageFilenameRequired: string
      imageContentTypeRequired: string
      imageSizeInvalid: string
      imageTooLarge: string
      imageInvalidFileType: string
      imageUploadUrlFailed: string
      layoutInvalid: string
      sizeInvalid: string
      colorInvalid: string
      styleInvalid: string
      marginInvalid: string
      fontSizeInvalid: string
      tableHeaderTooLong: string
      tableCellTooLong: string
      tableInvalid: string
      blocksOverlap: string
      blocksOutOfBounds: string
      collectionUnavailable: string
      unknownMergeVariable: string
    }
    errors: {
      notFound: string
      systemProtected: string
      unknownMergeVariable: string
      saveFailed: string
      deleteFailed: string
      loadFailed: string
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
      defaultHourlyRate: string
      defaultHourlyRatePlaceholder: string
      defaultHourlyRateHelp: string
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
        defaultHourlyRateInvalid: string
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
