// Shared localStorage store for support tickets so the SLA notification
// system can read them outside of SupportPage's local component state.

export interface SupportTicket {
  id: string;
  number: string;
  subject: string;
  status: string;   // "open" | "in_progress" | "resolved"
  priority: string; // "high" | "medium" | "low"
  created: string;  // YYYY-MM-DD
  clientId?: string;
  clientName?: string;
  createdBy?: string;
  createdById?: string;
  createdByEmail?: string;
  department?: string;
  assignedTo?: string;
  assignedRole?: string;
}

const KEY = "nido_support_tickets";

export function getSupportTickets(): SupportTicket[] {
  try {
    const summaryRaw = localStorage.getItem(KEY);
    const rawTickets = localStorage.getItem("nido_support_tickets_v1");
    const summary = summaryRaw ? JSON.parse(summaryRaw) as SupportTicket[] : [];
    const detailed = rawTickets ? JSON.parse(rawTickets) as SupportTicket[] : [];
    const byId = new Map<string, SupportTicket>();

    detailed.forEach((ticket) => {
      if (ticket?.id) byId.set(ticket.id, ticket);
    });
    summary.forEach((ticket) => {
      if (!ticket?.id) return;
      const original = byId.get(ticket.id);
      byId.set(ticket.id, {
        ...original,
        ...ticket,
        createdBy: ticket.createdBy || original?.createdBy,
        createdById: ticket.createdById || original?.createdById,
        createdByEmail: ticket.createdByEmail || original?.createdByEmail,
      });
    });
    return Array.from(byId.values());
  } catch {
    return [];
  }
}

export function saveSupportTickets(tickets: SupportTicket[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(tickets));
    window.dispatchEvent(new CustomEvent("supportTicketsUpdated"));
  } catch {
    // ignore
  }
}
