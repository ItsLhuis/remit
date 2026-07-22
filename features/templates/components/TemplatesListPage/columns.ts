import { type TFunction } from "@/lib/i18n"

import { type ColumnDef } from "@/hooks"

import { TEMPLATE_TYPE_LABEL_KEYS } from "../../labels"
import { TEMPLATE_TYPES } from "../../schemas"
import { type TemplateListItem } from "../../types"

// The listing renders cards, not rows, so these definitions carry no header or cell. They exist to
// give useDataTable the sort and filter identifiers it binds to the URL, and to hold the options
// the type facet offers.
export function getTemplateColumns(t: TFunction): ColumnDef<TemplateListItem>[] {
  return [
    { id: "name" },
    {
      id: "type",
      enableColumnFilter: true,
      meta: {
        label: t("templates.fields.type"),
        variant: "multiSelect",
        options: TEMPLATE_TYPES.map((type) => ({
          label: t(TEMPLATE_TYPE_LABEL_KEYS[type]),
          value: type
        }))
      }
    },
    { id: "updated" }
  ]
}
