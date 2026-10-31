export interface PortalDashboardIdentity {
  id?: string;
  email?: string;
  name?: string;
}

export interface PortalActorFields {
  userId?: unknown;
  requesterId?: unknown;
  requestedById?: unknown;
  createdById?: unknown;
  actorId?: unknown;
  uploadedById?: unknown;
  ownerId?: unknown;
  userEmail?: unknown;
  requesterEmail?: unknown;
  requestedByEmail?: unknown;
  createdByEmail?: unknown;
  actorEmail?: unknown;
  email?: unknown;
  requestedBy?: unknown;
  requester?: unknown;
  createdBy?: unknown;
  actorName?: unknown;
  userName?: unknown;
  uploadedBy?: unknown;
  ownerName?: unknown;
}

export interface DashboardOrderReference {
  id: string;
  poNumber?: string;
  productDetails?: Array<{ subOrderId?: string }>;
  cartItems?: Array<{ subOrderId?: string }>;
}

export interface DashboardInvoiceReference {
  originatingOrderId?: string;
  poReference?: string;
  lineItems?: Array<{ subOrderId?: string }>;
}

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function firstText(record: PortalActorFields, keys: Array<keyof PortalActorFields>): string {
  for (const key of keys) {
    const value = String(record[key] ?? "").trim();
    if (value) return value;
  }
  return "";
}

/**
 * Match records to one portal login. Stable IDs and email addresses take
 * precedence; a legacy display name is accepted only when unique in the
 * client's portal-user list.
 */
export function belongsToPortalUser(
  record: PortalActorFields,
  user: PortalDashboardIdentity | null | undefined,
  clientUsers: readonly PortalDashboardIdentity[] = [],
): boolean {
  if (!user?.id && !user?.email) return false;

  const recordId = firstText(record, [
    "userId",
    "requestedById",
    "requesterId",
    "createdById",
    "actorId",
    "uploadedById",
    "ownerId",
  ]);
  if (recordId) return Boolean(user.id && recordId === user.id);

  const recordEmail = normalize(firstText(record, [
    "userEmail",
    "requestedByEmail",
    "requesterEmail",
    "createdByEmail",
    "actorEmail",
    "email",
  ]));
  if (recordEmail) return Boolean(user.email && recordEmail === normalize(user.email));

  const actorName = normalize(firstText(record, [
    "requestedBy",
    "requester",
    "createdBy",
    "actorName",
    "userName",
    "uploadedBy",
    "ownerName",
  ]));
  if (!actorName) return false;
  if (user.email && actorName === normalize(user.email)) return true;
  if (!user.name || actorName !== normalize(user.name)) return false;

  const sameNameUsers = clientUsers.filter((candidate) => normalize(candidate.name) === actorName);
  return sameNameUsers.length === 1 && sameNameUsers[0].id === user.id;
}

export function invoiceReferencesOrders(
  invoice: DashboardInvoiceReference,
  orders: readonly DashboardOrderReference[],
): boolean {
  const orderReferences = new Set<string>();
  const subOrderReferences = new Set<string>();

  for (const order of orders) {
    if (order.id) orderReferences.add(normalize(order.id));
    if (order.poNumber) orderReferences.add(normalize(order.poNumber));
    for (const item of [...(order.productDetails || []), ...(order.cartItems || [])]) {
      if (item.subOrderId) subOrderReferences.add(normalize(item.subOrderId));
    }
  }

  const directReferences = [invoice.originatingOrderId, invoice.poReference]
    .map(normalize)
    .filter(Boolean);
  if (directReferences.some((reference) => orderReferences.has(reference))) return true;

  return (invoice.lineItems || []).some((item) => {
    const subOrderId = normalize(item.subOrderId);
    if (!subOrderId) return false;
    return subOrderReferences.has(subOrderId);
  });
}

export function invoiceBelongsToPortalUser(
  invoice: PortalActorFields & DashboardInvoiceReference,
  orders: readonly DashboardOrderReference[],
  user: PortalDashboardIdentity | null | undefined,
  clientUsers: readonly PortalDashboardIdentity[] = [],
): boolean {
  return belongsToPortalUser(invoice, user, clientUsers)
    || invoiceReferencesOrders(invoice, orders);
}
