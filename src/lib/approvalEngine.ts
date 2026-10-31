export type ApprovalStatus = "Pending" | "In Progress" | "Approved" | "Rejected" | "Sent Back" | "Cancelled" | "Escalated";

import { createDraftPOsForStoredOrder } from "./orderPurchaseOrderService";
import { appendOrderActivity } from "./orderActivityStore";

export interface ApprovalCondition {
  joinOperator: "AND" | "OR";
  field: string;
  operator: string;
  value: string | number | string[];
}

export interface ApprovalLevel {
  levelNumber: number;
  approverType: "Role" | "Specific User" | "Department" | "Manager" | "Reporting Manager";
  approverRole?: string;
  specificUserId?: string;
  minimumApprovers: number;
  approvalMode: "Sequential" | "Parallel" | "Any One" | "All Required" | "Majority";
  slaHours: number;
  escalationEnabled: boolean;
  escalationApprover?: string;
  escalationAfterHours?: number;
}

export interface ApprovalWorkflow {
  id: string;
  name: string;
  description: string;
  module: string;
  trigger: string;
  workflowType: string;
  status: "Draft" | "Active" | "Inactive";
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  conditions: ApprovalCondition[];
  levels: ApprovalLevel[];
  /** When set, this workflow applies only to the selected client portal tenant. */
  clientId?: string;
  clientName?: string;
}

