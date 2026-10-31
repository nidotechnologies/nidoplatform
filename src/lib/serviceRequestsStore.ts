/**
 * Shared localStorage store for user-submitted service requests.
 * MyRequestsPage reads these records directly and updates them in place.
 */

const STORE_KEY = "nido_service_requests";
const SEQ_KEY   = "nido_service_requests_seq";
import { getPrefix } from "./configService";
import { resolveAutoAssignment } from "./autoAssignmentStore";

export interface StoredServiceRequest {
  id: string;
  requestType: string;
  itemAsset: string;
  assetTag: string;
  location: string;
  requestDate: string;       // "DD Mon YYYY"
  requestDateTs: number;
  status: string;
  priority: string;
  nextAppointment: string;
  requestedBy: string;
  clientId?: string;
  requestedById?: string;
  requestedByEmail?: string;
  department?: string;
  assignedTo?: string;
  assignedRole?: string;
  autoAssigned?: boolean;
  /** Full form payload stored so the detail page can show it */
  payload?: Record<string, unknown>;
}

export type ServiceRequestUpdates = Partial<Omit<StoredServiceRequest, "id" | "requestDateTs">>;

function load(): StoredServiceRequest[] {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
  } catch {
    return [];
  }
}

function save(requests: StoredServiceRequest[]) {
  localStorage.setItem(STORE_KEY, JSON.stringify(requests));
}

function nextSeq(prefix: string): number {
  const raw = JSON.parse(localStorage.getItem(SEQ_KEY) || "{}") as Record<string, number>;
  const next = (raw[prefix] ?? 0) + 1;
  raw[prefix] = next;
  localStorage.setItem(SEQ_KEY, JSON.stringify(raw));
  return next;
}

export function addServiceRequest(req: Omit<StoredServiceRequest, "id" | "requestDateTs">, prefix: string): StoredServiceRequest {
  const effectivePrefix = getPrefix("serviceRequest") || prefix || "SVC-";
  const seq = nextSeq(effectivePrefix);
  const year = new Date().getFullYear();
  const id = `${effectivePrefix}${year}-${String(seq).padStart(5, "0")}`;

  const now = new Date();
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const requestDate = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;

  const full: StoredServiceRequest = {
    ...req,
    ...(() => {
      const payload = req.payload ?? {};
      const clientId = req.clientId || (typeof payload.clientId === "string" ? payload.clientId : undefined);
      const department = typeof payload.department === "string" ? payload.department : undefined;
      const role = typeof payload.role === "string" ? payload.role : undefined;
      const resolution =
        resolveAutoAssignment({ department, role, clientId })
        ?? resolveAutoAssignment({ role, clientId })
        ?? resolveAutoAssignment({ clientId });
      const assignedUser = resolution?.users[0];
      return {
        clientId,
        department: resolution?.rule.department || department,
        assignedTo: assignedUser?.name || assignedUser?.email || "Unassigned",
        assignedRole: assignedUser?.role || resolution?.rule.role,
        autoAssigned: Boolean(assignedUser),
        payload: {
          ...payload,
          autoAssigned: Boolean(assignedUser),
          assignedTo: assignedUser?.name || assignedUser?.email || "Unassigned",
          assignedRole: assignedUser?.role || resolution?.rule.role || "",
          assignedDepartment: resolution?.rule.department || department || "",
        },
      };
    })(),
    id,
    requestDate,
    requestDateTs: now.getTime(),
  };

  const existing = load();
  save([full, ...existing]);
  window.dispatchEvent(new Event("serviceRequestsUpdated"));
  return full;
}

export function getServiceRequests(): StoredServiceRequest[] {
  return load();
}

export function updateServiceRequest(
  id: string,
  updates: ServiceRequestUpdates,
): StoredServiceRequest | null {
  const requests = load();
  const index = requests.findIndex(request => request.id === id);
  if (index === -1) return null;

  const existing = requests[index];
  const updated: StoredServiceRequest = {
    ...existing,
    ...updates,
    id: existing.id,
    requestDateTs: existing.requestDateTs,
  };
  requests[index] = updated;
  save(requests);
  window.dispatchEvent(new Event("serviceRequestsUpdated"));
  return updated;
}

/**
 * Returns the ID that *would* be generated next for the given prefix
 * without incrementing the sequence counter.
 * Used by new-request forms to show a preview Request ID before submission.
 */
export function peekNextId(prefix: string): string {
  const effectivePrefix = getPrefix("serviceRequest") || prefix || "SVC-";
  const raw = JSON.parse(localStorage.getItem(SEQ_KEY) || "{}") as Record<string, number>;
  const next = (raw[effectivePrefix] ?? 0) + 1;
  const year = new Date().getFullYear();
  return `${effectivePrefix}${year}-${String(next).padStart(5, "0")}`;
}
