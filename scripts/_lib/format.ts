export function formatBytes(bytes: number): string {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 1,
    style: "unit",
    unit: "byte",
    unitDisplay: "short"
  }).format(bytes)
}
