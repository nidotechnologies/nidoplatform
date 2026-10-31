import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Activity, Archive, AlertTriangle, Check, ChevronDown, ChevronRight, Clock3,
  Copy, Edit3, Eye, History, Loader2, Plus, RefreshCw, Search, Settings2,
  ShieldCheck, Trash2, UsersRound, X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { getRoles, getUsers } from "@/lib/nidoUsersStore";
import {
  actOnApprovalRequest, deleteApprovalWorkflow, duplicateApprovalWorkflow,
  getApprovalRequest, getApprovalWorkflowHistory, loadApprovalBootstrap, saveApprovalWorkflow, setApprovalWorkflowStatus,
  type ApprovalCondition, type ApprovalLevel, type ApprovalRequest, type ApprovalWorkflow,
} from "@/lib/approvalEngine";

const MODULES = ["Client", "Vendor", "Catalogue", "Product", "Pricing", "Shop", "Order", "Procurement", "Purchase Order", "Stock", "Contract", "Finance", "User Management"];
const TRIGGERS: Record<string, string[]> = {
  Client: ["New client created", "Client profile changed", "Credit limit changed"],
  Vendor: ["New vendor created", "Vendor profile changed", "Vendor activated"],
  Catalogue: ["New product", "Product modification", "Product activation", "Product price change"],
  Product: ["New product", "Product modification", "Product activation", "Product price change"],
  Pricing: ["Client price change", "Margin below minimum", "Discount above permitted limit", "Manual price override"],
  Shop: ["Order created", "Order value exceeds threshold"],
  Order: ["Order created", "Order value exceeds threshold", "Order modified", "Order cancellation"],
  Procurement: ["Purchase requisition created", "Purchase requisition value exceeds threshold"],
  "Purchase Order": ["PO created", "PO value exceeds threshold", "Vendor changed", "PO modification"],
  Stock: ["Manual stock adjustment", "Stock transfer", "Stock correction", "Negative stock exception"],
  Contract: ["New contract", "Contract modification", "Contract renewal"],
  Finance: ["Payment approval", "Credit limit change", "Refund", "Financial adjustment"],
  "User Management": ["New user created", "User profile changed", "Role changed"],
};
const CONDITION_FIELDS = ["amount", "quantity", "percentage", "profitPct", "discountPct", "marginPct", "client", "clientCategory", "vendor", "productCategory", "department", "userRole", "stockQuantity", "contractValue", "paymentAmount", "creditLimit"];
const OPERATORS = [["equals", "Equals"], ["not_equals", "Not Equals"], ["greater_than", "Greater Than"], ["greater_or_equal", "Greater Than or Equal"], ["less_than", "Less Than"], ["less_or_equal", "Less Than or Equal"], ["between", "Between"], ["contains", "Contains"]];
const APPROVER_TYPES = ["Role", "Specific User", "Department", "Manager", "Reporting Manager"] as const;
const ACTIVE_USERS = () => getUsers().filter(user => user.status === "Active");
const DEPARTMENTS = () => Array.from(new Set(ACTIVE_USERS().map(user => user.department).filter(Boolean))).sort();
const APPROVAL_MODES = ["Sequential", "Parallel", "Any One", "All Required", "Majority"] as const;

const blankCondition = (): ApprovalCondition => ({ joinOperator: "AND", field: "amount", operator: "greater_than", value: "" });
const blankLevel = (n: number): ApprovalLevel => ({ levelNumber: n, approverType: "Role", approverRole: "System Admin", minimumApprovers: 1, approvalMode: "Sequential", slaHours: 24, escalationEnabled: false, escalationApprover: "", escalationAfterHours: 24 });
const blankWorkflow = (): Partial<ApprovalWorkflow> & { name: string; module: string; trigger: string } => ({ name: "", description: "", module: "Purchase Order", trigger: TRIGGERS["Purchase Order"][0], workflowType: "Standard", status: "Draft", conditions: [blankCondition()], levels: [blankLevel(1)] });

