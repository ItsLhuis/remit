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
        clear: "Clear",
        copy: "Copy",
        download: "Download",
        refresh: "Refresh",
        done: "Done",
        search: "Search",
        retry: "Try again",
        previous: "Previous",
        copyAllCodes: "Copy all codes",
        showPassword: "Show password",
        hidePassword: "Hide password"
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
        selectCurrency: "Select currency",
        selectDate: "Pick a date"
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
      chart: {
        noData: "No data yet"
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
      },
      table: {
        selectAll: "Select all rows",
        selectRow: "Select row",
        columns: "Columns",
        toggleColumns: "Toggle columns",
        noResults: "No results found.",
        sortAscending: "Sort ascending",
        sortDescending: "Sort descending",
        clearSelection: "Clear selection",
        selectedCount: "{count, plural, one {# selected} other {# selected}}",
        rowsPerPage: "Rows per page",
        rowsSelectedOfTotal: "{selected} of {total, plural, one {# row} other {# rows}} selected",
        page: "Page {page} of {total}",
        goToFirstPage: "Go to first page",
        goToPreviousPage: "Go to previous page",
        goToNextPage: "Go to next page",
        goToLastPage: "Go to last page",
        goToPage: "Go to page {page}",
        clearFilter: "Clear filter",
        min: "Min",
        max: "Max",
        export: "Export"
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
        passwordStrengthLabel: "Password strength",
        passwordStrengthEmpty: "Enter a password. Must contain:",
        passwordStrengthWeak: "Weak password. Must contain:",
        passwordStrengthMedium: "Medium password. Must contain:",
        passwordStrengthStrong: "Strong password. Must contain:",
        passwordStrengthVeryStrong: "Very strong password. Must contain:",
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
        leads: "Leads",
        clients: "Clients",
        projects: "Projects",
        time: "Time",
        expenses: "Expenses",
        proposals: "Proposals",
        contracts: "Contracts",
        invoices: "Invoices",
        recurringInvoices: "Recurring",
        creditNotes: "Credit notes",
        reports: "Reports",
        activity: "Activity",
        settings: "Settings",
        navigation: "Navigation",
        configuration: "Configuration",
        notifications: "Notifications"
      }
    },
    dashboard: {
      title: "Dashboard",
      description: "What you have earned, what you are owed, and what you have spent.",
      currencyNote:
        "Figures are shown in {currency}. {count, plural, one {# other currency is} other {# other currencies are}} recorded and not included.",
      periods: {
        label: "Period",
        month: "This month",
        quarter: "This quarter",
        year: "This year",
        all: "All time"
      },
      tiles: {
        revenue: "Revenue this month",
        revenueHint: "{amount} year to date",
        revenueEmptyHint: "No payments recorded yet",
        revenueAction: "Go to invoices",
        outstanding: "Outstanding",
        outstandingHint:
          "{count, plural, one {# sent invoice} other {# sent invoices}}, net of credit notes",
        outstandingEmptyHint: "Nothing is waiting to be paid",
        outstandingAction: "Go to invoices",
        overdue: "Overdue",
        overdueHint:
          "{count, plural, one {# invoice past its due date} other {# invoices past their due date}}",
        overdueEmptyHint: "Nothing is late",
        expenses: "Expenses",
        expensesHint: "{count, plural, one {# expense} other {# expenses}} in this period",
        expensesEmptyHint: "No expenses recorded in this period",
        expensesAction: "Go to expenses",
        profit: "Profit estimate",
        profitHint: "Revenue minus expenses for this period. An estimate — it excludes tax",
        profitEmptyHint: "Needs revenue or expenses in this period"
      },
      cashflow: {
        title: "Cashflow",
        description: "Payments received and expenses recorded, month by month, in {currency}.",
        revenueSeries: "Revenue",
        expenseSeries: "Expenses",
        emptyTitle: "No cashflow yet",
        emptyDescription:
          "Once payments and expenses are recorded, the last twelve months appear here.",
        emptyAction: "Go to invoices",
        tableCaption: "Revenue and expenses per month for the last twelve months",
        monthColumn: "Month",
        revenueColumn: "Revenue",
        expenseColumn: "Expenses"
      },
      upcoming: {
        title: "Due in the next 30 days",
        description: "Sent invoices with a due date coming up.",
        emptyTitle: "Nothing due in the next 30 days",
        emptyDescription: "Sent invoices with an upcoming due date appear here.",
        emptyAction: "Go to invoices",
        viewAll: "All invoices",
        numberColumn: "Invoice",
        parentColumn: "Client",
        dueColumn: "Due",
        amountColumn: "Amount",
        noParent: "No client",
        dueToday: "Today",
        dueIn: "{days, plural, one {In # day} other {In # days}}"
      },
      topClients: {
        title: "Top clients",
        description: "By payments received in this period, in {currency}.",
        emptyTitle: "No client revenue yet",
        emptyDescription: "Once payments are recorded against a client, the largest appear here.",
        emptyAction: "Go to clients",
        nameColumn: "Client",
        revenueColumn: "Revenue",
        shareColumn: "Share",
        share: "{value}%"
      },
      activity: {
        title: "Recent activity",
        description: "The latest events across this instance.",
        viewAll: "All activity",
        emptyTitle: "Nothing has happened yet",
        emptyDescription: "Client, invoice and payment events appear here as they happen."
      }
    },
    clients: {
      metadata: {
        list: "Clients",
        create: "Create client",
        detail: "Client",
        edit: "Edit client"
      },
      actions: {
        create: "Create client",
        edit: "Edit",
        delete: "Delete",
        view: "View"
      },
      fields: {
        name: "Name",
        email: "Email",
        phone: "Phone",
        currency: "Currency",
        taxId: "VAT / tax ID",
        addressLine1: "Address line 1",
        addressLine2: "Address line 2",
        city: "City",
        state: "State",
        postalCode: "Postal code",
        country: "Country",
        notes: "Notes",
        website: "Website",
        defaultHourlyRate: "Default hourly rate"
      },
      placeholders: {
        name: "Acme Studio",
        email: "billing@example.com",
        phone: "+1 555 0100",
        taxId: "Tax registration number",
        addressLine1: "Street address",
        addressLine2: "Apartment, suite, or unit",
        city: "City",
        state: "State or region",
        postalCode: "Postal code",
        website: "https://example.com",
        notes: "Internal notes for this client",
        defaultHourlyRate: "Leave blank to use the instance default"
      },
      status: {
        active: "Active",
        deleted: "Deleted",
        all: "All"
      },
      health: {
        owing: "Owing",
        settled: "Settled",
        dormant: "No activity"
      },
      summary: {
        activeClients: "Active clients",
        activeClientsHint: "in your book",
        owingClients: "Clients owing",
        owingClientsHint: "have an outstanding balance",
        outstanding: "Total outstanding",
        outstandingHint: "across open invoices",
        outstandingMultiCurrency: "across {count, plural, one {# currency} other {# currencies}}",
        newClients: "New this month",
        newClientsHint: "added in the last 30 days",
        monthlyDelta: "+{count, plural, one {# this month} other {# this month}}",
        last6Months: "Last 6 months",
        trendNewLabel: "New clients",
        trendTotalLabel: "Total clients",
        trendEmpty: "No activity in 6 months",
        healthTitle: "Portfolio health",
        healthHint: "By billing activity"
      },
      filters: {
        title: "Filters",
        description: "Search clients by name or email and narrow the list by status or currency.",
        search: "Search",
        searchPlaceholder: "Search by name or email",
        status: "Status",
        currency: "Currency",
        allCurrencies: "All currencies",
        health: "Health",
        allHealth: "All clients",
        reset: "Reset"
      },
      list: {
        title: "Clients",
        description: "Monitor relationships, balances, and activity across your client base.",
        tableTitle: "Client records",
        tableDescription: "Soft-deleted clients are hidden unless included with the status filter.",
        count: "{count, plural, one {# client} other {# clients}}",
        outstandingBalance: "Outstanding",
        joined: "Joined",
        healthColumn: "Status",
        actions: "Actions",
        viewProfile: "View profile",
        copyEmail: "Copy email",
        emailCopied: "Email copied",
        bulkDelete: "Delete selected",
        emptyTitle: "No clients yet",
        emptyDescription:
          "Create your first client before adding projects, proposals, or invoices.",
        noMatchTitle: "No clients match your filters",
        noMatchDescription: "Try a different search term or clear the active filters."
      },
      form: {
        createTitle: "Create client",
        createDescription: "Add the contact, billing, and address details used across Remit.",
        editTitle: "Edit client",
        editDescription: "Update this client's profile and billing defaults.",
        profileSection: "Profile",
        profileDescription: "Core contact and billing defaults for this client.",
        addressSection: "Address",
        addressDescription: "Postal address used on future client-facing documents.",
        notesSection: "Private notes",
        notesDescription: "Notes are encrypted at rest and stay internal to this Remit instance.",
        saveCreate: "Create client",
        saveEdit: "Save client",
        created: "Client created",
        updated: "Client updated"
      },
      delete: {
        title: "Delete client",
        description:
          "Delete {name}? The client will be hidden from normal lists and can be restored from retained data.",
        confirm: "Delete client",
        deleted: "Client deleted"
      },
      detail: {
        profileTitle: "Profile",
        profileDescription: "Contact and billing details for this client.",
        balanceTitle: "Outstanding balance",
        balanceDescription: "Computed from sent and paid invoices minus recorded payments.",
        computedBadge: "Computed",
        addressTitle: "Address",
        addressDescription: "Postal details stored for this client.",
        notesTitle: "Private notes",
        notesDescription: "Encrypted notes for internal reference.",
        relatedTitle: "Related resources",
        relatedDescription: "Shown only when records already exist for this client.",
        emptyValue: "Not provided",
        backToClients: "Back to clients",
        since: "Client since {date}",
        tabs: {
          overview: "Overview",
          financials: "Financials",
          projects: "Projects",
          activity: "Activity",
          details: "Details"
        },
        quick: {
          email: "Email",
          call: "Call",
          website: "Website"
        },
        outstandingLabel: "Outstanding balance",
        outstandingOwing: "Awaiting payment",
        outstandingSettled: "All invoices settled",
        outstandingDormant: "No invoices yet",
        atAGlance: "At a glance",
        statInvoices: "Invoices",
        statProjects: "Projects",
        statRecurring: "Recurring",
        statInvoicesHint: "New each month",
        statProjectsHint: "Linked to this client",
        statRecurringHint: "Active schedules",
        trendBilledLabel: "Invoiced",
        trendProjectsLabel: "Projects",
        trendRecurringLabel: "Recurring",
        trendEmpty: "No activity in 6 months",
        notesEmpty: "No notes yet",
        contactTitle: "Contact",
        contactDescription: "How to reach this client.",
        billingTitle: "Billing",
        billingDescription: "Currency and tax details used on documents.",
        updatedLabel: "Last updated",
        editDetails: "Edit details",
        invoicesEmptyTitle: "No invoices yet",
        invoicesEmptyDescription: "Invoices you raise for this client will appear here.",
        projectsEmptyTitle: "No projects yet",
        projectsEmptyDescription: "Projects you create for this client will appear here.",
        activityEmptyTitle: "No activity yet",
        activityEmptyDescription:
          "Updates, invoices, and payments for this client will appear here."
      },
      related: {
        projects: "Projects",
        projectsCount: "{count, plural, one {# project} other {# projects}}",
        invoices: "Invoices",
        invoicesCount: "{count, plural, one {# invoice} other {# invoices}}",
        recurringInvoices: "Recurring invoices",
        recurringInvoicesCount:
          "{count, plural, one {# recurring invoice} other {# recurring invoices}}"
      },
      errors: {
        notFound: "Client not found",
        updateFailed: "Failed to update client"
      },
      validation: {
        nameRequired: "Client name is required.",
        nameTooLong:
          "Client name must be {count, plural, one {# character} other {# characters}} or fewer.",
        emailInvalid: "Enter a valid email address.",
        emailTooLong:
          "Email must be {count, plural, one {# character} other {# characters}} or fewer.",
        textTooLong:
          "This field must be {count, plural, one {# character} other {# characters}} or fewer.",
        websiteInvalid: "Enter a valid URL.",
        currencyInvalid: "Select a valid ISO 4217 currency.",
        countryInvalid: "Select a valid country.",
        hourlyRateInvalid: "Enter a valid hourly rate.",
        idInvalid: "Invalid client."
      }
    },
    leads: {
      metadata: {
        list: "Leads",
        create: "Create lead",
        detail: "Lead",
        edit: "Edit lead"
      },
      actions: {
        create: "Create lead",
        edit: "Edit",
        delete: "Delete",
        convert: "Convert to client"
      },
      fields: {
        name: "Name",
        firstName: "First name",
        lastName: "Last name",
        company: "Company",
        email: "Email",
        phone: "Phone",
        source: "Source",
        status: "Stage",
        notes: "Notes",
        lostReason: "Lost reason"
      },
      placeholders: {
        firstName: "Jane",
        lastName: "Doe",
        company: "Acme Studio",
        email: "jane@example.com",
        phone: "+1 555 0100",
        source: "Referral, website, event",
        notes: "Context, requirements, or next steps",
        lostReason: "Why was this lead lost?"
      },
      status: {
        new: "New",
        contacted: "Contacted",
        qualified: "Qualified",
        proposal_sent: "Proposal sent",
        won: "Won",
        lost: "Lost"
      },
      statusFilter: {
        active: "Active",
        deleted: "Deleted",
        all: "All"
      },
      summary: {
        total: "Total leads",
        totalHint: "in your pipeline",
        newThisMonthDelta: "+{count, plural, one {# this month} other {# this month}}",
        open: "Open",
        openHint: "still in the pipeline",
        won: "Won",
        wonHint: "marked as won",
        converted: "Converted",
        convertedHint: "turned into clients",
        trendTotalLabel: "Total leads",
        trendNewLabel: "New leads",
        trendEmpty: "No activity in 6 months"
      },
      filters: {
        title: "Filters",
        search: "Search",
        searchPlaceholder: "Search by name, company, or email",
        status: "Status",
        reset: "Reset"
      },
      list: {
        title: "Leads",
        description: "Track prospects from first contact through to qualified opportunities.",
        tableTitle: "Lead records",
        count: "{count, plural, one {# lead} other {# leads}}",
        created: "Created",
        actions: "Actions",
        viewLead: "View lead",
        copyEmail: "Copy email",
        emailCopied: "Email copied",
        bulkDelete: "Delete selected",
        emptyTitle: "No leads yet",
        emptyDescription: "Capture your first lead to start building your pipeline.",
        noMatchTitle: "No leads match your filters",
        noMatchDescription: "Try a different search term or clear the active filters."
      },
      form: {
        createTitle: "Create lead",
        createDescription: "Capture a new prospect and place them in your pipeline.",
        editTitle: "Edit lead",
        editDescription: "Update this lead's contact and pipeline details.",
        contactSection: "Contact",
        contactDescription: "Who the lead is and how to reach them.",
        pipelineSection: "Pipeline",
        pipelineDescription: "Where this lead came from and its current stage.",
        notesSection: "Notes",
        notesDescription: "Internal notes for context on this lead.",
        saveCreate: "Create lead",
        saveEdit: "Save lead",
        created: "Lead created",
        updated: "Lead updated"
      },
      delete: {
        title: "Delete lead",
        description:
          "Delete {name}? The lead will be hidden from normal lists and can be restored from retained data.",
        confirm: "Delete lead",
        deleted: "Lead deleted"
      },
      detail: {
        backToLeads: "Back to leads",
        backToLead: "Back to lead",
        since: "Lead since {date}",
        quickEmail: "Email",
        statusLabel: "Stage",
        contactTitle: "Contact",
        updatedLabel: "Last updated",
        emptyValue: "Not provided",
        statConverted: "Conversion",
        convertedYes: "Converted",
        convertedNo: "Not converted",
        activityTitle: "Activity",
        activityEmptyTitle: "No activity yet",
        activityEmpty: "Stage changes and notes for this lead will show up here.",
        convertTitle: "Convert to client",
        convertDescription: "Turn this lead into a client to start projects and invoicing.",
        convertedTitle: "Converted to client",
        convertedOn: "Became a client on {date}",
        viewClient: "View client",
        lostReasonTitle: "Lost reason",
        notesTitle: "Notes",
        notesEmpty: "No notes yet",
        editDetails: "Edit details"
      },
      stage: {
        changed: "Stage updated",
        changeStatus: "Change stage",
        lostTitle: "Mark lead as lost",
        lostDescription: "Record why this lead was lost for future reference.",
        markLost: "Mark as lost"
      },
      convert: {
        title: "Convert to client",
        description: "Create a client record from this lead. The lead is kept for reference.",
        clientName: "Client name",
        currency: "Currency",
        confirm: "Convert to client",
        converted: "Lead converted to client"
      },
      errors: {
        notFound: "Lead not found",
        updateFailed: "Failed to update lead",
        invalidTransition: "That stage change is not allowed",
        alreadyConverted: "This lead has already been converted"
      },
      validation: {
        textTooLong:
          "This field must be {count, plural, one {# character} other {# characters}} or fewer.",
        emailRequired: "Email is required.",
        emailInvalid: "Enter a valid email address.",
        emailTooLong:
          "Email must be {count, plural, one {# character} other {# characters}} or fewer.",
        nameRequired: "Enter a first name, last name, or company.",
        lostReasonRequired: "Add a reason when marking a lead as lost.",
        idInvalid: "Invalid lead.",
        clientNameRequired: "Client name is required.",
        currencyInvalid: "Select a valid ISO 4217 currency."
      }
    },
    projects: {
      metadata: {
        list: "Projects",
        create: "Create project",
        detail: "Project",
        edit: "Edit project"
      },
      actions: {
        create: "Create project",
        edit: "Edit",
        delete: "Delete"
      },
      fields: {
        name: "Name",
        client: "Client",
        status: "Status",
        budget: "Budget",
        hourlyRate: "Hourly rate",
        startDate: "Start date",
        endDate: "End date",
        description: "Description",
        currency: "Currency"
      },
      placeholders: {
        name: "Website redesign",
        client: "Select a client",
        amount: "0.00",
        description: "Scope, deliverables, or context for this project"
      },
      status: {
        active: "Active",
        on_hold: "On hold",
        completed: "Completed",
        cancelled: "Cancelled"
      },
      statusFilter: {
        active: "Active",
        deleted: "Deleted",
        all: "All"
      },
      summary: {
        total: "Total projects",
        totalHint: "across all clients",
        newThisMonthDelta: "+{count, plural, one {# this month} other {# this month}}",
        active: "Active",
        activeHint: "currently in progress",
        onHold: "On hold",
        onHoldHint: "paused for now",
        completed: "Completed",
        completedHint: "delivered and closed",
        trendTotalLabel: "Total projects",
        trendNewLabel: "New projects",
        trendEmpty: "No activity in 6 months"
      },
      filters: {
        title: "Filters",
        search: "Search",
        searchPlaceholder: "Search by project or client",
        status: "Status",
        reset: "Reset"
      },
      list: {
        title: "Projects",
        description: "Track the work you deliver for each client from kickoff to completion.",
        tableTitle: "Project records",
        count: "{count, plural, one {# project} other {# projects}}",
        created: "Created",
        actions: "Actions",
        viewProject: "View project",
        bulkDelete: "Delete selected",
        emptyTitle: "No projects yet",
        emptyDescription: "Create your first project to start tracking client work.",
        noMatchTitle: "No projects match your filters",
        noMatchDescription: "Try a different search term or clear the active filters."
      },
      form: {
        createTitle: "Create project",
        createDescription: "Set up a new project and assign it to a client.",
        editTitle: "Edit project",
        editDescription: "Update this project's details and budget.",
        detailsSection: "Details",
        detailsDescription: "What the project is and which client it belongs to.",
        budgetSection: "Budget & schedule",
        budgetDescription:
          "Optional budget, hourly rate, and timeline. Amounts use the client's currency.",
        descriptionSection: "Description",
        descriptionDescription: "Internal notes about scope and deliverables.",
        saveCreate: "Create project",
        saveEdit: "Save project",
        created: "Project created",
        updated: "Project updated",
        noClientsTitle: "No clients yet",
        noClientsDescription:
          "Projects belong to a client. Create a client first to start a project.",
        createClient: "Create client"
      },
      delete: {
        title: "Delete project",
        description:
          "Delete {name}? The project will be hidden from normal lists and can be restored from retained data.",
        confirm: "Delete project",
        deleted: "Project deleted"
      },
      detail: {
        backToProjects: "Back to projects",
        backToProject: "Back to project",
        since: "Created {date}",
        updatedLabel: "Last updated",
        emptyValue: "Not set",
        overviewTitle: "Overview",
        activityTitle: "Activity",
        descriptionTitle: "Description",
        descriptionEmpty: "No description yet",
        editDetails: "Edit details"
      },
      stage: {
        changed: "Status updated",
        changeStatus: "Change status"
      },
      clientPanel: {
        title: "Projects",
        create: "New project",
        emptyTitle: "No projects yet",
        emptyDescription: "Start a project to track the work you deliver for this client."
      },
      errors: {
        notFound: "Project not found",
        clientNotFound: "Client not found",
        updateFailed: "Failed to update project",
        invalidTransition: "That status change is not allowed"
      },
      validation: {
        amountInvalid: "Enter a valid amount such as 1500 or 1500.00.",
        dateInvalid: "Enter a valid date.",
        descriptionTooLong:
          "Description must be {count, plural, one {# character} other {# characters}} or fewer.",
        clientRequired: "Select a client.",
        nameRequired: "Project name is required.",
        nameTooLong:
          "Name must be {count, plural, one {# character} other {# characters}} or fewer.",
        endBeforeStart: "End date must be on or after the start date.",
        idInvalid: "Invalid project."
      }
    },
    tasks: {
      metadata: {
        board: "Tasks"
      },
      board: {
        title: "Tasks",
        description: "Plan and track the work for this project.",
        backToProject: "Back to project",
        createButton: "New task",
        count: "{count, plural, one {# task} other {# tasks}}",
        searchPlaceholder: "Search tasks",
        searchLabel: "Search tasks",
        priorityFilter: "Priority",
        clearFilters: "Clear filters"
      },
      view: {
        label: "View",
        kanban: "Board",
        table: "Table"
      },
      status: {
        backlog: "Backlog",
        todo: "To do",
        in_progress: "In progress",
        done: "Done",
        cancelled: "Cancelled"
      },
      priority: {
        low: "Low",
        normal: "Normal",
        high: "High",
        urgent: "Urgent"
      },
      card: {
        actions: "Task actions",
        changeStatus: "Change status",
        moveUp: "Move up",
        moveDown: "Move down",
        edit: "Edit task",
        delete: "Delete task",
        dragHandle: "Reorder task",
        dueLabel: "Due",
        noDue: "No due date"
      },
      columns: {
        empty: "No tasks",
        dropHint: "Drop tasks here"
      },
      quickAdd: {
        button: "Add task",
        placeholder: "Task title",
        submit: "Add task",
        cancel: "Cancel"
      },
      dnd: {
        instructions:
          "To pick up a task, press space or enter. While dragging, use the arrow keys to move it between columns and positions. Press space or enter again to drop, or escape to cancel.",
        onDragStart: "Picked up task {title}.",
        onDragOver: "Task {title} is over the {column} column.",
        onDragEnd: "Task {title} was dropped in the {column} column.",
        onDragCancel: "Dragging cancelled. Task {title} returned to its original position."
      },
      table: {
        titleColumn: "Title",
        statusColumn: "Status",
        priorityColumn: "Priority",
        dueColumn: "Due",
        rateColumn: "Hourly rate",
        actions: "Actions"
      },
      fields: {
        title: "Title",
        description: "Description",
        status: "Status",
        priority: "Priority",
        dueDate: "Due date",
        hourlyRate: "Hourly rate"
      },
      placeholders: {
        title: "Task title",
        description: "Add more detail",
        amount: "0.00"
      },
      form: {
        createTitle: "New task",
        createDescription: "Add a task to this project.",
        editTitle: "Edit task",
        editDescription: "Update the details of this task.",
        saveCreate: "Create task",
        saveEdit: "Save changes"
      },
      delete: {
        title: "Delete task",
        description: "This task will be removed from the project. You can restore it later.",
        confirm: "Delete task",
        deleted: "Task deleted"
      },
      empty: {
        title: "No tasks yet",
        description: "Create the first task to start planning this project."
      },
      actions: {
        create: "New task",
        edit: "Edit",
        delete: "Delete"
      },
      notifications: {
        created: "Task created",
        updated: "Task updated",
        statusChanged: "Status updated",
        reordered: "Task moved"
      },
      validation: {
        titleRequired: "Title is required.",
        titleTooLong:
          "Title must be {count, plural, one {# character} other {# characters}} or fewer.",
        descriptionTooLong:
          "Description must be {count, plural, one {# character} other {# characters}} or fewer.",
        amountInvalid: "Enter a valid amount such as 1500 or 1500.00.",
        dateInvalid: "Enter a valid date.",
        idInvalid: "Invalid task.",
        projectRequired: "Select a project.",
        positionInvalid: "Invalid task position."
      },
      errors: {
        notFound: "Task not found",
        projectNotFound: "Project not found",
        invalidTransition: "That status change is not allowed",
        updateFailed: "Failed to update task"
      }
    },
    timeTracking: {
      metadata: {
        list: "Time"
      },
      list: {
        title: "Time",
        description: "Track hours against projects and tasks, then bill the unbilled ones.",
        tableTitle: "Time entries",
        count: "{count, plural, one {# entry} other {# entries}}",
        actions: "Time entry actions",
        edit: "Edit entry",
        bulkDelete: "Delete",
        emptyTitle: "No time logged yet",
        emptyDescription: "Start the timer or log an entry by hand to begin tracking hours.",
        noProjectsDescription: "Create a project first — every time entry belongs to one.",
        noMatchTitle: "No entries match those filters",
        noMatchDescription: "Try widening the date range or clearing a filter."
      },
      actions: {
        logManually: "Log time",
        delete: "Delete entry"
      },
      filters: {
        title: "Filters",
        search: "Search time entries",
        searchPlaceholder: "Search descriptions, projects, tasks",
        status: "Entry status",
        reset: "Reset filters"
      },
      status: {
        active: "Active",
        deleted: "Deleted",
        all: "All"
      },
      fields: {
        project: "Project",
        projectOption: "{client} — {project}",
        task: "Task",
        noTask: "No task",
        description: "Description",
        startedAt: "Started",
        endedAt: "Ended",
        duration: "Duration",
        billable: "Billable",
        billableHelp: "Unbillable time is tracked but never appears on an invoice",
        hourlyRate: "Hourly rate override",
        invoiced: "Billing",
        source: "Source",
        amount: "Amount"
      },
      placeholders: {
        project: "Select a project",
        description: "What did you work on?",
        hourlyRate: "Leave blank to use the task, project or client rate"
      },
      billable: {
        billable: "Billable",
        nonBillable: "Not billable"
      },
      invoiced: {
        unbilled: "Unbilled",
        invoiced: "Invoiced"
      },
      source: {
        timer: "Timer",
        manual: "Manual"
      },
      duration: {
        hoursMinutes: "{hours}h {minutes}m",
        withSeconds: "{hours}h {minutes}m {seconds}s"
      },
      timer: {
        idleTitle: "Start a timer",
        idleDescription: "Pick a project and start the clock. One timer runs at a time.",
        runningTitle: "Timer running",
        runningDescription: "{project} · {task}",
        running: "Running",
        rateHint: "Billing at {rate} per hour",
        start: "Start timer",
        stop: "Stop timer",
        started: "Timer started",
        stopped: "Timer stopped"
      },
      summary: {
        tracked: "Tracked",
        trackedHint: "All time logged on this instance",
        billable: "Billable",
        billableHint: "Hours marked billable",
        unbilled: "Unbilled",
        unbilledHint: "{duration} not yet on an invoice"
      },
      form: {
        createTitle: "Log time",
        createDescription: "Record work you have already done.",
        editTitle: "Edit time entry",
        editDescription: "Change the hours, the scope or the rate for this entry.",
        saveCreate: "Log time",
        saveEdit: "Save entry",
        created: "Time entry logged",
        updated: "Time entry updated"
      },
      delete: {
        title: "Delete time entry?",
        description:
          "The entry is removed from your logged hours. Invoiced entries cannot be deleted.",
        confirm: "Delete entry",
        deleted: "Time entry deleted"
      },
      validation: {
        projectRequired: "Select a project",
        taskInvalid: "Select a valid task",
        idInvalid: "Invalid time entry",
        amountInvalid: "Enter a valid amount",
        descriptionTooLong: "Description must be {count} characters or fewer",
        dateTimeInvalid: "Enter a valid date and time",
        endBeforeStart: "The end time must be after the start time"
      },
      errors: {
        notFound: "Time entry not found",
        projectNotFound: "Project not found",
        taskNotFound: "Task not found",
        taskProjectMismatch: "That task belongs to a different project",
        timerAlreadyRunning: "A timer is already running. Stop it before starting another one",
        timerNotRunning: "That timer is not running",
        timerRunning: "Stop the timer before editing this entry",
        endBeforeStart: "The end time must be after the start time",
        alreadyInvoiced: "This entry has already been invoiced and can no longer be changed",
        updateFailed: "Failed to save the time entry"
      }
    },
    expenses: {
      metadata: {
        list: "Expenses"
      },
      list: {
        title: "Expenses",
        description: "Record what a job cost you, then pass the rebillable part on.",
        tableTitle: "Expenses",
        count: "{count, plural, one {# expense} other {# expenses}}",
        actions: "Expense actions",
        edit: "Edit expense",
        bulkDelete: "Delete",
        rebillsAt: "+{markup}% → {amount}",
        emptyTitle: "No expenses yet",
        emptyDescription:
          "Log a cost you have paid and attach its receipt while you still have it.",
        noMatchTitle: "No expenses match those filters",
        noMatchDescription: "Try widening the date range or clearing a filter."
      },
      actions: {
        create: "Log expense",
        delete: "Delete expense",
        export: "Export CSV"
      },
      filters: {
        title: "Filters",
        search: "Search expenses",
        searchPlaceholder: "Search descriptions, categories, projects, clients",
        status: "Expense status",
        reset: "Reset filters"
      },
      status: {
        active: "Active",
        deleted: "Deleted",
        all: "All"
      },
      fields: {
        spentAt: "Date",
        category: "Category",
        description: "Description",
        amount: "Amount",
        currency: "Currency",
        project: "Project",
        projectOption: "{client} — {project}",
        noProject: "No project",
        client: "Client",
        noClient: "No client",
        clientFollowsProject: "Set from the selected project",
        rebillable: "Rebillable",
        rebillableHelp: "Rebillable costs are passed on to the client on their next invoice",
        markupPercentage: "Markup %",
        invoiced: "Billing",
        receipt: "Receipt"
      },
      placeholders: {
        category: "Travel, software, subcontracting…",
        description: "What was this spent on?",
        amount: "0.00",
        markupPercentage: "Leave blank to rebill at cost"
      },
      categories: {
        travel: "Travel",
        accommodation: "Accommodation",
        meals: "Meals",
        software: "Software",
        hardware: "Hardware",
        subcontracting: "Subcontracting",
        office: "Office",
        marketing: "Marketing",
        fees: "Fees",
        other: "Other"
      },
      rebillable: {
        rebillable: "Rebillable",
        nonRebillable: "Own cost"
      },
      invoiced: {
        unbilled: "Unbilled",
        invoiced: "Invoiced"
      },
      receipt: {
        none: "None",
        upload: "Upload receipt",
        replace: "Replace receipt",
        remove: "Remove",
        open: "Open receipt {filename}",
        help: "Images or PDF, up to {megabytes} MB"
      },
      summary: {
        total: "Total spent",
        totalHint: "{count, plural, one {# expense} other {# expenses}} recorded",
        rebillable: "Rebillable",
        rebillableHint: "What clients owe once billed, markup included",
        unbilled: "Unbilled",
        unbilledHint: "Rebillable and not yet on an invoice"
      },
      form: {
        createTitle: "Log expense",
        createDescription: "Record a cost you have already paid.",
        editTitle: "Edit expense",
        editDescription: "Change the amount, the scope or the markup for this expense.",
        saveCreate: "Log expense",
        saveEdit: "Save expense",
        created: "Expense logged",
        updated: "Expense updated"
      },
      delete: {
        title: "Delete expense?",
        description:
          "The expense is removed from your records. Invoiced expenses cannot be deleted.",
        confirm: "Delete expense",
        deleted: "Expense deleted"
      },
      export: {
        exported: "Exported {count, plural, one {# expense} other {# expenses}}",
        columns: {
          spentAt: "Date",
          category: "Category",
          description: "Description",
          project: "Project",
          client: "Client",
          amount: "Amount",
          currency: "Currency",
          rebillable: "Rebillable",
          markupPercentage: "Markup %",
          rebillableAmount: "Rebillable amount",
          invoiced: "Invoiced",
          receipt: "Receipt"
        }
      },
      validation: {
        idInvalid: "Invalid expense",
        amountRequired: "Enter an amount",
        amountInvalid: "Enter a valid amount",
        currencyInvalid: "Select a currency",
        categoryRequired: "Enter a category",
        categoryTooLong: "Category must be {count} characters or fewer",
        descriptionRequired: "Enter a description",
        descriptionTooLong: "Description must be {count} characters or fewer",
        dateRequired: "Select the date the expense was paid",
        dateInvalid: "Enter a valid date",
        projectInvalid: "Select a valid project",
        clientInvalid: "Select a valid client",
        markupInvalid: "Markup must be between 0 and {max}",
        markupRequiresRebillable: "A markup only applies to a rebillable expense",
        receiptKeyInvalid: "Invalid receipt",
        receiptFilenameRequired: "The receipt needs a filename",
        receiptTypeInvalid: "Receipts must be an image or a PDF",
        receiptSizeInvalid: "Invalid receipt size",
        receiptTooLarge: "Receipts must be {megabytes} MB or smaller"
      },
      errors: {
        notFound: "Expense not found",
        projectNotFound: "Project not found",
        clientNotFound: "Client not found",
        clientProjectMismatch: "That client does not own the selected project",
        alreadyInvoiced: "This expense has already been invoiced and can no longer be changed",
        updateFailed: "Failed to save the expense",
        exportFailed: "Failed to export the expenses",
        invalidFileType: "Receipts must be an image or a PDF",
        uploadUrlFailed: "Could not prepare the receipt upload",
        uploadFailed: "Could not upload the receipt"
      }
    },
    proposals: {
      metadata: {
        list: "Proposals",
        detail: "Proposal",
        create: "New proposal",
        edit: "Edit proposal"
      },
      list: {
        title: "Proposals",
        description: "Quotes and scopes of work for this project",
        backToProject: "Back to project",
        createButton: "New proposal",
        count: "{count, plural, one {# proposal} other {# proposals}}",
        searchPlaceholder: "Search by number",
        searchLabel: "Search proposals",
        statusFilter: "Status",
        clearFilters: "Clear filters"
      },
      overview: {
        title: "Proposals",
        description: "Every proposal across your projects, soonest to expire first",
        tableTitle: "All proposals",
        totalHint: "Across all projects",
        projectColumn: "Project",
        clientColumn: "Client",
        openProject: "Open project",
        browseProjects: "Browse projects",
        searchPlaceholder: "Search by number, project, or client",
        searchLabel: "Search proposals",
        filters: "Filters",
        emptyTitle: "No proposals yet",
        emptyDescription: "Proposals are created from a project. Open a project to quote it.",
        noMatchTitle: "No proposals match these filters",
        noMatchDescription: "Clear the filters to see every proposal again."
      },
      status: {
        draft: "Draft",
        sent: "Sent",
        accepted: "Accepted",
        rejected: "Rejected"
      },
      summary: {
        total: "Proposals",
        totalHint: "On this project",
        draft: "Drafts",
        draftHint: "Not sent yet",
        awaiting: "Awaiting response",
        awaitingHint: "Sent, no reply yet",
        accepted: "Accepted",
        acceptedMultiCurrency: "across {count, plural, one {# currency} other {# currencies}}",
        acceptedValue: "Accepted value"
      },
      table: {
        numberColumn: "Number",
        statusColumn: "Status",
        validUntilColumn: "Valid until",
        totalColumn: "Total",
        createdColumn: "Created",
        actions: "Actions",
        noValidUntil: "No expiry"
      },
      fields: {
        number: "Number",
        status: "Status",
        template: "Template",
        currency: "Currency",
        validUntil: "Valid until",
        notes: "Notes",
        discountType: "Proposal discount",
        discountPercentage: "Discount percentage",
        discountAmount: "Discount amount"
      },
      lineItems: {
        title: "Line items",
        addButton: "Add line item",
        removeButton: "Remove line item",
        moveUp: "Move line item up",
        moveDown: "Move line item down",
        descriptionColumn: "Description",
        quantityColumn: "Qty",
        unitColumn: "Unit",
        unitPriceColumn: "Unit price",
        discountColumn: "Discount",
        taxColumn: "Tax",
        totalColumn: "Total",
        actionsColumn: "Actions",
        rowLabel: "Line item {position}",
        empty: "No line items yet. Add the first one to price this proposal.",
        noTaxRate: "No tax"
      },
      placeholders: {
        description: "Design and build the marketing site",
        unit: "hour",
        amount: "0.00",
        quantity: "1",
        notes: "Anything the client should know before accepting",
        percentage: "0",
        search: "Search proposals"
      },
      discount: {
        none: "None",
        percentage: "Percentage",
        fixed: "Fixed amount"
      },
      totals: {
        subtotal: "Subtotal",
        discount: "Discount",
        tax: "Tax",
        total: "Total"
      },
      template: {
        none: "No template"
      },
      form: {
        backToList: "Back to proposals",
        backToProposal: "Back to proposal",
        createTitle: "New proposal",
        createDescription: "Draft a proposal for this project.",
        editTitle: "Edit proposal",
        editDescription: "Update this draft before sending it.",
        saveCreate: "Create proposal",
        saveEdit: "Save changes",
        detailsSection: "Details",
        detailsDescription: "Numbering, currency, and validity are taken from your settings.",
        lineItemsSection: "Line items",
        lineItemsDescription: "Tax rates are captured on each line when you save.",
        notesSection: "Notes",
        notesDescription: "Shown to the client on the proposal."
      },
      detail: {
        backToList: "Back to proposals",
        issuedAt: "Sent",
        notIssued: "Not sent yet",
        viewsLabel: "Client views",
        viewCount: "{count, plural, one {# view} other {# views}}",
        lockedTitle: "This proposal is locked",
        lockedDescription: "Only drafts can be edited. Sent proposals stay as the client saw them.",
        notesTitle: "Notes",
        summaryTitle: "Summary",
        publicLinkTitle: "Client link",
        publicLinkDescription: "Share this link with the client to let them review and respond.",
        publicLinkHidden: "The client link is created when you send the proposal.",
        copyLink: "Copy link",
        linkCopied: "Link copied"
      },
      send: {
        title: "Send proposal",
        description:
          "Sending locks the proposal, creates the client link, and queues the PDF. This cannot be undone.",
        confirm: "Send proposal"
      },
      delete: {
        title: "Delete proposal",
        description: "This proposal will be removed from the project. You can restore it later.",
        confirm: "Delete proposal"
      },
      empty: {
        title: "No proposals yet",
        description: "Create the first proposal to quote this project."
      },
      actions: {
        create: "New proposal",
        edit: "Edit",
        send: "Send",
        delete: "Delete",
        view: "View",
        rowActions: "Proposal actions"
      },
      notifications: {
        created: "Proposal created",
        updated: "Proposal updated",
        sent: "Proposal sent",
        deleted: "Proposal deleted"
      },
      validation: {
        descriptionRequired: "Description is required.",
        descriptionTooLong:
          "Description must be {count, plural, one {# character} other {# characters}} or fewer.",
        quantityInvalid: "Enter a quantity greater than zero, such as 1 or 2.50.",
        amountInvalid: "Enter a valid amount such as 1500 or 1500.00.",
        amountRequired: "Enter an amount.",
        percentageInvalid: "Enter a percentage between 0 and 100.",
        dateInvalid: "Enter a valid date.",
        idInvalid: "Invalid proposal.",
        projectRequired: "Select a project.",
        lineItemsRequired: "Add at least one line item.",
        notesTooLong:
          "Notes must be {count, plural, one {# character} other {# characters}} or fewer.",
        unitTooLong:
          "Unit must be {count, plural, one {# character} other {# characters}} or fewer.",
        currencyInvalid: "Select a currency.",
        taxRateInvalid: "Select a valid tax rate.",
        discountAmountRequired: "Enter a discount amount.",
        discountPercentageRequired: "Enter a discount percentage."
      },
      public: {
        metadataTitle: "Proposal",
        fromLabel: "From",
        preparedFor: "Prepared for {project}",
        unavailable: {
          title: "This proposal is not available",
          description:
            "The link may have expired, been withdrawn, or never existed. Ask the sender for a new one."
        },
        summary: {
          title: "Summary",
          issuedAt: "Sent",
          validUntil: "Valid until",
          noValidUntil: "No expiry"
        },
        respond: {
          title: "Your response",
          description: "Accept or decline this proposal. We will email you a code to confirm.",
          accept: "Accept proposal",
          reject: "Decline proposal",
          back: "Back",
          resend: "Send a new code"
        },
        identity: {
          acceptTitle: "Confirm your email to accept",
          acceptDescription:
            "Enter the email address this proposal was sent to and we will send you a confirmation code.",
          rejectTitle: "Confirm your email to decline",
          rejectDescription:
            "Tell us why you are declining and enter the email address this proposal was sent to.",
          emailLabel: "Email address",
          emailPlaceholder: "you@company.com",
          reasonLabel: "Reason for declining",
          reasonPlaceholder: "Let the sender know what changed",
          submit: "Send code"
        },
        code: {
          title: "Enter your code",
          description:
            "If that address is on file, a {length}-digit code is on its way. It expires in {minutes, plural, one {# minute} other {# minutes}}.",
          label: "Confirmation code",
          submit: "Confirm"
        },
        outcome: {
          acceptedTitle: "Proposal accepted",
          acceptedDescription:
            "Thank you. The sender has been notified and this proposal is now locked.",
          rejectedTitle: "Proposal declined",
          rejectedDescription: "Thank you. The sender has been notified of your decision.",
          reasonLabel: "Your reason",
          respondedAt: "Responded {date}"
        },
        email: {
          subject:
            "Your code to {action, select, accept {accept} other {decline}} proposal {number}",
          body: "Hi {name},\n\n{issuer} sent you proposal {number}. Use this code to confirm that you want to {action, select, accept {accept} other {decline}} it:\n\n{code}\n\nThe code expires in {minutes, plural, one {# minute} other {# minutes}} and can be used once. If you did not ask for it, ignore this email."
        },
        validation: {
          action: "Choose whether to accept or decline.",
          tokenInvalid: "Invalid link.",
          emailInvalid: "Enter a valid email address.",
          codeInvalid: "Enter the 6-digit code from your email.",
          reasonRequired: "Tell the sender why you are declining.",
          reasonTooLong:
            "Reason must be {count, plural, one {# character} other {# characters}} or fewer."
        },
        errors: {
          unavailable: "This proposal is not available",
          alreadyResponded: "This proposal has already been responded to",
          requestFailed: "Could not send a code right now",
          emailFailed: "Could not send the email. Try again in a moment",
          responseFailed: "Could not record your response",
          codeInvalid: "That code is not correct",
          codeExpired: "That code has expired. Request a new one",
          codeConsumed: "That code has already been used. Request a new one",
          codeAttemptsExhausted: "Too many incorrect attempts. Request a new code",
          rateLimited: "Too many attempts. Try again later"
        }
      },
      errors: {
        notFound: "Proposal not found",
        projectNotFound: "Project not found",
        notDraft: "Only draft proposals can be changed",
        invalidTransition: "That status change is not allowed",
        updateFailed: "Failed to update proposal",
        sendFailed: "Failed to send proposal"
      }
    },
    contracts: {
      metadata: {
        list: "Contracts",
        detail: "Contract",
        create: "New contract",
        edit: "Edit contract"
      },
      title: "Contracts",
      subtitle: "Agreements you have drafted, issued, and signed",
      actions: {
        create: "New contract",
        createFromProposal: "Create contract",
        edit: "Edit",
        send: "Send",
        terminate: "Terminate",
        delete: "Delete",
        view: "View",
        rowActions: "Contract actions"
      },
      fields: {
        number: "Number",
        title: "Title",
        status: "Status",
        parent: "Belongs to",
        project: "Project",
        client: "Client",
        template: "Template",
        effectiveFrom: "Effective from",
        effectiveUntil: "Effective until",
        issuedAt: "Issued",
        terminatedAt: "Terminated",
        terminationReason: "Reason"
      },
      status: {
        draft: "Draft",
        sent: "Sent",
        signed: "Signed",
        expired: "Expired",
        terminated: "Terminated"
      },
      summary: {
        total: "Total",
        totalHint: "All contracts",
        draft: "Draft",
        draftHint: "Not issued yet",
        sent: "Awaiting signature",
        sentHint: "Sent and still open",
        signed: "Signed",
        signedHint: "Executed by both sides"
      },
      table: {
        numberColumn: "Number",
        titleColumn: "Title",
        parentColumn: "Belongs to",
        statusColumn: "Status",
        effectiveColumn: "Effective",
        createdColumn: "Created",
        actions: "Actions",
        noParent: "No parent",
        noEffectiveRange: "No dates set"
      },
      filters: {
        count: "{count, plural, one {# contract} other {# contracts}}",
        searchPlaceholder: "Search contracts",
        searchLabel: "Search contracts",
        statusFilter: "Status",
        allStatuses: "All statuses",
        clearFilters: "Clear filters"
      },
      empty: {
        title: "No contracts yet",
        description: "Draft a contract for a client or a project to get started",
        noMatchTitle: "No contracts match",
        noMatchDescription: "Try a different search or clear the filters"
      },
      form: {
        backToList: "Back to contracts",
        createTitle: "New contract",
        createDescription: "Draft an agreement for a client or a project",
        editTitle: "Edit contract",
        editDescription: "Only draft contracts can be changed",
        saveCreate: "Create contract",
        saveEdit: "Save changes",
        detailsSection: "Details",
        detailsDescription: "Title and effective window",
        parentSection: "Belongs to",
        parentDescription: "Pick a project or a client this contract covers",
        contentSection: "Content",
        contentDescription: "The document sent to the counterparty",
        noProject: "No project",
        noClient: "No client",
        noTemplate: "No template",
        blockCount: "{count, plural, one {# block} other {# blocks}}",
        blocksEmpty: "No content yet. Pick a template to seed this contract"
      },
      detail: {
        backToList: "Back to contracts",
        issuedAt: "Issued",
        notIssued: "Not issued yet",
        effectiveWindow: "Effective window",
        openParent: "Open",
        lockedTitle: "This contract is locked",
        lockedDescription: "A contract can only be changed while it is a draft",
        contentTitle: "Content",
        summaryTitle: "Summary",
        terminationTitle: "Termination"
      },
      dialogs: {
        send: {
          title: "Send this contract?",
          description:
            "The contract is issued and can no longer be edited. A PDF is generated for the counterparty.",
          confirm: "Send contract"
        },
        terminate: {
          title: "Terminate this contract?",
          description: "The contract stays on record with the reason you give below.",
          confirm: "Terminate contract",
          reasonLabel: "Reason",
          reasonPlaceholder: "Why is this contract ending?"
        },
        delete: {
          title: "Delete this contract?",
          description: "The contract is removed from your lists. This cannot be undone.",
          confirm: "Delete contract"
        }
      },
      notifications: {
        created: "Contract created",
        updated: "Contract updated",
        sent: "Contract sent",
        terminated: "Contract terminated",
        deleted: "Contract deleted"
      },
      pdfSignature: {
        title: "Electronic signature",
        signerName: "Signed by",
        signerEmail: "Email",
        signedAt: "Signed at",
        ipAddress: "IP address"
      },
      public: {
        metadataTitle: "Contract",
        fromLabel: "Sent by",
        preparedFor: "Prepared for {client}",
        unavailable: {
          title: "This contract is not available",
          description:
            "The link may have expired, been withdrawn, or already been used. Contact the sender for a new one"
        },
        document: {
          title: "The agreement",
          frameTitle: "Contract {number}",
          empty: "This contract has no content to display"
        },
        summary: {
          title: "Details",
          issuedAt: "Sent",
          effectiveFrom: "Starts",
          effectiveUntil: "Ends",
          none: "—"
        },
        sign: {
          title: "Sign this contract",
          description:
            "Read the agreement above, then type your full name and email to sign it electronically",
          nameLabel: "Full name",
          namePlaceholder: "Your full legal name",
          emailLabel: "Email address",
          emailPlaceholder: "you@example.com",
          consentLabel: "I agree to the statement above",
          submit: "Sign contract"
        },
        consent: {
          text: "I, the person named above, agree to be bound by contract {number} issued by {issuer}, and I consent to signing it electronically. My name, email address, IP address, and browser details are recorded as part of this signature"
        },
        signed: {
          title: "Contract signed",
          description:
            "Your signature has been recorded. The sender has been notified and will share a signed copy",
          signedAt: "Signed on {date}"
        },
        validation: {
          tokenInvalid: "This contract is not available",
          nameRequired: "Your full name is required",
          nameTooLong: "Your name must be {count} characters or fewer",
          emailInvalid: "Enter a valid email address",
          consentRequired: "You must agree before signing"
        },
        errors: {
          unavailable: "This contract is not available",
          alreadySigned: "This contract can no longer be signed",
          signFailed: "Failed to record your signature",
          requestFailed: "Something went wrong. Try again",
          rateLimited: "Too many attempts. Try again later"
        }
      },
      validation: {
        idInvalid: "Invalid contract",
        proposalIdInvalid: "Invalid proposal",
        titleRequired: "Title is required",
        parentRequired: "Pick a project or a client for this contract",
        effectiveRangeInvalid: "The end date must be on or after the start date",
        terminationReasonRequired: "A termination reason is required",
        blocksRequired: "Add content before sending this contract"
      },
      errors: {
        notFound: "Contract not found",
        notDraft: "Only draft contracts can be changed",
        invalidTransition: "That status change is not allowed",
        parentNotFound: "The selected project or client was not found",
        proposalNotConvertible: "That proposal cannot be turned into a contract",
        proposalAlreadyConverted: "That proposal already has a contract",
        createFailed: "Failed to create contract",
        updateFailed: "Failed to update contract",
        sendFailed: "Failed to send contract",
        terminateFailed: "Failed to terminate contract",
        deleteFailed: "Failed to delete contract"
      }
    },
    documentEmails: {
      invoiceSent: {
        subject: "Invoice {number} from {businessName}",
        body: "Hello {clientName},\n\nInvoice {number} for {amount} is attached, due {dueDate}.\n\nYou can also view it online: {url}\n\n{businessName}"
      },
      proposalSent: {
        subject: "Proposal {number} from {businessName}",
        body: "Hello {clientName},\n\nProposal {number} for {amount} is attached.\n\nYou can review and respond online: {url}\n\n{businessName}"
      },
      contractSent: {
        subject: "Contract {number} from {businessName}",
        body: "Hello {clientName},\n\nContract {number} is attached for your review.\n\nYou can read and sign it online: {url}\n\n{businessName}"
      },
      paymentReceipt: {
        subject: "Receipt for invoice {number}",
        body: "Hello {clientName},\n\nThank you. We have recorded your payment for invoice {number}. The invoice is attached.\n\n{businessName}"
      },
      recurringGenerated: {
        subject: "Invoice {number} from {businessName}",
        body: "Hello {clientName},\n\nYour recurring invoice {number} for {amount} is attached, due {dueDate}.\n\nYou can also view it online: {url}\n\n{businessName}"
      }
    },
    invoices: {
      metadata: {
        list: "Invoices",
        detail: "Invoice",
        create: "New invoice",
        edit: "Edit invoice"
      },
      reminders: {
        subjectBefore: "Invoice {number} is due in {days, plural, one {# day} other {# days}}",
        subjectAfter: "Invoice {number} is {days, plural, one {# day} other {# days}} overdue",
        bodyBefore:
          "Hello {clientName},\n\nThis is a reminder that invoice {number} for {amount} is due on {dueDate}.\n\nYou can view and pay it here: {url}\n\nThank you,\n{businessName}",
        bodyAfter:
          "Hello {clientName},\n\nInvoice {number} for {amount} was due on {dueDate} and is still outstanding.\n\nYou can view and pay it here: {url}\n\nThank you,\n{businessName}"
      },
      list: {
        title: "Invoices",
        description: "Bill this project's work and track what is still owed",
        backToProject: "Back to project",
        createButton: "New invoice",
        moreActions: "More",
        count: "{count, plural, one {# invoice} other {# invoices}}",
        clearFilters: "Clear filters"
      },
      overview: {
        title: "Invoices",
        description: "Every invoice across your clients and projects, soonest due first",
        tableTitle: "All invoices",
        totalHint: "Across every client and project",
        parentColumn: "Belongs to",
        clientColumn: "Client",
        outstandingColumn: "Outstanding",
        noParent: "No parent",
        noClient: "No client",
        openProject: "Open project",
        openClient: "Open client",
        browseProjects: "Browse projects",
        searchPlaceholder: "Search by number, project, or client",
        searchLabel: "Search invoices",
        filters: "Filters",
        emptyTitle: "No invoices yet",
        emptyDescription: "Invoices are raised from a project. Open a project to bill its work.",
        noMatchTitle: "No invoices match these filters",
        noMatchDescription: "Clear the filters to see every invoice again."
      },
      status: {
        draft: "Draft",
        sent: "Sent",
        paid: "Paid",
        overdue: "Overdue",
        partially_paid: "Partially paid"
      },
      summary: {
        total: "Invoices",
        totalHint: "Every invoice raised for this project",
        draft: "Drafts",
        draftHint: "Not yet issued to the client",
        overdue: "Overdue",
        overdueHint: "Past the due date and unpaid",
        outstanding: "Outstanding",
        outstandingHint: "Issued and still unpaid",
        outstandingMultiCurrency:
          "Largest of {count, plural, one {# currency} other {# currencies}}"
      },
      table: {
        numberColumn: "Number",
        statusColumn: "Status",
        issueDateColumn: "Issued",
        dueDateColumn: "Due",
        totalColumn: "Total",
        notIssued: "Not issued",
        noDueDate: "No due date"
      },
      fields: {
        currency: "Currency",
        template: "Template",
        issueDate: "Issue date",
        dueDate: "Due date",
        notes: "Notes",
        discountType: "Invoice discount",
        discountPercentage: "Discount percentage",
        discountAmount: "Discount amount"
      },
      lineItems: {
        title: "Line items",
        addButton: "Add line item",
        removeButton: "Remove line item",
        descriptionColumn: "Description",
        quantityColumn: "Quantity",
        unitColumn: "Unit",
        unitPriceColumn: "Unit price",
        discountColumn: "Line discount",
        taxColumn: "Tax",
        totalColumn: "Total",
        rowLabel: "Line item {position}",
        empty: "No line items yet",
        noTaxRate: "No tax"
      },
      placeholders: {
        description: "What are you billing for",
        unit: "hour",
        amount: "0.00",
        quantity: "1",
        notes: "Payment details, thanks, anything the client should read",
        percentage: "0"
      },
      discount: {
        none: "None",
        percentage: "Percentage",
        fixed: "Fixed amount"
      },
      totals: {
        subtotal: "Subtotal",
        discount: "Discount",
        tax: "Tax",
        total: "Total",
        amountPaid: "Paid",
        outstanding: "Outstanding",
        credited: "Credited",
        effectiveReceivable: "Effective receivable"
      },
      template: {
        none: "No template"
      },
      form: {
        backToList: "Back to invoices",
        backToInvoice: "Back to invoice",
        createTitle: "New invoice",
        createDescription: "Draft an invoice. Nothing is sent until you issue it",
        editTitle: "Edit invoice",
        editDescription: "Only a draft invoice can be edited",
        saveCreate: "Create invoice",
        saveEdit: "Save changes",
        detailsSection: "Details",
        detailsDescription: "Currency, template, dates and any invoice-wide discount",
        lineItemsSection: "Line items",
        lineItemsDescription: "What you are billing, priced and taxed per line",
        notesSection: "Notes",
        notesDescription: "Shown to the client on the invoice"
      },
      detail: {
        backToList: "Back to invoices",
        notIssued: "Not issued",
        paidAt: "Paid",
        notPaid: "Not paid",
        viewsLabel: "Client views",
        viewCount: "{count, plural, one {# view} other {# views}}",
        lockedTitle: "This invoice is locked",
        lockedDescription: "An issued invoice cannot be edited. Raise a credit note instead",
        notesTitle: "Notes",
        summaryTitle: "Summary",
        publicLinkTitle: "Client link",
        publicLinkDescription: "The address where your client can view and pay this invoice",
        publicLinkHidden: "The link appears once the invoice is sent",
        copyLink: "Copy link",
        linkCopied: "Link copied"
      },
      send: {
        title: "Send this invoice?",
        description:
          "The invoice is stamped with today's date, locked against edits, and a client link is opened",
        confirm: "Send invoice"
      },
      markPaid: {
        title: "Mark this invoice as paid?",
        description: "This records the full {amount} as received",
        confirm: "Mark as paid"
      },
      convert: {
        title: "Invoice an accepted proposal",
        description: "The proposal's line items, tax rates and totals are copied to a new draft",
        proposalLabel: "Proposal",
        proposalPlaceholder: "Choose a proposal",
        proposalOption: "{number} — {total}",
        confirm: "Create invoice",
        empty: "No accepted proposal is waiting to be invoiced"
      },
      delete: {
        title: "Delete this invoice?",
        description: "The invoice is removed from your lists. Its number is never reused",
        confirm: "Delete invoice"
      },
      empty: {
        title: "No invoices yet",
        description: "Bill this project's work by raising your first invoice"
      },
      actions: {
        create: "New invoice",
        edit: "Edit",
        send: "Send",
        markPaid: "Mark as paid",
        delete: "Delete",
        view: "View",
        rowActions: "Invoice actions",
        convertProposal: "From accepted proposal"
      },
      notifications: {
        created: "Invoice created",
        updated: "Invoice updated",
        sent: "Invoice sent",
        markedPaid: "Invoice marked as paid",
        deleted: "Invoice deleted",
        converted: "Invoice created from proposal"
      },
      validation: {
        descriptionRequired: "Description is required",
        descriptionTooLong: "Description must be {count} characters or fewer",
        quantityInvalid: "Quantity must be a positive number",
        amountInvalid: "Enter a valid amount",
        amountRequired: "Amount is required",
        percentageInvalid: "Enter a percentage between 0 and 100",
        dateInvalid: "Enter a valid date",
        dueDateBeforeIssueDate: "Due date cannot be before the issue date",
        idInvalid: "Invoice not found",
        proposalIdInvalid: "Proposal not found",
        projectRequired: "Project is required",
        lineItemsRequired: "Add at least one line item",
        notesTooLong: "Notes must be {count} characters or fewer",
        unitTooLong: "Unit must be {count} characters or fewer",
        currencyInvalid: "Select a currency",
        taxRateInvalid: "Select a valid tax rate",
        discountAmountRequired: "Enter a discount amount",
        discountPercentageRequired: "Enter a discount percentage"
      },
      public: {
        metadataTitle: "Invoice",
        fromLabel: "From",
        preparedFor: "Prepared for {parent}",
        unavailable: {
          title: "This invoice is not available",
          description:
            "The link may have been withdrawn or never existed. Ask the sender for a new one."
        },
        summary: {
          title: "Summary",
          issueDate: "Issued",
          dueDate: "Due",
          paidAt: "Paid",
          noDate: "Not set"
        },
        payment: {
          title: "How to pay",
          description: "Pay using any of the details below and quote the invoice number.",
          settledTitle: "Nothing to pay",
          settledDescription: "This invoice has been settled in full.",
          settledNote: "Thank you. No further payment is due.",
          amountDue: "Amount due",
          amountSettled: "Total paid",
          bankTitle: "Bank transfer",
          bankName: "Bank",
          iban: "IBAN",
          reference: "Reference",
          cardTitle: "Card payment",
          cardButton: "Pay by card",
          cardUnavailable: "Card payments are not available yet. Use the details above to pay.",
          noMethods:
            "No payment details have been published. Contact the sender to arrange payment."
        },
        validation: {
          tokenInvalid: "Invalid invoice link"
        }
      },
      errors: {
        notFound: "Invoice not found",
        projectNotFound: "Project not found",
        notDraft: "Only a draft invoice can be edited",
        invalidTransition: "This invoice cannot move to that status",
        createFailed: "Failed to create invoice",
        updateFailed: "Failed to update invoice",
        sendFailed: "Failed to send invoice",
        markPaidFailed: "Failed to mark the invoice as paid",
        deleteFailed: "Failed to delete invoice",
        proposalNotConvertible: "Only an accepted proposal can be invoiced",
        proposalAlreadyConverted: "This proposal has already been invoiced",
        proposalHasNoLineItems: "This proposal has no line items to invoice"
      }
    },
    creditNotes: {
      metadata: {
        list: "Credit notes",
        detail: "Credit note",
        create: "New credit note"
      },
      overview: {
        title: "Credit notes",
        description: "Every adjustment issued against an invoice",
        tableTitle: "All credit notes",
        count: "{count, plural, one {# credit note} other {# credit notes}}",
        numberColumn: "Number",
        invoiceColumn: "Invoice",
        clientColumn: "Client",
        issuedColumn: "Issued",
        totalColumn: "Credited",
        rowActions: "Credit note actions",
        noClient: "No client",
        openInvoice: "Open invoice",
        openClient: "Open client",
        browseInvoices: "Browse invoices",
        searchPlaceholder: "Search number, invoice, client",
        searchLabel: "Search credit notes",
        filters: "Filters",
        clearFilters: "Clear filters",
        emptyTitle: "No credit notes yet",
        emptyDescription: "Credit notes are raised from an issued invoice",
        noMatchTitle: "No credit notes match",
        noMatchDescription: "Adjust the search or filters to widen the results"
      },
      summary: {
        total: "Credit notes",
        totalHint: "Issued on this instance",
        credited: "Credited",
        creditedHint: "Total reduced across invoices",
        creditedMultiCurrency: "Largest of {count, plural, one {# currency} other {# currencies}}",
        invoicesCredited: "Invoices credited",
        invoicesCreditedHint: "Invoices carrying an adjustment",
        average: "Average note",
        averageHint: "Mean value in the leading currency"
      },
      card: {
        title: "Credit notes",
        description: "Adjustments reducing what this invoice is still owed",
        issuedOn: "Issued {date}"
      },
      empty: {
        title: "No credit notes",
        description: "Credit this invoice when work is cancelled, returned or overbilled",
        lockedDescription: "A draft invoice cannot be credited. Edit the invoice instead"
      },
      actions: {
        create: "New credit note",
        view: "View credit note",
        delete: "Delete",
        backToInvoice: "Back to invoice",
        backToList: "Back to credit notes"
      },
      fields: {
        reason: "Reason",
        invoice: "Invoice",
        client: "Client",
        issuedAt: "Issued"
      },
      placeholders: {
        reason: "Why is this credit being issued?",
        description: "What is being credited",
        quantity: "1",
        unit: "hours",
        amount: "0.00",
        percentage: "0"
      },
      form: {
        createTitle: "New credit note",
        createDescription: "Credit part or all of an issued invoice. The number is permanent",
        creditingInvoice: "Crediting {number} for {client}",
        lineItemsSection: "Line items",
        lineItemsDescription: "What is being credited, priced in {currency}",
        reasonSection: "Reason",
        reasonDescription: "Recorded on the credit note and shown to the client",
        saveCreate: "Issue credit note"
      },
      lineItems: {
        empty: "Add at least one line to credit",
        addButton: "Add line",
        removeButton: "Remove line",
        rowLabel: "Line {position}",
        tableTitle: "Credited items",
        descriptionColumn: "Description",
        quantityColumn: "Qty",
        unitPriceColumn: "Unit price",
        taxColumn: "Tax",
        totalColumn: "Total",
        unitColumn: "Unit",
        discountColumn: "Discount",
        noTaxRate: "No tax"
      },
      discount: {
        none: "No discount",
        percentage: "Percentage",
        fixed: "Fixed amount"
      },
      totals: {
        subtotal: "Subtotal",
        tax: "Tax",
        total: "Total credited",
        invoiceTotal: "Invoice total",
        alreadyCredited: "Already credited",
        outstanding: "Still outstanding"
      },
      detail: {
        summaryTitle: "Summary",
        reasonTitle: "Reason",
        noReason: "No reason recorded"
      },
      delete: {
        title: "Delete this credit note?",
        description: "The invoice returns to its uncredited balance. The number is never reused",
        confirm: "Delete credit note"
      },
      notifications: {
        created: "Credit note issued",
        deleted: "Credit note deleted"
      },
      validation: {
        descriptionRequired: "Description is required",
        descriptionTooLong: "Description must be {count} characters or fewer",
        unitTooLong: "Unit must be {count} characters or fewer",
        quantityInvalid: "Quantity must be a positive number",
        amountRequired: "Amount is required",
        amountInvalid: "Enter a valid amount",
        percentageInvalid: "Enter a percentage between 0 and 100",
        discountPercentageRequired: "Enter a discount percentage",
        discountAmountRequired: "Enter a discount amount",
        reasonTooLong: "Reason must be {count} characters or fewer",
        lineItemsRequired: "Add at least one line item",
        taxRateInvalid: "Select a valid tax rate",
        invoiceIdInvalid: "Invalid invoice",
        idInvalid: "Invalid credit note"
      },
      errors: {
        notFound: "Credit note not found",
        invoiceNotFound: "Invoice not found",
        invoiceNotIssued: "Only an issued invoice can be credited",
        totalNotPositive: "A credit note must be worth more than zero",
        settingsMissing: "Invoicing settings are not configured",
        createFailed: "Failed to issue credit note",
        deleteFailed: "Failed to delete credit note"
      },
      routeError: {
        title: "Credit note unavailable",
        description: "Something went wrong loading this credit note"
      }
    },
    recurringInvoices: {
      metadata: {
        list: "Recurring invoices",
        detail: "Recurring invoice",
        create: "New recurring invoice",
        edit: "Edit recurring invoice"
      },
      list: {
        title: "Recurring invoices",
        description: "Schedules that raise invoices on their own, soonest run first",
        createButton: "New recurring invoice",
        searchPlaceholder: "Search by name, client, or project",
        moreActions: "More",
        columns: {
          name: "Name",
          client: "Client",
          project: "Project",
          cadence: "Cadence",
          nextRun: "Next run",
          status: "Status",
          occurrences: "Generated"
        },
        empty: {
          title: "No recurring invoices yet",
          description: "Set up a schedule to bill a client on a fixed rhythm",
          action: "New recurring invoice"
        }
      },
      filters: {
        status: "Status",
        cadence: "Cadence",
        client: "Client",
        clear: "Clear filters"
      },
      status: {
        active: "Active",
        paused: "Paused",
        completed: "Completed",
        cancelled: "Cancelled"
      },
      cadence: {
        weekly: "Weekly",
        monthly: "Monthly",
        quarterly: "Quarterly",
        yearly: "Yearly"
      },
      fields: {
        name: "Name",
        client: "Client",
        project: "Project",
        template: "Template",
        cadence: "Cadence",
        cadenceDay: "Billing day",
        nextRunAt: "First run",
        endCondition: "Ends",
        endAfterCount: "Number of occurrences",
        endByDate: "End date",
        autoSend: "Send automatically",
        currency: "Currency",
        includedHours: "Included hours",
        overageRate: "Overage rate",
        notes: "Notes",
        lineItems: "Line items"
      },
      fieldHints: {
        cadenceDayWeekly: "1 is Monday, 7 is Sunday. Leave blank to use the first run's weekday",
        cadenceDayMonthly: "Day of the month from 1 to 31. Short months use their last day",
        autoSend: "Issue and email each invoice as soon as it is generated",
        includedHours: "Hours covered by the retainer before overage is billed",
        overageRate: "Charged per hour once the included hours are used up"
      },
      endCondition: {
        never: "Never",
        after_count: "After a number of invoices",
        by_date: "On a date"
      },
      form: {
        createTitle: "New recurring invoice",
        createDescription: "Set up a schedule. The first invoice is raised on its first run date",
        editTitle: "Edit recurring invoice",
        editDescription: "Changes apply to invoices generated from the next run onwards",
        sections: {
          details: "Details",
          schedule: "Schedule",
          retainer: "Retainer",
          lineItems: "Line items",
          notes: "Notes"
        },
        addLineItem: "Add line item",
        removeLineItem: "Remove line item",
        submitCreate: "Create schedule",
        submitEdit: "Save changes",
        cancel: "Cancel",
        retainerToggle: "Bill this as a retainer",
        retainerDescription: "Include a pool of hours each period and bill anything beyond it"
      },
      detail: {
        title: "Recurring invoice",
        scheduleSummary: "Schedule",
        nextRun: "Next run",
        lastRun: "Last run",
        occurrences: "{count, plural, one {# invoice generated} other {# invoices generated}}",
        endCondition: "Ends",
        retainer:
          "{includedHours, plural, one {# hour} other {# hours}} included, then {rate} an hour",
        retainerNone: "Not a retainer",
        generatedInvoices: "Generated invoices",
        generatedInvoicesEmpty: "Nothing has been generated yet",
        noProject: "No project"
      },
      dialogs: {
        pause: {
          title: "Pause this schedule?",
          description: "No invoices are generated until you resume it",
          confirm: "Pause schedule"
        },
        resume: {
          title: "Resume this schedule?",
          description: "The next invoice is generated on the next run date",
          confirm: "Resume schedule"
        },
        cancel: {
          title: "Cancel this schedule?",
          description: "Cancelling is permanent. Invoices already generated are kept",
          confirm: "Cancel schedule"
        },
        delete: {
          title: "Delete this recurring invoice?",
          description: "The schedule is removed from your lists. Generated invoices are kept",
          confirm: "Delete schedule"
        }
      },
      toasts: {
        created: "Recurring invoice created",
        updated: "Recurring invoice updated",
        paused: "Schedule paused",
        resumed: "Schedule resumed",
        cancelled: "Schedule cancelled",
        deleted: "Recurring invoice deleted"
      },
      validation: {
        nameRequired: "Name is required",
        nameTooLong: "Name is too long",
        clientRequired: "Client is required",
        referenceInvalid: "Selection is not valid",
        cadenceDayInvalid: "Day must be a whole number",
        cadenceDayOutOfRange: "Day is outside the range allowed by this cadence",
        nextRunRequired: "First run date is required",
        dateInvalid: "Date is not valid",
        occurrenceCountRequired: "Number of occurrences is required",
        occurrenceCountInvalid: "Number of occurrences must be between 1 and 1000",
        endDateRequired: "End date is required",
        endDateBeforeNextRun: "End date cannot be before the first run",
        currencyInvalid: "Currency must be a three-letter code",
        includedHoursInvalid: "Included hours must be a positive number",
        retainerIncomplete: "Set both included hours and an overage rate, or neither",
        notesTooLong: "Notes are too long",
        lineItemsRequired: "Add at least one line item",
        descriptionRequired: "Description is required",
        descriptionTooLong: "Description is too long",
        unitTooLong: "Unit is too long",
        quantityInvalid: "Quantity must be greater than zero",
        amountRequired: "Amount is required",
        amountInvalid: "Amount is not valid",
        percentageInvalid: "Percentage must be between 0 and 100"
      },
      overage: {
        lineDescription:
          "Additional hours beyond the {includedHours, plural, one {# included hour} other {# included hours}}",
        lineUnit: "hours"
      },
      errors: {
        notFound: "Recurring invoice not found",
        clientNotFound: "Client not found",
        projectNotFound: "Project does not belong to this client",
        taxRateInvalid: "One of the selected tax rates is no longer available",
        invalidTransition: "This schedule cannot change to that state",
        terminal: "A completed or cancelled schedule cannot be edited",
        createFailed: "Failed to create recurring invoice",
        updateFailed: "Failed to update recurring invoice",
        deleteFailed: "Failed to delete recurring invoice"
      },
      routeError: {
        title: "Recurring invoice unavailable",
        description: "Something went wrong loading this recurring invoice"
      }
    },
    payments: {
      method: {
        bank_transfer: "Bank transfer",
        stripe: "Stripe",
        cash: "Cash",
        other: "Other"
      },
      list: {
        title: "Payments",
        description: "Money received against this invoice",
        rowActions: "Payment actions"
      },
      actions: {
        record: "Record payment",
        edit: "Edit payment",
        delete: "Delete payment"
      },
      empty: {
        title: "No payments recorded",
        description: "Record a payment when the money arrives",
        draftDescription: "Send the invoice before recording a payment"
      },
      totals: {
        recorded: "Recorded",
        outstanding: "Outstanding"
      },
      fields: {
        amount: "Amount",
        paidAt: "Payment date",
        method: "Method",
        reference: "Reference",
        notes: "Notes"
      },
      placeholders: {
        amount: "0.00",
        reference: "Bank transaction reference",
        notes: "Anything worth remembering about this payment"
      },
      form: {
        createTitle: "Record payment",
        createDescription: "Record money received against this invoice",
        editTitle: "Edit payment",
        editDescription: "Correct the details of this payment record",
        saveCreate: "Record payment",
        saveEdit: "Save payment",
        recorded: "Payment recorded",
        updated: "Payment updated"
      },
      delete: {
        title: "Delete this payment?",
        description:
          "The {amount} recorded here will be removed and the invoice totals recalculated",
        confirm: "Delete payment"
      },
      notifications: {
        deleted: "Payment deleted"
      },
      validation: {
        amountRequired: "Amount is required",
        amountInvalid: "Enter a valid amount",
        amountPositive: "Amount must be greater than zero",
        dateInvalid: "Enter a valid date",
        referenceTooLong: "Reference must be {count} characters or fewer",
        notesTooLong: "Notes must be {count} characters or fewer",
        invoiceIdInvalid: "Invalid invoice",
        idInvalid: "Invalid payment"
      },
      errors: {
        notFound: "Payment not found",
        invoiceNotFound: "Invoice not found",
        invoiceNotIssued: "Send the invoice before recording a payment",
        currencyMismatch: "This payment is in a different currency to the invoice",
        overpayment: "This would pay more than the invoice total; issue a credit note instead",
        providerOwned: "A Stripe payment cannot be edited",
        alreadySettled: "This invoice is already paid in full",
        recordFailed: "Failed to record payment",
        updateFailed: "Failed to update payment",
        deleteFailed: "Failed to delete payment"
      },
      webhook: {
        rateLimited: "Too many requests",
        rejected: "Webhook rejected"
      }
    },
    activity: {
      metadata: {
        feed: "Activity"
      },
      feed: {
        title: "Activity",
        description: "Everything that happened across your business",
        unread: "{count, plural, =0 {No unread} one {# unread} other {# unread}}",
        unreadBadge: "Unread",
        allRead: "All caught up",
        markAllRead: "Mark all as read",
        markRead: "Mark as read",
        open: "Open",
        delete: "Delete",
        deleteTitle: "Delete this activity entry?",
        deleteDescription:
          "The entry is removed from your activity history. This cannot be undone.",
        emptyTitle: "No activity yet",
        emptyDescription:
          "Actions across clients, projects, invoices and time will show up here as they happen",
        noMatchTitle: "No matching activity",
        noMatchDescription: "Try a different filter",
        pagination: "Page {page, number} of {pageCount, number}",
        previous: "Previous",
        next: "Next"
      },
      filters: {
        entityType: "Type",
        allEntityTypes: "All types",
        unreadOnly: "Unread only",
        reset: "Reset"
      },
      timeline: {
        emptyTitle: "No activity yet",
        emptyDescription: "Activity for this record will show up here"
      },
      entityTypes: {
        client: "Client",
        project: "Project",
        proposal: "Proposal",
        invoice: "Invoice",
        contract: "Contract",
        task: "Task",
        timeEntry: "Time entry",
        expense: "Expense",
        payment: "Payment"
      },
      messages: {
        clientCreated: "Client {name} was added",
        projectCreated: "Project {name} was created",
        projectStatusChanged:
          "Project {name} moved to {status, select, active {Active} completed {Completed} on_hold {On hold} cancelled {Cancelled} other {Unknown}}",
        proposalSent: "Proposal {number} was sent",
        proposalAccepted: "Proposal {number} was accepted",
        proposalRejected: "Proposal {number} was declined",
        contractSigned: "Contract {title} was signed",
        invoiceSent: "Invoice {number} was sent",
        invoicePaid: "Invoice {number} was marked as paid",
        invoiceOverdue: "Invoice {number} is {days, plural, one {# day} other {# days}} overdue",
        invoiceGenerated: "Invoice {number} was generated automatically (run {occurrence, number})",
        paymentReceived: "Payment received for invoice {number}",
        timeLogged: "Logged {hours, number} h on {project}",
        expenseCreated: "Expense recorded: {category}"
      },
      success: {
        markedRead: "Marked as read",
        markedAllRead: "All activity marked as read",
        deleted: "Activity entry deleted"
      },
      errors: {
        notFound: "Activity entry not found",
        markReadFailed: "Failed to mark activity as read",
        deleteFailed: "Failed to delete activity entry",
        idInvalid: "Invalid activity entry"
      }
    },
    reports: {
      metadata: {
        list: "Reports"
      },
      actions: {
        export: "Export CSV"
      },
      kinds: {
        revenueByClient: {
          title: "Revenue by client",
          description:
            "What each client was invoiced, net of credit notes, and what is still outstanding."
        },
        revenueByProject: {
          title: "Revenue by project",
          description:
            "What each project earned, net of credit notes, and what is still outstanding."
        },
        revenueByMonth: {
          title: "Revenue by month",
          description: "Invoiced value month by month, net of credit notes."
        },
        revenueByTaxRate: {
          title: "Revenue by tax rate",
          description: "Taxable value and tax charged at each rate, net of credit notes."
        },
        timeByProject: {
          title: "Time by project",
          description: "Hours logged per project, split by whether they are billable."
        },
        expensesByCategory: {
          title: "Expenses by category",
          description: "What was spent in each category and how much of it is rebillable."
        },
        taxSummary: {
          title: "Tax summary",
          description: "Tax charged, tax credited, and the difference still owed at each rate."
        }
      },
      filters: {
        title: "Filters",
        report: "Report",
        from: "From",
        to: "To",
        reset: "Clear filters",
        client: "Client",
        allClients: "All clients",
        project: "Project",
        allProjects: "All projects",
        taxRate: "Tax rate",
        allTaxRates: "All tax rates",
        projectOption: "{client} — {project}",
        taxRateOption: "{name} ({percentage, number}%)"
      },
      dimensions: {
        client: "Client",
        project: "Project",
        month: "Month",
        taxRate: "Tax rate",
        category: "Category"
      },
      columns: {
        invoiceCount: "Invoices",
        invoiced: "Invoiced",
        credited: "Credited",
        netRevenue: "Net revenue",
        paid: "Paid",
        outstanding: "Outstanding",
        netTaxable: "Net taxable",
        netTax: "Net tax",
        netGross: "Net gross",
        entryCount: "Entries",
        hours: "Hours",
        billableValue: "Value",
        expenseCount: "Expenses",
        amount: "Amount",
        rebillableAmount: "Rebillable",
        taxableBase: "Taxable base",
        taxAmount: "Tax charged",
        creditedTaxable: "Credited base",
        creditedTax: "Tax credited",
        netTaxDue: "Net tax due"
      },
      rows: {
        noClient: "No client",
        noProject: "No project",
        noTaxRate: "No tax rate",
        percentage: "{percentage, number}%"
      },
      table: {
        currency: "Currency",
        rowCount: "{count, plural, one {# row} other {# rows}}"
      },
      summary: {
        hint: "{column}, over {count, plural, one {# row} other {# rows}}"
      },
      time: {
        billable: "Billable",
        nonBillable: "Non-billable"
      },
      export: {
        exported: "{count, plural, one {# row exported} other {# rows exported}}",
        columns: {
          detail: "Detail",
          currency: "Currency",
          total: "Total"
        }
      },
      empty: {
        title: "Nothing to report yet",
        description: "This report fills in as you invoice, log time, and record expenses.",
        filteredTitle: "No rows match these filters",
        filteredDescription: "Widen the date range or clear the filters to see more."
      },
      errors: {
        exportFailed: "Failed to export the report"
      }
    },
    templates: {
      metadataTitle: "Templates",
      title: "Templates",
      description: "Reusable content for your documents and emails",
      list: {
        tableTitle: "All templates",
        count: "{count, plural, one {# template} other {# templates}}",
        actions: "Actions",
        updatedColumn: "Updated",
        noMatchTitle: "No templates match",
        noMatchDescription: "Adjust the search or filters to see more templates"
      },
      summary: {
        total: "Templates",
        totalHint: "Across every document and email type",
        customDelta: "{count, plural, one {# custom template} other {# custom templates}}",
        documents: "Documents",
        documentsHint: "Invoices, proposals, contracts and credit notes",
        emails: "Emails",
        emailsHint: "Messages sent alongside your documents",
        otherEmails: "Other",
        defaults: "Defaults set",
        defaultsValue: "{covered}/{total}",
        defaultsHint: "Every type has a default template",
        defaultsMissingHint:
          "{count, plural, one {# type falls back to the built-in layout} other {# types fall back to the built-in layout}}",
        defaultsCovered: "Set",
        defaultsMissing: "Missing",
        breakdownEmpty: "No templates yet"
      },
      filters: {
        title: "Filters",
        search: "Search templates",
        searchPlaceholder: "Search by name or subject",
        origin: "Source",
        reset: "Reset"
      },
      origin: {
        all: "All sources",
        custom: "Custom",
        system: "System"
      },
      preview: {
        frameTitle: "{name} preview",
        empty: "No content yet"
      },
      types: {
        invoice: "Invoice",
        proposal: "Proposal",
        contract: "Contract",
        credit_note: "Credit note",
        email_invoice_send: "Email — invoice sent",
        email_proposal_send: "Email — proposal sent",
        email_contract_send: "Email — contract sent",
        email_payment_receipt: "Email — payment receipt",
        email_overdue_reminder: "Email — overdue reminder",
        email_recurring_generated: "Email — recurring invoice"
      },
      actions: {
        create: "Create template",
        edit: "Edit",
        preview: "Preview",
        duplicate: "Duplicate",
        delete: "Delete",
        setDefault: "Set as default",
        backToList: "Back to templates"
      },
      badges: {
        default: "Default",
        system: "System"
      },
      empty: {
        title: "No templates yet",
        description: "Create your first template to reuse content across documents and emails"
      },
      form: {
        createTitle: "Create template",
        createDescription: "Choose a type and give your template a name.",
        saveCreate: "Create template",
        created: "Template created"
      },
      delete: {
        description: "Delete {name}? This cannot be undone."
      },
      fields: {
        name: "Name",
        namePlaceholder: "e.g. Standard invoice",
        type: "Type",
        typePlaceholder: "Select a template type",
        subject: "Subject",
        subjectPlaceholder: "Email subject line"
      },
      blocks: {
        text: "Text",
        image: "Image",
        table: "Table",
        frame: "Frame",
        group: "Group",
        shape: "Shape",
        shapeVariant: {
          rectangle: "Rectangle",
          ellipse: "Ellipse",
          line: "Line"
        }
      },
      editor: {
        previewTab: "Preview",
        previewTitle: "Preview",
        previewEmpty: "Add blocks to see a preview",
        emptyCanvasTitle: "Empty template",
        emptyCanvasDescription: "Add a block to start composing this template",
        save: "Save template",
        unsaved: "Unsaved changes",
        selectBlock: "Select {name} block",
        duplicateBlock: "Duplicate block",
        removeBlock: "Remove block",
        moveUp: "Move up",
        moveDown: "Move down",
        moveLeft: "Move left",
        moveRight: "Move right",
        hideBlock: "Hide block",
        showBlock: "Show block",
        lockBlock: "Lock block",
        unlockBlock: "Unlock block",
        bringToFront: "Bring to front",
        bringForward: "Bring forward",
        sendBackward: "Send backward",
        sendToBack: "Send to back",
        layersTitle: "Layers",
        layersEmpty: "No blocks yet",
        pageLayer: "Page",
        renameBlock: "Rename block",
        layerDragHandle: "Drag to reorder {name}",
        layerMoved: "{name} moved",
        layerReparented: "{name} moved into a new parent",
        groupCreated: "{count, plural, one {# block grouped} other {# blocks grouped}}",
        frameCreated:
          "{count, plural, one {# block wrapped in a frame} other {# blocks wrapped in a frame}}",
        ungroupedBlocks:
          "{count, plural, one {# block released from the group} other {# blocks released from the group}}",
        duplicated: "{count, plural, one {# block duplicated} other {# blocks duplicated}}",
        pasted: "Blocks pasted",
        broughtToFront: "Brought to front",
        broughtForward: "Brought forward",
        sentBackward: "Sent backward",
        sentToBack: "Sent to back",
        zoomIn: "Zoom in",
        zoomOut: "Zoom out",
        zoomFit: "Fit to view",
        fullscreen: "Enter fullscreen",
        exitFullscreen: "Exit fullscreen",
        showGrid: "Show grid",
        undo: "Undo",
        redo: "Redo",
        renameTemplate: "Rename template",
        toolSelect: "Select tool",
        toolPan: "Pan tool",
        insertMenu: "Insert block",
        statusNoSelection: "No block selected",
        statusSize: "W {width} × H {height}",
        statusPosition: "X {x} · Y {y}",
        gridSize: "Grid {size}px",
        sectionLayout: "Layout",
        sectionSpacing: "Spacing",
        sectionAppearance: "Appearance",
        sectionTypography: "Typography",
        sectionContent: "Content",
        sizeWidth: "Width",
        sizeHeight: "Height",
        positionX: "X",
        positionY: "Y",
        paddingAll: "All sides",
        paddingTop: "Top",
        paddingRight: "Right",
        paddingBottom: "Bottom",
        paddingLeft: "Left",
        backgroundColor: "Background",
        backgroundNone: "None",
        backgroundSolid: "Solid",
        borderWidth: "Border",
        borderColor: "Border color",
        borderRadius: "Radius",
        fontFamily: "Font",
        fontSize: "Size",
        fontWeight: "Weight",
        textColor: "Text color",
        textAlign: "Alignment",
        alignLeft: "Left",
        alignCenter: "Center",
        alignRight: "Right",
        lineHeight: "Line height",
        weight300: "Light",
        weight400: "Regular",
        weight500: "Medium",
        weight600: "Semibold",
        weight700: "Bold",
        pageDefault: "Page default",
        richText: "Content",
        imageAlt: "Alt text",
        imageSource: "Source",
        imageSourceUpload: "Upload",
        imageSourceBusinessLogo: "Business logo",
        businessLogoMissing: "No business logo configured yet",
        uploadImage: "Upload image",
        replaceImage: "Replace image",
        imageEmpty: "No image uploaded yet",
        tableSource: "Rows",
        tableSourceManual: "Manual",
        tableSourceLineItems: "Line items",
        tableBinding: "Field",
        tableHeaderPlaceholder: "Column {column} header",
        tableCellPlaceholder: "Row {row}, column {column}",
        tableAddColumn: "Add column",
        tableRemoveColumn: "Remove column",
        tableAddRow: "Add row",
        tableRemoveRow: "Remove row",
        frameClip: "Clip contents",
        frameChildMoveUp: "Move child up",
        frameChildMoveDown: "Move child down",
        shapeVariant: "Variant",
        resizeHandle: "Resize block ({direction})",
        rotateHandle: "Rotate selection",
        rotationBadge: "{degrees}°",
        rotation: "Rotation",
        mixedValue: "Mixed",
        multiSelectionTitle: "{count} blocks selected",
        ungroup: "Ungroup",
        sectionConstraints: "Constraints",
        constraintHorizontal: "Horizontal",
        constraintVertical: "Vertical",
        constraintStart: "Start",
        constraintEnd: "End",
        constraintCenter: "Center",
        constraintStretch: "Stretch",
        constraintScale: "Scale",
        contextMenu: {
          copy: "Copy",
          paste: "Paste",
          pasteHere: "Paste here",
          groupSelection: "Group selection",
          wrapInFrame: "Wrap in frame",
          selectLayerUnderCursor: "Select layer under cursor",
          copyStyle: "Copy style",
          pasteStyle: "Paste style"
        },
        gesture: {
          instructions:
            "Use the arrow keys to move the selected block one grid cell, Shift and an arrow key to move it ten pixels, Control and an arrow key to resize it, and Delete to remove it. Press escape to clear the selection.",
          start: "Picked up {name} block",
          move: "{name} block is at position {position}",
          resize: "{name} block is {width} × {height}",
          rotate: "{name} block is rotated to {degrees}°",
          end: "{name} block dropped at position {position}",
          cancel: "Moving {name} block cancelled"
        },
        textEdit: {
          enter: "Editing {name} block",
          exit: "Finished editing {name} block",
          editingLabel: "Text block content",
          mergeVariableSuggestionsLabel: "Merge variable suggestions"
        },
        selection: {
          marquee:
            "{count, plural, =0 {Selection cleared} one {# block selected} other {# blocks selected}}",
          marqueeCancel: "Selection cancelled"
        }
      },
      pageSettings: {
        title: "Page settings",
        description: "Applies to the whole document",
        margins: "Margins",
        marginTop: "Top",
        marginRight: "Right",
        marginBottom: "Bottom",
        marginLeft: "Left",
        fontFamily: "Default font",
        baseFontSize: "Base font size",
        fonts: {
          sans: "Sans serif",
          serif: "Serif",
          mono: "Monospace"
        }
      },
      mergeVariables: {
        title: "Merge variables",
        insertVariable: "Insert variable",
        searchPlaceholder: "Search variables",
        noResults: "No matching variables",
        labels: {
          clientName: "Client name",
          clientEmail: "Client email",
          clientPhone: "Client phone",
          clientWebsite: "Client website",
          clientTaxId: "Client tax ID",
          clientAddressLine1: "Client address line 1",
          clientAddressLine2: "Client address line 2",
          clientCity: "Client city",
          clientState: "Client state",
          clientPostalCode: "Client postal code",
          clientCountry: "Client country",
          clientCurrency: "Client currency",
          businessName: "Business name",
          businessEmail: "Business email",
          businessPhone: "Business phone",
          businessWebsite: "Business website",
          businessTaxId: "Business tax ID",
          businessAddressLine1: "Business address line 1",
          businessAddressLine2: "Business address line 2",
          businessCity: "Business city",
          businessState: "Business state",
          businessPostalCode: "Business postal code",
          businessCountry: "Business country",
          paymentIban: "Payment IBAN",
          paymentBankName: "Payment bank name",
          paymentInstructions: "Payment instructions",
          paymentTermsDays: "Payment terms (days)",
          invoiceNumber: "Invoice number",
          invoiceStatus: "Invoice status",
          invoiceCurrency: "Invoice currency",
          invoiceSubtotal: "Invoice subtotal",
          invoiceDiscount: "Invoice discount",
          invoiceTax: "Invoice tax",
          invoiceTotal: "Invoice total",
          invoiceAmountPaid: "Invoice amount paid",
          invoiceAmountDue: "Invoice amount due",
          invoiceIssueDate: "Invoice issue date",
          invoiceDueDate: "Invoice due date",
          invoicePaidAt: "Invoice paid date",
          invoiceNotes: "Invoice notes",
          invoiceLateFee: "Invoice late fee",
          invoiceExchangeRate: "Invoice exchange rate",
          proposalNumber: "Proposal number",
          proposalStatus: "Proposal status",
          proposalCurrency: "Proposal currency",
          proposalSubtotal: "Proposal subtotal",
          proposalDiscount: "Proposal discount",
          proposalTax: "Proposal tax",
          proposalTotal: "Proposal total",
          proposalValidUntil: "Proposal valid until",
          proposalNotes: "Proposal notes",
          proposalIssueDate: "Proposal issue date",
          contractNumber: "Contract number",
          contractTitle: "Contract title",
          contractStatus: "Contract status",
          contractEffectiveFrom: "Contract effective from",
          contractEffectiveUntil: "Contract effective until",
          contractIssuedAt: "Contract issue date",
          contractTerminationReason: "Contract termination reason",
          creditNoteNumber: "Credit note number",
          creditNoteReason: "Credit note reason",
          creditNoteCurrency: "Credit note currency",
          creditNoteSubtotal: "Credit note subtotal",
          creditNoteTax: "Credit note tax",
          creditNoteTotal: "Credit note total",
          creditNoteIssueDate: "Credit note issue date",
          lineItemDescription: "Line item description",
          lineItemUnit: "Line item unit",
          lineItemQuantity: "Line item quantity",
          lineItemUnitPrice: "Line item unit price",
          lineItemDiscount: "Line item discount",
          lineItemTaxPercentage: "Line item tax percentage",
          lineItemSubtotal: "Line item subtotal",
          lineItemTaxAmount: "Line item tax amount",
          lineItemTotal: "Line item total"
        }
      },
      validation: {
        nameRequired: "Name is required",
        nameTooLong: "Name must be {count} characters or fewer",
        blockNameTooLong: "Block name must be {count} characters or fewer",
        typeInvalid: "Select a valid template type",
        idInvalid: "Invalid template",
        subjectTooLong: "Subject must be {count} characters or fewer",
        textTooLong: "Text must be {count} characters or fewer",
        imageAltTooLong: "Alt text must be {count} characters or fewer",
        imageUploadInvalid: "Invalid image upload reference",
        imageUploadMissing: "An image block references an upload that no longer exists",
        imageUploadFailed: "Failed to save the uploaded image",
        imageObjectKeyRequired: "Image upload key is required",
        imageFilenameRequired: "Image filename is required",
        imageContentTypeRequired: "Image content type is required",
        imageSizeInvalid: "Image size is invalid",
        imageTooLarge: "Image must be 5 MB or smaller",
        imageInvalidFileType: "Image must be a JPEG, PNG, WebP, or GIF file",
        imageUploadUrlFailed: "Could not prepare the image upload",
        layoutInvalid: "Block layout is invalid",
        sizeInvalid: "Block size is invalid",
        colorInvalid: "Color must be a hex value like #1E40AF",
        styleInvalid: "Block style is invalid",
        marginInvalid: "Margins must be whole grid steps between 0 and 96",
        fontSizeInvalid: "Base font size must be between 10 and 24",
        tableHeaderTooLong: "Table headers must be {count} characters or fewer",
        tableCellTooLong: "Table cells must be {count} characters or fewer",
        tableInvalid: "Table structure is invalid",
        blocksOverlap: "Blocks cannot overlap",
        blocksOutOfBounds: "Blocks cannot leave the page",
        collectionUnavailable: "This template type has no line items to bind a table to",
        unknownMergeVariable: "Unknown merge variable: {token}"
      },
      errors: {
        notFound: "Template not found",
        systemProtected: "System templates cannot be deleted",
        unknownMergeVariable: "Template uses an unknown merge variable",
        saveFailed: "Failed to save template",
        deleteFailed: "Failed to delete template",
        loadFailed: "Failed to load templates"
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
    team: {
      accept: {
        metadataTitle: "Accept invitation",
        title: "Join the team",
        description: "You have been invited to {organization} on Remit.",
        invalidDescription: "This invitation cannot be used.",
        invalidMessage:
          "The invitation link is invalid, has already been used, or has expired. Ask the instance owner to send a new one.",
        goToLogin: "Go to sign in",
        alreadyMemberMessage: "You are already a member of this Remit instance.",
        goToDashboard: "Go to dashboard",
        hasAccountMessage:
          "{email} already has an account on this instance. Sign in first, then open this invitation link again to accept it.",
        goToSignIn: "Go to sign in",
        signedInMessage: "You are signed in as {email}. Accept the invitation to join.",
        acceptInvitation: "Accept invitation",
        createAccount: "Create account and join",
        wrongAccount:
          "You are signed in as {current}, but this invitation was sent to {invited}. Sign out and try again.",
        signOut: "Sign out",
        signUpFailed: "Could not create your account"
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
        email: "Email",
        team: "Team",
        data: "Data",
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
        team: "Team",
        data: "Data",
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
        defaultHourlyRate: "Default hourly rate",
        defaultHourlyRatePlaceholder: "0.00",
        defaultHourlyRateHelp:
          "The last fallback for time entries. A client, project, task or entry rate always wins. Leave blank to log time with no rate.",
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
          paymentTermsDaysInvalid: "Payment terms must be a whole number from 0 to 365.",
          defaultHourlyRateInvalid: "Enter a valid hourly rate."
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
      team: {
        title: "Team",
        description: "Invite people to this Remit instance and manage what they can do.",
        membersTitle: "Members",
        membersCount: "{count, plural, one {# member} other {# members}}",
        invitationsTitle: "Pending invitations",
        invitationsDescription: "Invitations that have not been accepted yet.",
        invitationsEmptyTitle: "No pending invitations",
        invitationsEmptyDescription: "Invite an accountant or an assistant to give them access.",
        invitationsEmptyDescriptionNoEmail:
          "Email delivery is not configured, so invitations are shared as a one-time link.",
        invite: "Invite member",
        inviteTitle: "Invite a member",
        inviteDescription:
          "They join with the role you choose and must set up two-factor authentication.",
        emailPlaceholder: "name@example.com",
        emailWillSend: "An invitation email is sent to this address.",
        emailWillNotSend:
          "Email delivery is not configured, so you will get a one-time link to share instead.",
        selectRole: "Select a role",
        sendInvite: "Send invitation",
        inviteSent: "Invitation sent to {email}",
        inviteCreated: "Invitation created for {email}",
        changeRole: "Change role",
        changeRoleTitle: "Change role",
        changeRoleDescription: "Choose the role {name} should have on this instance.",
        changeRoleDescriptionFallback: "Choose the role this member should have on this instance.",
        confirmRoleChange: "Save role",
        roleChanged: "Role updated for {name}",
        removeMember: "Remove member",
        removeTitle: "Remove member",
        removeDescription: "{name} loses access immediately and is signed out of every device.",
        removeDescriptionFallback: "This member loses access immediately.",
        confirmRemove: "Remove member",
        removed: "{name} was removed",
        removedSessionsKept:
          "{name} was removed, but their existing sessions could not be signed out. They have no access to any data.",
        cancelInvitation: "Cancel invitation",
        cancelInvitationTitle: "Cancel invitation",
        cancelInvitationDescription: "The invitation sent to {email} stops working immediately.",
        cancelInvitationDescriptionFallback: "This invitation stops working immediately.",
        confirmCancelInvitation: "Cancel invitation",
        invitationCanceled: "Invitation to {email} was canceled",
        showLink: "Show invitation link",
        linkTitle: "Invitation link",
        linkDescription: "Send this link to {email} yourself.",
        linkDescriptionFallback: "Send this link to the invited address yourself.",
        linkWarningTitle: "Share it privately",
        linkWarningDescription:
          "Anyone who opens this link can create the invited account. It stops working once the invitation is accepted, canceled, or expires.",
        copyLink: "Copy invitation link",
        linkCopied: "Invitation link copied",
        tableMember: "Member",
        tableRole: "Role",
        tableJoined: "Joined",
        tableInvitee: "Invited address",
        tableExpires: "Expires",
        tableActions: "Actions",
        roles: {
          owner: "Owner",
          accountant: "Accountant",
          assistant: "Assistant"
        },
        roleDescriptions: {
          accountant: "Reads everything and exports data. Cannot create, edit, send, or delete.",
          assistant:
            "Creates and edits drafts. Cannot send, record payment, delete, or change settings."
        },
        email: {
          subject: "You have been invited to {organization} on Remit",
          intro: "{inviter} invited you to join {organization} on Remit as {role}.",
          cta: "Accept invitation",
          outro: "If you were not expecting this invitation, you can ignore this email."
        },
        errors: {
          memberNotFound: "Member not found",
          invitationNotFound: "This invitation is no longer valid",
          alreadyMember: "That email address is already a member",
          alreadyInvited: "That email address already has a pending invitation",
          notInvitee: "This invitation was sent to a different email address",
          ownerImmutable: "The owner role cannot be changed or removed",
          selfRemoval: "You cannot remove yourself",
          roleUnchanged: "That member already has this role",
          actionFailed: "Something went wrong"
        },
        validation: {
          emailInvalid: "Enter a valid email address.",
          roleInvalid: "Choose either accountant or assistant.",
          memberIdInvalid: "Invalid member.",
          invitationIdInvalid: "Invalid invitation."
        }
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
      data: {
        title: "Data export",
        description:
          "Package your business records as a downloadable archive, for the whole instance or for one client.",
        request: {
          title: "New export",
          description:
            "Exports are assembled in the background. You can leave this page and come back to download the archive.",
          scopeLabel: "What to export",
          scopeInstance: "Whole instance",
          scopeInstanceHelp: "Every business record, uploaded file and generated document.",
          scopeClient: "One client",
          scopeClientHelp: "One client and everything attached to them, for offboarding requests.",
          clientLabel: "Client",
          clientPlaceholder: "Select a client",
          noClients: "Add a client before requesting a client export",
          submit: "Start export",
          submitted: "Export started. It will appear below when it is ready",
          activeNotice:
            "An export is already running. Wait for it to finish before starting another",
          progressNotice: "{status} — {progress}% complete"
        },
        scope: {
          instance: "Whole instance",
          client: "One client"
        },
        status: {
          pending: "Queued",
          running: "Assembling",
          ready: "Ready",
          failed: "Failed"
        },
        history: {
          title: "Exports",
          description: "Every export requested on this instance, newest first.",
          emptyTitle: "No exports yet",
          emptyDescription: "Start an export above and it will appear here when it is ready."
        },
        table: {
          scope: "Scope",
          status: "Status",
          requested: "Requested",
          size: "Size",
          entries: "Files",
          actions: "Actions"
        },
        download: "Download",
        emptyValue: "—",
        contents: {
          title: "What the archive contains",
          description:
            "One JSON file per table under data/, the stored files under files/, and an index.json describing both.",
          includedTitle: "Included",
          includedRecords:
            "Clients, leads, projects, tasks, time entries, expenses, proposals, contracts, invoices, payments and credit notes",
          includedFiles: "Every uploaded file and generated document, plus the business profile",
          includedActivity: "The activity feed and, for a whole-instance export, the audit log",
          excludedTitle: "Never included",
          excludedSecrets:
            "Email, payment provider and backup configuration, including every stored key and secret",
          excludedTokens:
            "Public sharing tokens for invoices, proposals, contracts and the client portal",
          excludedAuth: "Accounts, sessions, passwords and two-factor secrets"
        },
        failureReasons: {
          clientMissing: "The client was deleted before the export finished",
          assemblyFailed: "The archive could not be assembled",
          storageFailed: "The archive could not be stored"
        },
        errors: {
          alreadyRunning: "An export is already running",
          clientNotFound: "Client not found",
          requestFailed: "Could not start the export",
          notReady: "This export is not ready to download",
          downloadFailed: "Could not download the archive"
        },
        validation: {
          scopeInvalid: "Choose either the whole instance or one client.",
          clientInvalid: "Invalid client.",
          clientRequired: "Select the client to export.",
          exportInvalid: "Invalid export."
        }
      },
      system: {
        title: "System"
      }
    }
  }
}
