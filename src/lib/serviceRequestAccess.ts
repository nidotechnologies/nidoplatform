import type { PortalUser } from "@/lib/portalUserStore";
import { belongsToPortalUser } from "@/lib/clientDashboardScoping";
import type { StoredServiceRequest } from "@/lib/serviceRequestsStore";

interface PortalIdentity {
  id: string;
  email?: string;
  name?: string;
  clientId?: string;
}

function payloadText(request: StoredServiceRequest, key: string): string {
  const value = request.payload?.[key];
  return typeof value === "string" ? value.trim() : "";
}

export function serviceRequestBelongsToPortalUser(
  request: StoredServiceRequest,
  user: PortalIdentity,
  clientUsers: PortalUser[],
): boolean {
  const recordClientId = request.clientId || payloadText(request, "clientId");
  if (recordClientId && recordClientId !== user.clientId) return false;

  // Without a client reference, only a stable account ID safely identifies the
  // requester across tenants. Name/email matching needs an explicit client ID.
  if (!recordClientId) {
    const requesterId = request.requestedById || payloadText(request, "requestedById");
    return Boolean(requesterId && requesterId === user.id);
  }

  return belongsToPortalUser(request, user, clientUsers);
}
