const PARENT_TICKET_TRANSITIONS: Record<string, string[]> = {
  open: ["In Progress", "On Hold", "Cancelled", "Duplicate"],
  "in progress": ["On Hold", "Resolved", "Cancelled"],
  "on hold": ["In Progress", "Cancelled"],
  resolved: ["Closed", "Reopened"],
  closed: ["Reopened"],
  reopened: ["In Progress", "On Hold", "Cancelled"],
  assigned: ["Accepted", "In Progress", "On Hold"],
  accepted: ["In Progress", "On Hold"],
  cancelled: [],
  duplicate: [],
};

const CHILD_TICKET_TRANSITIONS: Record<string, string[]> = {
  ...PARENT_TICKET_TRANSITIONS,
  open: ["Assigned", "On Hold", "Cancelled"],
  assigned: ["Accepted", "On Hold", "Cancelled"],
  accepted: ["In Progress", "On Hold"],
};

function normalizeStatus(status: string): string {
  return String(status || "").trim().toLowerCase().replace(/[_-]+/g, " ");
}

export function getTicketAllowedTransitions(status: string, isChild = false): string[] {
  const transitions = isChild ? CHILD_TICKET_TRANSITIONS : PARENT_TICKET_TRANSITIONS;
  return [...(transitions[normalizeStatus(status)] || [])];
}

export function getTicketNextAction(status: string, isChild = false): string {
  const normalized = normalizeStatus(status);
  if (normalized === "closed") return "Reopen only if the client disputes the recorded resolution.";
  if (normalized === "resolved") return "The client CRM reviews the evidence and records acceptance before closing.";
  if (normalized === "on hold") return "Record the hold reason and review date before resuming work.";
  if (normalized === "in progress") return "Record work evidence, then resolve when the requested work is complete.";
  if (normalized === "reopened") return "Resume work and retain the original resolution history.";
  if (normalized === "cancelled" || normalized === "duplicate") return "No further work is expected unless the record is reopened.";
  if (isChild && normalized === "assigned") return "The specialist accepts the work before starting it.";
  if (isChild) return "Complete the assigned specialist work and send the result to the parent CRM for review.";
  return "Route the ticket to the client's primary CRM and begin triage.";
}
