import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Home, ChevronRight, Info, ChevronDown, Upload, X,
  Bold, Italic, List, ListOrdered, Link2, Image,
  ExternalLink, AlertCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { resolveAutoAssignment } from "@/lib/autoAssignmentStore";

// ── Constants ──────────────────────────────────────────────────────────────────

const DEPARTMENTS = [
  "Account Management", "IT Support", "Finance", "Procurement",
  "Facilities", "HR", "Operations", "Customer Success",
];

const TICKET_CATEGORIES: Record<string, string[]> = {
  "Platform / System":  ["Login / Access", "Dashboard Issues", "Performance", "System Errors", "Feature Request", "Other"],
  "Billing / Payments": ["Invoice Issues", "Payment Failure", "Refund Request", "Credit Note", "Other"],
  "Purchase Orders":    ["PO Creation", "PO Approval", "PO Delivery", "PO Amendment", "Other"],
  "User Management":    ["Account Setup", "Role / Permission", "Password Reset", "User Deactivation", "Other"],
  "General Enquiry":    ["Information Request", "Feedback", "Other"],
  "Other":              ["Other"],
};

const PRIORITY_OPTIONS = [
  { value: "low",      label: "Low",      color: "text-green-600",  bg: "bg-green-100 dark:bg-green-900/30"  },
  { value: "medium",   label: "Medium",   color: "text-amber-600",  bg: "bg-amber-100 dark:bg-amber-900/30"  },
  { value: "high",     label: "High",     color: "text-orange-600", bg: "bg-orange-100 dark:bg-orange-900/30" },
  { value: "critical", label: "Critical", color: "text-red-600",    bg: "bg-red-100 dark:bg-red-900/30"    },
];

const ASSIGNEES = [
  "Neha Singh", "Arjun Kumar", "Vikram Sharma", "Priya Patel",
  "Rahul Mehta", "Anita Desai", "Suresh Nair",
];

// ── localStorage helpers ───────────────────────────────────────────────────────

export interface StoredChildTicket {
  id: string;
  number: string;
  parentNumber: string;
  subject: string;
  department: string;
  category: string;
  subCategory: string;
  priority: string;
  assignedTo: string;
  assignedRole?: string;
  description: string;
  status: string;
  created: string;
  createdBy: string;
  clientName: string;
}

const CHILD_KEY = "nido_child_tickets_v1";

