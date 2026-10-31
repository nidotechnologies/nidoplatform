import { describe, expect, it } from "vitest";
import { getServiceAllowedTransitions, getServiceNextAction } from "@/lib/serviceWorkflow";

describe("service workflow guidance", () => {
  it("offers only next-stage service transitions", () => {
    expect(getServiceAllowedTransitions("Assigned")).toEqual(["Accepted", "On Hold", "Cancelled"]);
    expect(getServiceAllowedTransitions("In Progress")).toEqual(["On Hold", "Resolved"]);
    expect(getServiceAllowedTransitions("Resolved")).toEqual(["Closed", "Reopened"]);
  });

  it("keeps resolution evidence and acceptance distinct", () => {
    expect(getServiceNextAction("Resolved")).toContain("acceptance before closure");
  });
});
