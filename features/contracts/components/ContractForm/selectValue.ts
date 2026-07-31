// Radix's Select has no value for "nothing chosen" - an empty string closes the listbox and clears
// the trigger - so the absent option carries this sentinel and is mapped back to "" on the way into
// the form, where the schema turns it into null. Module-private to the ContractForm folder: the two
// field components that render a nullable select have to agree on the sentinel, and it carries no
// domain meaning outside them.
export const NO_SELECTION = "none"

export function toSelectValue(value: string): string {
  return value === "" ? NO_SELECTION : value
}

export function fromSelectValue(value: string): string {
  return value === NO_SELECTION ? "" : value
}
