import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Home, ChevronRight, Headphones, User, Bold, Italic,
  Underline, List, ListOrdered, Link2, Upload, X, Send,
  CheckCircle, Copy, Eye, AlignJustify, Tag, Layers,
  Building2, Shield, Calendar, Info,
} from "lucide-react";
import { getClients, StoredClient } from "@/lib/clientStore";
import { saveSupportTickets } from "@/lib/supportTicketStore";
import { resolveAutoAssignment } from "@/lib/autoAssignmentStore";
import { getUsers } from "@/lib/nidoUsersStore";
import { useAuth } from "@/contexts/AuthContext";
import { getPrefix } from "@/lib/configService";

// ── Static data ────────────────────────────────────────────────────────────────

const TICKET_CATEGORIES: Record<string, string[]> = {
  "Platform / System":   ["Login / Access", "Dashboard Issues", "Performance", "System Errors", "Feature Request", "Other"],
  "Billing / Payments":  ["Invoice Issues", "Payment Failure", "Refund Request", "Credit Note", "Other"],
  "Purchase Orders":     ["PO Creation", "PO Approval", "PO Delivery", "PO Amendment", "Other"],
  "User Management":     ["Account Setup", "Role / Permission", "Password Reset", "User Deactivation", "Other"],
  "General Enquiry":     ["Information Request", "Feedback", "Other"],
  "Other":               ["Other"],
};

const PRIORITY_OPTIONS = [
  { value: "low",      label: "Low",      color: "bg-green-100 text-green-700",  dot: "bg-green-500"  },
  { value: "medium",   label: "Medium",   color: "bg-amber-100 text-amber-700",  dot: "bg-amber-500"  },
  { value: "high",     label: "High",     color: "bg-orange-100 text-orange-700",dot: "bg-orange-500" },
  { value: "critical", label: "Critical", color: "bg-red-100 text-red-700",      dot: "bg-red-500"    },
];

// ── Ticket number helpers ──────────────────────────────────────────────────────

