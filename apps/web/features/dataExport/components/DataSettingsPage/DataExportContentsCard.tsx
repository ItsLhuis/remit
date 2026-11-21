import { t } from "@/lib/i18n/server"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Icon,
  Typography
} from "@/components/ui"

const INCLUDED_KEYS = [
  "settings.data.contents.includedRecords",
  "settings.data.contents.includedFiles",
  "settings.data.contents.includedActivity"
] as const

const EXCLUDED_KEYS = [
  "settings.data.contents.excludedSecrets",
  "settings.data.contents.excludedTokens",
  "settings.data.contents.excludedAuth"
] as const

const DataExportContentsCard = () => {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("settings.data.contents.title")}</CardTitle>
        <CardDescription>{t("settings.data.contents.description")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Typography affects={["small", "medium"]}>
            {t("settings.data.contents.includedTitle")}
          </Typography>
          <ul className="flex flex-col gap-2">
            {INCLUDED_KEYS.map((key) => (
              <li key={key} className="flex items-start gap-2">
                <Icon
                  name="Check"
                  className="text-success-border mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <Typography affects={["muted", "tiny"]}>{t(key)}</Typography>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-2">
          <Typography affects={["small", "medium"]}>
            {t("settings.data.contents.excludedTitle")}
          </Typography>
          <ul className="flex flex-col gap-2">
            {EXCLUDED_KEYS.map((key) => (
              <li key={key} className="flex items-start gap-2">
                <Icon
                  name="X"
                  className="text-muted-foreground mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <Typography affects={["muted", "tiny"]}>{t(key)}</Typography>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

export { DataExportContentsCard }