function money(value?: number | null) {
  return value == null ? "—" : `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}
function date(value?: string | null) {
  return value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";
}
function statusClass(status: string) {
  return status === "Active" || status === "Approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
    status === "Draft" ? "bg-slate-50 text-slate-600 border-slate-200" :
      status === "Rejected" ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200";
}
function Pill({ children }: { children: React.ReactNode }) { return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(String(children))}`}>{children}</span>; }
function Button({ children, onClick, variant = "primary", disabled = false, title }: any) {
  const styles = variant === "primary" ? "bg-primary text-primary-foreground hover:bg-primary/90" : variant === "danger" ? "border border-red-200 text-red-600 hover:bg-red-50" : "border border-border bg-background hover:bg-muted";
  return <button title={title} disabled={disabled} onClick={onClick} className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles}`}>{children}</button>;
}

function changeSummary(snapshot: any, previousSnapshot?: any) {
  if (!previousSnapshot) return ["Initial workflow configuration"];
  const changes: string[] = [];
  if (JSON.stringify(snapshot?.conditions || []) !== JSON.stringify(previousSnapshot?.conditions || [])) changes.push("Conditional rules updated");
  if (JSON.stringify(snapshot?.levels || []) !== JSON.stringify(previousSnapshot?.levels || [])) changes.push("Approval levels or approvers updated");
  return changes.length ? changes : ["Workflow version saved without rule changes"];
}

function WorkflowDetailsDialog({ workflow, onClose }: { workflow: ApprovalWorkflow; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl border bg-background shadow-2xl">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-6 py-4">
        <div><h2 className="text-lg font-semibold">{workflow.name}</h2><p className="text-sm text-muted-foreground">{workflow.description || "No description provided."}</p></div>
        <button onClick={onClose} className="rounded-md p-2 hover:bg-muted" aria-label="Close workflow details"><X size={18} /></button>
      </div>
      <div className="space-y-5 p-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[["Module", workflow.module], ["Trigger", workflow.trigger], ["Workflow Type", workflow.workflowType], ["Status", workflow.status]].map(([label, value]) => <div key={label} className="rounded-lg border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div>)}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-4"><p className="text-xs text-muted-foreground">Current version</p><p className="mt-1 text-lg font-semibold">v{workflow.currentVersion}</p><p className="mt-1 text-xs text-muted-foreground">Updated {date(workflow.updatedAt)} by {workflow.updatedBy || "—"}</p></div>
          <div className="rounded-lg border p-4"><p className="text-xs text-muted-foreground">Created</p><p className="mt-1 text-sm font-medium">{date(workflow.createdAt)}</p><p className="mt-1 text-xs text-muted-foreground">By {workflow.createdBy || "—"}</p></div>
        </div>
        <div><h3 className="mb-3 font-semibold">Conditional rules</h3><div className="space-y-2">{workflow.conditions.length ? workflow.conditions.map((condition, index) => <div key={index} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm"><span className="rounded bg-muted px-2 py-1 text-xs font-semibold">{index === 0 ? "IF" : condition.joinOperator}</span><span className="font-medium">{condition.field}</span><span className="text-muted-foreground">{OPERATORS.find(([value]) => value === condition.operator)?.[1] || condition.operator}</span><span>{Array.isArray(condition.value) ? condition.value.join(" — ") : String(condition.value || "—")}</span></div>) : <p className="rounded-lg border p-4 text-sm text-muted-foreground">No conditions configured; this workflow applies to every matching trigger.</p>}</div></div>
        <div><h3 className="mb-3 font-semibold">Approval levels</h3><div className="space-y-3">{workflow.levels.map((level, index) => <div key={index} className="rounded-lg border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">Level {level.levelNumber}</p><Pill>{level.approvalMode}</Pill></div><div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><div><p className="text-xs text-muted-foreground">Approver</p><p className="font-medium">{level.approverRole || level.specificUserId || level.approverType}</p></div><div><p className="text-xs text-muted-foreground">Minimum approvers</p><p className="font-medium">{level.minimumApprovers}</p></div><div><p className="text-xs text-muted-foreground">SLA</p><p className="font-medium">{level.slaHours} hours</p></div><div><p className="text-xs text-muted-foreground">Escalation</p><p className="font-medium">{level.escalationEnabled ? `${level.escalationAfterHours || "—"} hours → ${level.escalationApprover || "Configured approver"}` : "Disabled"}</p></div></div></div>)}</div></div>
      </div>
      <div className="flex justify-end border-t bg-muted/20 px-6 py-4"><Button variant="secondary" onClick={onClose}>Close</Button></div>
    </div>
  </div>;
}

export function ApprovalWorkflowBuilder({
  initial,
  editingId,
  actor,
  onClose,
  onSaved,
  approverUsers,
  approverRoles,
  approverDepartments,
}: {
  initial: any;
  editingId?: string;
  actor: string;
  onClose: () => void;
  onSaved: () => void;
  approverUsers?: Array<{ id: string; name: string; role?: string; status?: string }>;
  approverRoles?: string[];
  approverDepartments?: string[];
}) {
  const [form, setForm] = useState<any>({ ...blankWorkflow(), ...initial, conditions: initial.conditions?.length ? initial.conditions : [blankCondition()], levels: initial.levels?.length ? initial.levels : [blankLevel(1)] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const availableUsers = approverUsers?.length ? approverUsers : ACTIVE_USERS();
  const availableRoles = approverRoles?.length ? approverRoles : getRoles().filter(r => r.status === "Active").map(r => r.name);
  const availableDepartments = approverDepartments?.length ? approverDepartments : DEPARTMENTS();
  const update = (key: string, value: any) => setForm((v: any) => ({ ...v, [key]: value }));
  const moduleTriggers = TRIGGERS[form.module] || ["Manual submission"];
  const save = async () => {
    if (!form.name.trim()) return setError("Workflow name is required.");
    setSaving(true); setError("");
    try { await saveApprovalWorkflow({ ...form, updatedBy: actor, createdBy: actor }, editingId); onSaved(); onClose(); }
    catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl border bg-background shadow-2xl">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-6 py-4"><div><h2 className="text-lg font-semibold">{editingId ? "Edit Workflow" : "Create Workflow"}</h2><p className="text-sm text-muted-foreground">Configure rules centrally for the selected NIDO module.</p></div><button onClick={onClose} className="rounded-md p-2 hover:bg-muted"><X size={18} /></button></div>
      <div className="space-y-6 p-6">
        <section><h3 className="mb-3 font-semibold">1. Basic Information</h3><div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">Workflow Name<input autoFocus value={form.name} onChange={e => update("name", e.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2" placeholder="e.g. Purchase Order Approval" /></label>
          <label className="text-sm">Module<select value={form.module} onChange={e => { update("module", e.target.value); update("trigger", TRIGGERS[e.target.value]?.[0] || "Manual submission"); }} className="mt-1 w-full rounded-md border bg-background px-3 py-2">{MODULES.map(m => <option key={m}>{m}</option>)}</select></label>
          <label className="text-sm">Trigger<select value={form.trigger} onChange={e => update("trigger", e.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2">{moduleTriggers.map(t => <option key={t}>{t}</option>)}</select></label>
          <label className="text-sm">Workflow Type<select value={form.workflowType} onChange={e => update("workflowType", e.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2"><option>Standard</option><option>Exception</option><option>Threshold</option></select></label>
           <label className="text-sm">Status<select value={form.status || "Draft"} onChange={e => update("status", e.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2"><option>Draft</option><option>Active</option><option>Inactive</option></select></label>
           <label className="text-sm md:col-span-2">Description<textarea rows={2} value={form.description} onChange={e => update("description", e.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2" /></label>
        </div></section>
        <section><div className="mb-3 flex items-center justify-between"><div><h3 className="font-semibold">2. Conditional Rules</h3><p className="text-sm text-muted-foreground">Approval starts only when the configured expression matches.</p></div><Button variant="secondary" onClick={() => update("conditions", [...form.conditions, blankCondition()])}><Plus size={15} /> Add condition</Button></div>
          <div className="space-y-2">{form.conditions.map((condition: ApprovalCondition, index: number) => <div key={index} className="grid gap-2 rounded-lg border p-3 md:grid-cols-[80px_1fr_1fr_1fr_auto]">
            <select disabled={index === 0} value={condition.joinOperator} onChange={e => update("conditions", form.conditions.map((c: any, i: number) => i === index ? { ...c, joinOperator: e.target.value } : c))} className="rounded-md border bg-background px-2 py-2 text-sm"><option>AND</option><option>OR</option></select>
            <select value={condition.field} onChange={e => update("conditions", form.conditions.map((c: any, i: number) => i === index ? { ...c, field: e.target.value } : c))} className="rounded-md border bg-background px-2 py-2 text-sm">{CONDITION_FIELDS.map(f => <option key={f} value={f}>{f}</option>)}</select>
            <select value={condition.operator} onChange={e => update("conditions", form.conditions.map((c: any, i: number) => i === index ? { ...c, operator: e.target.value } : c))} className="rounded-md border bg-background px-2 py-2 text-sm">{OPERATORS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <input value={Array.isArray(condition.value) ? condition.value.join(",") : condition.value} onChange={e => update("conditions", form.conditions.map((c: any, i: number) => i === index ? { ...c, value: c.operator === "between" ? e.target.value.split(",") : e.target.value } : c))} className="rounded-md border bg-background px-2 py-2 text-sm" placeholder={condition.operator === "between" ? "min,max" : "Value"} />
            <button disabled={form.conditions.length === 1} onClick={() => update("conditions", form.conditions.filter((_: any, i: number) => i !== index))} className="rounded-md p-2 text-red-600 hover:bg-red-50 disabled:opacity-30"><Trash2 size={16} /></button>
          </div>)}</div>
        </section>
        <section><div className="mb-3 flex items-center justify-between"><div><h3 className="font-semibold">3. Approval Levels</h3><p className="text-sm text-muted-foreground">Levels are stored with this workflow version.</p></div><Button variant="secondary" onClick={() => update("levels", [...form.levels, blankLevel(form.levels.length + 1)])}><Plus size={15} /> Add level</Button></div>
           <div className="space-y-3">{form.levels.map((level: ApprovalLevel, index: number) => <div key={index} className="rounded-lg border p-4"><div className="mb-3 flex items-center justify-between"><span className="font-medium">Level {index + 1}</span><button disabled={form.levels.length === 1} onClick={() => update("levels", form.levels.filter((_: any, i: number) => i !== index).map((l: any, i: number) => ({ ...l, levelNumber: i + 1 })))} className="text-red-600 disabled:opacity-30"><Trash2 size={16} /></button></div><div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
             <label className="text-sm">Approver Type<select value={level.approverType} onChange={e => update("levels", form.levels.map((l: any, i: number) => i === index ? { ...l, approverType: e.target.value, approverRole: "", specificUserId: "" } : l))} className="mt-1 w-full rounded-md border bg-background px-2 py-2">{APPROVER_TYPES.map(v => <option key={v}>{v}</option>)}</select></label>
             <label className="text-sm">{level.approverType === "Role" ? "Approver Role" : level.approverType === "Specific User" ? "Specific User" : level.approverType === "Department" ? "Department" : "Manager Rule"}<select value={level.approverType === "Specific User" ? level.specificUserId || "" : level.approverRole || ""} onChange={e => update("levels", form.levels.map((l: any, i: number) => i === index ? (level.approverType === "Specific User" ? { ...l, specificUserId: e.target.value } : { ...l, approverRole: e.target.value }) : l))} className="mt-1 w-full rounded-md border bg-background px-2 py-2">
                {level.approverType === "Role" && availableRoles.map(role => <option key={role} value={role}>{role}</option>)}
                {level.approverType === "Specific User" && availableUsers.map(u => <option key={u.id} value={u.id}>{u.name} · {u.role || "Portal user"}</option>)}
                {level.approverType === "Department" && availableDepartments.map(department => <option key={department} value={department}>{department}</option>)}
               {(level.approverType === "Manager" || level.approverType === "Reporting Manager") && <option value="requester_manager">{level.approverType === "Manager" ? "Requester’s manager" : "Requester’s reporting manager"}</option>}
             </select></label>
             <label className="text-sm">Minimum Approvers<input type="number" min={1} value={level.minimumApprovers || 1} onChange={e => update("levels", form.levels.map((l: any, i: number) => i === index ? { ...l, minimumApprovers: Math.max(1, Number(e.target.value)) } : l))} className="mt-1 w-full rounded-md border bg-background px-2 py-2" /></label>
             <label className="text-sm">Approval Mode<select value={level.approvalMode} onChange={e => update("levels", form.levels.map((l: any, i: number) => i === index ? { ...l, approvalMode: e.target.value } : l))} className="mt-1 w-full rounded-md border bg-background px-2 py-2">{APPROVAL_MODES.map(v => <option key={v}>{v}</option>)}</select></label>
             <label className="text-sm">SLA (hours)<input type="number" min={1} value={level.slaHours} onChange={e => update("levels", form.levels.map((l: any, i: number) => i === index ? { ...l, slaHours: Number(e.target.value) } : l))} className="mt-1 w-full rounded-md border bg-background px-2 py-2" /></label>
           </div><div className="mt-3 flex flex-wrap items-center gap-2 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={level.escalationEnabled} onChange={e => update("levels", form.levels.map((l: any, i: number) => i === index ? { ...l, escalationEnabled: e.target.checked } : l))} /> Enable escalation after</label><input type="number" min={1} value={level.escalationAfterHours || 24} onChange={e => update("levels", form.levels.map((l: any, i: number) => i === index ? { ...l, escalationAfterHours: Number(e.target.value) } : l))} className="w-20 rounded-md border bg-background px-2 py-1" /><span>hours</span>{level.escalationEnabled && <><span className="text-muted-foreground">to</span><select value={level.escalationApprover || ""} onChange={e => update("levels", form.levels.map((l: any, i: number) => i === index ? { ...l, escalationApprover: e.target.value } : l))} className="rounded-md border bg-background px-2 py-1"><option value="">Select escalation approver</option>{getRoles().filter(r => r.status === "Active").map(r => <option key={r.id} value={r.name}>{r.name}</option>)}</select></>}</div></div>)}</div>
        </section>
        {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 border-t bg-muted/20 px-6 py-4"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={saving} onClick={save}>{saving && <Loader2 className="animate-spin" size={15} />} Save Workflow</Button></div>
    </div>
  </div>;
}

export { WorkflowDetailsDialog };

function RequestDialog({ request, onClose, onChanged, actor }: { request: ApprovalRequest; onClose: () => void; onChanged: () => void; actor: any }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const act = async (action: string) => {
    const comment = ["reject", "send_back", "request_changes", "delegate", "reassign"].includes(action) ? window.prompt("Reason (required)") || "" : "";
    if (["reject", "send_back", "request_changes"].includes(action) && !comment.trim()) return;
    const targetUserId = ["delegate", "reassign"].includes(action) ? window.prompt("Target NIDO user ID (required)") || "" : "";
    if (["delegate", "reassign"].includes(action) && !targetUserId.trim()) return;
    setBusy(true); setError("");
    try { await actOnApprovalRequest(request.id, { action, comment, targetUserId, userId: actor.id, userName: actor.name, userRole: actor.role }); onChanged(); onClose(); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border bg-background shadow-2xl"><div className="flex items-center justify-between border-b px-6 py-4"><div><h2 className="font-semibold">{request.reference || request.workflow}</h2><p className="text-sm text-muted-foreground">{request.id} · Workflow version {request.workflowVersion}</p></div><button onClick={onClose}><X size={18} /></button></div><div className="space-y-5 p-6">
    <div className="grid gap-3 rounded-lg bg-muted/30 p-4 text-sm md:grid-cols-3"><div><span className="text-muted-foreground">Module</span><p className="font-medium">{request.module}</p></div><div><span className="text-muted-foreground">Requested by</span><p className="font-medium">{request.requestedByName}</p></div><div><span className="text-muted-foreground">Value</span><p className="font-medium">{money(request.amount)}</p></div></div>
    <div><h3 className="mb-3 font-semibold">Approval timeline</h3><div className="space-y-3">{(request.timeline || []).map((entry: any, i: number) => <div key={entry.id || i} className="flex gap-3"><div className="mt-1 rounded-full bg-primary/10 p-1 text-primary"><Activity size={13} /></div><div><p className="text-sm font-medium">{entry.action.replaceAll("_", " ")} <span className="font-normal text-muted-foreground">by {entry.user_name}</span></p><p className="text-xs text-muted-foreground">{date(entry.created_at)}{entry.comment ? ` · ${entry.comment}` : ""}</p></div></div>)}</div></div>
    {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
   </div><div className="flex flex-wrap justify-end gap-2 border-t px-6 py-4">{request.status !== "Approved" && request.status !== "Rejected" && <><Button variant="secondary" disabled={busy} onClick={() => act("send_back")}>Send Back</Button>{actor.role && <><Button variant="secondary" disabled={busy} onClick={() => act("request_changes")}>Request Changes</Button><Button variant="secondary" disabled={busy} onClick={() => act("delegate")}>Delegate</Button><Button variant="secondary" disabled={busy} onClick={() => act("reassign")}>Reassign</Button></>}<Button variant="danger" disabled={busy} onClick={() => act("reject")}>Reject</Button><Button disabled={busy} onClick={() => act("approve")}><Check size={15} /> Approve</Button></>}</div></div></div>;
}

export default function ApprovalWorkflowsPage() {
  const location = useLocation();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const canView = hasPermission("approvals", "view");
  const canManage = hasPermission("approvals", "manage") || hasPermission("approvals", "configure") || hasPermission("approvals", "create");
  const actor = { id: user?.id || "system", name: user?.name || "System", role: user?.role || "System Owner" };
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([]);
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [tab, setTab] = useState("Workflows");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [builder, setBuilder] = useState<any>(null); const [editingId, setEditingId] = useState<string>();
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<ApprovalWorkflow | null>(null);
  const [historyWorkflow, setHistoryWorkflow] = useState<ApprovalWorkflow | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const refresh = async () => {
    setLoading(true); setError("");
    try { const data = await loadApprovalBootstrap(); setWorkflows(data.workflows); setRequests(data.requests); setStats(data.stats || {}); }
    catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    const requestId = new URLSearchParams(location.search).get("request");
    if (!requestId || loading) return;
    getApprovalRequest(requestId).then((request) => {
      setSelectedRequest(request);
      setTab("Approval Requests");
    }).catch(() => undefined);
  }, [location.search, loading]);
  const shownWorkflows = useMemo(() => workflows.filter(w => !search || `${w.name} ${w.module} ${w.trigger}`.toLowerCase().includes(search.toLowerCase())), [workflows, search]);
  const shownRequests = useMemo(() => requests.filter(r => !search || `${r.id} ${r.workflow} ${r.reference} ${r.module}`.toLowerCase().includes(search.toLowerCase())), [requests, search]);
  const mutate = async (fn: () => Promise<any>) => { try { await fn(); await refresh(); } catch (e: any) { setError(e.message); } };
  const toggleAll = () => {
    const target = workflows.some(w => w.status === "Active") ? "Inactive" : "Active";
    if (!window.confirm(`${target === "Active" ? "Activate" : "Deactivate"} all eligible workflows?`)) return;
    mutate(async () => { await Promise.all(workflows.filter(w => w.status !== "Draft").map(w => setApprovalWorkflowStatus(w.id, target as any, actor.name))); });
  };
  const openHistory = async (workflow: ApprovalWorkflow) => { setHistoryWorkflow(workflow); try { setHistory(await getApprovalWorkflowHistory(workflow.id)); } catch { setHistory([]); } };
  if (!canView) return <div className="p-8"><h1 className="text-2xl font-bold">Approval Workflow</h1><p className="mt-2 text-muted-foreground">You do not have permission to view approval workflows.</p></div>;
  const statCards = [["Total Workflows", stats.total_workflows], ["Active Workflows", stats.active_workflows], ["Draft Workflows", stats.draft_workflows], ["Pending Approvals", stats.pending_approvals], ["Completed Approvals", stats.completed_approvals], ["Rejected Approvals", stats.rejected_approvals]];
  const pendingRequests = requests.filter(request => ["Pending", "In Progress", "Escalated"].includes(request.status));
  const overdueRequests = pendingRequests.filter(request => request.dueAt && new Date(request.dueAt).getTime() < Date.now());
  const myPendingRequests = pendingRequests.filter(request => [actor.id, actor.name, actor.role].includes(request.currentApprover));
  const pendingCards = [
    ["My Pending Approvals", myPendingRequests.length, UsersRound],
    ["Total Pending", pendingRequests.length, Clock3],
    ["Overdue", overdueRequests.length, AlertTriangle],
    ["Escalated", requests.filter(request => request.status === "Escalated").length, ShieldCheck],
  ] as const;
  return <div className="space-y-6 p-2 pb-10">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-3xl font-bold tracking-tight">Approval Workflow</h1><p className="text-muted-foreground">Configure and manage approval rules used across the NIDO platform.</p></div><div className="flex gap-2">{canManage && <Button variant="secondary" onClick={toggleAll}><ShieldCheck size={15} /> {workflows.some(w => w.status === "Active") ? "Disable All" : "Enable All"}</Button>}{canManage && <Button onClick={() => { setEditingId(undefined); setBuilder(blankWorkflow()); }}><Plus size={16} /> Create Workflow</Button>}</div></div>
    {error && <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><span>{error}</span><Button variant="secondary" onClick={refresh}><RefreshCw size={14} /> Retry</Button></div>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{statCards.map(([label, value]) => <div key={String(label)} className="rounded-xl border bg-card p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold">{loading ? "—" : String(value ?? 0)}</p></div>)}</div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b"><div className="flex gap-5 overflow-x-auto">{["Workflows", "Approval Requests", "Pending Approvals", "History", "Settings"].map(t => <button key={t} onClick={() => setTab(t)} className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>{t}</button>)}</div><div className="relative mb-2"><Search className="absolute left-2.5 top-2.5 text-muted-foreground" size={15} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-56 rounded-md border bg-background py-2 pl-8 pr-3 text-sm" /></div></div>
     {tab === "Workflows" && <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[1160px] text-sm"><thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground"><tr>{["Workflow Name", "Module", "Trigger", "Approval Type", "Levels", "Version", "Status", "Last Updated", "Updated By", "Actions"].map(h => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody>{shownWorkflows.map(w => <tr key={w.id} className="border-t"><td className="px-4 py-3"><div className="font-medium">{w.name}</div><div className="text-xs text-muted-foreground">{w.description}</div></td><td className="px-4 py-3">{w.module}</td><td className="px-4 py-3">{w.trigger}</td><td className="px-4 py-3">{w.workflowType}</td><td className="px-4 py-3">{w.levels.length}</td><td className="px-4 py-3">v{w.currentVersion}</td><td className="px-4 py-3"><Pill>{w.status}</Pill></td><td className="px-4 py-3 text-muted-foreground">{date(w.updatedAt)}</td><td className="px-4 py-3">{w.updatedBy || "—"}</td><td className="px-4 py-3"><div className="flex gap-1"><Button variant="secondary" title="View" onClick={() => setSelectedWorkflow(w)}><Eye size={14} /></Button><Button variant="secondary" title="Edit" onClick={() => { setEditingId(w.id); setBuilder(w); }}><Edit3 size={14} /></Button><Button variant="secondary" title={w.status === "Active" ? "Deactivate" : "Activate"} onClick={() => mutate(() => setApprovalWorkflowStatus(w.id, w.status === "Active" ? "Inactive" : "Active", actor.name))}>{w.status === "Active" ? <Archive size={14} /> : <Check size={14} />}</Button><Button variant="secondary" title="Duplicate" onClick={() => mutate(() => duplicateApprovalWorkflow(w.id, actor.name))}><Copy size={14} /></Button><Button variant="secondary" title="Version history" onClick={() => openHistory(w)}><History size={14} /></Button>{canManage && <Button variant="danger" title="Delete" onClick={() => window.confirm("Delete this workflow? Active requests prevent deletion.") && mutate(() => deleteApprovalWorkflow(w.id))}><Trash2 size={14} /></Button>}</div></td></tr>)}</tbody></table>{!loading && shownWorkflows.length === 0 && <div className="p-10 text-center text-sm text-muted-foreground">No workflows have been configured yet.</div>}</div>}
     {(tab === "Approval Requests" || tab === "Pending Approvals") && <>{tab === "Pending Approvals" && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{pendingCards.map(([label, value, Icon]) => <div key={label} className="rounded-xl border bg-card p-4"><div className="flex items-center justify-between"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><Icon size={17} className="text-primary" /></div><p className="mt-2 text-2xl font-bold">{value}</p></div>)}</div>}<div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[1060px] text-sm"><thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground"><tr>{["Request ID", "Workflow", "Module", "Reference", "Requested By", "Current Approver", "Level", "Amount", "Status", "Created", "Due Date", "Actions"].map(h => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody>{shownRequests.filter(r => tab === "Approval Requests" || ["Pending", "In Progress", "Escalated"].includes(r.status)).map(r => <tr key={r.id} className="border-t"><td className="px-4 py-3 font-medium">{r.id}</td><td className="px-4 py-3">{r.workflow}</td><td className="px-4 py-3">{r.module}</td><td className="px-4 py-3">{r.reference || "—"}</td><td className="px-4 py-3">{r.requestedByName}</td><td className="px-4 py-3">{r.currentApprover}</td><td className="px-4 py-3">{r.currentLevel}</td><td className="px-4 py-3">{money(r.amount)}</td><td className="px-4 py-3"><Pill>{r.status}</Pill></td><td className="px-4 py-3 text-muted-foreground">{date(r.createdAt)}</td><td className={`px-4 py-3 ${r.dueAt && new Date(r.dueAt).getTime() < Date.now() ? "font-medium text-red-600" : "text-muted-foreground"}`}>{date(r.dueAt)}</td><td className="px-4 py-3"><Button onClick={() => getApprovalRequest(r.id).then(setSelectedRequest).catch(() => setSelectedRequest(r))}>Review</Button></td></tr>)}</tbody></table>{shownRequests.filter(r => tab === "Approval Requests" || ["Pending", "In Progress", "Escalated"].includes(r.status)).length === 0 && <div className="p-10 text-center text-sm text-muted-foreground">No approval requests found.</div>}</div></>}
     {tab === "History" && <div className="space-y-3">{historyWorkflow && <div className="rounded-xl border bg-muted/20 p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Selected workflow</p><p className="mt-1 font-semibold">{historyWorkflow.name}</p><p className="text-sm text-muted-foreground">{historyWorkflow.module} · Current version v{historyWorkflow.currentVersion}</p></div>}{history.length ? history.map((h, index) => <div key={h.version} className="rounded-lg border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">Version {h.version}</p><p className="text-sm text-muted-foreground">Changed by {h.changed_by} · {date(h.date)}</p></div><Pill>{h.status}</Pill></div><div className="mt-3 flex flex-wrap gap-2">{changeSummary(h.snapshot, history[index + 1]?.snapshot).map(change => <span key={change} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{change}</span>)}</div></div>) : <div className="rounded-xl border p-10 text-center text-sm text-muted-foreground">Select a workflow’s history action to view versions.</div>}</div>}
    {tab === "Settings" && <div className="rounded-xl border p-6"><div className="flex items-start gap-3"><Settings2 className="mt-1 text-primary" /><div><h2 className="font-semibold">Central approval settings</h2><p className="mt-1 text-sm text-muted-foreground">Workflow configuration is centralized here. Modules should submit matching transactions to the approval engine and display the resulting request status.</p><p className="mt-3 text-sm text-muted-foreground">Active workflows execute only when their module, trigger, and conditions match. Existing requests retain their workflow version.</p></div></div></div>}
     {builder && <ApprovalWorkflowBuilder initial={builder} editingId={editingId} actor={actor.name} onClose={() => setBuilder(null)} onSaved={refresh} />}
     {selectedWorkflow && <WorkflowDetailsDialog workflow={selectedWorkflow} onClose={() => setSelectedWorkflow(null)} />}
    {selectedRequest && <RequestDialog request={selectedRequest} actor={actor} onClose={() => setSelectedRequest(null)} onChanged={refresh} />}
  </div>;
}