"use client"

import { useTranslation } from "@/lib/i18n"

import { Field, FieldLabel, Input } from "@/components/ui"

import { SHAPE_VARIANT_LABEL_KEYS } from "../../../labels"
import { type Block, type TemplateType } from "../../../schemas"
import { BUSINESS_LOGO_ASSET_KEY, type FrameChildType } from "../../../services"
import { ImageBlockField } from "../ImageBlockField"

import { FieldRowSelect } from "./FieldRowSelect"
import { FrameContentSection } from "./FrameContentSection"
import { PanelSection } from "./PanelSection"
import { TableContentSection } from "./TableContentSection"
import { TextContentSection } from "./TextContentSection"

type BlockContentSectionProps = {
  block: Block
  depth: number
  type: TemplateType
  assets: Record<string, string>
  disabled?: boolean
  onChangeBlock: (block: Block, coalesceTag?: string | null) => void
  onTextContentChange: (id: string, html: string) => void
  onAssetUploaded: (uploadId: string, storageKey: string) => void
  onAddChild: (frameId: string, childType: FrameChildType) => void
  onMoveChild: (childId: string, offset: -1 | 1) => void
  onRemoveChild: (id: string) => void
  onSelectChild: (id: string) => void
}

// Content editors are per-type by necessity (each block type has its own content schema); the
// style sections around them stay registry-driven. Text and table cells expose the merge-variable
// picker.
const BlockContentSection = ({
  block,
  depth,
  type,
  assets,
  disabled,
  onChangeBlock,
  onTextContentChange,
  onAssetUploaded,
  onAddChild,
  onMoveChild,
  onRemoveChild,
  onSelectChild
}: BlockContentSectionProps) => {
  const { t } = useTranslation()

  const contentTag = `content:${block.id}`

  const update = (next: Block) => onChangeBlock(next, contentTag)

  return (
    <PanelSection label={t("templates.editor.sectionContent")}>
      {block.type === "text" ? (
        <TextContentSection
          block={block}
          type={type}
          disabled={disabled}
          onChange={(html) => onTextContentChange(block.id, html)}
        />
      ) : null}
      {block.type === "image" ? (
        <div className="flex flex-col gap-2.5">
          <FieldRowSelect
            id={`${block.id}-source`}
            label={t("templates.editor.imageSource")}
            value={block.content.source}
            options={[
              { value: "upload", label: t("templates.editor.imageSourceUpload") },
              { value: "businessLogo", label: t("templates.editor.imageSourceBusinessLogo") }
            ]}
            disabled={disabled}
            onChange={(source) =>
              update({
                ...block,
                content: { ...block.content, source: source as "upload" | "businessLogo" }
              })
            }
          />
          {block.content.source === "upload" ? (
            <ImageBlockField
              hasUpload={block.content.uploadId !== null}
              imageUrl={block.content.uploadId ? (assets[block.content.uploadId] ?? null) : null}
              alt={block.content.alt}
              disabled={disabled}
              onUploaded={(uploadId, storageKey) => {
                onAssetUploaded(uploadId, storageKey)
                update({ ...block, content: { ...block.content, uploadId } })
              }}
            />
          ) : assets[BUSINESS_LOGO_ASSET_KEY] ? (
            // Self-hosted instance-local storage asset; next/image optimization does not apply here.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={assets[BUSINESS_LOGO_ASSET_KEY]}
              alt={block.content.alt}
              className="border-border max-h-32 w-full rounded-md border object-contain"
            />
          ) : (
            <div className="border-border text-muted-foreground flex h-20 items-center justify-center rounded-md border border-dashed">
              <span className="text-xs">{t("templates.editor.businessLogoMissing")}</span>
            </div>
          )}
          <Field>
            <FieldLabel htmlFor={`${block.id}-alt`}>{t("templates.editor.imageAlt")}</FieldLabel>
            <Input
              id={`${block.id}-alt`}
              value={block.content.alt}
              disabled={disabled}
              onChange={(event) =>
                update({ ...block, content: { ...block.content, alt: event.target.value } })
              }
            />
          </Field>
        </div>
      ) : null}
      {block.type === "table" ? (
        <TableContentSection block={block} type={type} disabled={disabled} onChange={update} />
      ) : null}
      {block.type === "frame" ? (
        <FrameContentSection
          block={block}
          depth={depth}
          disabled={disabled}
          onChange={update}
          onAddChild={onAddChild}
          onMoveChild={onMoveChild}
          onRemoveChild={onRemoveChild}
          onSelectChild={onSelectChild}
        />
      ) : null}
      {block.type === "shape" ? (
        <FieldRowSelect
          id={`${block.id}-variant`}
          label={t("templates.editor.shapeVariant")}
          value={block.content.variant}
          options={[
            { value: "rectangle", label: t(SHAPE_VARIANT_LABEL_KEYS.rectangle) },
            { value: "ellipse", label: t(SHAPE_VARIANT_LABEL_KEYS.ellipse) },
            { value: "line", label: t(SHAPE_VARIANT_LABEL_KEYS.line) }
          ]}
          disabled={disabled}
          onChange={(variant) =>
            update({
              ...block,
              content: { variant: variant as "rectangle" | "ellipse" | "line" }
            })
          }
        />
      ) : null}
    </PanelSection>
  )
}

export { BlockContentSection }
