import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, Clock3, Loader2, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getPortalUsersByClient } from "@/lib/portalUserStore";
import {
  actOnApprovalRequest,
  loadApprovalBootstrap,
  type ApprovalRequest,
} from "@/lib/approvalEngine";

const PENDING_STATUSES = ["Pending", "In Progress", "Escalated"];

function statusClass(status: string) {
  if (status === "Approved") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "Rejected") return "bg-red-50 text-red-700 border-red-200";
  if (status === "Sent Back") return "bg-orange-50 text-orange-700 border-orange-200";
  return "bg-blue-50 text-blue-700 border-blue-200";
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

export default function ClientPortalApprovalsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const refresh = async () => {
    if (!user?.clientId) {
      setRequests([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await loadApprovalBootstrap();
      setRequests(data.requests.filter(request => request.clientId === user.clientId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load approvals.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    const onApprovalChange = () => void refresh();
    window.addEventListener("approvalStoreUpdated", onApprovalChange);
    window.addEventListener("storage", onApprovalChange);
    return () => {
      window.removeEventListener("approvalStoreUpdated", onApprovalChange);
      window.removeEventListener("storage", onApprovalChange);
    };
  }, [user?.clientId]);

  const portalProfile = user?.clientId
    ? getPortalUsersByClient(user.clientId).find(portalUser => portalUser.id === user.id)
    : undefined;

  const assignedRequests = useMemo(() => requests.filter(request => {
    if (!PENDING_STATUSES.includes(request.status)) return false;
    const currentApprover = String(request.currentApprover || "");
    const currentStep = request.steps?.find(step => Number(step.level_number) === Number(request.currentLevel));
    return user?.userType === "client_admin"
      || currentApprover === user?.id
      || currentApprover === user?.name
      || currentApprover === user?.role
      || currentApprover === user?.clientId
      || currentStep?.approver_role === user?.role
      || currentStep?.approver_role === portalProfile?.department
      || (request.approverType === "Department" && currentApprover === portalProfile?.department);
  }), [requests, user]);

  const act = async (request: ApprovalRequest, action: "approve" | "reject") => {
    if (!user || busyId) return;
    const comment = action === "reject"
      ? window.prompt("Reason for rejecting this request") || ""
      : "";
    if (action === "reject" && !comment.trim()) return;
    setBusyId(request.id);
    setError("");
    try {
      await actOnApprovalRequest(request.id, {
        action,
        comment,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        userDepartment: portalProfile?.department || "",
        userType: user.userType,
        clientId: user.clientId,
      });
      await refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to update approval.");
    } finally {
      setBusyId("");
    }
  };

  const history = requests.filter(request => !PENDING_STATUSES.includes(request.status));

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="mb-8 border-b border-gray-200/70 pb-4">
        <p className="text-xs text-gray-500">Portal / Approvals</p>
        <h1 className="text-2xl font-bold">My Approvals</h1>
        <p className="text-sm text-gray-500">Review requests assigned to your client portal account.</p>
      </div>

      {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border p-12 text-sm text-gray-500">
          <Loader2 size={18} className="animate-spin" /> Loading approvals…
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-xl border border-gray-200">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="font-semibold text-gray-900">Requests requiring your approval</h2>
                <p className="text-xs text-gray-500">Orders created through your client portal.</p>
              </div>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{assignedRequests.length} pending</span>
            </div>
            {assignedRequests.length === 0 ? (
              <div className="flex flex-col items-center p-12 text-center">
                <CheckCircle2 className="mb-3 text-emerald-500" size={28} />
                <p className="font-medium text-gray-700">No pending approvals</p>
                <p className="mt-1 text-sm text-gray-500">New requests assigned to you will appear here.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {assignedRequests.map(request => (
                  <div key={request.id} className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex gap-3">
                        <ClipboardCheck className="mt-0.5 text-blue-600" size={20} />
                        <div>
                          <p className="font-medium text-gray-900">{request.reference || request.workflow}</p>
                          <p className="mt-1 text-xs text-gray-500">{request.workflow} · Submitted by {request.requestedByName}</p>
                          <p className="mt-1 text-xs text-gray-400">{formatDate(request.createdAt)} · Level {request.currentLevel}</p>
                        </div>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(request.status)}`}>{request.status}</span>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-gray-50 px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock3 size={15} />
                        {request.amount != null ? `Amount: ₹${request.amount.toLocaleString("en-IN")}` : "Approval requested"}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busyId === request.id}
                          onClick={() => void act(request, "reject")}
                          className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          <XCircle size={14} /> Reject
                        </button>
                        <button
                          type="button"
                          disabled={busyId === request.id}
                          onClick={() => void act(request, "approve")}
                          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {busyId === request.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Approve
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {history.length > 0 && (
            <section className="rounded-xl border border-gray-200">
              <div className="border-b border-gray-200 px-5 py-4">
                <h2 className="font-semibold text-gray-900">Approval history</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {history.map(request => (
                  <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{request.reference || request.workflow}</p>
                      <p className="text-xs text-gray-500">{request.workflow} · {formatDate(request.createdAt)}</p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(request.status)}`}>{request.status}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}