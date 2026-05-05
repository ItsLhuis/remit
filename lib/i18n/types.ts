export type Language = {
  code: string
  name: string
  isRtl: boolean
  translations: Translations
}

export type Translations = {
  common: {
    cancel: string
    save: string
    delete: string
    edit: string
    create: string
    loading: string
    back: string
    next: string
    confirm: string
    continue: string
    close: string
    search: string
    noResults: string
    actions: string
    status: string
    name: string
    email: string
    optional: string
    required: string
    yes: string
    no: string
    copy: string
    download: string
    refresh: string
  }
  errors: {
    notFound: string
    unauthorized: string
    forbidden: string
    validationFailed: string
    somethingWentWrong: string
    sessionExpired: string
    networkError: string
    emailAlreadyInUse: string
    relatedRecordNotFound: string
  }
  auth: {
    signIn: string
    signOut: string
    register: string
    email: string
    password: string
    forgotPassword: string
    totpCode: string
    backupCode: string
    useBackupCode: string
    useTotpCode: string
    invalidCredentials: string
  }
  setup: {
    title: string
    steps: {
      businessProfile: string
      totp: string
      backupCodes: string
    }
    businessProfile: {
      title: string
      description: string
      businessName: string
      currency: string
      locale: string
      timezone: string
    }
    totp: {
      title: string
      description: string
      scanQr: string
      enterCode: string
      verifyCode: string
    }
    backupCodes: {
      title: string
      description: string
      download: string
      confirm: string
      warning: string
    }
  }
}
