import { beforeEach, describe, expect, it } from "vitest";
import { getSupportTickets } from "@/lib/supportTicketStore";

describe("support ticket dashboard attribution", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("preserves the ticket creator when summary data is merged with the detailed ticket record", () => {
    localStorage.setItem(
      "nido_support_tickets_v1",
      JSON.stringify([
        {
          id: "ticket-a",
          number: "TKT-001",
          subject: "Order update",
          status: "open",
          priority: "medium",
          created: "2026-08-01",
          clientId: "client-a",
          createdById: "portal-user-a",
          createdByEmail: "alex@example.com",
        },
      ]),
    );
    localStorage.setItem(
      "nido_support_tickets",
      JSON.stringify([
        {
          id: "ticket-a",
          number: "TKT-001",
          subject: "Order update",
          status: "in_progress",
          priority: "medium",
          created: "2026-08-01",
          clientId: "client-a",
        },
        {
          id: "ticket-b",
          number: "TKT-002",
          subject: "Another ticket",
          status: "open",
          priority: "low",
          created: "2026-08-02",
        },
      ]),
    );

    const tickets = getSupportTickets();
    expect(tickets).toHaveLength(2);
    expect(tickets.find((ticket) => ticket.id === "ticket-a")).toMatchObject({
      status: "in_progress",
      createdById: "portal-user-a",
      createdByEmail: "alex@example.com",
    });
  });
});
