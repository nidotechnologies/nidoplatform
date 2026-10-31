import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { getServiceRequests, updateServiceRequest } from "@/lib/serviceRequestsStore";
import type { StoredServiceRequest } from "@/lib/serviceRequestsStore";
import { getPortalUsersByClient } from "@/lib/portalUserStore";
import { serviceRequestBelongsToPortalUser } from "@/lib/serviceRequestAccess";
import { WorkflowCheckpoint } from "@/components/workflow/WorkflowCheckpoint";
import { getServiceAllowedTransitions, getServiceNextAction } from "@/lib/serviceWorkflow";

type EditableValue = string | number | boolean;

interface EditDraft {
  itemAsset: string;
  assetTag: string;
  location: string;
  status: string;
  priority: string;
  nextAppointment: string;
  requestedBy: string;
  payloadValues: Record<string, EditableValue>;
}

const HIDDEN_PAYLOAD_FIELDS = new Set([
  "assignedDepartment",
  "assignedRole",
  "assignedTo",
  "assetTag",
  "autoAssigned",
  "client",
  "clientId",
  "location",
  "priority",
  "requestType",
  "status",
]);

const PRIORITIES = ["Low", "Medium", "High", "Critical"];
const DATE_FIELDS = new Set(["deliveryDate", "endDate", "prefDate", "purchaseDate", "requiredBy", "startDate"]);
const MULTILINE_FIELDS = new Set(["description", "issueDesc", "notes", "purpose", "reason"]);
const NUMBER_FIELDS = new Set(["quantity", "repeatEvery", "unitPrice"]);
const APPOINTMENT_FIELDS = ["deliveryDate", "prefDate", "requiredBy"] as const;

function editablePayloadValues(payload: Record<string, unknown> = {}): Record<string, EditableValue> {
  return Object.fromEntries(
    Object.entries(payload).filter(([key, value]) =>
      !HIDDEN_PAYLOAD_FIELDS.has(key)
      && (typeof value === "string" || typeof value === "number" || typeof value === "boolean"),
    ),
  ) as Record<string, EditableValue>;
}

function formatLabel(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (first) => first.toUpperCase());
}

function formatAppointmentDate(value: string): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function initialDraft(request: StoredServiceRequest | undefined): EditDraft | null {
  if (!request) return null;
  return {
    itemAsset: request.itemAsset === "—" ? "" : request.itemAsset,
    assetTag: request.assetTag ?? "",
    location: request.location === "—" ? "" : request.location,
    status: request.status || "Pending",
    priority: request.priority || "Medium",
    nextAppointment: request.nextAppointment === "—" ? "" : request.nextAppointment,
    requestedBy: request.requestedBy === "—" ? "" : request.requestedBy,
    payloadValues: editablePayloadValues(request.payload),
  };
}

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";
const labelClass = "mb-1 block text-sm font-medium text-gray-700";

