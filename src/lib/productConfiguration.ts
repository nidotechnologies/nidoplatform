export type ProductConfiguration = Record<string, string>;

export function formatConfigurationLabel(label: string): string {
  const trimmed = label.trim();
  const indexedSlug = trimmed.match(/^([a-z0-9]+(?:-[a-z0-9]+)*)-\d+$/);
  if (!indexedSlug) return trimmed;
  return indexedSlug[1]
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function getProductConfigurationEntries(
  configuration?: ProductConfiguration | null,
): Array<[string, string]> {
  return Object.entries(configuration || {})
    .map(([label, value]) => [formatConfigurationLabel(label), String(value ?? "").trim()] as [string, string])
    .filter(([, value]) => value.length > 0);
}

export function getProductSpecLines(
  specs?: string[] | string | null,
  configuration?: ProductConfiguration | null,
): string[] {
  const lines = Array.isArray(specs) ? specs : typeof specs === "string" ? [specs] : [];
  const hasStructuredConfiguration = getProductConfigurationEntries(configuration).length > 0;
  return lines
    .map(line => String(line || "").trim())
    .filter(line => line.length > 0)
    .filter(line => !hasStructuredConfiguration || !/^configuration\s*:/i.test(line));
}