export interface ApprovalRequest {
  id: string;
  workflowId: string;
  workflow: string;
  workflowVersion: number;
  module: string;
  trigger: string;
  reference: string;
  requestedBy: string;
  requestedByName: string;
  currentApprover: string;
  approverType?: string;
  currentLevel: number;
  status: ApprovalStatus;
  amount?: number | null;
  context: Record<string, unknown>;
  createdAt: string;
  dueAt?: string | null;
  timeline?: any[];
  steps?: any[];
  clientId?: string;
  clientName?: string;
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  let session: Record<string, any> = {};
  try {
    session = JSON.parse(localStorage.getItem("nido_user") || "{}") || {};
  } catch {
    // The backend will reject protected operations when no role is available.
  }
  const response = await fetch(`/api/approvals${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(session.role ? { "x-nido-role": session.role } : {}),
      ...(session.id ? { "x-nido-user-id": session.id } : {}),
      ...(session.clientId ? { "x-nido-client-id": session.clientId } : {}),
      ...(session.userType ? { "x-nido-user-type": session.userType } : {}),
      ...(options?.headers || {}),
    },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) throw new Error(payload.error || "Approval service unavailable.");
  return payload.data as T;
}

// The approval UI can be exercised before the database is connected.  The
// public functions below intentionally keep the same shapes as the API
// service, so switching to the backend later only requires setting
// VITE_APPROVAL_BACKEND=true.
const USE_APPROVAL_BACKEND = import.meta.env.VITE_APPROVAL_BACKEND === "true";
const LOCAL_APPROVAL_KEY = "nido_local_approval_engine";

type LocalWorkflowHistory = {
  version: number;
  changed_by: string;
  date: string;
  snapshot: { conditions: ApprovalCondition[]; levels: ApprovalLevel[] };
  status: "Saved";
};

type LocalApprovalStore = {
  workflows: ApprovalWorkflow[];
  requests: ApprovalRequest[];
  history: Record<string, LocalWorkflowHistory[]>;
};

const fallbackLevels = (): ApprovalLevel[] => [{
  levelNumber: 1,
  approverType: "Role",
  approverRole: "System Admin",
  minimumApprovers: 1,
  approvalMode: "Sequential",
  slaHours: 24,
  escalationEnabled: false,
  escalationApprover: "",
  escalationAfterHours: 24,
}];

function localStore(): LocalApprovalStore {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_APPROVAL_KEY) || "{}");
    return {
      workflows: Array.isArray(parsed.workflows) ? parsed.workflows : [],
      requests: Array.isArray(parsed.requests) ? parsed.requests : [],
      history: parsed.history && typeof parsed.history === "object" ? parsed.history : {},
    };
  } catch {
    return { workflows: [], requests: [], history: {} };
  }
}

function saveLocalStore(store: LocalApprovalStore) {
  localStorage.setItem(LOCAL_APPROVAL_KEY, JSON.stringify(store));
  window.dispatchEvent(new Event("approvalStoreUpdated"));
}

function localId(prefix: string) {
  return `${prefix}_local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function localSnapshot(workflow: Partial<ApprovalWorkflow>) {
  return {
    conditions: Array.isArray(workflow.conditions) ? structuredClone(workflow.conditions) : [],
    levels: Array.isArray(workflow.levels) && workflow.levels.length
      ? structuredClone(workflow.levels)
      : fallbackLevels(),
  };
}

function localWorkflow(
  input: Partial<ApprovalWorkflow> & { name: string; module: string },
  existing?: ApprovalWorkflow,
): ApprovalWorkflow {
  const now = new Date().toISOString();
  const snapshot = localSnapshot(input);
  return {
    id: existing?.id || localId("wf"),
    name: String(input.name || existing?.name || "").trim(),
    description: input.description ?? existing?.description ?? "",
    module: input.module || existing?.module || "",
    trigger: input.trigger || existing?.trigger || "Manual submission",
    workflowType: input.workflowType || existing?.workflowType || "Standard",
    status: input.status || existing?.status || "Draft",
    currentVersion: existing ? existing.currentVersion + 1 : 1,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    createdBy: existing?.createdBy || input.createdBy || input.updatedBy || "system",
    updatedBy: input.updatedBy || input.createdBy || existing?.updatedBy || "system",
    conditions: snapshot.conditions,
    levels: snapshot.levels,
    clientId: input.clientId || existing?.clientId,
    clientName: input.clientName || existing?.clientName,
  };
}

function compareLocal(actual: unknown, operator: string, expected: unknown) {
  if (operator === "contains") {
    return String(actual ?? "").toLowerCase().includes(String(expected ?? "").toLowerCase());
  }
  if (operator === "between") {
    const range = Array.isArray(expected) ? expected : String(expected ?? "").split(",");
    const min = Number(range[0]);
    const max = Number(range[1]);
    return Number(actual) >= min && Number(actual) <= max;
  }
  const a = Number(actual);
  const b = Number(expected);
  const numeric = Number.isFinite(a) && Number.isFinite(b) && actual !== "" && expected !== "";
  const left = numeric ? a : String(actual ?? "").toLowerCase();
  const right = numeric ? b : String(expected ?? "").toLowerCase();
  switch (operator) {
    case "equals": return left === right;
    case "not_equals": return left !== right;
    case "greater_than": return left > right;
    case "greater_or_equal": return left >= right;
    case "less_than": return left < right;
    case "less_or_equal": return left <= right;
    default: return false;
  }
}

function localConditionsMatch(conditions: ApprovalCondition[] = [], context: Record<string, unknown> = {}) {
  if (!conditions.length) return true;
  let result = compareLocal(context[conditions[0].field], conditions[0].operator, conditions[0].value);
  for (let i = 1; i < conditions.length; i += 1) {
    const next = compareLocal(context[conditions[i].field], conditions[i].operator, conditions[i].value);
    result = conditions[i].joinOperator === "OR" ? result || next : result && next;
  }
  return result;
}

function localStats(store: LocalApprovalStore) {
  const pending = store.requests.filter(request => ["Pending", "In Progress", "Escalated"].includes(request.status));
  return {
    total_workflows: store.workflows.length,
    active_workflows: store.workflows.filter(workflow => workflow.status === "Active").length,
    draft_workflows: store.workflows.filter(workflow => workflow.status === "Draft").length,
    pending_approvals: pending.length,
    completed_approvals: store.requests.filter(request => request.status === "Approved").length,
    rejected_approvals: store.requests.filter(request => request.status === "Rejected").length,
    overdue_approvals: pending.filter(request => request.dueAt && new Date(request.dueAt).getTime() < Date.now()).length,
  };
}

function localApprover(level: ApprovalLevel) {
  return level.approverType === "Specific User"
    ? level.specificUserId || "Specific User"
    : level.approverRole || level.approverType;
}

function localRequestSteps(requestId: string, levels: ApprovalLevel[], dueAt: string) {
  return levels.map((level, index) => ({
    id: `${requestId}_step_${level.levelNumber || index + 1}`,
    request_id: requestId,
    level_number: level.levelNumber || index + 1,
    approver_type: level.approverType,
    approver_role: level.approverRole || null,
    specific_user_id: level.specificUserId || null,
    minimum_approvers: level.minimumApprovers || 1,
    approval_mode: level.approvalMode || "Sequential",
    sla_hours: level.slaHours || 24,
    escalation_enabled: Boolean(level.escalationEnabled),
    escalation_approver: level.escalationApprover || null,
    escalation_after_hours: level.escalationAfterHours || null,
    status: index === 0 ? "Pending" : "Waiting",
    due_at: index === 0 ? dueAt : null,
  }));
}

function requiredLocalApprovals(step: any) {
  const minimum = Math.max(1, Number(step?.minimum_approvers) || 1);
  if (step?.approval_mode === "Any One") return 1;
  if (step?.approval_mode === "Majority") return Math.max(1, Math.ceil(minimum / 2));
  return minimum;
}

async function localLoadApprovalBootstrap() {
  const store = localStore();
  return {
    workflows: structuredClone(store.workflows).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    requests: structuredClone(store.requests).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    stats: localStats(store),
  };
}

async function localSaveApprovalWorkflow(
  workflow: Partial<ApprovalWorkflow> & { name: string; module: string },
  editingId?: string,
) {
  if (!String(workflow.name || "").trim() || !workflow.module) {
    throw new Error("Workflow name and module are required.");
  }
  const store = localStore();
  const existing = editingId ? store.workflows.find(item => item.id === editingId) : undefined;
  if (editingId && !existing) throw new Error("Workflow not found.");
  const saved = localWorkflow(workflow, existing);
  if (existing) {
    store.workflows = store.workflows.map(item => item.id === saved.id ? saved : item);
  } else {
    store.workflows = [saved, ...store.workflows];
  }
  const history = store.history[saved.id] || [];
  store.history[saved.id] = [{
    version: saved.currentVersion,
    changed_by: saved.updatedBy,
    date: saved.updatedAt,
    snapshot: localSnapshot(saved),
    status: "Saved",
  }, ...history];
  saveLocalStore(store);
  return structuredClone(saved);
}

async function localSetApprovalWorkflowStatus(id: string, status: ApprovalWorkflow["status"], updatedBy: string) {
  if (!["Active", "Inactive", "Draft"].includes(status)) throw new Error("Invalid workflow status.");
  const store = localStore();
  const existing = store.workflows.find(workflow => workflow.id === id);
  if (!existing) throw new Error("Workflow not found.");
  const updated = { ...existing, status, updatedAt: new Date().toISOString(), updatedBy: updatedBy || "system" };
  store.workflows = store.workflows.map(workflow => workflow.id === id ? updated : workflow);
  saveLocalStore(store);
  return structuredClone(updated);
}

async function localDuplicateApprovalWorkflow(id: string, createdBy: string) {
  const store = localStore();
  const existing = store.workflows.find(workflow => workflow.id === id);
  if (!existing) throw new Error("Workflow not found.");
  return localSaveApprovalWorkflow({
    ...structuredClone(existing),
    id: undefined,
    name: `${existing.name} (Copy)`,
    status: "Draft",
    createdBy,
    updatedBy: createdBy,
  });
}

async function localDeleteApprovalWorkflow(id: string) {
  const store = localStore();
  if (!store.workflows.some(workflow => workflow.id === id)) throw new Error("Workflow not found.");
  if (store.requests.some(request => request.workflowId === id)) {
    throw new Error("This workflow has approval history and cannot be deleted. Deactivate it to preserve the audit trail.");
  }
  store.workflows = store.workflows.filter(workflow => workflow.id !== id);
  delete store.history[id];
  saveLocalStore(store);
}

async function localCreateApprovalRequest(payload: Record<string, unknown>) {
  const store = localStore();
  const context = {
    ...(payload.context && typeof payload.context === "object" ? payload.context : {}),
    amount: payload.amount,
    module: payload.module,
    trigger: payload.trigger,
  } as Record<string, unknown>;
  const isClientPortalPayload = ["client_admin", "client_user"].includes(String(payload.userType || ""));
  const candidates = store.workflows.filter(workflow =>
    workflow.module === payload.module &&
    workflow.trigger === payload.trigger &&
    workflow.status === "Active" &&
    (
      workflow.clientId
        ? isClientPortalPayload && workflow.clientId === String(payload.clientId || "")
        : !isClientPortalPayload
    ) &&
    localConditionsMatch(workflow.conditions, context),
  );
  const created: ApprovalRequest[] = [];
  for (const workflow of candidates) {
    const duplicate = store.requests.find(request =>
      request.workflowId === workflow.id &&
      request.reference === String(payload.reference || "") &&
      ["Pending", "In Progress", "Sent Back", "Escalated"].includes(request.status),
    );
    if (duplicate) {
      created.push(structuredClone(duplicate));
      continue;
    }
    const levels = workflow.levels?.length ? workflow.levels : fallbackLevels();
    const first = levels[0];
    const requestId = localId("apr");
    const dueAt = new Date(Date.now() + (Number(first.slaHours) || 24) * 3600000).toISOString();
    const request = {
      id: requestId,
      workflowId: workflow.id,
      workflow: workflow.name,
      workflowVersion: workflow.currentVersion,
      module: String(payload.module || ""),
      trigger: String(payload.trigger || ""),
      reference: String(payload.reference || ""),
      requestedBy: String(payload.requestedBy || "system"),
      requestedByName: String(payload.requestedByName || "System"),
      currentApprover: localApprover(first),
      approverType: first.approverType,
      currentLevel: 1,
      status: "Pending" as const,
      amount: payload.amount == null ? null : Number(payload.amount),
      context,
      createdAt: new Date().toISOString(),
      dueAt,
      timeline: [{
        id: `${requestId}_submitted`,
        action: "submitted",
        user_name: String(payload.requestedByName || "System"),
        user_role: String(payload.requestedByRole || ""),
        comment: "",
        previous_status: "",
        new_status: "Pending",
        created_at: new Date().toISOString(),
      }],
      steps: localRequestSteps(requestId, levels, dueAt),
      clientId: payload.clientId ? String(payload.clientId) : undefined,
      clientName: payload.clientName ? String(payload.clientName) : undefined,
    };
    store.requests.unshift(request);
    created.push(structuredClone(request));
  }
  if (created.length) saveLocalStore(store);
  return created;
}

async function localActOnApprovalRequest(id: string, payload: Record<string, unknown>) {
  const action = String(payload.action || "");
  const validActions = ["approve", "reject", "send_back", "request_changes", "delegate", "reassign", "cancel"];
  if (!validActions.includes(action)) throw new Error("Unsupported approval action.");
  const store = localStore();
  const request = store.requests.find(item => item.id === id);
  if (!request) throw new Error("Approval request not found.");
  if (["Approved", "Rejected", "Cancelled"].includes(request.status)) {
    throw new Error("This approval request is already complete.");
  }
  const comment = String(payload.comment || "");
  if (["reject", "send_back", "request_changes"].includes(action) && !comment.trim()) {
    throw new Error("A reason is required for this action.");
  }
  if (["delegate", "reassign"].includes(action) && !String(payload.targetUserId || "").trim()) {
    throw new Error("A target user is required for delegation or reassignment.");
  }
  const step = request.steps?.find((item: any) => Number(item.level_number) === Number(request.currentLevel)) as any;
  const actorId = String(payload.userId || "system");
  const actorRole = String(payload.userRole || "");
  const actorDepartment = String(payload.userDepartment || "");
  const sameClient = Boolean(request.clientId && payload.clientId && request.clientId === String(payload.clientId));
  const clientAdmin = ["client_admin", "client_user"].includes(String(payload.userType || ""))
    && String(payload.userType || "") === "client_admin"
    && sameClient;
  const authorized = actorRole === "System Owner" ||
    clientAdmin ||
    (action === "cancel" && (actorId === String(request.requestedBy) || actorRole === "System Admin")) ||
    (step?.approver_type === "Role" && step.approver_role === actorRole) ||
    (step?.approver_type === "Specific User" && step.specific_user_id === actorId) ||
    (step?.approver_type === "Department" && step.approver_role === actorDepartment) ||
    (["Manager", "Reporting Manager"].includes(step?.approver_type)
      && actorId === String(request.context?.managerId || request.context?.reportingManagerId || ""));
  if (!authorized) throw new Error("You are not an eligible approver for the current level.");

  const priorApproverIds = new Set(
    (request.timeline || [])
      .filter((entry: any) => entry.action === "approve" && String(entry.step_id) === String(step?.id))
      .map((entry: any) => String(entry.user_id || entry.user_name)),
  );
  if (action === "approve" && priorApproverIds.has(actorId)) {
    throw new Error("You have already approved this approval level.");
  }
  const stepApprovalComplete = action !== "approve"
    || priorApproverIds.size + 1 >= requiredLocalApprovals(step);

  const previousStatus = request.status;
  let newStatus: ApprovalStatus = request.status;
  if (action === "approve" && stepApprovalComplete) {
    if (request.currentLevel >= (request.steps?.length || 1)) {
      newStatus = "Approved";
    } else {
      request.currentLevel += 1;
      newStatus = "In Progress";
      const next = request.steps?.find((item: any) => Number(item.level_number) === Number(request.currentLevel)) as any;
      if (next) {
        next.status = "Pending";
        next.due_at = new Date(Date.now() + (Number(next.sla_hours) || 24) * 3600000).toISOString();
        request.currentApprover = next.specific_user_id || next.approver_role || next.approver_type;
        request.dueAt = next.due_at;
      }
    }
  } else if (action === "reject") {
    newStatus = "Rejected";
  } else if (action === "send_back" || action === "request_changes") {
    newStatus = "Sent Back";
  } else if (action === "delegate" || action === "reassign") {
    newStatus = "In Progress";
    if (step) {
      step.approver_type = "Specific User";
      step.specific_user_id = String(payload.targetUserId);
      step.approver_role = null;
      step.status = "Pending";
      request.currentApprover = String(payload.targetUserId);
    }
  } else if (action === "cancel") {
    newStatus = "Cancelled";
  }
  if (step && action !== "delegate" && action !== "reassign") {
    step.status = action === "approve"
      ? (stepApprovalComplete ? "Approved" : "Pending")
      : action === "reject" ? "Rejected" : "Actioned";
    if (action === "cancel") step.status = "Cancelled";
  }
  request.status = newStatus;
  request.timeline = [...(request.timeline || []), {
    id: `${id}_${Date.now().toString(36)}`,
    action,
    step_id: step?.id,
    user_id: actorId,
    user_name: String(payload.userName || actorId),
    user_role: actorRole,
    comment,
    previous_status: previousStatus,
    new_status: newStatus,
    created_at: new Date().toISOString(),
  }];
  store.requests = store.requests.map(item => item.id === id ? request : item);
  saveLocalStore(store);
  return structuredClone(request);
}

async function localGetApprovalRequest(id: string) {
  const request = localStore().requests.find(item => item.id === id);
  if (!request) throw new Error("Approval request not found.");
  return structuredClone(request);
}

async function localGetApprovalWorkflowHistory(id: string) {
  return structuredClone(localStore().history[id] || []);
}

export async function loadApprovalBootstrap() {
  return USE_APPROVAL_BACKEND
    ? api<{ workflows: ApprovalWorkflow[]; requests: ApprovalRequest[]; stats: Record<string, number> }>("/bootstrap")
    : localLoadApprovalBootstrap();
}

export async function saveApprovalWorkflow(workflow: Partial<ApprovalWorkflow> & { name: string; module: string }, editingId?: string) {
  return USE_APPROVAL_BACKEND
    ? api<ApprovalWorkflow>(editingId ? `/workflows/${editingId}` : "/workflows", {
      method: editingId ? "PUT" : "POST",
      body: JSON.stringify(workflow),
    })
    : localSaveApprovalWorkflow(workflow, editingId);
}

export async function setApprovalWorkflowStatus(id: string, status: ApprovalWorkflow["status"], updatedBy: string) {
  return USE_APPROVAL_BACKEND
    ? api<ApprovalWorkflow>(`/workflows/${id}/status`, { method: "POST", body: JSON.stringify({ status, updatedBy }) })
    : localSetApprovalWorkflowStatus(id, status, updatedBy);
}

export async function duplicateApprovalWorkflow(id: string, createdBy: string) {
  return USE_APPROVAL_BACKEND
    ? api<ApprovalWorkflow>(`/workflows/${id}/duplicate`, {
      method: "POST",
      body: JSON.stringify({ createdBy, actorRole: currentRole() }),
    })
    : localDuplicateApprovalWorkflow(id, createdBy);
}

export async function deleteApprovalWorkflow(id: string) {
  if (USE_APPROVAL_BACKEND) return api<void>(`/workflows/${id}`, { method: "DELETE" });
  return localDeleteApprovalWorkflow(id);
}

export async function createApprovalRequest(payload: Record<string, unknown>) {
  return USE_APPROVAL_BACKEND
    ? api<ApprovalRequest[]>("/requests/evaluate", { method: "POST", body: JSON.stringify(payload) })
    : localCreateApprovalRequest(payload);
}

export async function actOnApprovalRequest(id: string, payload: Record<string, unknown>) {
  const updated = USE_APPROVAL_BACKEND
    ? api<ApprovalRequest>(`/requests/${id}/action`, { method: "POST", body: JSON.stringify(payload) })
    : localActOnApprovalRequest(id, payload);
  const request = await updated;
  const latestTimeline = Array.isArray(request.timeline) ? request.timeline[request.timeline.length - 1] : null;
  const actor = String(latestTimeline?.user_name || "System");
  if (request.module === "Order" && latestTimeline) {
    appendOrderActivity(
      request.reference,
      `Approval status changed from ${latestTimeline.previous_status || "Pending"} to ${request.status}${latestTimeline.comment ? `. Comment: ${latestTimeline.comment}` : ""}.`,
      {
        actor,
        eventType: request.status === "Approved" ? "activity" : "status-change",
        id: `activity_approval_${request.id}_${latestTimeline.id || request.status}`,
      },
    );
  }
  if (request.status === "Approved" && request.module === "Order") {
    createDraftPOsForStoredOrder(request.reference);
  }
  return request;
}

/**
 * Cancels any open approval requests for a reference before the related
 * business record is cancelled. This prevents a late approval from releasing
 * work for an order that no longer exists in an active state.
 */
export async function cancelApprovalRequestsForReference(
  reference: string,
  actor: { userId?: string; userName?: string; userRole?: string; userType?: string; clientId?: string } = {},
) {
  if (!reference) return [];
  const bootstrap = await loadApprovalBootstrap();
  const open = bootstrap.requests.filter(request =>
    request.reference === reference &&
    ["Pending", "In Progress", "Sent Back", "Escalated"].includes(request.status),
  );
  return Promise.all(open.map(request => actOnApprovalRequest(request.id, {
    action: "cancel",
    userId: actor.userId || "system",
    userName: actor.userName || "System",
    userRole: actor.userRole || "",
    userType: actor.userType || "",
    clientId: actor.clientId,
  })));
}

export async function getApprovalRequest(id: string) {
  return USE_APPROVAL_BACKEND ? api<ApprovalRequest>(`/requests/${id}`) : localGetApprovalRequest(id);
}

export async function getApprovalWorkflowHistory(id: string) {
  return USE_APPROVAL_BACKEND ? api<unknown[]>(`/workflows/${id}/history`) : localGetApprovalWorkflowHistory(id);
}

function currentRole(): string {
  try {
    return JSON.parse(localStorage.getItem("nido_user") || "null")?.role || "";
  } catch {
    return "";
  }
}