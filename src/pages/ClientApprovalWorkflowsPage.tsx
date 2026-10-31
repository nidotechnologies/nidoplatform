import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Edit3, Eye, Loader2, Plus, RefreshCw, Trash2, UsersRound, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getClients, type StoredClient } from "@/lib/clientStore";
import { getPortalUsersByClient } from "@/lib/portalUserStore";
import {
  ApprovalWorkflowBuilder,
  WorkflowDetailsDialog,
} from "./ApprovalWorkflowsPage";
import {
  deleteApprovalWorkflow,
  duplicateApprovalWorkflow,
  loadApprovalBootstrap,
  saveApprovalWorkflow,
  setApprovalWorkflowStatus,
  type ApprovalRequest,
  type ApprovalWorkflow,
} from "@/lib/approvalEngine";

function clientLabel(client: StoredClient) {
  return client.name || client.company_name || client.id;
}

function statusClass(status: string) {
  if (status === "Active" || status === "Approved") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "Draft") return "bg-slate-50 text-slate-600 border-slate-200";
  if (status === "Rejected") return "bg-red-50 text-red-700 border-red-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

export default function ClientApprovalWorkflowsPage() {
  const { user } = useAuth();
  const clients = useMemo(() => getClients(), []);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([]);
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [builder, setBuilder] = useState<{ workflow?: ApprovalWorkflow; editingId?: string } | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<ApprovalWorkflow | null>(null);

  const selectedClient = clients.find(client => client.id === selectedClientId);
  const portalUsers = selectedClientId
    ? getPortalUsersByClient(selectedClientId).filter(portalUser => portalUser.status === "active")
    : [];
  const portalRoles = Array.from(new Set(portalUsers.map(portalUser => portalUser.role).filter(Boolean)));
  const portalDepartments = Array.from(new Set(portalUsers.map(portalUser => portalUser.department).filter(Boolean)));

  useEffect(() => {
    if (!selectedClientId && clients.length) setSelectedClientId(clients[0].id);
  }, [clients, selectedClientId]);

  const refresh = async () => {
    if (!selectedClientId) return;
    setLoading(true);
    setError("");
    try {
      const data = await loadApprovalBootstrap();
      setWorkflows(data.workflows.filter(workflow => workflow.clientId === selectedClientId));
      setRequests(data.requests.filter(request => request.clientId === selectedClientId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load client approval workflows.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [selectedClientId]);

  const openNew = () => {
    if (!selectedClient) return;
    setBuilder({
      workflow: {
        id: "",
        name: `${clientLabel(selectedClient)} Order Approval`,
        description: `Approval workflow for ${clientLabel(selectedClient)} client portal requests.`,
        module: "Order",
        trigger: "Order created",
        workflowType: "Standard",
        status: "Draft",
        currentVersion: 0,
        createdAt: "",
        updatedAt: "",
        createdBy: user?.name || "System",
        updatedBy: user?.name || "System",
        conditions: [],
        levels: [],
        clientId: selectedClient.id,
        clientName: clientLabel(selectedClient),
      },
    });
  };

  const updateStatus = async (workflow: ApprovalWorkflow) => {
    try {
      await setApprovalWorkflowStatus(
        workflow.id,
        workflow.status === "Active" ? "Inactive" : "Active",
        user?.name || "System",
      );
      await refresh();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Unable to update workflow status.");
    }
  };

  const duplicate = async (workflow: ApprovalWorkflow) => {
    try {
      await duplicateApprovalWorkflow(workflow.id, user?.name || "System");
      await refresh();
    } catch (duplicateError) {
      setError(duplicateError instanceof Error ? duplicateError.message : "Unable to duplicate workflow.");
    }
  };

  const remove = async (workflow: ApprovalWorkflow) => {
    if (!window.confirm(`Delete “${workflow.name}” for ${clientLabel(selectedClient!)}`)) return;
    try {
      await deleteApprovalWorkflow(workflow.id);
      await refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete workflow.");
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Configuration / Client Portal</p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">Client Approval Workflow</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Configure approval rules for one client portal tenant. Only requests from the selected client are evaluated against these workflows.
          </p>
        </div>
        <button
          onClick={openNew}
          disabled={!selectedClient}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={16} /> New Client Workflow
        </button>
      </div>

      <div className="mb-5 rounded-xl border bg-card p-4 shadow-sm">
        <label className="block max-w-xl text-sm font-medium text-foreground">
          Select client
          <select
            value={selectedClientId}
            onChange={event => setSelectedClientId(event.target.value)}
            className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">Choose a client</option>
            {clients.map(client => <option key={client.id} value={client.id}>{clientLabel(client)}</option>)}
          </select>
        </label>
        {selectedClient && (
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><UsersRound size={14} /> {portalUsers.length} active portal users</span>
            <span>{workflows.filter(workflow => workflow.status === "Active").length} active workflow(s)</span>
            <span>{requests.filter(request => ["Pending", "In Progress", "Escalated"].includes(request.status)).length} pending request(s)</span>
          </div>
        )}
      </div>

      {error && <div className="mb-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {!selectedClient ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">Select a client to manage its portal workflow.</div>
      ) : loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border p-12 text-sm text-muted-foreground"><Loader2 className="animate-spin" size={16} /> Loading workflows…</div>
      ) : (
        <div className="space-y-5">
          <section className="rounded-xl border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div><h2 className="font-semibold text-foreground">Configured workflows</h2><p className="text-xs text-muted-foreground">Rules saved for {clientLabel(selectedClient)} only.</p></div>
              <button onClick={() => void refresh()} className="rounded-md border p-2 text-muted-foreground hover:bg-muted" title="Refresh"><RefreshCw size={15} /></button>
            </div>
            {workflows.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">No client workflow configured yet.</div>
            ) : (
              <div className="divide-y">
                {workflows.map(workflow => (
                  <div key={workflow.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium text-foreground">{workflow.name}</h3>
                        <span className={`rounded-full border px-2 py-0.5 text-xs ${statusClass(workflow.status)}`}>{workflow.status}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{workflow.module} · {workflow.trigger} · {workflow.levels.length} approval level(s)</p>
                      {workflow.description && <p className="mt-1 text-xs text-muted-foreground">{workflow.description}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => setSelectedWorkflow(workflow)} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted"><Eye size={14} /> View</button>
                      <button onClick={() => setBuilder({ workflow, editingId: workflow.id })} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted"><Edit3 size={14} /> Edit</button>
                      <button onClick={() => void updateStatus(workflow)} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted">{workflow.status === "Active" ? "Deactivate" : "Activate"}</button>
                      <button onClick={() => void duplicate(workflow)} className="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted">Duplicate</button>
                      <button onClick={() => void remove(workflow)} className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50"><Trash2 size={14} /> Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border bg-card shadow-sm">
            <div className="border-b px-4 py-3"><h2 className="font-semibold text-foreground">Client portal approval requests</h2><p className="text-xs text-muted-foreground">Requests created by this client’s portal orders.</p></div>
            {requests.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground"><CheckCircle2 className="mx-auto mb-2 text-emerald-500" size={20} />No approval requests for this client.</div>
            ) : (
              <div className="divide-y">
                {requests.map(request => (
                  <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div><p className="text-sm font-medium text-foreground">{request.reference || request.workflow}</p><p className="text-xs text-muted-foreground">{request.requestedByName} · {request.workflow}</p></div>
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${statusClass(request.status)}`}>{request.status}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {builder && selectedClient && (
        <ApprovalWorkflowBuilder
          initial={builder.workflow}
          editingId={builder.editingId}
          actor={user?.name || "System"}
          approverUsers={portalUsers.map(portalUser => ({ id: portalUser.id, name: portalUser.name, role: portalUser.role, status: portalUser.status }))}
          approverRoles={portalRoles}
          approverDepartments={portalDepartments}
          onClose={() => setBuilder(null)}
          onSaved={() => void refresh()}
        />
      )}
      {selectedWorkflow && <WorkflowDetailsDialog workflow={selectedWorkflow} onClose={() => setSelectedWorkflow(null)} />}
    </div>
  );
}