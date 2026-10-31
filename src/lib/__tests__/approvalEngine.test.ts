import { beforeEach, describe, expect, it } from "vitest";
import {
  actOnApprovalRequest,
  createApprovalRequest,
  getApprovalWorkflowHistory,
  loadApprovalBootstrap,
  saveApprovalWorkflow,
  setApprovalWorkflowStatus,
} from "@/lib/approvalEngine";

describe("local approval engine", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persists workflows, evaluates conditions, and moves through sequential levels", async () => {
    const workflow = await saveApprovalWorkflow({
      name: "Purchase Order Approval",
      description: "Local approval test",
      module: "Purchase Order",
      trigger: "PO created",
      workflowType: "Threshold",
      status: "Draft",
      conditions: [{
        joinOperator: "AND",
        field: "amount",
        operator: "greater_than",
        value: "100000",
      }],
      levels: [
        {
          levelNumber: 1,
          approverType: "Role",
          approverRole: "Procurement Manager",
          minimumApprovers: 1,
          approvalMode: "Sequential",
          slaHours: 24,
          escalationEnabled: false,
          escalationAfterHours: 24,
        },
        {
          levelNumber: 2,
          approverType: "Role",
          approverRole: "Finance Manager",
          minimumApprovers: 1,
          approvalMode: "Sequential",
          slaHours: 48,
          escalationEnabled: false,
          escalationAfterHours: 48,
        },
      ],
      createdBy: "System Owner",
      updatedBy: "System Owner",
    });

    await setApprovalWorkflowStatus(workflow.id, "Active", "System Owner");
    const persisted = await loadApprovalBootstrap();
    expect(persisted.workflows).toHaveLength(1);
    expect(persisted.workflows[0].status).toBe("Active");
    expect(persisted.stats.active_workflows).toBe(1);

    const ignored = await createApprovalRequest({
      module: "Purchase Order",
      trigger: "PO created",
      reference: "PO-LOW",
      amount: 50000,
      context: { amount: 50000 },
      requestedBy: "buyer",
      requestedByName: "Buyer",
      requestedByRole: "Operations Manager",
    });
    expect(ignored).toHaveLength(0);

    const created = await createApprovalRequest({
      module: "Purchase Order",
      trigger: "PO created",
      reference: "PO-001",
      amount: 150000,
      context: { amount: 150000 },
      requestedBy: "buyer",
      requestedByName: "Buyer",
      requestedByRole: "Operations Manager",
    });
    expect(created).toHaveLength(1);
    expect(created[0].status).toBe("Pending");
    expect(created[0].currentApprover).toBe("Procurement Manager");

    const levelOne = await actOnApprovalRequest(created[0].id, {
      action: "approve",
      userId: "procurement-manager",
      userName: "Procurement Manager",
      userRole: "Procurement Manager",
    });
    expect(levelOne.status).toBe("In Progress");
    expect(levelOne.currentLevel).toBe(2);
    expect(levelOne.currentApprover).toBe("Finance Manager");

    const completed = await actOnApprovalRequest(created[0].id, {
      action: "approve",
      userId: "finance-manager",
      userName: "Finance Manager",
      userRole: "Finance Manager",
    });
    expect(completed.status).toBe("Approved");
    expect(completed.timeline).toHaveLength(3);
    expect((await loadApprovalBootstrap()).stats.completed_approvals).toBe(1);
  });

  it("creates a new version while preserving workflow history", async () => {
    const workflow = await saveApprovalWorkflow({
      name: "Stock Adjustment Approval",
      module: "Stock",
      trigger: "Manual stock adjustment",
      status: "Draft",
      conditions: [],
      levels: [],
      updatedBy: "System Owner",
    });

    const updated = await saveApprovalWorkflow({
      ...workflow,
      description: "Updated rule",
      updatedBy: "System Admin",
    }, workflow.id);

    expect(updated.currentVersion).toBe(2);
    const history = await getApprovalWorkflowHistory(workflow.id);
    expect(history).toHaveLength(2);
    expect(history.map(item => item.version)).toEqual([2, 1]);
  });

  it("uses each condition's join operator and lets the requester cancel an open request", async () => {
    const workflow = await saveApprovalWorkflow({
      name: "Conditional Order Approval",
      module: "Order",
      trigger: "Order created",
      status: "Active",
      clientId: "client-1",
      clientName: "Client One",
      conditions: [
        { joinOperator: "AND", field: "client", operator: "equals", value: "client-1" },
        { joinOperator: "OR", field: "amount", operator: "greater_than", value: 100000 },
      ],
      levels: [{
        levelNumber: 1,
        approverType: "Role",
        approverRole: "Approver",
        minimumApprovers: 1,
        approvalMode: "Sequential",
        slaHours: 24,
        escalationEnabled: false,
      }],
      updatedBy: "System Owner",
    });

    const created = await createApprovalRequest({
      module: "Order",
      trigger: "Order created",
      reference: "ORD-CANCEL",
      amount: 50000,
      requestedBy: "requester-1",
      requestedByName: "Requester",
      userType: "client_user",
      clientId: "client-1",
      context: { client: "client-1", amount: 50000 },
    });
    expect(created).toHaveLength(1);
    const cancelled = await actOnApprovalRequest(created[0].id, {
      action: "cancel",
      userId: "requester-1",
      userName: "Requester",
      userType: "client_user",
      clientId: "client-1",
    });
    expect(cancelled.status).toBe("Cancelled");
    expect((await loadApprovalBootstrap()).requests[0].status).toBe("Cancelled");
    expect(workflow.status).toBe("Active");
  });

  it("scopes client workflows, prevents duplicate requests, and supports multi-approver levels", async () => {
    const workflow = await saveApprovalWorkflow({
      name: "Client Order Approval",
      module: "Order",
      trigger: "Order created",
      status: "Active",
      clientId: "client-1",
      clientName: "Client One",
      conditions: [],
      levels: [{
        levelNumber: 1,
        approverType: "Role",
        approverRole: "Approver",
        minimumApprovers: 2,
        approvalMode: "All Required",
        slaHours: 24,
        escalationEnabled: false,
      }],
      updatedBy: "System Owner",
    });

    const wrongClient = await createApprovalRequest({
      module: "Order",
      trigger: "Order created",
      reference: "ORD-WRONG",
      clientId: "client-2",
      requestedBy: "portal-user",
      requestedByName: "Portal User",
      userType: "client_user",
    });
    expect(wrongClient).toHaveLength(0);

    const created = await createApprovalRequest({
      module: "Order",
      trigger: "Order created",
      reference: "ORD-CLIENT-1",
      clientId: "client-1",
      requestedBy: "portal-user",
      requestedByName: "Portal User",
      requestedByRole: "Employee",
      userType: "client_user",
    });
    expect(created).toHaveLength(1);

    const duplicate = await createApprovalRequest({
      module: "Order",
      trigger: "Order created",
      reference: "ORD-CLIENT-1",
      clientId: "client-1",
      requestedBy: "portal-user",
      requestedByName: "Portal User",
      userType: "client_user",
    });
    expect(duplicate).toHaveLength(1);
    expect(duplicate[0].id).toBe(created[0].id);

    const firstApproval = await actOnApprovalRequest(created[0].id, {
      action: "approve",
      userId: "approver-1",
      userName: "Approver One",
      userRole: "Approver",
      userType: "client_user",
      clientId: "client-1",
    });
    expect(firstApproval.status).toBe("Pending");
    expect(firstApproval.currentLevel).toBe(1);

    const completed = await actOnApprovalRequest(created[0].id, {
      action: "approve",
      userId: "approver-2",
      userName: "Approver Two",
      userRole: "Approver",
      userType: "client_user",
      clientId: "client-1",
    });
    expect(completed.status).toBe("Approved");
    expect(completed.currentLevel).toBe(1);
    expect(workflow.clientId).toBe("client-1");

    await saveApprovalWorkflow({
      name: "NIDO Order Approval",
      module: "Order",
      trigger: "Order created",
      status: "Active",
      conditions: [],
      levels: [{
        levelNumber: 1,
        approverType: "Role",
        approverRole: "System Admin",
        minimumApprovers: 1,
        approvalMode: "Sequential",
        slaHours: 24,
        escalationEnabled: false,
      }],
      updatedBy: "System Owner",
    });
    const nidoOrderRequest = await createApprovalRequest({
      module: "Order",
      trigger: "Order created",
      reference: "ORD-NIDO-1",
      clientId: "client-1",
      userType: "nido_admin",
      requestedBy: "nido-user",
      requestedByName: "NIDO User",
    });
    expect(nidoOrderRequest).toHaveLength(1);
    expect(nidoOrderRequest[0].workflow).toBe("NIDO Order Approval");
  });
});