import { t } from "@/lib/i18n/server"

import { getBusinessSettings } from "../../queries"

import { Separator, SidebarTrigger, Typography } from "@/components/ui"

import { AddressSection } from "./AddressSection"
import { BusinessProfileSection } from "./BusinessProfileSection"
import { LogoSection } from "./LogoSection"
import { RegionalDefaultsSection } from "./RegionalDefaultsSection"
import { TaxDetailsSection } from "./TaxDetailsSection"

const BusinessSettingsPage = async () => {
  const settings = await getBusinessSettings()

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <header className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        <Typography variant="h2">{t("settings.business.title")}</Typography>
      </header>
      <div className="space-y-8">
        <LogoSection
          businessName={settings.businessName}
          businessLogoStorageKey={settings.businessLogoStorageKey}
        />
        <Separator />
        <BusinessProfileSection
          initialValues={{
            businessName: settings.businessName,
            businessEmail: settings.businessEmail,
            businessPhone: settings.businessPhone,
            businessWebsite: settings.businessWebsite
          }}
        />
        <Separator />
        <RegionalDefaultsSection
          initialValues={{
            defaultCurrency: settings.defaultCurrency,
            defaultLocale: settings.defaultLocale,
            defaultTimezone: settings.defaultTimezone
          }}
        />
        <Separator />
        <TaxDetailsSection initialValues={{ businessTaxId: settings.businessTaxId }} />
        <Separator />
        <AddressSection
          initialValues={{
            businessAddressLine1: settings.businessAddressLine1,
            businessAddressLine2: settings.businessAddressLine2,
            businessCity: settings.businessCity,
            businessState: settings.businessState,
            businessPostalCode: settings.businessPostalCode,
            businessCountry: settings.businessCountry
          }}
        />
      </div>
    </div>
  )
}

export { BusinessSettingsPage }
