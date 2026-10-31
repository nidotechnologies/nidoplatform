export interface VendorScope {
  vendorId?: string;
  vendorName?: string;
}

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function hasVendorScope(scope: VendorScope): boolean {
  return Boolean(scope.vendorId || scope.vendorName);
}

/**
 * Match only explicit vendor references. Scoped vendor pages must not infer
 * ownership from unrelated fields such as client, location, or contact name.
 */
export function belongsToVendor(
  record: unknown,
  scope: VendorScope,
): boolean {
  if (!hasVendorScope(scope)) return true;

  const source = (record || {}) as Record<string, unknown>;
  const payload =
    source.payload && typeof source.payload === "object"
      ? (source.payload as Record<string, unknown>)
      : {};
  const values = [
    source.vendorId,
    source.vendor_id,
    source.vendorName,
    source.vendor_name,
    source.vendor,
    payload.vendorId,
    payload.vendor_id,
    payload.vendorName,
    payload.vendor_name,
    payload.vendor,
  ]
    .map(normalize)
    .filter(Boolean);

  const vendorId = normalize(scope.vendorId);
  const vendorName = normalize(scope.vendorName);
  return values.some((value) => value === vendorId || value === vendorName);
}