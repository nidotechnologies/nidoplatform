type ReportEntityType = "client" | "vendor" | "internal";

export function reportCenterDisplayColumn(
  column: string,
  entityType: ReportEntityType,
  selectedEntityName?: string,
): string {
  if (entityType !== "client") return column;
  const displayName = selectedEntityName?.trim() || "Client";
  return column.replace(/(\/\s*)Apex(?=\s*\/)/gi, (_match, prefix: string) => `${prefix}${displayName}`);
}
