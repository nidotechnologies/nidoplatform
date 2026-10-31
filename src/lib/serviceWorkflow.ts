const SERVICE_TRANSITIONS: Record<string, string[]> = {
  pending: ["Open", "Scheduled", "Cancelled"],
  open: ["Pending Approval", "Assigned", "Cancelled"],
  "pending approval": ["Assigned", "Cancelled"],
  assigned: ["Accepted", "On Hold", "Cancelled"],
  accepted: ["Scheduled", "In Progress", "On Hold"],
  scheduled: ["In Progress", "On Hold", "Cancelled"],
  active: ["In Progress", "On Hold", "Cancelled"],
  "in progress": ["On Hold", "Resolved"],
  "on hold": ["In Progress", "Cancelled"],
  resolved: ["Closed", "Reopened"],
  completed: ["Reopened"],
  closed: ["Reopened"],
  reopened: ["Assigned", "In Progress", "On Hold"],
  cancelled: [],
};

const normalizeStatus = (status: string) =>
  String(status || "").trim().toLowerCase().replace(/[_-]+/g, " ");

export function getServiceAllowedTransitions(status: string): string[] {
  return [...(SERVICE_TRANSITIONS[normalizeStatus(status)] || [])];
}

export function getServiceNextAction(status: string): string {
  const normalized = normalizeStatus(status);
  if (normalized === "resolved") return "Attach work evidence; the client or CRM records acceptance before closure.";
  if (normalized === "closed" || normalized === "completed") return "Keep the completion history; reopen only for an agreed follow-up.";
  if (normalized === "on hold") return "Record the hold reason and review date before resuming.";
  if (normalized === "in progress" || normalized === "active") return "Record the work performed and evidence before resolving.";
  if (normalized === "scheduled") return "Complete the appointment, then record the outcome and work evidence.";
  if (normalized === "assigned") return "The assigned specialist accepts the request before starting work.";
  if (normalized === "accepted") return "Schedule the work when needed, otherwise begin service.";
  if (normalized === "cancelled") return "No further service work is expected unless the request is reopened.";
  return "Confirm approval requirements, then assign the service specialist.";
}