export function loadChildTickets(): StoredChildTicket[] {
  try {
    const raw = localStorage.getItem(CHILD_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveChildTickets(tickets: StoredChildTicket[]) {
  localStorage.setItem(CHILD_KEY, JSON.stringify(tickets));
  window.dispatchEvent(new CustomEvent("childTicketsUpdated"));
}

function loadParentTicket(parentNumber: string) {
  try {
    const raw = localStorage.getItem("nido_support_tickets_v1");
    if (!raw) return null;
    const all = JSON.parse(raw) as {
      number: string; subject: string; status: string; priority: string;
      created: string; clientId?: string; clientName?: string; department?: string;
    }[];
    return all.find(t => t.number === parentNumber) ?? null;
  } catch { return null; }
}

// ── Dropdown component ─────────────────────────────────────────────────────────

function Select({
  placeholder, value, options, onChange, disabled,
}: {
  placeholder: string; value: string; options: string[];
  onChange: (v: string) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen(p => !p)}
        className={`w-full flex items-center justify-between px-3 py-2.5 border border-border rounded-lg text-sm bg-background transition-colors ${disabled ? "opacity-50 cursor-not-allowed" : "hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"} ${value ? "text-foreground" : "text-muted-foreground"}`}
      >
        <span>{value || placeholder}</span>
        <ChevronDown size={14} className="text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-lg py-1 max-h-52 overflow-y-auto">
          {options.map(opt => (
            <button key={opt} type="button"
              onClick={() => { onChange(opt); setOpen(false); }}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-muted/60 transition-colors ${value === opt ? "text-primary font-semibold" : "text-foreground"}`}
            >{opt}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Priority badge ────────────────────────────────────────────────────────────

function PriorityBadge({ p }: { p: string }) {
  const opt = PRIORITY_OPTIONS.find(o => o.value === p.toLowerCase()) ?? PRIORITY_OPTIONS[0];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${opt.bg} ${opt.color}`}>
      {opt.label}
    </span>
  );
}

// ── What is a Child Ticket illustration ───────────────────────────────────────

function ChildTicketIllustration() {
  return (
    <svg viewBox="0 0 180 100" className="w-full max-w-[180px] mx-auto" fill="none">
      {/* parent doc */}
      <rect x="20" y="15" width="54" height="70" rx="6" fill="#e0e7ff" stroke="#818cf8" strokeWidth="1.5"/>
      <line x1="30" y1="32" x2="64" y2="32" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="30" y1="42" x2="60" y2="42" stroke="#a5b4fc" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="30" y1="52" x2="57" y2="52" stroke="#a5b4fc" strokeWidth="1.2" strokeLinecap="round"/>
      {/* arrow */}
      <path d="M74 50 Q100 50 102 60" stroke="#818cf8" strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round" fill="none"/>
      <polygon points="98,62 106,56 107,65" fill="#818cf8"/>
      {/* child doc */}
      <rect x="106" y="45" width="54" height="42" rx="5" fill="#f0fdf4" stroke="#4ade80" strokeWidth="1.5"/>
      <line x1="115" y1="58" x2="149" y2="58" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="115" y1="67" x2="145" y2="67" stroke="#86efac" strokeWidth="1.2" strokeLinecap="round"/>
      {/* check circle */}
      <circle cx="148" cy="82" r="9" fill="#22c55e"/>
      <path d="M143 82 l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CreateChildTicketPage() {
  const { parentNumber } = useParams<{ parentNumber: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const parentRaw = loadParentTicket(parentNumber ?? "");

  // Mock fallback for demo parent tickets
  const MOCK_PARENTS: Record<string, { subject: string; status: string; priority: string; clientName: string; department: string; created: string }> = {
    "TKT-2026-00077": { subject: "Need more 20L Water Cans for Bangalore office", status: "In Progress", priority: "low", clientName: "Apex Tech Solutions", department: "Account Management", created: new Date(Date.now() - 2 * 86400000).toISOString() },
    "TKT-2026-00078": { subject: "Printer not working in Office Floor 2", status: "Open", priority: "medium", clientName: "Apex Tech Solutions", department: "Account Management", created: new Date(Date.now() - 86400000).toISOString() },
  };

  const parent = parentRaw
    ? { subject: parentRaw.subject, status: parentRaw.status, priority: parentRaw.priority, clientName: parentRaw.clientName ?? "—", department: parentRaw.department ?? "—", created: parentRaw.created }
    : (parentNumber ? MOCK_PARENTS[parentNumber] ?? null : null);

  // Form state
  const [subject,     setSubject]     = useState("");
  const [department,  setDepartment]  = useState("");
  const [category,    setCategory]    = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [priority,    setPriority]    = useState("");
  const [assignedTo,  setAssignedTo]  = useState("");
  const [description, setDescription] = useState("");
  const [files,       setFiles]       = useState<File[]>([]);
  const [dragOver,    setDragOver]    = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [errors,      setErrors]      = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const descRef      = useRef<HTMLTextAreaElement>(null);

  const subCategories = category ? (TICKET_CATEGORIES[category] ?? []) : [];

  const existingChildren = parentNumber
    ? loadChildTickets().filter(c => c.parentNumber === parentNumber)
    : [];

  const fmtDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
        + ", " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
    } catch { return iso; }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!subject.trim())    e.subject    = "Subject is required";
    if (!department)        e.department = "Department is required";
    if (!category)          e.category   = "Category is required";
    if (!subCategory)       e.subCategory = "Sub Category is required";
    if (!priority)          e.priority   = "Priority is required";
    if (!assignedTo)        e.assignedTo = "Assign To is required";
    if (!description.trim()) e.description = "Description is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    setSubmitting(true);

    const existingTickets = loadChildTickets();
    const prefix = `${parentNumber}-`;
    const nextChildNumber = existingTickets
      .filter(ticket => ticket.parentNumber === parentNumber && ticket.number.startsWith(prefix))
      .reduce((highest, ticket) => {
        const suffix = Number(ticket.number.slice(prefix.length));
        return Number.isInteger(suffix) ? Math.max(highest, suffix) : highest;
      }, 0) + 1;
    let sequence = nextChildNumber;
    while (existingTickets.some(ticket => ticket.number === `${prefix}${sequence}`)) sequence += 1;
    const number = `${prefix}${sequence}`;
    const now = new Date().toISOString();
    const autoAssignment =
      resolveAutoAssignment({ department, clientId: parentRaw?.clientId })
      ?? resolveAutoAssignment({ clientId: parentRaw?.clientId });
    const autoAssignee = autoAssignment?.users[0];
    const ticket: StoredChildTicket = {
      id:           number,
      number,
      parentNumber: parentNumber ?? "",
      subject:      subject.trim(),
      department,
      category,
      subCategory,
      priority,
      assignedTo: autoAssignee?.name || autoAssignee?.email || assignedTo,
      assignedRole: autoAssignee?.role || autoAssignment?.rule.role,
      description:  description.trim(),
      status:       "open",
      created:      now,
      createdBy:    user?.name ?? "System",
      clientName:   parent?.clientName ?? "—",
    };

    saveChildTickets([ticket, ...existingTickets]);

    setTimeout(() => {
      setSubmitting(false);
      navigate(`/support/child-ticket/${number}`);
    }, 600);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files).slice(0, 5 - files.length);
    setFiles(f => [...f, ...dropped].slice(0, 5));
  };

  const removeFile = (i: number) => setFiles(f => f.filter((_, idx) => idx !== i));

  const statusColor = (s: string) => {
    const m: Record<string, string> = {
      "open": "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
      "in_progress": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
      "In Progress": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
      "on_hold": "bg-slate-100 text-slate-600",
      "resolved": "bg-green-100 text-green-700",
      "closed": "bg-gray-100 text-gray-600",
    };
    return m[s] ?? "bg-muted text-muted-foreground";
  };
  const statusLabel = (s: string) => {
    const m: Record<string, string> = { open: "Open", in_progress: "In Progress", on_hold: "On Hold", resolved: "Resolved", closed: "Closed" };
    return m[s] ?? s;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Breadcrumb */}
      <div className="border-b border-border bg-background">
        <div className="px-4 md:px-6 py-3">
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
            <Link to="/" className="hover:text-foreground flex items-center"><Home size={13} /></Link>
            <ChevronRight size={11} />
            <Link to="/support" className="hover:text-foreground">Support</Link>
            <ChevronRight size={11} />
            <Link to="/support/tickets" className="hover:text-foreground">Tickets</Link>
            <ChevronRight size={11} />
            {parentNumber && (
              <>
                <Link to={`/support/ticket/${parentNumber}`} className="hover:text-foreground text-primary font-medium">{parentNumber}</Link>
                <ChevronRight size={11} />
              </>
            )}
            <span className="text-foreground font-medium">Create Child Ticket</span>
          </nav>
        </div>
      </div>

      <div className="px-4 md:px-6 py-6">
        <div className="flex items-center gap-2 mb-6">
          <h1 className="text-xl font-bold text-foreground">Create Child Ticket</h1>
          <Info size={16} className="text-muted-foreground" />
        </div>

        {/* Parent info banner */}
        {parent && (
          <div className="mb-6 flex items-center gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl text-sm">
            <Info size={16} className="text-blue-500 shrink-0" />
            <span className="text-blue-700 dark:text-blue-300">You are creating a child ticket for Parent Ticket</span>
            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded text-xs font-semibold border border-blue-300 dark:border-blue-700">
              {parentNumber}
            </span>
            <span className="text-blue-800 dark:text-blue-200 font-medium">{parent.subject}</span>
          </div>
        )}

        {existingChildren.length > 0 && (
          <div className="mb-6 flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-sm">
            <AlertCircle size={16} className="text-amber-500 shrink-0" />
            <span className="text-amber-700 dark:text-amber-300">
              This parent already has {existingChildren.length} child {existingChildren.length === 1 ? "ticket" : "tickets"}. The new child ticket will be added without replacing them.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          {/* ── Left: Form ── */}
          <div className="space-y-5">
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">Child Ticket Details</h2>

              {/* Subject + Department */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Subject <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={subject}
                    onChange={e => { setSubject(e.target.value); setErrors(v => ({ ...v, subject: "" })); }}
                    placeholder="Enter subject of the issue"
                    className={`w-full px-3 py-2.5 border rounded-lg text-sm bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 ${errors.subject ? "border-red-400" : "border-border"}`}
                  />
                  {errors.subject && <p className="text-xs text-red-500 mt-1">{errors.subject}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Department <span className="text-red-500">*</span>
                  </label>
                  <Select
                    placeholder="Select Department" value={department} options={DEPARTMENTS}
                    onChange={v => { setDepartment(v); setErrors(e => ({ ...e, department: "" })); }}
                  />
                  {errors.department && <p className="text-xs text-red-500 mt-1">{errors.department}</p>}
                </div>
              </div>

              {/* Category + Sub Category */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <Select
                    placeholder="Select Category" value={category} options={Object.keys(TICKET_CATEGORIES)}
                    onChange={v => { setCategory(v); setSubCategory(""); setErrors(e => ({ ...e, category: "" })); }}
                  />
                  {errors.category && <p className="text-xs text-red-500 mt-1">{errors.category}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Sub Category <span className="text-red-500">*</span>
                  </label>
                  <Select
                    placeholder="Select Sub Category" value={subCategory} options={subCategories}
                    onChange={v => { setSubCategory(v); setErrors(e => ({ ...e, subCategory: "" })); }}
                    disabled={!category}
                  />
                  {errors.subCategory && <p className="text-xs text-red-500 mt-1">{errors.subCategory}</p>}
                </div>
              </div>

              {/* Priority + Assign To */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Priority <span className="text-red-500">*</span>
                  </label>
                  <Select
                    placeholder="Select Priority" value={priority ? (PRIORITY_OPTIONS.find(p => p.value === priority)?.label ?? "") : ""}
                    options={PRIORITY_OPTIONS.map(p => p.label)}
                    onChange={v => {
                      const opt = PRIORITY_OPTIONS.find(o => o.label === v);
                      setPriority(opt?.value ?? v.toLowerCase());
                      setErrors(e => ({ ...e, priority: "" }));
                    }}
                  />
                  {errors.priority && <p className="text-xs text-red-500 mt-1">{errors.priority}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Assign To <span className="text-red-500">*</span>
                  </label>
                  <Select
                    placeholder="Select Assignee" value={assignedTo} options={ASSIGNEES}
                    onChange={v => { setAssignedTo(v); setErrors(e => ({ ...e, assignedTo: "" })); }}
                  />
                  {errors.assignedTo && <p className="text-xs text-red-500 mt-1">{errors.assignedTo}</p>}
                </div>
              </div>

              {/* Description */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Description <span className="text-red-500">*</span>
                </label>
                <div className={`border rounded-lg overflow-hidden ${errors.description ? "border-red-400" : "border-border"}`}>
                  <textarea
                    ref={descRef}
                    value={description}
                    onChange={e => { setDescription(e.target.value); setErrors(v => ({ ...v, description: "" })); }}
                    placeholder="Provide detailed description of the issue..."
                    rows={5}
                    className="w-full px-3 py-3 text-sm bg-background placeholder:text-muted-foreground focus:outline-none resize-none"
                  />
                  {/* Toolbar */}
                  <div className="flex items-center gap-1 px-3 py-2 border-t border-border bg-muted/30">
                    {[Bold, Italic, List, ListOrdered, Link2, Image].map((Icon, i) => (
                      <button key={i} type="button"
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      ><Icon size={14} /></button>
                    ))}
                  </div>
                </div>
                {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description}</p>}
              </div>
            </div>

            {/* Attachments */}
            <div className="bg-card border border-border rounded-xl p-5">
              <label className="block text-sm font-medium text-foreground mb-3">Attachments (Optional)</label>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/20"}`}
              >
                <Upload size={28} className="mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Drag &amp; drop files here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">You can attach up to 5 files. Max file size 10MB each.</p>
                <p className="text-xs text-muted-foreground">Supported formats: PDF, JPG, PNG, DOC, XLS, ZIP</p>
                <input ref={fileInputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.zip" className="hidden"
                  onChange={e => { const f = Array.from(e.target.files ?? []).slice(0, 5 - files.length); setFiles(v => [...v, ...f].slice(0, 5)); }} />
              </div>
              {files.length > 0 && (
                <div className="mt-3 space-y-2">
                  {files.map((file, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 bg-muted/40 rounded-lg text-sm">
                      <span className="text-foreground truncate max-w-[80%]">{file.name}</span>
                      <button type="button" onClick={() => removeFile(i)} className="text-muted-foreground hover:text-foreground ml-2"><X size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-3 pb-6">
              <button
                type="button"
                onClick={() => navigate(parentNumber ? `/support/ticket/${parentNumber}` : "/support/tickets")}
                className="px-5 py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
              >
                {submitting ? "Creating…" : "Create Child Ticket"}
              </button>
            </div>
          </div>

          {/* ── Right sidebar ── */}
          <div className="space-y-4">
            {/* Parent Ticket Summary */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-sm font-bold text-foreground mb-3">Parent Ticket Summary</h3>
              {parent ? (
                <>
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="px-2 py-0.5 bg-muted rounded text-xs font-semibold text-foreground border border-border">{parentNumber}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor(parent.status)}`}>{statusLabel(parent.status)}</span>
                  </div>
                  <div className="space-y-2.5 text-sm">
                    <div className="flex"><span className="text-muted-foreground w-24 shrink-0">Subject</span><span className="font-medium text-foreground">{parent.subject}</span></div>
                    <div className="flex"><span className="text-muted-foreground w-24 shrink-0">Client</span><span className="text-foreground">{parent.clientName}</span></div>
                    <div className="flex"><span className="text-muted-foreground w-24 shrink-0">Department</span><span className="font-semibold text-foreground">{parent.department}</span></div>
                    <div className="flex items-center"><span className="text-muted-foreground w-24 shrink-0">Priority</span><PriorityBadge p={parent.priority} /></div>
                    <div className="flex"><span className="text-muted-foreground w-24 shrink-0">Created On</span><span className="text-foreground text-xs">{fmtDate(parent.created)}</span></div>
                  </div>
                  <Link
                    to={`/support/ticket/${parentNumber}`}
                    className="inline-flex items-center gap-1.5 mt-3 text-primary text-sm font-medium hover:underline"
                  >
                    View Parent Ticket <ExternalLink size={13} />
                  </Link>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Parent ticket not found.</p>
              )}
            </div>

            {/* Note */}
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <AlertCircle size={16} className="text-amber-500" />
                <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300">Note</h4>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-400">A parent can have multiple child tickets. Closing a child ticket does not automatically close its parent.</p>
            </div>

            {/* What is a Child Ticket */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h4 className="text-sm font-bold text-foreground mb-1.5">What is a Child Ticket?</h4>
              <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                Child tickets help in breaking down the parent issue into a specific actionable item. It will help the team to track and resolve the issue efficiently.
              </p>
              <ChildTicketIllustration />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
