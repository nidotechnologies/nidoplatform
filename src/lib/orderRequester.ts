export const ORDER_REQUESTER_KEY = "nido_order_requester";

export const ORDER_REQUESTER_OPTIONS = [
  { value: "self", label: "Ordered by self" },
] as const;

export type OrderRequesterValue = "self" | `client-user:${string}`;
export type OrderRequesterOption = { value: OrderRequesterValue; label: string };

export function getOrderRequesterOptions(
  users: Array<{ id: string; name: string }> = [],
): OrderRequesterOption[] {
  return [
    ...ORDER_REQUESTER_OPTIONS,
    ...users
      .filter(user => user.id && user.name.trim())
      .map(user => ({
        value: `client-user:${user.id}` as const,
        label: user.name.trim(),
      })),
  ];
}

export function normalizeOrderRequester(value: string | null | undefined): OrderRequesterValue {
  if (value === "self") return "self";
  if (value?.startsWith("client-user:") && value.length > "client-user:".length) {
    return value as OrderRequesterValue;
  }
  return "self";
}

export function resolveOrderRequester(
  value: string | null | undefined,
  currentUserName?: string | null,
  options: OrderRequesterOption[] = ORDER_REQUESTER_OPTIONS,
): string {
  const normalized = normalizeOrderRequester(value);
  if (normalized === "self") return currentUserName?.trim() || "Owner";
  return options.find(option => option.value === normalized)?.label || "Owner";
}