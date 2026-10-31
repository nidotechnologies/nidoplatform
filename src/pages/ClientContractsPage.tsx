import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  RefreshCw,
  Bell,
  Scale,
  PenLine,
  CheckCircle2,
  IndianRupee,
  Receipt,
  ShieldCheck,
  FileText,
  ChevronRight,
  MoreVertical,
  Download,
  Database,
  Cloud,
  Users,
  Lock,
  FileX,
  Headphones,
  Archive,
  Mail,
  Phone,
  X,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  getClientContract,
  getClientContracts,
  saveClientContract,
} from "@/lib/clientDataStore";
import { getClients } from "@/lib/clientStore";
import { useAuth } from "@/contexts/AuthContext";
import ClientContractsList from "@/pages/ClientContractsList";

interface ContractDetailViewProps {
  contractId: string;
  contractTitle: string;
  clientId?: string;
  clientName?: string;
  clientContactName?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientGstin?: string;
  clientAddress?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  clientCurrency?: string;
  clientPaymentTerms?: string;
  clientStatus?: string;
  readOnly?: boolean;
  editOnOpen?: boolean;
  onBack: () => void;
}

interface FieldConfig {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "date";
  options?: string[];
  optionLabels?: Record<string, string>;
  placeholder?: string;
}

interface RowEditorConfig {
  initialRowCount: number;
  makeRowFields: (rowIndex: number) => FieldConfig[];
  addButtonLabel?: string;
}

interface EditModalProps {
  title: string;
  fields: FieldConfig[];
  currentValues: Record<string, string>;
  onSave: (values: Record<string, string>, rowCount?: number) => void;
  onClose: () => void;
  rowEditor?: RowEditorConfig;
}

