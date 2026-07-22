"use client"

import { useTranslation } from "@/lib/i18n"

import { Field, FieldLabel, Input } from "@/components/ui"

import { TEMPLATE_FONT_LABEL_KEYS } from "../../../labels"
import {
  GRID_SIZE,
  PAGE_MARGIN_MAX,
  TEMPLATE_FONT_KEYS,
  type TemplateFontKey,
  type TemplatePageSettings
} from "../../../schemas"

import { FieldRowNumber } from "./FieldRowNumber"
import { FieldRowSelect } from "./FieldRowSelect"
import { PanelSection } from "./PanelSection"

type PageSettingsSectionProps = {
  pageSettings: TemplatePageSettings
  isEmail: boolean
  subject: string
  disabled?: boolean
  onPageSettingsChange: (pageSettings: TemplatePageSettings) => void
  onSubjectChange: (subject: string) => void
}

type MarginSide = "top" | "right" | "bottom" | "left"

const MARGIN_SIDES: {
  side: MarginSide
  labelKey: `templates.pageSettings.margin${Capitalize<MarginSide>}`
}[] = [
  { side: "top", labelKey: "templates.pageSettings.marginTop" },
  { side: "right", labelKey: "templates.pageSettings.marginRight" },
  { side: "bottom", labelKey: "templates.pageSettings.marginBottom" },
  { side: "left", labelKey: "templates.pageSettings.marginLeft" }
]

// The page inspector body (the Page layer / nothing-selected state): page margins, the document's
// default typography, and (for email types) the subject line - everything that applies to the
// whole document rather than one block. The panel shell owns the sticky header.
const PageSettingsSection = ({
  pageSettings,
  isEmail,
  subject,
  disabled,
  onPageSettingsChange,
  onSubjectChange
}: PageSettingsSectionProps) => {
  const { t } = useTranslation()

  const setMargin = (side: MarginSide, value: number | null) => {
    onPageSettingsChange({
      ...pageSettings,
      margins: { ...pageSettings.margins, [side]: value ?? 0 }
    })
  }

  return (
    <div className="flex flex-col">
      <PanelSection label={t("templates.pageSettings.margins")}>
        {MARGIN_SIDES.map(({ side, labelKey }) => (
          <FieldRowNumber
            key={side}
            id={`page-margin-${side}`}
            label={t(labelKey)}
            value={pageSettings.margins[side]}
            min={0}
            max={PAGE_MARGIN_MAX}
            step={GRID_SIZE}
            disabled={disabled}
            onChange={(value) => setMargin(side, value)}
          />
        ))}
      </PanelSection>
      <PanelSection label={t("templates.editor.sectionTypography")}>
        <FieldRowSelect
          id="page-font-family"
          label={t("templates.pageSettings.fontFamily")}
          value={pageSettings.fontFamily}
          options={TEMPLATE_FONT_KEYS.map((key) => ({
            value: key,
            label: t(TEMPLATE_FONT_LABEL_KEYS[key])
          }))}
          disabled={disabled}
          onChange={(value) =>
            onPageSettingsChange({ ...pageSettings, fontFamily: value as TemplateFontKey })
          }
        />
        <FieldRowNumber
          id="page-base-font-size"
          label={t("templates.pageSettings.baseFontSize")}
          value={pageSettings.baseFontSize}
          min={10}
          max={24}
          disabled={disabled}
          onChange={(value) => onPageSettingsChange({ ...pageSettings, baseFontSize: value ?? 14 })}
        />
      </PanelSection>
      {isEmail ? (
        <PanelSection label={t("templates.fields.subject")}>
          <Field>
            <FieldLabel htmlFor="page-subject" className="sr-only">
              {t("templates.fields.subject")}
            </FieldLabel>
            <Input
              id="page-subject"
              value={subject}
              placeholder={t("templates.fields.subjectPlaceholder")}
              disabled={disabled}
              onChange={(event) => onSubjectChange(event.target.value)}
            />
          </Field>
        </PanelSection>
      ) : null}
    </div>
  )
}

export { PageSettingsSection }
