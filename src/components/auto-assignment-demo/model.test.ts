import { describe, expect, it } from "vitest";
import {
  createDefaultDemoState,
  createReassignment,
  getNextAssignments,
  simulateNext,
  type TierConfig,
} from "./model";

describe("auto-assignment demo model", () => {
  it("previews active employees in sequence without advancing the saved position", () => {
    const state = createDefaultDemoState();
    const tier = state.tiers.Medium;
    const positionBeforePreview = tier.rotationPosition;

    const preview = getNextAssignments(tier, 5);

    expect(preview.map((item) => item.employeeId)).toEqual([
      "employee-b",
      "employee-c",
      "employee-b",
      "employee-c",
      "employee-b",
    ]);
    expect(tier.rotationPosition).toBe(positionBeforePreview);
  });

  it("advances only the simulated tier after a successful round-robin assignment", () => {
    const state = createDefaultDemoState();
    const beforePremium = state.tiers.Premium.rotationPosition;
    const beforeStandard = state.tiers.Standard.rotationPosition;
    const client = { id: "client-meridian", name: "Meridian Works", tier: "Medium" as const };

    const { nextState, item } = simulateNext(state, client);

    expect(item.assignedEmployeeId).toBe("employee-b");
    expect(nextState.tiers.Medium.rotationPosition).toBe(1);
    expect(nextState.tiers.Premium.rotationPosition).toBe(beforePremium);
    expect(nextState.tiers.Standard.rotationPosition).toBe(beforeStandard);
  });

  it("skips inactive employees and leaves rotation unchanged when none are available", () => {
    const state = createDefaultDemoState();
    const tier: TierConfig = {
      ...state.tiers.Standard,
      eligibleEmployeeIds: ["employee-d"],
      sequence: ["employee-d"],
      rotationPosition: 0,
      fallback: null,
    };
    const client = { id: "client-fieldnote", name: "Fieldnote Learning", tier: "Standard" as const };
    const { nextState, item } = simulateNext({ ...state, tiers: { ...state.tiers, Standard: tier } }, client);

    expect(item.status).toBe("Unassigned");
    expect(item.assignedEmployeeId).toBeNull();
    expect(nextState.tiers.Standard.rotationPosition).toBe(0);
  });

  it("uses an active fallback without advancing the round-robin position", () => {
    const state = createDefaultDemoState();
    const tier: TierConfig = {
      ...state.tiers.Standard,
      eligibleEmployeeIds: ["employee-d"],
      sequence: ["employee-d"],
      rotationPosition: 0,
      fallback: "employee-c",
    };
    const client = { id: "client-fieldnote", name: "Fieldnote Learning", tier: "Standard" as const };
    const { nextState, item } = simulateNext({ ...state, tiers: { ...state.tiers, Standard: tier } }, client);

    expect(item.method).toBe("Fallback");
    expect(item.assignedEmployeeId).toBe("employee-c");
    expect(nextState.tiers.Standard.rotationPosition).toBe(0);
  });

  it("records the prior assignee, new assignee, and required reason", () => {
    const state = createDefaultDemoState();
    const order = state.history[0];

    const next = createReassignment(state, order.orderId, "employee-b", "Balance the workload");
    const updated = next.history.find((item) => item.orderId === order.orderId);

    expect(updated?.assignedEmployeeId).toBe("employee-b");
    expect(updated?.reassignments.at(-1)).toMatchObject({
      previousEmployeeId: order.assignedEmployeeId,
      newEmployeeId: "employee-b",
      reason: "Balance the workload",
    });
  });

  it("uses the supplied NIDO roster for tier defaults and demo assignments", () => {
    const nidoEmployees = [
      {
        id: "nido-user-1",
        employeeId: "EMP-00041",
        name: "Asha Rao",
        department: "Operations",
        role: "Order Specialist",
        status: "Active" as const,
      },
      {
        id: "nido-user-2",
        employeeId: "EMP-00042",
        name: "Ravi Shah",
        department: "Operations",
        role: "Order Specialist",
        status: "Inactive" as const,
      },
    ];
    const state = createDefaultDemoState(nidoEmployees);
    const client = { id: "client-meridian", name: "Meridian Works", tier: "Medium" as const };

    expect(state.tiers.Medium.eligibleEmployeeIds).toEqual(["nido-user-1"]);
    expect(getNextAssignments(state.tiers.Medium, 2, nidoEmployees).map((item) => item.employeeId))
      .toEqual(["nido-user-1", "nido-user-1"]);
    expect(simulateNext(state, client, nidoEmployees).item.assignedEmployeeId).toBe("nido-user-1");
    expect(state.history[0].assignedEmployeeId).toBe("nido-user-1");
  });
});