function getExistingTickets(): {
  id: string; number: string; subject: string; status: string;
  priority: string; created: string; clientId?: string; clientName?: string;
  category?: string; subCategory?: string; department?: string;
  description?: string; ccEmail?: string; createdBy?: string;
  createdById?: string; createdByEmail?: string;
  assignedTo?: string; assignedRole?: string;
}[] {
  try {
    const raw = localStorage.getItem("nido_support_tickets_v1");
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function generateTicketNumber(): string {
  const year = new Date().getFullYear();
  const prefix = getPrefix("supportTicket") || "TKT-";
  const prefixWithYear = `${prefix}${year}-`;
  const existing = getExistingTickets();
  let maxSerial = 0;
  for (const t of existing) {
    if (t.number && t.number.startsWith(prefixWithYear)) {
      const serial = parseInt(t.number.slice(prefixWithYear.length), 10);
      if (!isNaN(serial) && serial > maxSerial) maxSerial = serial;
    }
  }
  return `${prefixWithYear}${String(maxSerial + 1).padStart(6, "0")}`;
}

// ── Confetti dots (decorative, static) ────────────────────────────────────────

const CONFETTI = [
  { x: "38%",  y: "4%",  size: 8,  color: "#f97316" },
  { x: "60%",  y: "3%",  size: 6,  color: "#3b82f6" },
  { x: "70%",  y: "8%",  size: 5,  color: "#22c55e" },
  { x: "32%",  y: "10%", size: 7,  color: "#eab308" },
  { x: "25%",  y: "5%",  size: 5,  color: "#ef4444" },
  { x: "65%",  y: "15%", size: 4,  color: "#a855f7" },
  { x: "72%",  y: "4%",  size: 6,  color: "#f97316" },
  { x: "28%",  y: "16%", size: 4,  color: "#3b82f6" },
  { x: "76%",  y: "12%", size: 5,  color: "#22c55e" },
  { x: "34%",  y: "18%", size: 3,  color: "#eab308" },
];

// ── Success screen ─────────────────────────────────────────────────────────────

interface CreatedTicket {
  number: string;
  clientName: string;
  category: string;
  subCategory: string;
  subject: string;
  department: string;
  priority: string;
  status: string;
  createdOn: string;
  createdBy: string;
  assignedTo: string;
  assignedRole: string;
}

function SuccessScreen({ ticket }: { ticket: CreatedTicket }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(ticket.number).catch(() => {
      const el = document.createElement("textarea");
      el.value = ticket.number;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const priorityOpt = PRIORITY_OPTIONS.find(p => p.value === ticket.priority);
  const priorityLabel = priorityOpt?.label || ticket.priority;
  const priorityDot   = priorityOpt?.dot   || "bg-gray-400";

  const summaryItems = [
    { icon: <User size={16} className="text-primary" />,       label: "Client",       value: ticket.clientName, isLink: true },
    { icon: <Tag size={16} className="text-primary" />,        label: "Sub Category", value: ticket.subCategory },
    { icon: <AlignJustify size={16} className="text-primary" />,label: "Subject",     value: ticket.subject },
    { icon: <Layers size={16} className="text-primary" />,     label: "Category",     value: ticket.category },
    { icon: <Building2 size={16} className="text-primary" />,  label: "Department",   value: ticket.department },
    { icon: <User size={16} className="text-primary" />,       label: "Assigned To",  value: ticket.assignedTo },
    { icon: <Shield size={16} className="text-primary" />,     label: "Assigned Role", value: ticket.assignedRole },
    { icon: <Shield size={16} className="text-primary" />,     label: "Status",       isStatus: true },
    { icon: <CheckCircle size={16} className="text-primary" />,label: "Priority",     isPriority: true },
    { icon: <Calendar size={16} className="text-primary" />,   label: "Created On",   value: ticket.createdOn },
    { icon: <User size={16} className="text-primary" />,       label: "Created By",   value: ticket.createdBy },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Breadcrumb */}
      <div className="border-b border-border bg-background">
        <div className="px-4 md:px-6 py-3">
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground flex items-center"><Home size={13} /></Link>
            <ChevronRight size={11} />
            <Link to="/support" className="hover:text-foreground">Support</Link>
            <ChevronRight size={11} />
            <button onClick={() => navigate("/support/tickets")} className="hover:text-foreground">Tickets</button>
            <ChevronRight size={11} />
            <span className="text-primary font-medium">Create Ticket</span>
          </nav>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">

        {/* ── Hero success block ── */}
        <div className="relative text-center py-8">
          {/* Confetti dots */}
          {CONFETTI.map((c, i) => (
            <span
              key={i}
              className="absolute rounded-full"
              style={{ left: c.x, top: c.y, width: c.size, height: c.size, background: c.color }}
            />
          ))}

          {/* Green circle */}
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500 shadow-lg mb-5">
            <CheckCircle size={40} className="text-white" strokeWidth={2.5} />
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-2">Ticket Created Successfully!</h1>
          <p className="text-sm text-muted-foreground">
            Your support ticket has been created and assigned to the appropriate team.
          </p>
        </div>

        {/* ── Ticket number box ── */}
        <div className="rounded-xl border-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-0.5">Ticket Number</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400 tracking-wide">{ticket.number}</p>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors flex-shrink-0"
          >
            <Copy size={15} />
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        {/* ── Ticket summary card ── */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-bold text-foreground mb-4">Ticket Summary</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-5 gap-x-4">
            {summaryItems.map(item => (
              <div key={item.label} className="flex items-start gap-2.5">
                <div className="mt-0.5 flex-shrink-0">{item.icon}</div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">{item.label}</p>
                  {item.isLink ? (
                    <p className="text-sm font-semibold text-primary">{item.value}</p>
                  ) : item.isStatus ? (
                    <span className="inline-flex px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-semibold">
                      Open
                    </span>
                  ) : item.isPriority ? (
                    <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <span className={`w-2.5 h-2.5 rounded-full ${priorityDot}`} />
                      {priorityLabel}
                    </span>
                  ) : (
                    <p className="text-sm font-medium text-foreground">{item.value}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Email notification banner ── */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
          <Info size={16} className="text-blue-500 flex-shrink-0" />
          <p className="text-sm text-blue-700 dark:text-blue-400">
            You will receive email notifications for updates on this ticket.
          </p>
        </div>

        {/* ── Action buttons ── */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => navigate(`/support/ticket/${ticket.number}`)}
            className="flex items-center gap-2 px-6 py-2.5 border border-border rounded-lg text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors"
          >
            <Eye size={16} />
            View Ticket
          </button>
          <button
            onClick={() => navigate("/support/tickets")}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-semibold transition-colors"
          >
            <AlignJustify size={16} />
            Go to Ticket List
          </button>
        </div>

      </div>
    </div>
  );
}

// ── Main form component ────────────────────────────────────────────────────────

export default function CreateSupportTicketPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const clients: StoredClient[] = getClients();

  // Form state
  const [clientId,    setClientId]    = useState("");
  const [category,    setCategory]    = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [priority,    setPriority]    = useState("medium");
  const [subject,     setSubject]     = useState("");
  const [description, setDescription] = useState("");
  const [ccEmail,     setCcEmail]     = useState("");
  const [files,       setFiles]       = useState<File[]>([]);
  const [dragging,    setDragging]    = useState(false);

  // Success state
  const [createdTicket, setCreatedTicket] = useState<CreatedTicket | null>(null);

  const descRef   = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const selectedClient = clients.find(c => c.id === clientId);

  const subCategories = category ? (TICKET_CATEGORIES[category] ?? []) : [];
  useEffect(() => { setSubCategory(""); }, [category]);

  const handleDescInput = () => {
    if (descRef.current) setDescription(descRef.current.innerText);
  };

  const execFormat = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    descRef.current?.focus();
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter(f =>
      ["application/pdf", "application/msword",
       "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
       "image/jpeg", "image/png"].includes(f.type)
    );
    setFiles(prev => [...prev, ...dropped].slice(0, 5));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...picked].slice(0, 5));
  };

  const removeFile = (idx: number) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = () => {
    if (!clientId)       { toast.error("Please select a client"); return; }
    if (!category)       { toast.error("Please select a category"); return; }
    if (!subCategory)    { toast.error("Please select a sub category"); return; }
    if (!subject.trim()) { toast.error("Please enter a subject"); return; }
    const desc = descRef.current?.innerText?.trim() || "";
    if (!desc)           { toast.error("Please enter a description"); return; }

    const ticketNumber = generateTicketNumber();
    const now          = new Date();
    const createdOn    = now.toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
    const createdBy = user?.name || "System Admin";
    const internalRequester = getUsers().find((candidate) => {
      const value = createdBy.trim().toLowerCase();
      return (
        candidate.name.trim().toLowerCase() === value
        || candidate.email.trim().toLowerCase() === value
      );
    });
    const role = internalRequester?.role || user?.role;
    const autoAssignment =
      resolveAutoAssignment({
        department: internalRequester?.department,
        role,
        clientId,
      })
      ?? resolveAutoAssignment({ role, clientId })
      ?? resolveAutoAssignment({ clientId });
    const assignedUser = autoAssignment?.users[0];
    const assignedTo = assignedUser?.name || assignedUser?.email || "Unassigned";
    const assignedRole = assignedUser?.role || autoAssignment?.rule.role || "";
    const assignedDepartment =
      autoAssignment?.rule.department
      || internalRequester?.department
      || "Unassigned Department";

    const ticket = {
      id:          `tkt_${Date.now()}`,
      number:      ticketNumber,
      subject:     subject.trim(),
      status:      "open",
      priority,
      created:     now.toISOString().split("T")[0],
      clientId,
      clientName:  selectedClient?.name || "",
      category,
      subCategory,
      description: desc,
      department:  assignedDepartment,
      assignedTo,
      assignedRole,
      autoAssigned: Boolean(assignedUser),
      ccEmail,
      createdBy,
      createdById: user?.id || "",
      createdByEmail: user?.email || "",
    };

    const existing = getExistingTickets();
    const updated  = [...existing, ticket];
    localStorage.setItem("nido_support_tickets_v1", JSON.stringify(updated));
    saveSupportTickets(updated.map(t => ({
      id: t.id, number: t.number, subject: t.subject,
      status: t.status, priority: t.priority, created: t.created,
      clientId: t.clientId, clientName: t.clientName,
      department: t.department, assignedTo: t.assignedTo, assignedRole: t.assignedRole,
      createdBy: t.createdBy, createdById: t.createdById, createdByEmail: t.createdByEmail,
    })));

    setCreatedTicket({
      number:      ticketNumber,
      clientName:  selectedClient?.name || "",
      category,
      subCategory,
      subject:     subject.trim(),
       department:  assignedDepartment,
      priority,
      status:      "open",
      createdOn,
      createdBy,
       assignedTo,
       assignedRole,
    });
  };

  // ── Show success screen if ticket was just created ──
  if (createdTicket) {
    return <SuccessScreen ticket={createdTicket} />;
  }

  const priorityStyle = PRIORITY_OPTIONS.find(p => p.value === priority)?.color || "";

  return (
    <div className="min-h-screen bg-background">
      {/* ── Page header ── */}
      <div className="bg-transparent border-b border-border">
        <div className="w-full px-4 md:px-6 py-3">
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
            <Link to="/" className="hover:text-foreground flex items-center">
              <Home size={13} />
            </Link>
            <ChevronRight size={11} />
            <Link to="/support" className="hover:text-foreground">Support</Link>
            <ChevronRight size={11} />
            <button onClick={() => navigate("/support/tickets")} className="hover:text-foreground">Tickets</button>
            <ChevronRight size={11} />
            <span className="text-primary font-medium">Create Ticket</span>
          </nav>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Headphones size={18} className="text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground leading-tight">Create Support Ticket</h1>
              <p className="text-xs text-muted-foreground">Raise a new support request for your client</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Form body ── */}
      <div className="w-full px-4 md:px-6 py-6 max-w-5xl">
        <div className="bg-card rounded-2xl border border-border p-6 space-y-6">

          {/* Row 1: Client / Category / Sub Category */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Client <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  className="w-full appearance-none px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring pr-8"
                >
                  <option value="">Select client…</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ChevronRight size={14} className="absolute right-2.5 top-2.5 text-muted-foreground rotate-90 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Category <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full appearance-none px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring pr-8"
                >
                  <option value="">Select category…</option>
                  {Object.keys(TICKET_CATEGORIES).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ChevronRight size={14} className="absolute right-2.5 top-2.5 text-muted-foreground rotate-90 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Sub Category <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={subCategory}
                  onChange={e => setSubCategory(e.target.value)}
                  disabled={!category}
                  className="w-full appearance-none px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring pr-8 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Select sub category…</option>
                  {subCategories.map(sc => (
                    <option key={sc} value={sc}>{sc}</option>
                  ))}
                </select>
                <ChevronRight size={14} className="absolute right-2.5 top-2.5 text-muted-foreground rotate-90 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Row 2: Department (static) / Priority */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Department</label>
              <div className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg bg-muted/30 text-sm text-muted-foreground">
                <User size={15} className="text-muted-foreground flex-shrink-0" />
                <span>Customer Relationship Manager (Auto Assigned)</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Priority <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value)}
                  className={`w-full appearance-none px-3 py-2 border border-border rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring pr-8 ${priorityStyle}`}
                >
                  {PRIORITY_OPTIONS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
                <ChevronRight size={14} className="absolute right-2.5 top-2.5 text-muted-foreground rotate-90 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Subject <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Brief description of the issue"
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Description – rich text */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Description <span className="text-red-500">*</span>
            </label>
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="flex items-center gap-0.5 px-3 py-2 border-b border-border bg-muted/20">
                <select
                  onChange={e => execFormat("formatBlock", e.target.value)}
                  defaultValue="p"
                  className="text-xs border border-border rounded px-2 py-1 bg-background text-foreground focus:outline-none mr-2"
                >
                  <option value="p">Normal</option>
                  <option value="h1">Heading 1</option>
                  <option value="h2">Heading 2</option>
                  <option value="h3">Heading 3</option>
                </select>
                <button type="button" onClick={() => execFormat("bold")}
                  className="p-1.5 rounded hover:bg-muted text-foreground" title="Bold">
                  <Bold size={14} />
                </button>
                <button type="button" onClick={() => execFormat("italic")}
                  className="p-1.5 rounded hover:bg-muted text-foreground" title="Italic">
                  <Italic size={14} />
                </button>
                <button type="button" onClick={() => execFormat("underline")}
                  className="p-1.5 rounded hover:bg-muted text-foreground" title="Underline">
                  <Underline size={14} />
                </button>
                <div className="w-px h-5 bg-border mx-1" />
                <button type="button" onClick={() => execFormat("insertUnorderedList")}
                  className="p-1.5 rounded hover:bg-muted text-foreground" title="Bullet list">
                  <List size={14} />
                </button>
                <button type="button" onClick={() => execFormat("insertOrderedList")}
                  className="p-1.5 rounded hover:bg-muted text-foreground" title="Numbered list">
                  <ListOrdered size={14} />
                </button>
                <div className="w-px h-5 bg-border mx-1" />
                <button type="button"
                  onClick={() => {
                    const url = window.prompt("Enter URL:");
                    if (url) execFormat("createLink", url);
                  }}
                  className="p-1.5 rounded hover:bg-muted text-foreground" title="Insert link">
                  <Link2 size={14} />
                </button>
              </div>

              <div
                ref={descRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleDescInput}
                data-placeholder="Describe the issue in detail…"
                className="min-h-[140px] px-4 py-3 text-sm text-foreground focus:outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground"
              />

              <div className="px-4 py-1.5 border-t border-border bg-muted/10 text-right">
                <span className={`text-xs ${description.length > 2800 ? "text-red-500" : "text-muted-foreground"}`}>
                  {description.length} / 3000
                </span>
              </div>
            </div>
          </div>

          {/* CC Email */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">CC Email (Optional)</label>
            <input
              type="text"
              value={ccEmail}
              onChange={e => setCcEmail(e.target.value)}
              placeholder="Enter up to 2 email addresses separated by comma"
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground mt-1">You can add maximum 2 email addresses.</p>
          </div>

          {/* Attachments */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Attachments (Optional)</label>

            {files.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-lg text-xs text-foreground border border-border">
                    <span className="max-w-[160px] truncate">{f.name}</span>
                    <button type="button" onClick={() => removeFile(i)} className="text-muted-foreground hover:text-red-500">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInput.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
                dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/20"
              }`}
            >
              <Upload size={22} className="text-muted-foreground mb-1" />
              <p className="text-sm text-muted-foreground">
                Drag &amp; drop files here or{" "}
                <span className="text-primary font-medium underline underline-offset-2">click to browse</span>
              </p>
              <p className="text-xs text-muted-foreground">Max file size: 10MB each (PDF, DOC, DOCX, JPG, PNG)</p>
            </div>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>

        {/* ── Footer actions ── */}
        <div className="flex items-center justify-end gap-3 mt-5 pb-8">
          <button
            type="button"
            onClick={() => navigate("/support")}
            className="px-5 py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
          >
            <Send size={15} />
            Create Ticket
          </button>
        </div>
      </div>
    </div>
  );
}
