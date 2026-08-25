import { t } from "@/lib/i18n/server"

import { Separator } from "@/components/ui"

import { SettingsPageHeader } from "@/components/layout"

import { getBusinessSettings } from "../../queries"

import { AddressSection } from "./AddressSection"
import { BusinessProfileSection } from "./BusinessProfileSection"
import { LogoSection } from "./LogoSection"
import { RegionalDefaultsSection } from "./RegionalDefaultsSection"
import { TaxDetailsSection } from "./TaxDetailsSection"

const BusinessSettingsPage = async () => {
  const settings = await getBusinessSettings()

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <SettingsPageHeader
        title={t("settings.business.title")}
        description={t("settings.business.description")}
        icon="Building2"
      />
      <div className="space-y-8">
        <LogoSection
          businessName={settings.businessName}
          businessLogoStorageKey={settings.businessLogoStorageKey}
          locale={settings.defaultLocale}
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