function EditModal({ title, fields, currentValues, onSave, onClose, rowEditor }: EditModalProps) {
  const [values, setValues] = useState<Record<string, string>>(currentValues);
  const [visibleFields, setVisibleFields] = useState(fields);
  const [rowCount, setRowCount] = useState(rowEditor?.initialRowCount || 0);

  const addRow = () => {
    if (!rowEditor) return;
    const newFields = rowEditor.makeRowFields(rowCount);
    setVisibleFields((current) => [...current, ...newFields]);
    setValues((current) => ({
      ...current,
      ...Object.fromEntries(newFields.map((field) => [field.key, ""])),
    }));
    setRowCount((current) => current + 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4" onClick={onClose}>
      <div
        className="my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {visibleFields.map((field) => (
            <div key={field.key} className="space-y-1">
              <label htmlFor={`contract-edit-${field.key}`} className="block text-xs font-medium text-gray-700">{field.label}</label>
              {field.type === "text" && (
                <input
                  id={`contract-edit-${field.key}`}
                  type="text"
                  value={values[field.key] ?? ""}
                  onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                  className="w-full text-sm px-2 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
              {field.type === "date" && (
                <input
                  id={`contract-edit-${field.key}`}
                  type="date"
                  value={values[field.key] ?? ""}
                  onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                  className="w-full text-sm px-2 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
              {field.type === "textarea" && (
                <textarea
                  id={`contract-edit-${field.key}`}
                  value={values[field.key] ?? ""}
                  onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                  rows={3}
                  className="w-full text-sm px-2 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
              {field.type === "select" && field.options && (
                <select
                  id={`contract-edit-${field.key}`}
                  value={values[field.key] ?? ""}
                  onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                  className="w-full text-sm px-2 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {field.placeholder && <option value="">{field.placeholder}</option>}
                  {field.options.map((opt) => (
                    <option key={opt} value={opt}>{field.optionLabels?.[opt] || opt}</option>
                  ))}
                </select>
              )}
            </div>
          ))}
          {rowEditor && (
            <button
              type="button"
              onClick={addRow}
              className="rounded-lg border border-dashed border-blue-300 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
            >
              {rowEditor.addButtonLabel || "Add another row"}
            </button>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-5 py-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-200">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(values, rowCount)}
            data-testid="save-contract-changes"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function MetaCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 px-2 py-2 border-r border-gray-200 last:border-0">
      <div className="text-gray-400 mt-0.5 shrink-0">{icon}</div>
      <div>
        <p className="text-[10px] text-gray-400 leading-tight">{label}</p>
        <div className="text-xs font-semibold text-gray-800 mt-0.5">{value}</div>
      </div>
    </div>
  );
}

function SectionCard({ title, children, onEdit }: { title: string; children: React.ReactNode; onEdit?: () => void }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden relative">
      <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <h3 className="text-xs font-bold text-gray-800">{title}</h3>
        {onEdit && (
          <button
            onClick={onEdit}
            aria-label={`Edit ${title}`}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 transition-colors"
            data-testid={`edit-${title.replace(/\s+/g, "-").toLowerCase()}`}
          >
            <PenLine size={14} />
          </button>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function getDataSecurityIcon(type: string) {
  const cls = "shrink-0";
  switch (type) {
    case "ssl": return <ShieldCheck size={18} className={`text-blue-500 ${cls}`} />;
    case "backup": return <Database size={18} className={`text-indigo-500 ${cls}`} />;
    case "disaster": return <Cloud size={18} className={`text-sky-500 ${cls}`} />;
    case "audit": return <FileText size={18} className={`text-teal-500 ${cls}`} />;
    case "rbac": return <Users size={18} className={`text-purple-500 ${cls}`} />;
    case "hosting": return <Lock size={18} className={`text-emerald-500 ${cls}`} />;
    default: return <ShieldCheck size={18} className={`text-gray-400 ${cls}`} />;
  }
}

function getRenewalIcon(type: string) {
  switch (type) {
    case "renewal": return <RefreshCw size={18} className="text-blue-500" />;
    case "notice": return <Bell size={18} className="text-amber-500" />;
    case "termination": return <FileX size={18} className="text-red-500" />;
    case "exit": return <Headphones size={18} className="text-indigo-500" />;
    case "export": return <Database size={18} className="text-emerald-500" />;
    case "retention": return <Archive size={18} className="text-gray-500" />;
    default: return <RefreshCw size={18} className="text-gray-400" />;
  }
}

function formatContractDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function getInitials(value?: string): string {
  return (value || "Client")
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 5);
}

function getDaysRemaining(value?: string): string {
  if (!value) return "";
  const end = new Date(value);
  if (Number.isNaN(end.getTime())) return "";
  return String(Math.ceil((end.getTime() - Date.now()) / 86400000));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function ContractDetailView({
  contractId,
  contractTitle,
  clientId,
  clientName,
  clientContactName,
  clientEmail,
  clientPhone,
  clientGstin,
  clientAddress,
  contractStartDate,
  contractEndDate,
  clientCurrency,
  clientPaymentTerms,
  clientStatus,
  readOnly = false,
  editOnOpen = false,
  onBack,
}: ContractDetailViewProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [phonePopup, setPhonePopup] = useState<string | null>(null);
  const phonePopupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
      if (phonePopupRef.current && !phonePopupRef.current.contains(event.target as Node)) {
        setPhonePopup(null);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDropdownOpen(false);
        setPhonePopup(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const [editModalConfig, setEditModalConfig] = useState<{
    title: string;
    fields: FieldConfig[];
    currentValues: Record<string, string>;
    onSave: (values: Record<string, string>, rowCount?: number) => void;
    rowEditor?: RowEditorConfig;
  } | null>(null);

  const closeModal = () => setEditModalConfig(null);

  // ── Data states ──────────────────────────────────────────────────────────────

  const [relationshipOwners, setRelationshipOwners] = useState({
    nidoTech: { name: "", email: "", phone: "", initials: "" },
    apex: { name: "", email: "", phone: "", initials: "" },
  });

  const [overview, setOverview] = useState({
    purpose: "",
    scope: "",
    deployment: "",
    currency: "",
    taxation: "",
    jurisdiction: "",
    confidentiality: "",
  });

  const [responseTargets, setResponseTargets] = useState<Array<{ priority: string; response: string; resolution: string; color: string }>>([]);

  const [commercialTerms, setCommercialTerms] = useState({
    type: "",
    model: "",
    duration: "",
    paymentTerms: clientPaymentTerms || "",
    latePenalty: "",
    extras: "",
    priceRevision: "",
    forceMajeure: "",
    dispute: "",
  });

  const [servicesCovered, setServicesCovered] = useState<Array<{ service: string; scope: string; badge: string }>>([]);

  const [dataSecurity, setDataSecurity] = useState<Array<{ type: string; label: string; active: boolean }>>([]);

  const [confidentiality, setConfidentiality] = useState({
    text: "",
    effective: "",
    status: "",
  });

  const [supportMatrix, setSupportMatrix] = useState<Array<{ level: string; team: string; email: string; availability: string }>>([]);

  const [renewalTerm, setRenewalTerm] = useState<Array<{ type: string; label: string }>>([]);

  const [subscription, setSubscription] = useState({
    userLicensing: "",
    licensedUsers: "",
    concurrent: "",
    additionalCost: "",
    transfer: "",
    minCommitment: "",
  });

  const [slaCommitments, setSlaCommitments] = useState<Array<{ commitment: string; target: string; color: string }>>([]);

  const [renewalInfo, setRenewalInfo] = useState({
    renewalDate: "",
    autoRenewal: "",
    daysRemaining: "",
  });

  const [supportInfo, setSupportInfo] = useState({
    plan: "",
    hours: "",
    responseSLA: "",
  });

  const [keyContacts, setKeyContacts] = useState({
    apex: { name: "", role: "", email: "", phone: "", initials: "" },
    nidoTech: { name: "", role: "", email: "", phone: "", initials: "" },
  });

  const [reminders, setReminders] = useState<Array<{ label: string; date: string }>>([]);
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [newReminderLabel, setNewReminderLabel] = useState("");
  const [newReminderDate, setNewReminderDate] = useState("");
  const [contractHydrated, setContractHydrated] = useState(false);
  const [saveConfirmation, setSaveConfirmation] = useState("");
  const initialSaveSkipped = useRef(false);
  const autoEditOpened = useRef(false);
  const openOverviewEditRef = useRef<() => void>(() => undefined);
  const [activeContractTitle, setActiveContractTitle] = useState(contractTitle || "Client Contract");
  const [contractStartDateValue, setContractStartDateValue] = useState(contractStartDate || "");
  const [contractEndDateValue, setContractEndDateValue] = useState(contractEndDate || "");

  useEffect(() => {
    initialSaveSkipped.current = false;
    setContractHydrated(false);
    if (!clientId) {
      setContractHydrated(true);
      return;
    }
    const saved = getClientContract(clientId, contractId) || (!contractId ? getClientContract(clientId) : null);
    const data = (saved?.data || {}) as Record<string, unknown>;
    const savedStartDate = saved && typeof saved.startDate === "string"
      ? saved.startDate
      : String(data.contractStartDate || "") || contractStartDate || "";
    const savedEndDate = saved && typeof saved.endDate === "string"
      ? saved.endDate
      : String(data.contractEndDate || "") || contractEndDate || "";
    const clientInitials = getInitials(clientContactName || clientName);
    setActiveContractTitle(saved?.contractTitle || contractTitle || "Client Contract");
    setContractStartDateValue(savedStartDate);
    setContractEndDateValue(savedEndDate);
    const liveDefaults = {
      relationshipOwners: {
        nidoTech: { name: "", email: "", phone: "", initials: "" },
        apex: {
          name: clientContactName || clientName || "",
          email: clientEmail || "",
          phone: clientPhone || "",
          initials: clientInitials,
        },
      },
      overview: {
        purpose: "",
        scope: "",
        deployment: "",
        currency: clientCurrency || "",
        taxation: "",
        jurisdiction: "",
        confidentiality: "",
      },
      commercialTerms: {
        type: "",
        model: "",
        duration: "",
        paymentTerms: clientPaymentTerms || "",
        latePenalty: "",
        extras: "",
        priceRevision: "",
        forceMajeure: "",
        dispute: "",
      },
      renewalInfo: {
        renewalDate: "",
        autoRenewal: "",
        daysRemaining: getDaysRemaining(savedEndDate),
      },
      supportInfo: {
        plan: "",
        hours: "",
        responseSLA: "",
      },
      keyContacts: {
        apex: {
          name: clientContactName || clientName || "",
          role: "",
          email: clientEmail || "",
          phone: clientPhone || "",
          initials: clientInitials,
        },
        nidoTech: { name: "", role: "", email: "", phone: "", initials: "" },
      },
    };

    const savedOwners = asRecord(data.relationshipOwners);
    const savedKeyContacts = asRecord(data.keyContacts);
    setRelationshipOwners({
      ...liveDefaults.relationshipOwners,
      ...savedOwners,
      apex: { ...liveDefaults.relationshipOwners.apex, ...asRecord(savedOwners.apex) },
      nidoTech: { ...liveDefaults.relationshipOwners.nidoTech, ...asRecord(savedOwners.nidoTech) },
    } as typeof relationshipOwners);
    setOverview({ ...liveDefaults.overview, ...asRecord(data.overview) });
    setCommercialTerms({ ...liveDefaults.commercialTerms, ...asRecord(data.commercialTerms) });
    setRenewalInfo({ ...liveDefaults.renewalInfo, ...asRecord(data.renewalInfo) });
    setSupportInfo({ ...liveDefaults.supportInfo, ...asRecord(data.supportInfo) });
    setKeyContacts({
      ...liveDefaults.keyContacts,
      ...savedKeyContacts,
      apex: { ...liveDefaults.keyContacts.apex, ...asRecord(savedKeyContacts.apex) },
      nidoTech: { ...liveDefaults.keyContacts.nidoTech, ...asRecord(savedKeyContacts.nidoTech) },
    } as typeof keyContacts);
    if (Array.isArray(data.responseTargets)) setResponseTargets(data.responseTargets as typeof responseTargets);
    if (Array.isArray(data.servicesCovered)) setServicesCovered(data.servicesCovered as typeof servicesCovered);
    if (Array.isArray(data.dataSecurity)) setDataSecurity(data.dataSecurity as typeof dataSecurity);
    if (data.confidentiality) setConfidentiality(data.confidentiality as typeof confidentiality);
    if (Array.isArray(data.supportMatrix)) setSupportMatrix(data.supportMatrix as typeof supportMatrix);
    if (Array.isArray(data.renewalTerm)) setRenewalTerm(data.renewalTerm as typeof renewalTerm);
    if (data.subscription) setSubscription(data.subscription as typeof subscription);
    if (Array.isArray(data.slaCommitments)) setSlaCommitments(data.slaCommitments as typeof slaCommitments);
    if (Array.isArray(data.reminders)) setReminders(data.reminders as typeof reminders);
    setContractHydrated(true);
  }, [clientId, contractId, contractTitle, clientName, clientContactName, clientEmail, clientPhone, clientCurrency, clientPaymentTerms, contractStartDate, contractEndDate]);

  useEffect(() => {
    if (!clientId || !contractHydrated || readOnly) return;
    if (!initialSaveSkipped.current) {
      initialSaveSkipped.current = true;
      return;
    }
    saveClientContract({
      clientId,
      contractId: contractId || "CLIENT-CONTRACT",
      contractTitle: activeContractTitle || "Client Contract",
      startDate: contractStartDateValue,
      endDate: contractEndDateValue,
      data: {
        relationshipOwners,
        overview,
        responseTargets,
        commercialTerms,
        servicesCovered,
        dataSecurity,
        confidentiality,
        supportMatrix,
        renewalTerm,
        subscription,
        slaCommitments,
        renewalInfo,
        supportInfo,
        keyContacts,
        reminders,
      },
      updatedAt: new Date().toISOString(),
    });
  }, [
    clientId,
    contractId,
    readOnly,
    activeContractTitle,
    contractHydrated,
    contractStartDateValue,
    contractEndDateValue,
    relationshipOwners,
    overview,
    responseTargets,
    commercialTerms,
    servicesCovered,
    dataSecurity,
    confidentiality,
    supportMatrix,
    renewalTerm,
    subscription,
    slaCommitments,
    renewalInfo,
    supportInfo,
    keyContacts,
    reminders,
  ]);

  // ── Edit handlers ─────────────────────────────────────────────────────────────

  const openOverviewEdit = () => {
    setEditModalConfig({
      title: "Edit Contract Overview",
      fields: [
        { key: "contractTitle", label: "Contract Name", type: "text" },
        { key: "contractStartDate", label: "Contract Start Date", type: "date" },
        { key: "contractEndDate", label: "Contract End Date", type: "date" },
        { key: "purpose", label: "Contract Purpose", type: "textarea" },
        { key: "scope", label: "Scope of Work", type: "textarea" },
        { key: "deployment", label: "Deployment Model", type: "text" },
        { key: "currency", label: "Currency", type: "text" },
        { key: "taxation", label: "Taxation", type: "text" },
        { key: "jurisdiction", label: "Jurisdiction", type: "text" },
        { key: "confidentiality", label: "Confidentiality Note", type: "textarea" },
        { key: "nidoName", label: "Relationship Owner — Nido-Tech (Name)", type: "text" },
        { key: "nidoEmail", label: "Relationship Owner — Nido-Tech (Email)", type: "text" },
        { key: "nidoPhone", label: "Relationship Owner — Nido-Tech (Phone)", type: "text" },
        { key: "apexName", label: "Relationship Owner — Client (Name)", type: "text" },
        { key: "apexEmail", label: "Relationship Owner — Client (Email)", type: "text" },
        { key: "apexPhone", label: "Relationship Owner — Client (Phone)", type: "text" },
      ],
      currentValues: {
        contractTitle: activeContractTitle,
        contractStartDate: contractStartDateValue,
        contractEndDate: contractEndDateValue,
        ...overview,
        nidoName: relationshipOwners.nidoTech.name,
        nidoEmail: relationshipOwners.nidoTech.email,
        nidoPhone: relationshipOwners.nidoTech.phone,
        apexName: relationshipOwners.apex.name,
        apexEmail: relationshipOwners.apex.email,
        apexPhone: relationshipOwners.apex.phone,
      },
      onSave: (v) => {
        setActiveContractTitle(v.contractTitle || "Client Contract");
        setContractStartDateValue(v.contractStartDate || "");
        setContractEndDateValue(v.contractEndDate || "");
        setOverview({ purpose: v.purpose, scope: v.scope, deployment: v.deployment, currency: v.currency, taxation: v.taxation, jurisdiction: v.jurisdiction, confidentiality: v.confidentiality });
        setRelationshipOwners({
          nidoTech: { name: v.nidoName, email: v.nidoEmail, phone: v.nidoPhone, initials: (v.nidoName || "").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) },
          apex: { name: v.apexName, email: v.apexEmail, phone: v.apexPhone, initials: (v.apexName || "").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) },
        });
        closeModal();
      },
    });
  };

  openOverviewEditRef.current = openOverviewEdit;
  useEffect(() => {
    if (!editOnOpen || readOnly || !contractHydrated || autoEditOpened.current) return;
    autoEditOpened.current = true;
    openOverviewEditRef.current();
  }, [editOnOpen, readOnly, contractHydrated]);

  const openResponseTargetsEdit = () => {
    const flat: Record<string, string> = {};
    responseTargets.forEach((row, i) => { flat[`p${i}_priority`] = row.priority; flat[`p${i}_response`] = row.response; flat[`p${i}_resolution`] = row.resolution; });
    const initialRowCount = Math.max(1, responseTargets.length);
    const makeRowFields = (i: number): FieldConfig[] => [
      { key: `p${i}_priority`, label: `Row ${i + 1} — Priority Label`, type: "text", placeholder: "Enter priority" },
      { key: `p${i}_response`, label: `Row ${i + 1} — Response Time`, type: "text", placeholder: "Enter response time" },
      { key: `p${i}_resolution`, label: `Row ${i + 1} — Resolution Time`, type: "text", placeholder: "Enter resolution time" },
    ];
    setEditModalConfig({
      title: "Edit Response & Resolution Targets",
      fields: Array.from({ length: initialRowCount }, (_, i) => makeRowFields(i)).flat(),
      rowEditor: { initialRowCount, makeRowFields },
      currentValues: flat,
      onSave: (v, rowCount = initialRowCount) => {
        const updated = Array.from({ length: rowCount }, (_, i) => {
          const existing = responseTargets[i];
          const priority = (v[`p${i}_priority`] ?? existing?.priority ?? "").trim();
          const response = (v[`p${i}_response`] ?? existing?.response ?? "").trim();
          const resolution = (v[`p${i}_resolution`] ?? existing?.resolution ?? "").trim();
          if (!priority && !response && !resolution) return null;
          if (!priority || !response || !resolution) return null;
          return { priority, response, resolution, color: existing?.color || "blue" };
        }).filter((row): row is NonNullable<typeof row> => row !== null);
        setResponseTargets(updated);
        closeModal();
      },
    });
  };

  const openCommercialEdit = () => {
    setEditModalConfig({
      title: "Edit Commercial Terms",
      fields: [
        { key: "type", label: "Agreement Type", type: "text" },
        { key: "model", label: "Billing Model", type: "text" },
        { key: "duration", label: "Contract Duration", type: "text" },
        { key: "paymentTerms", label: "Payment Terms", type: "text" },
        { key: "latePenalty", label: "Late Payment Penalty", type: "text" },
        { key: "extras", label: "Extras", type: "text" },
        { key: "priceRevision", label: "Price Revision", type: "text" },
        { key: "forceMajeure", label: "Force Majeure", type: "text" },
        { key: "dispute", label: "Dispute Resolution", type: "text" },
      ],
      currentValues: commercialTerms,
      onSave: (v) => { setCommercialTerms(v as typeof commercialTerms); closeModal(); },
    });
  };

  const openServicesCoveredEdit = () => {
    const scopeOptions = ["Included", "Change Request Required", "Excluded"];
    const flat: Record<string, string> = {};
    servicesCovered.forEach((row, i) => { flat[`s${i}_service`] = row.service; flat[`s${i}_scope`] = row.scope; });
    const initialRowCount = Math.max(1, servicesCovered.length);
    const makeRowFields = (i: number): FieldConfig[] => [
      { key: `s${i}_service`, label: `Service ${i + 1} — Name`, type: "text", placeholder: "Enter service name" },
      { key: `s${i}_scope`, label: `Service ${i + 1} — Scope`, type: "select", options: scopeOptions, placeholder: "Choose scope" },
    ];
    setEditModalConfig({
      title: "Edit Services Covered",
      fields: Array.from({ length: initialRowCount }, (_, i) => makeRowFields(i)).flat(),
      rowEditor: { initialRowCount, makeRowFields },
      currentValues: flat,
      onSave: (v, rowCount = initialRowCount) => {
        const updated = Array.from({ length: rowCount }, (_, i) => {
          const existing = servicesCovered[i];
          const service = (v[`s${i}_service`] ?? existing?.service ?? "").trim();
          const scope = (v[`s${i}_scope`] ?? existing?.scope ?? "").trim();
          if (!service || !scope) return null;
          const badge = scope === "Included" ? "green" : scope === "Excluded" ? "red" : "amber";
          return { service, scope, badge };
        }).filter((row): row is NonNullable<typeof row> => row !== null);
        setServicesCovered(updated);
        closeModal();
      },
    });
  };

  const openDataSecurityEdit = () => {
    const flat: Record<string, string> = {};
    const baseTypes = ["ssl", "backup", "disaster", "audit", "rbac", "hosting"];
    const typeOptions = Array.from(new Set([...baseTypes, ...dataSecurity.map((item) => item.type)]));
    const typeLabels: Record<string, string> = {
      ssl: "SSL / TLS",
      backup: "Backup",
      disaster: "Disaster Recovery",
      audit: "Audit Logging",
      rbac: "Role-Based Access",
      hosting: "Hosting",
    };
    dataSecurity.forEach((item, i) => {
      flat[`ds${i}_type`] = item.type;
      flat[`ds${i}_label`] = item.label;
      flat[`ds${i}_active`] = item.active ? "Active" : "Inactive";
    });
    const initialRowCount = Math.max(1, dataSecurity.length);
    const makeRowFields = (i: number): FieldConfig[] => [
      {
        key: `ds${i}_type`,
        label: `Feature ${i + 1} — Type`,
        type: "select",
        options: typeOptions,
        optionLabels: typeLabels,
        placeholder: "Choose feature type",
      },
      { key: `ds${i}_label`, label: `Feature ${i + 1} — Name`, type: "text", placeholder: "Enter security feature" },
      {
        key: `ds${i}_active`,
        label: `Feature ${i + 1} — Status`,
        type: "select",
        options: ["Active", "Inactive"],
        placeholder: "Choose status",
      },
    ];
    setEditModalConfig({
      title: "Edit Data Security & Compliance",
      fields: Array.from({ length: initialRowCount }, (_, i) => makeRowFields(i)).flat(),
      rowEditor: { initialRowCount, makeRowFields },
      currentValues: flat,
      onSave: (v, rowCount = initialRowCount) => {
        const updated = Array.from({ length: rowCount }, (_, i) => {
          const existing = dataSecurity[i];
          const type = (v[`ds${i}_type`] ?? existing?.type ?? "").trim();
          const label = (v[`ds${i}_label`] ?? existing?.label ?? "").trim();
          const active = v[`ds${i}_active`] ?? (existing?.active ? "Active" : "Inactive");
          if (!type || !label || !active) return null;
          return { type, label, active: active === "Active" };
        }).filter((item): item is NonNullable<typeof item> => item !== null);
        setDataSecurity(updated);
        closeModal();
      },
    });
  };

  const openConfidentialityEdit = () => {
    setEditModalConfig({
      title: "Edit Confidentiality Clause",
      fields: [
        { key: "text", label: "Confidentiality Text", type: "textarea" },
        { key: "effective", label: "Effective Until", type: "text" },
        { key: "status", label: "Status", type: "select", options: ["Active", "Inactive", "Pending"] },
      ],
      currentValues: confidentiality,
      onSave: (v) => { setConfidentiality(v as typeof confidentiality); closeModal(); },
    });
  };

  const openSupportMatrixEdit = () => {
    const flat: Record<string, string> = {};
    supportMatrix.forEach((row, i) => { flat[`sm${i}_level`] = row.level; flat[`sm${i}_team`] = row.team; flat[`sm${i}_email`] = row.email; flat[`sm${i}_availability`] = row.availability; });
    const initialRowCount = Math.max(1, supportMatrix.length);
    const makeRowFields = (i: number): FieldConfig[] => [
      { key: `sm${i}_level`, label: `Row ${i + 1} — Level`, type: "text", placeholder: "Enter support level" },
      { key: `sm${i}_team`, label: `Row ${i + 1} — Contact / Team`, type: "text", placeholder: "Enter team or contact" },
      { key: `sm${i}_email`, label: `Row ${i + 1} — Email`, type: "text", placeholder: "Enter email (optional)" },
      { key: `sm${i}_availability`, label: `Row ${i + 1} — Availability`, type: "text", placeholder: "Enter availability" },
    ];
    setEditModalConfig({
      title: "Edit Support & Escalation Matrix",
      fields: Array.from({ length: initialRowCount }, (_, i) => makeRowFields(i)).flat(),
      rowEditor: { initialRowCount, makeRowFields },
      currentValues: flat,
      onSave: (v, rowCount = initialRowCount) => {
        const updated = Array.from({ length: rowCount }, (_, i) => {
          const existing = supportMatrix[i];
          const level = (v[`sm${i}_level`] ?? existing?.level ?? "").trim();
          const team = (v[`sm${i}_team`] ?? existing?.team ?? "").trim();
          const email = (v[`sm${i}_email`] ?? existing?.email ?? "").trim();
          const availability = (v[`sm${i}_availability`] ?? existing?.availability ?? "").trim();
          if (!level && !team && !email && !availability) return null;
          if (!level || !team) return null;
          return { level, team, email, availability };
        }).filter((row): row is NonNullable<typeof row> => row !== null);
        setSupportMatrix(updated);
        closeModal();
      },
    });
  };

  const openRenewalTermEdit = () => {
    const flat: Record<string, string> = {};
    const typeOptions = ["renewal", "notice", "termination", "exit", "export", "retention"];
    const typeLabels: Record<string, string> = {
      renewal: "Renewal",
      notice: "Notice",
      termination: "Termination",
      exit: "Exit",
      export: "Data Export",
      retention: "Data Retention",
    };
    renewalTerm.forEach((item, i) => {
      flat[`rt${i}_type`] = item.type;
      flat[`rt${i}_label`] = item.label;
    });
    const initialRowCount = Math.max(1, renewalTerm.length);
    const makeRowFields = (i: number): FieldConfig[] => [
      {
        key: `rt${i}_type`,
        label: `Item ${i + 1} — Type`,
        type: "select",
        options: typeOptions,
        optionLabels: typeLabels,
        placeholder: "Choose item type",
      },
      { key: `rt${i}_label`, label: `Item ${i + 1} — Details`, type: "text", placeholder: "Enter renewal or termination detail" },
    ];
    setEditModalConfig({
      title: "Edit Renewal & Termination",
      fields: Array.from({ length: initialRowCount }, (_, i) => makeRowFields(i)).flat(),
      rowEditor: { initialRowCount, makeRowFields },
      currentValues: flat,
      onSave: (v, rowCount = initialRowCount) => {
        const updated = Array.from({ length: rowCount }, (_, i) => {
          const existing = renewalTerm[i];
          const type = (v[`rt${i}_type`] ?? existing?.type ?? "").trim();
          const label = (v[`rt${i}_label`] ?? existing?.label ?? "").trim();
          if (!type || !label) return null;
          return { type, label };
        }).filter((item): item is NonNullable<typeof item> => item !== null);
        setRenewalTerm(updated);
        closeModal();
      },
    });
  };

  const openSubscriptionEdit = () => {
    setEditModalConfig({
      title: "Edit Subscription & Licensing",
      fields: [
        { key: "userLicensing", label: "User Licensing", type: "text" },
        { key: "licensedUsers", label: "Licensed Users", type: "text" },
        { key: "concurrent", label: "Concurrent Users", type: "text" },
        { key: "additionalCost", label: "Additional User Cost", type: "text" },
        { key: "transfer", label: "License Transfer (Allowed)", type: "text" },
        { key: "minCommitment", label: "Minimum Commitment", type: "text" },
      ],
      currentValues: subscription,
      onSave: (v) => { setSubscription(v as typeof subscription); closeModal(); },
    });
  };

  const openSLAEdit = () => {
    const flat: Record<string, string> = {};
    slaCommitments.forEach((row, i) => { flat[`sla${i}_commitment`] = row.commitment; flat[`sla${i}_target`] = row.target; });
    const initialRowCount = Math.max(1, slaCommitments.length);
    const makeRowFields = (i: number): FieldConfig[] => [
      { key: `sla${i}_commitment`, label: `Row ${i + 1} — Commitment`, type: "text", placeholder: "Enter SLA commitment" },
      { key: `sla${i}_target`, label: `Row ${i + 1} — Target`, type: "text", placeholder: "Enter target" },
    ];
    setEditModalConfig({
      title: "Edit SLA Commitments",
      fields: Array.from({ length: initialRowCount }, (_, i) => makeRowFields(i)).flat(),
      rowEditor: { initialRowCount, makeRowFields },
      currentValues: flat,
      onSave: (v, rowCount = initialRowCount) => {
        const updated = Array.from({ length: rowCount }, (_, i) => {
          const existing = slaCommitments[i];
          const commitment = (v[`sla${i}_commitment`] ?? existing?.commitment ?? "").trim();
          const target = (v[`sla${i}_target`] ?? existing?.target ?? "").trim();
          if (!commitment && !target) return null;
          if (!commitment || !target) return null;
          return { commitment, target, color: existing?.color || "blue" };
        }).filter((row): row is NonNullable<typeof row> => row !== null);
        setSlaCommitments(updated);
        closeModal();
      },
    });
  };

  const openRenewalInfoEdit = () => {
    setEditModalConfig({
      title: "Edit Renewal Information",
      fields: [
        { key: "renewalDate", label: "Contract Renewal Date", type: "text" },
        { key: "autoRenewal", label: "Auto Renewal", type: "select", options: ["Enabled", "Disabled"] },
        { key: "daysRemaining", label: "Days Remaining", type: "text" },
      ],
      currentValues: renewalInfo,
      onSave: (v) => { setRenewalInfo(v as typeof renewalInfo); closeModal(); },
    });
  };

  const openSupportInfoEdit = () => {
    setEditModalConfig({
      title: "Edit Support Information",
      fields: [
        { key: "plan", label: "Support Plan", type: "text" },
        { key: "hours", label: "Support Hours", type: "text" },
        { key: "responseSLA", label: "Response SLA", type: "text" },
      ],
      currentValues: supportInfo,
      onSave: (v) => { setSupportInfo(v as typeof supportInfo); closeModal(); },
    });
  };

  const openKeyContactsEdit = () => {
    setEditModalConfig({
      title: "Edit Key Contacts",
      fields: [
        { key: "apexName", label: `${clientName || "Client"} — Contact Name`, type: "text" },
        { key: "apexRole", label: `${clientName || "Client"} — Role`, type: "text" },
        { key: "apexEmail", label: `${clientName || "Client"} — Email`, type: "text" },
        { key: "apexPhone", label: `${clientName || "Client"} — Phone`, type: "text" },
        { key: "nidoName", label: "Nido-Tech — Contact Name", type: "text" },
        { key: "nidoRole", label: "Nido-Tech — Role", type: "text" },
        { key: "nidoEmail", label: "Nido-Tech — Email", type: "text" },
        { key: "nidoPhone", label: "Nido-Tech — Phone", type: "text" },
      ],
      currentValues: {
        apexName: keyContacts.apex.name, apexRole: keyContacts.apex.role, apexEmail: keyContacts.apex.email, apexPhone: keyContacts.apex.phone,
        nidoName: keyContacts.nidoTech.name, nidoRole: keyContacts.nidoTech.role, nidoEmail: keyContacts.nidoTech.email, nidoPhone: keyContacts.nidoTech.phone,
      },
      onSave: (v) => {
        setKeyContacts({
          apex: { name: v.apexName, role: v.apexRole, email: v.apexEmail, phone: v.apexPhone, initials: (v.apexName || "").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) },
          nidoTech: { name: v.nidoName, role: v.nidoRole, email: v.nidoEmail, phone: v.nidoPhone, initials: (v.nidoName || "").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) },
        });
        closeModal();
      },
    });
  };

  const openRemindersEdit = () => {
    const flat: Record<string, string> = {};
    reminders.forEach((r, i) => { flat[`r${i}_label`] = r.label; flat[`r${i}_date`] = r.date; });
    const initialRowCount = Math.max(1, reminders.length);
    const makeRowFields = (i: number): FieldConfig[] => [
      { key: `r${i}_label`, label: `Reminder ${i + 1} — Label`, type: "text", placeholder: "Enter reminder details" },
      { key: `r${i}_date`, label: `Reminder ${i + 1} — Date`, type: "text", placeholder: "Enter reminder date" },
    ];
    setEditModalConfig({
      title: "Edit Reminders",
      fields: Array.from({ length: initialRowCount }, (_, i) => makeRowFields(i)).flat(),
      rowEditor: { initialRowCount, makeRowFields },
      currentValues: flat,
      onSave: (v, rowCount = initialRowCount) => {
        const updated = Array.from({ length: rowCount }, (_, i) => {
          const existing = reminders[i];
          const label = (v[`r${i}_label`] ?? existing?.label ?? "").trim();
          const date = (v[`r${i}_date`] ?? existing?.date ?? "").trim();
          if (!label && !date) return null;
          if (!label || !date) return null;
          return { label, date };
        }).filter((reminder): reminder is NonNullable<typeof reminder> => reminder !== null);
        setReminders(updated);
        closeModal();
      },
    });
  };

  const downloadContract = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 42;
    const contentWidth = pageWidth - margin * 2;
    const generatedOn = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    const colors = {
      blue: [37, 99, 235] as [number, number, number],
      dark: [31, 41, 55] as [number, number, number],
      muted: [107, 114, 128] as [number, number, number],
      line: [229, 231, 235] as [number, number, number],
      header: [239, 246, 255] as [number, number, number],
    };

    const setBodyStyle = () => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...colors.dark);
    };

    const addPageHeader = () => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...colors.muted);
      doc.text("NIDO-TECH | CLIENT CONTRACT", margin, 28);
      doc.setDrawColor(...colors.line);
      doc.line(margin, 34, pageWidth - margin, 34);
    };

    const addSectionTitle = (title: string, y: number) => {
      if (y > 760) {
        doc.addPage();
        addPageHeader();
        y = 54;
      }
      doc.setFillColor(...colors.header);
      doc.roundedRect(margin, y, contentWidth, 22, 3, 3, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...colors.blue);
      doc.text(title, margin + 9, y + 15);
      return y + 34;
    };

    const addKeyValueRows = (title: string, rows: Array<[string, string]>, y: number) => {
      y = addSectionTitle(title, y);
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        tableWidth: contentWidth,
        head: [["Detail", "Value"]],
        body: rows.map(([label, value]) => [label, value || "—"]),
        theme: "grid",
        styles: { font: "helvetica", fontSize: 8.5, cellPadding: 6, textColor: colors.dark },
        headStyles: { fillColor: colors.blue, textColor: [255, 255, 255], fontStyle: "bold" },
        columnStyles: { 0: { cellWidth: 150, fontStyle: "bold" }, 1: { cellWidth: contentWidth - 150 } },
        alternateRowStyles: { fillColor: [249, 250, 251] },
      });
      return ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y) + 18;
    };

    const addTable = (title: string, headers: string[], rows: string[][], y: number) => {
      y = addSectionTitle(title, y);
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        tableWidth: contentWidth,
        head: [headers],
        body: rows.length ? rows : [["No entries", ...headers.slice(1).map(() => "—")]],
        theme: "grid",
        styles: { font: "helvetica", fontSize: 8, cellPadding: 5, textColor: colors.dark, overflow: "linebreak" },
        headStyles: { fillColor: colors.blue, textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [249, 250, 251] },
      });
      return ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y) + 18;
    };

    let y = 58;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(...colors.dark);
    doc.text(activeContractTitle || "SaaS & Services Agreement", margin, y);
    y += 25;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...colors.muted);
    doc.text(`Contract ID: ${contractId || "CLIENT-CONTRACT"}   |   Generated: ${generatedOn}`, margin, y);
    y += 22;
    doc.setDrawColor(...colors.line);
    doc.line(margin, y, pageWidth - margin, y);
    y += 20;
    setBodyStyle();

    y = addKeyValueRows("Contract Overview", [
      ["Purpose", overview.purpose],
      ["Scope", overview.scope],
      ["Deployment", overview.deployment],
      ["Currency", overview.currency],
      ["Taxation", overview.taxation],
      ["Jurisdiction", overview.jurisdiction],
      ["Confidentiality Summary", overview.confidentiality],
    ], y);

    y = addKeyValueRows("Commercial Terms", [
      ["Contract Type", commercialTerms.type],
      ["Commercial Model", commercialTerms.model],
      ["Duration", commercialTerms.duration],
      ["Payment Terms", commercialTerms.paymentTerms],
      ["Late Payment Penalty", commercialTerms.latePenalty],
      ["Additional Services", commercialTerms.extras],
      ["Price Revision", commercialTerms.priceRevision],
      ["Force Majeure", commercialTerms.forceMajeure],
      ["Dispute Resolution", commercialTerms.dispute],
    ], y);

    y = addTable("Services Covered", ["Service", "Scope"], servicesCovered.map((item) => [item.service, item.scope]), y);
    y = addTable("Response Targets", ["Priority", "Response", "Resolution"], responseTargets.map((item) => [item.priority, item.response, item.resolution]), y);
    y = addTable("Data Security", ["Control", "Status"], dataSecurity.map((item) => [item.label, item.active ? "Active" : "Inactive"]), y);

    y = addKeyValueRows("Confidentiality", [
      ["Status", confidentiality.status],
      ["Effective Period", confidentiality.effective],
      ["Terms", confidentiality.text],
    ], y);

    y = addTable("Support Matrix", ["Level", "Team", "Email", "Availability"], supportMatrix.map((item) => [item.level, item.team, item.email, item.availability]), y);
    y = addTable("SLA Commitments", ["Commitment", "Target"], slaCommitments.map((item) => [item.commitment, item.target]), y);
    y = addTable("Renewal & Termination", ["Term", "Details"], renewalTerm.map((item) => [item.label.split(":")[0] || item.label, item.label.includes(":") ? item.label.slice(item.label.indexOf(":") + 1).trim() : item.label]), y);

    y = addKeyValueRows("Renewal Information", [
      ["Renewal Date", renewalInfo.renewalDate],
      ["Auto Renewal", renewalInfo.autoRenewal],
      ["Days Remaining", renewalInfo.daysRemaining],
      ["Support Plan", supportInfo.plan],
      ["Support Hours", supportInfo.hours],
      ["Response SLA", supportInfo.responseSLA],
    ], y);

    y = addKeyValueRows("Subscription", [
      ["User Licensing", subscription.userLicensing],
      ["Licensed Users", subscription.licensedUsers],
      ["Concurrent Users", subscription.concurrent],
      ["Additional User Cost", subscription.additionalCost],
      ["License Transfer", subscription.transfer],
      ["Minimum Commitment", subscription.minCommitment],
    ], y);

    y = addTable("Key Contacts", ["Contact", "Role", "Email", "Phone"], [
      [keyContacts.apex.name, keyContacts.apex.role, keyContacts.apex.email, keyContacts.apex.phone],
      [keyContacts.nidoTech.name, keyContacts.nidoTech.role, keyContacts.nidoTech.email, keyContacts.nidoTech.phone],
    ], y);
    y = addTable("Relationship Owners", ["Party", "Name", "Email", "Phone"], [
      ["Nido-Tech", relationshipOwners.nidoTech.name, relationshipOwners.nidoTech.email, relationshipOwners.nidoTech.phone],
      ["Client", relationshipOwners.apex.name, relationshipOwners.apex.email, relationshipOwners.apex.phone],
    ], y);
    addTable("Reminders", ["Reminder", "Date"], reminders.map((item) => [item.label, item.date]), y);

    const pageCount = doc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      addPageHeader();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...colors.muted);
      doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, 816, { align: "right" });
    }

    const safeName = (activeContractTitle || "Client-Contract").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
    doc.save(`${safeName || "Client-Contract"}.pdf`);
    setDropdownOpen(false);
  };

  // ── JSX ───────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full bg-gray-50 flex flex-col relative">
      {editModalConfig && !readOnly && (
        <EditModal
          title={editModalConfig.title}
          fields={editModalConfig.fields}
          currentValues={editModalConfig.currentValues}
          rowEditor={editModalConfig.rowEditor}
          onSave={(values, rowCount) => {
            editModalConfig.onSave(values, rowCount);
            setSaveConfirmation("Changes saved successfully.");
            window.setTimeout(() => setSaveConfirmation(""), 3000);
          }}
          onClose={closeModal}
        />
      )}
      {saveConfirmation && (
        <div
          role="status"
          className="fixed right-5 top-5 z-[60] rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 shadow-lg"
        >
          {saveConfirmation}
        </div>
      )}

      {/* Header */}
      <div className="bg-white relative">
        <div className="absolute top-4 right-4" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
            data-testid="contract-menu"
          >
            <MoreVertical size={18} />
          </button>
          {dropdownOpen && (
            <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1">
              <button
                onClick={downloadContract}
                className="w-full px-2 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Download size={14} className="text-gray-400" />
                Download Contract
              </button>
            </div>
          )}
        </div>

        <div className="px-4 pt-5 pb-4 border-b border-gray-100 sm:px-6">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition-colors mb-4"
          >
            <ArrowLeft size={14} />
            Back to Contracts
          </button>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
            {/* Left — Service Provider */}
            <div className="w-full lg:w-64 lg:shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                  <span className="text-white font-black text-sm">N</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 leading-tight">Nido-Tech</p>
                  <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Service Provider (We)</span>
                </div>
              </div>
              <div className="text-[11px] text-gray-500 space-y-0.5 pl-11">
                <p className="text-[10px] text-gray-400 font-medium">GSTIN</p>
                   <p className="font-mono">—</p>
                <p className="text-[10px] text-gray-400 font-medium mt-1">Registered Address</p>
                   <p>—</p>
              </div>
            </div>

            {/* Center */}
            <div className="flex min-w-0 flex-1 flex-col items-center text-center">
              <span className="text-[10px] border border-blue-300 text-blue-600 px-2 py-0.5 rounded tracking-widest font-semibold mb-2 bg-blue-50">CONTRACT</span>
              <h2 className="text-lg font-bold text-gray-900 mb-3">{activeContractTitle || "SaaS & Services Agreement"}</h2>
              {readOnly && (
                <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                  <Archive size={13} />
                  Archived · Read only
                </span>
              )}
              <p className="text-[11px] text-gray-400 mb-2">Between</p>
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-[11px] font-medium px-2 py-1 rounded">
                  Nido-Tech<br /><span className="text-[10px] text-yellow-600">(Service Provider)</span>
                </div>
                <div className="flex items-center gap-0.5 text-gray-300">
                  <div className="w-8 h-px bg-gray-300" />
                  <ChevronRight size={12} className="text-gray-400" />
                </div>
                <div className="bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-medium px-2 py-1 rounded">
                  {clientName || "Client"}<br /><span className="text-[10px] text-blue-600">(Client)</span>
                </div>
              </div>
              <div className="flex gap-2 text-center">
                <div>
                  <p className="text-[10px] text-gray-400">Contract No.</p>
                  <p className="text-xs font-semibold text-gray-800">{contractId || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400">Contract Type</p>
                  <p className="text-xs font-semibold text-gray-800">{commercialTerms.type || "—"}</p>
                </div>
              </div>
            </div>

            {/* Right — Client */}
            <div className="w-full text-left lg:w-64 lg:shrink-0 lg:pr-6 lg:text-right">
              <div className="mb-2 flex items-center justify-start gap-2 lg:justify-end">
                <div>
                   <p className="text-sm font-bold text-gray-900 leading-tight">{clientName || "Client"}</p>
                  <div className="flex justify-start lg:justify-end">
                    <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">Client</span>
                  </div>
                </div>
                <div className="w-9 h-9 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
                  <span className="text-white font-black text-[10px]">{getInitials(clientName)}</span>
                </div>
              </div>
              <div className="space-y-0.5 pl-11 text-[11px] text-gray-500 lg:pl-0 lg:pr-11">
                <p className="text-[10px] text-gray-400 font-medium">GSTIN</p>
                 <p className="font-mono">{clientGstin || "—"}</p>
                <p className="text-[10px] text-gray-400 font-medium mt-1">Registered Address</p>
                 <p>{clientAddress || "—"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Meta bar */}
        <div className="bg-gray-50 border-b border-gray-200 overflow-x-auto">
          <div className="flex min-w-max">
            <MetaCell icon={<Calendar size={13} />} label="Contract Start Date" value={formatContractDate(contractStartDateValue)} />
            <MetaCell icon={<Calendar size={13} />} label="Contract End Date" value={formatContractDate(contractEndDateValue)} />
            <MetaCell icon={<IndianRupee size={13} />} label="Currency" value={clientCurrency || overview.currency || "—"} />
            <MetaCell icon={<Receipt size={13} />} label="Billing Model" value={commercialTerms.model || "—"} />
            <MetaCell icon={<FileText size={13} />} label="Payment Terms" value={commercialTerms.paymentTerms || "—"} />
            <MetaCell icon={<CheckCircle2 size={13} className={clientStatus?.toLowerCase() === "active" ? "text-green-500" : "text-gray-400"} />} label="Client Status" value={clientStatus || "—"} />
            <MetaCell icon={<RefreshCw size={13} />} label="Auto Renewal" value={renewalInfo.autoRenewal || "—"} />
            <MetaCell icon={<Bell size={13} />} label="Notice Period" value={renewalTerm.find((item) => item.label.toLowerCase().includes("notice"))?.label || "—"} />
            <MetaCell icon={<Scale size={13} />} label="Governing Law" value={overview.jurisdiction || "—"} />
            <MetaCell icon={<PenLine size={13} />} label="Signed On" value="—" />
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
        <div className="flex-1 overflow-auto p-2">
        <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]">

          {/* LEFT COLUMN */}
          <div className="space-y-4">
            <SectionCard title="Contract Overview" onEdit={readOnly ? undefined : openOverviewEdit}>
              <div className="space-y-3">
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-[11px] text-gray-500 w-32 shrink-0">Contract Purpose</span>
                  <span className="text-[11px] text-gray-800 text-right">{overview.purpose}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-[11px] text-gray-500 w-32 shrink-0">Scope of Work</span>
                  <span className="text-[11px] text-gray-800 text-right">{overview.scope}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-[11px] text-gray-500 w-32 shrink-0">Deployment Model</span>
                  <span className="text-[11px] text-gray-800 text-right font-medium">{overview.deployment}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-[11px] text-gray-500 w-32 shrink-0">Currency</span>
                  <span className="text-[11px] text-gray-800 text-right font-medium">{overview.currency}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-[11px] text-gray-500 w-32 shrink-0">Taxation</span>
                  <span className="text-[11px] text-gray-800 text-right font-medium">{overview.taxation}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-[11px] text-gray-500 w-32 shrink-0">Jurisdiction</span>
                  <span className="text-[11px] text-gray-800 text-right font-medium">{overview.jurisdiction}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-[11px] text-gray-500 w-32 shrink-0">Confidentiality</span>
                  <span className="text-[11px] text-gray-800 text-right">{overview.confidentiality}</span>
                </div>

                {/* Relationship Owner — Nido-Tech */}
                <div className="pt-2 border-b border-gray-100 pb-3">
                  <p className="text-[10px] text-gray-500 mb-1.5 uppercase font-medium">Relationship Owner (Nido-Tech)</p>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0">
                        {relationshipOwners.nidoTech.initials}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-900">{relationshipOwners.nidoTech.name}</p>
                        <p className="text-[10px] text-gray-500">{relationshipOwners.nidoTech.email}</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0" ref={phonePopup === `nido-owner` ? phonePopupRef : undefined}>
                      <a
                        href={`mailto:${relationshipOwners.nidoTech.email}`}
                        className="w-7 h-7 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-500 hover:text-blue-600 hover:border-blue-200 transition-colors"
                        title={`Email ${relationshipOwners.nidoTech.name}`}
                      >
                        <Mail size={12} />
                      </a>
                      <div className="relative">
                        <button
                          onClick={() => setPhonePopup(phonePopup === "nido-owner" ? null : "nido-owner")}
                          className="w-7 h-7 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-500 hover:text-blue-600 hover:border-blue-200 transition-colors"
                          title="Show phone number"
                        >
                          <Phone size={12} />
                        </button>
                        {phonePopup === "nido-owner" && (
                          <div className="absolute right-0 bottom-8 bg-gray-900 text-white text-[11px] font-medium px-2 py-1.5 rounded-lg shadow-lg whitespace-nowrap z-20">
                            {relationshipOwners.nidoTech.phone}
                            <div className="absolute right-2.5 -bottom-1 w-2 h-2 bg-gray-900 rotate-45" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Relationship Owner — Client */}
                <div className="pt-1">
                  <p className="text-[10px] text-gray-500 mb-1.5 uppercase font-medium">Relationship Owner (Client)</p>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 text-xs font-bold shrink-0">
                        {relationshipOwners.apex.initials}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-900">{relationshipOwners.apex.name}</p>
                        <p className="text-[10px] text-gray-500">{relationshipOwners.apex.email}</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <a
                        href={`mailto:${relationshipOwners.apex.email}`}
                        className="w-7 h-7 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-500 hover:text-blue-600 hover:border-blue-200 transition-colors"
                        title={`Email ${relationshipOwners.apex.name}`}
                      >
                        <Mail size={12} />
                      </a>
                      <div className="relative">
                        <button
                          onClick={() => setPhonePopup(phonePopup === "apex-owner" ? null : "apex-owner")}
                          className="w-7 h-7 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-500 hover:text-blue-600 hover:border-blue-200 transition-colors"
                          title="Show phone number"
                        >
                          <Phone size={12} />
                        </button>
                        {phonePopup === "apex-owner" && (
                          <div className="absolute right-0 bottom-8 bg-gray-900 text-white text-[11px] font-medium px-2 py-1.5 rounded-lg shadow-lg whitespace-nowrap z-20">
                            {relationshipOwners.apex.phone}
                            <div className="absolute right-2.5 -bottom-1 w-2 h-2 bg-gray-900 rotate-45" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="2. Response & Resolution Targets" onEdit={readOnly ? undefined : openResponseTargetsEdit}>
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-[10px] text-gray-500 font-medium">
                    <tr>
                      <th className="px-3 py-2 border-b border-gray-200">Priority</th>
                      <th className="px-3 py-2 border-b border-gray-200">Response</th>
                      <th className="px-3 py-2 border-b border-gray-200">Resolution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-[11px]">
                    {responseTargets.map((row, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-${row.color}-50 text-${row.color}-600 border border-${row.color}-200`}>
                            {row.priority}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-medium">{row.response}</td>
                        <td className="px-3 py-2 font-medium">{row.resolution}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>

          {/* MIDDLE COLUMN */}
          <div className="space-y-4">
            <SectionCard title="1. Commercial Terms" onEdit={readOnly ? undefined : openCommercialEdit}>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-[11px] text-gray-500">Agreement Type</span>
                  <span className="text-[11px] text-gray-800 font-medium text-right">{commercialTerms.type}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-[11px] text-gray-500">Billing Model</span>
                  <span className="text-[11px] text-gray-800 font-medium text-right">{commercialTerms.model}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-[11px] text-gray-500">Contract Duration</span>
                  <span className="text-[11px] text-gray-800 font-medium text-right">{commercialTerms.duration}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-[11px] text-gray-500">Payment Terms</span>
                  <span className="text-[11px] text-gray-800 font-medium text-right">{commercialTerms.paymentTerms}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-[11px] text-gray-500">Late Payment Penalty</span>
                  <span className="text-[11px] text-gray-800 font-medium text-right">{commercialTerms.latePenalty}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-[11px] text-gray-500">Extras</span>
                  <span className="text-[11px] text-gray-800 font-medium text-right">{commercialTerms.extras}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-[11px] text-gray-500">Price Revision</span>
                  <span className="text-[11px] text-gray-800 font-medium text-right">{commercialTerms.priceRevision}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-[11px] text-gray-500">Force Majeure</span>
                  <span className="text-[11px] text-gray-800 font-medium text-right">{commercialTerms.forceMajeure}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2 col-span-2">
                  <span className="text-[11px] text-gray-500">Dispute Resolution</span>
                  <span className="text-[11px] text-gray-800 font-medium text-right">{commercialTerms.dispute}</span>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="3. Services Covered" onEdit={readOnly ? undefined : openServicesCoveredEdit}>
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-[10px] text-gray-500 font-medium">
                    <tr>
                      <th className="px-4 py-2 border-b border-gray-200">Service</th>
                      <th className="px-4 py-2 border-b border-gray-200">In Scope</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-[11px]">
                    {servicesCovered.map((row, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2 font-medium text-gray-800">{row.service}</td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-${row.badge}-50 text-${row.badge}-600 border border-${row.badge}-200`}>
                            {row.scope}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard title="5. Data Security & Compliance" onEdit={readOnly ? undefined : openDataSecurityEdit}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                {dataSecurity.map((item, i) => (
                  <div key={i} className="flex flex-col items-center justify-center p-2 bg-gray-50 rounded-lg border border-gray-100 text-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center">
                      {getDataSecurityIcon(item.type)}
                    </div>
                    <span className="text-[10px] font-medium text-gray-700 leading-tight">{item.label}</span>
                    {item.active && <CheckCircle2 size={12} className="text-green-500 mt-auto" />}
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="6. Confidentiality Clause" onEdit={readOnly ? undefined : openConfidentialityEdit}>
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                  <ShieldCheck size={20} className="text-blue-500" />
                </div>
                <div className="flex-1 space-y-3">
                  <p className="text-[11px] text-gray-600 leading-relaxed">{confidentiality.text}</p>
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    <p className="text-[11px] font-medium text-gray-800">
                      Effective Until: <span className="text-gray-500 font-normal">{confidentiality.effective}</span>
                    </p>
                    <p className="text-[11px] font-medium text-gray-800 flex items-center gap-1.5">
                      Status:{" "}
                      <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] bg-green-50 text-green-600 border border-green-200">
                        {confidentiality.status}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="7. Support & Escalation Matrix" onEdit={readOnly ? undefined : openSupportMatrixEdit}>
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-[10px] text-gray-500 font-medium">
                    <tr>
                      <th className="px-4 py-2 border-b border-gray-200">Level</th>
                      <th className="px-4 py-2 border-b border-gray-200">Contact / Team</th>
                      <th className="px-4 py-2 border-b border-gray-200">Email</th>
                      <th className="px-4 py-2 border-b border-gray-200">Availability</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-[11px]">
                    {supportMatrix.map((row, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2 font-medium text-gray-800">{row.level}</td>
                        <td className="px-4 py-2 text-gray-700">{row.team}</td>
                        <td className="px-4 py-2">
                          <a href={`mailto:${row.email}`} className="text-blue-600 hover:underline">{row.email}</a>
                        </td>
                        <td className="px-4 py-2 text-gray-600">{row.availability}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard title="8. Renewal & Termination" onEdit={readOnly ? undefined : openRenewalTermEdit}>
              <div className="grid grid-cols-3 gap-3">
                {renewalTerm.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0">
                      {getRenewalIcon(item.type)}
                    </div>
                    <span className="text-[11px] font-medium text-gray-700">{item.label}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-4">
            <SectionCard title="2. Subscription & Licensing" onEdit={readOnly ? undefined : openSubscriptionEdit}>
              <div className="space-y-3">
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-[11px] text-gray-500">User Licensing</span>
                  <span className="text-[11px] text-gray-800 font-medium">{subscription.userLicensing}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-[11px] text-gray-500">Licensed Users</span>
                  <span className="text-[11px] text-gray-800 font-medium">{subscription.licensedUsers}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-[11px] text-gray-500">Concurrent Users</span>
                  <span className="text-[11px] text-gray-800 font-medium">{subscription.concurrent}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-[11px] text-gray-500">Additional User Cost</span>
                  <span className="text-[11px] text-gray-800 font-medium">{subscription.additionalCost}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-[11px] text-gray-500">License Transfer</span>
                  <span className="text-[11px] text-gray-800 font-medium">{subscription.transfer}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-[11px] text-gray-500">Minimum Commitment</span>
                  <span className="text-[11px] text-gray-800 font-medium">{subscription.minCommitment}</span>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="4. SLA Commitments" onEdit={readOnly ? undefined : openSLAEdit}>
              <div className="overflow-hidden rounded-lg border border-gray-200 mb-2">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-[10px] text-gray-500 font-medium">
                    <tr>
                      <th className="px-3 py-2 border-b border-gray-200">Commitment</th>
                      <th className="px-3 py-2 border-b border-gray-200 text-right">Target</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-[11px]">
                    {slaCommitments.map((row, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-gray-700">{row.commitment}</td>
                        <td className={`px-3 py-2 font-medium text-right text-${row.color}-600`}>{row.target}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard title="Renewal Information" onEdit={readOnly ? undefined : openRenewalInfoEdit}>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[11px] text-gray-600">
                    <Calendar size={14} className="text-gray-400" />
                    <span>Contract Renewal</span>
                  </div>
                  <span className="text-[11px] font-medium text-gray-900">{renewalInfo.renewalDate}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[11px] text-gray-600">
                    <RefreshCw size={14} className="text-gray-400" />
                    <span>Auto Renewal</span>
                  </div>
                  <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-600 border border-green-200">
                    {renewalInfo.autoRenewal}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[11px] text-gray-600">
                    <Bell size={14} className="text-gray-400" />
                    <span>Days Remaining</span>
                  </div>
                  <span className="text-[11px] font-bold text-blue-600">{renewalInfo.daysRemaining}</span>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Support Information" onEdit={readOnly ? undefined : openSupportInfoEdit}>
              <div className="space-y-3 mb-4">
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-[11px] text-gray-500">Support Plan</span>
                  <span className="text-[11px] text-gray-800 font-medium">{supportInfo.plan}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-[11px] text-gray-500">Support Hours</span>
                  <span className="text-[11px] text-gray-800 font-medium">{supportInfo.hours}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-[11px] text-gray-500">Response SLA</span>
                  <span className="text-[11px] text-gray-800 font-medium">{supportInfo.responseSLA}</span>
                </div>
              </div>
              <button className="w-full flex items-center justify-center gap-2 py-2 px-2 rounded-lg border border-blue-600 text-blue-600 text-[11px] font-medium hover:bg-blue-50 transition-colors">
                <Headphones size={14} />
                Create Support Ticket
              </button>
            </SectionCard>

            <SectionCard title="Key Contacts" onEdit={readOnly ? undefined : openKeyContactsEdit}>
              <div className="space-y-4">
                {/* Apex */}
                <div>
                  <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">{clientName || "Client"}</h4>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 text-xs font-bold shrink-0">
                        {keyContacts.apex.initials}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-900 leading-tight">{keyContacts.apex.name}</p>
                        <p className="text-[10px] text-gray-500">{keyContacts.apex.role}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={`mailto:${keyContacts.apex.email}`}
                        className="w-7 h-7 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-500 hover:text-blue-600 hover:border-blue-200 transition-colors"
                        title={`Email ${keyContacts.apex.name}`}
                      >
                        <Mail size={12} />
                      </a>
                      <div className="relative">
                        <button
                          onClick={() => setPhonePopup(phonePopup === "apex-key" ? null : "apex-key")}
                          className="w-7 h-7 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-500 hover:text-blue-600 hover:border-blue-200 transition-colors"
                          title="Show phone number"
                        >
                          <Phone size={12} />
                        </button>
                        {phonePopup === "apex-key" && (
                          <div className="absolute right-0 bottom-8 bg-gray-900 text-white text-[11px] font-medium px-2 py-1.5 rounded-lg shadow-lg whitespace-nowrap z-20">
                            {keyContacts.apex.phone}
                            <div className="absolute right-2.5 -bottom-1 w-2 h-2 bg-gray-900 rotate-45" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Nido-Tech */}
                <div className="pt-3 border-t border-gray-100">
                  <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Nido-Tech</h4>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0">
                        {keyContacts.nidoTech.initials}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-900 leading-tight">{keyContacts.nidoTech.name}</p>
                        <p className="text-[10px] text-gray-500">{keyContacts.nidoTech.role}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={`mailto:${keyContacts.nidoTech.email}`}
                        className="w-7 h-7 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-500 hover:text-blue-600 hover:border-blue-200 transition-colors"
                        title={`Email ${keyContacts.nidoTech.name}`}
                      >
                        <Mail size={12} />
                      </a>
                      <div className="relative">
                        <button
                          onClick={() => setPhonePopup(phonePopup === "nido-key" ? null : "nido-key")}
                          className="w-7 h-7 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-500 hover:text-blue-600 hover:border-blue-200 transition-colors"
                          title="Show phone number"
                        >
                          <Phone size={12} />
                        </button>
                        {phonePopup === "nido-key" && (
                          <div className="absolute right-0 bottom-8 bg-gray-900 text-white text-[11px] font-medium px-2 py-1.5 rounded-lg shadow-lg whitespace-nowrap z-20">
                            {keyContacts.nidoTech.phone}
                            <div className="absolute right-2.5 -bottom-1 w-2 h-2 bg-gray-900 rotate-45" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Reminders" onEdit={readOnly ? undefined : openRemindersEdit}>
              <div className="space-y-3 mb-4">
                {reminders.map((r, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[11px] text-gray-700">
                      <Calendar size={14} className={i === 0 ? "text-amber-500" : "text-blue-500"} />
                      <span>{r.label}</span>
                    </div>
                    <span className="text-[11px] font-medium text-gray-900">{r.date}</span>
                  </div>
                ))}
              </div>
              <button className="w-full text-center text-blue-600 text-[11px] font-medium hover:underline">
                View All Reminders
              </button>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ClientContractsRoute() {
  const { id, contractId: selectedContractId } = useParams<{ id: string; contractId: string }>();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const clientId = id || user?.clientId || "";
  const client = getClients().find((item) => item.id === clientId);
  const contracts = getClientContracts(clientId);
  const contract = selectedContractId
    ? getClientContract(clientId, selectedContractId)
    : getClientContract(clientId);
  const isPortalRoute = window.location.pathname.startsWith("/portal/");
  const address = client ? [
    client.billingAddress || client.billing_address,
    client.billingCity || client.billing_city,
    client.billingState || client.billing_state,
    client.billingPincode || client.billing_pincode,
  ].filter(Boolean).join(", ") : "";

  if (!client) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white text-center">
        <h2 className="text-lg font-semibold text-gray-900">Client not found</h2>
        <p className="text-sm text-gray-500">No client profile is available for this contract.</p>
        <button
          type="button"
          onClick={() => navigate(isPortalRoute ? "/portal/dashboard" : "/clients")}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Back
        </button>
      </div>
    );
  }

  if (!isPortalRoute && !selectedContractId) {
    return (
      <ClientContractsList
        clientId={clientId}
        clientName={client.name}
        contracts={contracts}
        fallbackStartDate={client.contractStartDate || client.contract_start_date || ""}
        fallbackEndDate={client.contractEndDate || client.contract_end_date || ""}
        onOpenContract={(contractId) => navigate(`/clients/${clientId}/contracts/${encodeURIComponent(contractId)}`)}
        onEditContract={(contractId) => navigate(`/clients/${clientId}/contracts/${encodeURIComponent(contractId)}?edit=true`)}
        onCreated={(created) => navigate(`/clients/${clientId}/contracts/${encodeURIComponent(created.contractId)}`)}
        showArchived={searchParams.get("view") === "archived"}
        onShowArchived={() => navigate(`/clients/${clientId}/contracts?view=archived`)}
        onShowActive={() => navigate(`/clients/${clientId}/contracts`)}
      />
    );
  }

  if (selectedContractId && !contract) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 bg-white text-center">
        <h2 className="text-lg font-semibold text-gray-900">Contract not found</h2>
        <p className="text-sm text-gray-500">This contract ID is not saved for this client.</p>
        <button
          type="button"
          onClick={() => navigate(`/clients/${clientId}/contracts`)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Back to Contracts
        </button>
      </div>
    );
  }

  return (
    <ContractDetailView
      key={`${clientId}-${contract?.contractId || selectedContractId || "portal-contract"}`}
      contractId={contract?.contractId || ""}
      contractTitle={contract?.contractTitle || "Client Contract"}
      clientId={clientId}
      clientName={client.name}
      clientContactName={client.rep || client.contact_person || ""}
      clientEmail={client.email || ""}
      clientPhone={client.phone || client.mobile || ""}
      clientGstin={client.gstin || client.gstin_number || ""}
      clientAddress={address}
      contractStartDate={contract?.startDate ?? client.contractStartDate ?? client.contract_start_date ?? ""}
      contractEndDate={contract?.endDate ?? client.contractEndDate ?? client.contract_end_date ?? ""}
      clientCurrency={client.currency || ""}
      clientPaymentTerms={client.payment_terms || ""}
      clientStatus={client.status || ""}
      readOnly={Boolean(contract?.archivedAt)}
      editOnOpen={searchParams.get("edit") === "true" && !contract?.archivedAt}
      onBack={() => navigate(isPortalRoute
        ? "/portal/dashboard"
        : `/clients/${clientId}/contracts${contract?.archivedAt ? "?view=archived" : ""}`)}
    />
  );
}