export default function EditServiceRequestPage() {
  const { requestId = "" } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const { user, isClientPortalUser } = useAuth();
  const [request] = useState(() => getServiceRequests().find((item) => item.id === requestId));
  const [draft, setDraft] = useState<EditDraft | null>(() => initialDraft(request));
  const myServicesPath = isClientPortalUser ? "/portal/my-services" : "/my-services";
  const canEdit = !isClientPortalUser || Boolean(
    user
    && request
    && serviceRequestBelongsToPortalUser(
      request,
      user,
      user.clientId ? getPortalUsersByClient(user.clientId) : [],
    ),
  );

  if (!request || !draft || !canEdit) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="border-b border-gray-200 bg-white px-6 py-5">
          <button
            type="button"
            onClick={() => navigate(myServicesPath)}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" /> Back to My Services
          </button>
        </header>
        <main className="mx-auto max-w-4xl px-6 py-10">
          <section className="rounded-xl border border-gray-200 bg-white p-8 text-center">
            <h1 className="text-lg font-semibold text-gray-900">Request not found</h1>
            <p className="mt-2 text-sm text-gray-500">This service request is no longer available to edit.</p>
          </section>
        </main>
      </div>
    );
  }

  const updateDraft = <K extends keyof EditDraft>(key: K, value: EditDraft[K]) => {
    setDraft((current) => current ? { ...current, [key]: value } : current);
  };

  const updatePayloadValue = (key: string, value: EditableValue) => {
    setDraft((current) => current
      ? { ...current, payloadValues: { ...current.payloadValues, [key]: value } }
      : current);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      ...(request.payload ?? {}),
      ...draft.payloadValues,
      assetTag: draft.assetTag.trim(),
      location: draft.location.trim(),
      priority: draft.priority,
      status: draft.status,
    };
    const payloadItemName = typeof payload.itemName === "string" ? payload.itemName.trim() : "";
    const payloadBrandModel = [payload.brand, payload.model]
      .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
      .join(" ");
    const payloadCategory = typeof payload.category === "string" ? payload.category.trim() : "";
    const itemAsset = payloadItemName || payloadBrandModel || payloadCategory || draft.itemAsset.trim();
    const location = draft.location.trim();
    if (!itemAsset || !location) {
      toast.error("Item / Asset and Location are required.");
      return;
    }

    const changedAppointmentField = APPOINTMENT_FIELDS.find((key) =>
      Object.hasOwn(request.payload ?? {}, key)
      && request.payload?.[key] !== draft.payloadValues[key],
    );
    let nextAppointment = draft.nextAppointment.trim() || "—";
    if (changedAppointmentField) {
      const rawDate = draft.payloadValues[changedAppointmentField];
      if (typeof rawDate === "string" && rawDate.trim()) {
        nextAppointment = formatAppointmentDate(rawDate);
        if (changedAppointmentField === "prefDate") nextAppointment += "\n10:00 AM";
        if (changedAppointmentField === "deliveryDate" && typeof payload.timeSlot === "string" && payload.timeSlot) {
          nextAppointment += `\n${payload.timeSlot}`;
        }
      } else {
        nextAppointment = "—";
      }
    }
    const updated = updateServiceRequest(request.id, {
      itemAsset,
      assetTag: draft.assetTag.trim(),
      location,
      status: draft.status,
      priority: draft.priority,
      nextAppointment,
      requestedBy: draft.requestedBy.trim() || "—",
      payload,
    });

    if (!updated) {
      toast.error("This request is no longer available.");
      navigate(myServicesPath);
      return;
    }
    toast.success("Request updated.");
    navigate(myServicesPath);
  };

  const payloadFields = Object.entries(draft.payloadValues);
  const hasSpecificItemFields = ["itemName", "brand", "model"].some((key) =>
    typeof request.payload?.[key] === "string",
  );
  const currentClient = typeof request.payload?.client === "string"
    ? request.payload.client
    : typeof request.payload?.clientId === "string"
      ? request.payload.clientId
      : "";
  const attachments = Array.isArray(request.payload?.attachments)
    ? request.payload.attachments.filter((name): name is string => typeof name === "string")
    : [];
  const serviceOwner = String(
    (request.payload as Record<string, unknown> | undefined)?.assignedTo
      ?? (request.payload as Record<string, unknown> | undefined)?.assignedRole
      ?? "Not assigned",
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-5">
        <div className="mx-auto flex max-w-6xl items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Request</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Update the details for this {request.requestType.toLowerCase()} request.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(myServicesPath)}
            className="flex flex-shrink-0 items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <ListChecks className="h-4 w-4" /> My Services
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-6 py-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-5 text-base font-bold text-gray-800">Request ID</h2>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <label>
                <span className={labelClass}>Request ID</span>
                <input readOnly value={request.id} className={`${inputClass} cursor-not-allowed bg-gray-50 font-mono font-semibold`} />
              </label>
              <label>
                <span className={labelClass}>Request Type</span>
                <input readOnly value={request.requestType} className={`${inputClass} cursor-not-allowed bg-gray-50`} />
              </label>
              <label>
                <span className={labelClass}>Requested Date</span>
                <input readOnly value={request.requestDate || "—"} className={`${inputClass} cursor-not-allowed bg-gray-50`} />
              </label>
            </div>
          </section>

          <WorkflowCheckpoint
            title="Service workflow"
            status={draft.status}
            ownerLabel="Assigned specialist"
            owner={serviceOwner}
            nextAction={getServiceNextAction(draft.status)}
            note="Assignment is separate from completion. Resolved requires work evidence; Closed follows client or CRM acceptance. On Hold should include a reason and review date."
          />

          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-5 text-base font-bold text-gray-800">Request Details</h2>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {currentClient && (
                <label>
                  <span className={labelClass}>Client</span>
                  <input readOnly value={currentClient} className={`${inputClass} cursor-not-allowed bg-gray-50`} />
                </label>
              )}
              {!hasSpecificItemFields && (
                <label>
                  <span className={labelClass}>Item / Asset *</span>
                  <input required value={draft.itemAsset} onChange={(event) => updateDraft("itemAsset", event.target.value)} className={inputClass} />
                </label>
              )}
              <label>
                <span className={labelClass}>Asset Tag</span>
                <input value={draft.assetTag} onChange={(event) => updateDraft("assetTag", event.target.value)} className={inputClass} />
              </label>
              <label>
                <span className={labelClass}>Location *</span>
                <input required value={draft.location} onChange={(event) => updateDraft("location", event.target.value)} className={inputClass} />
              </label>
              <label>
                <span className={labelClass}>Status</span>
                <select value={draft.status} onChange={(event) => updateDraft("status", event.target.value)} className={inputClass}>
                  {Array.from(new Set([draft.status, ...getServiceAllowedTransitions(draft.status)])).filter(Boolean).map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className={labelClass}>Priority</span>
                <select value={draft.priority} onChange={(event) => updateDraft("priority", event.target.value)} className={inputClass}>
                  {Array.from(new Set([...PRIORITIES, draft.priority])).filter(Boolean).map((priority) => (
                    <option key={priority} value={priority}>{priority}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className={labelClass}>Requested By</span>
                <input value={draft.requestedBy} onChange={(event) => updateDraft("requestedBy", event.target.value)} className={inputClass} />
              </label>
              <label className="md:col-span-2 lg:col-span-3">
                <span className={labelClass}>Next Appointment</span>
                <textarea rows={2} value={draft.nextAppointment} onChange={(event) => updateDraft("nextAppointment", event.target.value)} className={inputClass} />
              </label>
            </div>
          </section>

          {payloadFields.length > 0 && (
            <section className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="mb-5 text-base font-bold text-gray-800">Service Details</h2>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {payloadFields.map(([key, value]) => {
                  const label = formatLabel(key);
                  const fieldId = `service-field-${key}`;
                  const dateInput = DATE_FIELDS.has(key)
                    && typeof value === "string"
                    && /^\d{4}-\d{2}-\d{2}$/.test(value);
                  const numberInput = NUMBER_FIELDS.has(key) || typeof value === "number";
                  const multiline = MULTILINE_FIELDS.has(key);
                  return (
                    <label key={key} htmlFor={fieldId} className={multiline ? "md:col-span-2 lg:col-span-3" : ""}>
                      <span className={labelClass}>{label}</span>
                      {typeof value === "boolean" ? (
                        <span className="flex min-h-10 items-center gap-2 text-sm text-gray-700">
                          <input
                            id={fieldId}
                            type="checkbox"
                            checked={value}
                            onChange={(event) => updatePayloadValue(key, event.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          {value ? "Yes" : "No"}
                        </span>
                      ) : multiline ? (
                        <textarea
                          id={fieldId}
                          rows={3}
                          value={String(value)}
                          onChange={(event) => updatePayloadValue(key, event.target.value)}
                          className={inputClass}
                        />
                      ) : (
                        <input
                          id={fieldId}
                          type={dateInput ? "date" : numberInput ? "number" : "text"}
                          value={String(value)}
                          onChange={(event) => updatePayloadValue(key, numberInput && event.target.value !== "" ? Number(event.target.value) : event.target.value)}
                          className={inputClass}
                        />
                      )}
                    </label>
                  );
                })}
              </div>
              {attachments.length > 0 && (
                <div className="mt-5">
                  <span className={labelClass}>Existing Attachments</span>
                  <ul className="flex flex-wrap gap-2">
                    {attachments.map((name, index) => (
                      <li key={`${name}-${index}`} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-600">
                        {name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          <div className="flex justify-end gap-3 pb-2">
            <button
              type="button"
              onClick={() => navigate(myServicesPath)}
              className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Save Changes
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
