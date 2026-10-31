import { describe, expect, it } from "vitest";
import { getTicketAllowedTransitions, getTicketNextAction } from "@/lib/ticketWorkflow";

describe("ticket workflow guidance", () => {
  it("keeps parent ticket movement sequential", () => {
    expect(getTicketAllowedTransitions("Open")).toEqual(["In Progress", "On Hold", "Cancelled", "Duplicate"]);
    expect(getTicketAllowedTransitions("In Progress")).toEqual(["On Hold", "Resolved", "Cancelled"]);
    expect(getTicketAllowedTransitions("Closed")).toEqual(["Reopened"]);
  });

  it("uses specialist-specific child-ticket assignment stages", () => {
    expect(getTicketAllowedTransitions("Open", true)).toContain("Assigned");
    expect(getTicketAllowedTransitions("Assigned", true)).toEqual(["Accepted", "On Hold", "Cancelled"]);
  });

  it("describes CRM acceptance as a separate close gate", () => {
    expect(getTicketNextAction("Resolved")).toContain("acceptance before closing");
  });
});
