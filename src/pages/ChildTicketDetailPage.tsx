import { useState, useMemo, useRef, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Home, ChevronRight, MoreHorizontal, Clock, CheckCircle,
  Paperclip, Bold, Italic, List, ListOrdered, Link2,
  ChevronDown, Search, AlertCircle, FileText, Activity,
  MessageSquare, Send, Image, ArrowRight, Mail,
  Edit, RotateCcw,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { loadChildTickets, StoredChildTicket } from "./CreateChildTicketPage";
import { WorkflowCheckpoint } from "@/components/workflow/WorkflowCheckpoint";
import { getTicketAllowedTransitions, getTicketNextAction } from "@/lib/ticketWorkflow";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ConversationEntry {
  id: string;
  kind: "message" | "internal" | "external" | "system";
  author: string;
  role: string;
  time: string;
  text: string;
  attachment?: { name: string; size: string };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
      + ", " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch { return iso; }
}

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function priorityToSLA(p: string): { response: number; resolution: number } {
  const lp = p.toLowerCase();
  if (lp === "high" || lp === "critical") return { response: 4,  resolution: 12 };
  if (lp === "medium")                    return { response: 8,  resolution: 24 };
  return                                         { response: 24, resolution: 48 };
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

const STATUS_MAP: Record<string, string> = {
  open: "Open", in_progress: "In Progress", on_hold: "On Hold",
  resolved: "Resolved", closed: "Closed",
};
const PRI_MAP: Record<string, string> = {
  low: "Low", medium: "Medium", high: "High", critical: "Critical",
};

// ── Badge components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    "Open":        "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    "In Progress": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    "On Hold":     "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    "Resolved":    "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    "Closed":      "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${colors[status] ?? "bg-muted text-muted-foreground"}`}>
      {status}
      <ChevronDown size={11} />
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    Low:      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    Medium:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    High:     "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    Critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${colors[priority] ?? "bg-muted text-muted-foreground"}`}>
      {priority}
    </span>
  );
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "w-7 h-7 text-xs" : size === "lg" ? "w-10 h-10 text-sm" : "w-8 h-8 text-xs";
  const colors = ["bg-violet-200 text-violet-700", "bg-blue-200 text-blue-700", "bg-green-200 text-green-700",
    "bg-orange-200 text-orange-700", "bg-rose-200 text-rose-700", "bg-teal-200 text-teal-700"];
  const idx = name.charCodeAt(0) % colors.length;
  return (
    <div className={`${sz} ${colors[idx]} rounded-full flex items-center justify-center font-semibold shrink-0`}>
      {initials(name)}
    </div>
  );
}

// ── Mock fallback data ─────────────────────────────────────────────────────────

const MOCK_CHILD: StoredChildTicket = {
  id: "TKT-2026-00077-1",
  number: "TKT-2026-00077-1",
  parentNumber: "TKT-2026-00077",
  subject: "Alternative supplier options for water cans",
  department: "Account Management",
  category: "General Enquiry",
  subCategory: "Information Request",
  priority: "low",
  assignedTo: "Neha Singh",
  description: "Hi Vikram,\n\nWe are looking for alternative supplier options for 20L water cans for our Bangalore office.\nPlease suggest reliable vendors with pricing and delivery timelines.",
  status: "open",
  created: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  createdBy: "Arjun Kumar",
  clientName: "Apex Tech Solutions",
};

const MOCK_CONVERSATION: ConversationEntry[] = [
  {
    id: "c1",
    kind: "message",
    author: "Arjun Kumar",
    role: "Account Manager",
    time: "31 Jul 2026, 04:10 PM",
    text: "Hi Vikram,\n\nWe are looking for alternative supplier options for 20L water cans for our Bangalore office. Please suggest reliable vendors with pricing and delivery timelines.",
    attachment: { name: "water-can-specs.xlsx", size: "24 KB" },
  },
  {
    id: "c2",
    kind: "message",
    author: "Vikram Sharma",
    role: "Client",
    time: "31 Jul 2026, 04:12 PM",
    text: "Please compare pricing, quality and delivery time for at least 3 vendors and share your recommendation.",
  },
];

const DEPARTMENTS = [
  "Account Management", "IT Support", "Finance", "Procurement",
  "Facilities", "HR", "Operations", "Customer Success",
];

const ASSIGNEES = [
  "Neha Singh", "Arjun Kumar", "Vikram Sharma", "Priya Patel",
  "Rahul Mehta", "Anita Desai", "Suresh Nair",
];

// ── Select component ───────────────────────────────────────────────────────────

function Select({ placeholder, value, options, onChange }: {
  placeholder: string; value: string; options: string[];
  onChange: (v: string) => void;
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
      <button type="button" onClick={() => setOpen(p => !p)}
        className={`w-full flex items-center justify-between px-3 py-2 border border-border rounded-lg text-sm bg-background transition-colors hover:border-primary/50 ${value ? "text-foreground" : "text-muted-foreground"}`}>
        <span>{value || placeholder}</span>
        <ChevronDown size={13} className="text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-lg py-1 max-h-48 overflow-y-auto">
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

// ── SLA Progress bar ──────────────────────────────────────────────────────────

function SLABar({ label, hoursLeft, totalHours, icon }: {
  label: string; hoursLeft: number; totalHours: number; icon: React.ReactNode;
}) {
  const pct = Math.max(0, Math.min(100, (hoursLeft / totalHours) * 100));
  const isAtRisk = pct < 25;
  const barColor = isAtRisk ? "bg-red-500" : pct < 50 ? "bg-orange-400" : "bg-green-500";
  const h = Math.floor(hoursLeft);
  const m = Math.round((hoursLeft - h) * 60);
  const label2 = h > 0 ? `${h}h ${m > 0 ? m + "m" : ""} left (${totalHours}h)` : `${m}m left (${totalHours}h)`;
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}<span>{label}</span></div>
        <span className="text-xs text-muted-foreground">{label2.trim()}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Conversation message ───────────────────────────────────────────────────────

function ConvMessage({ entry }: { entry: ConversationEntry }) {
  const isInternal = entry.kind === "internal";
  return (
    <div className={`flex gap-3 ${isInternal ? "bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3" : ""}`}>
      <Avatar name={entry.author} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-semibold text-sm text-foreground">{entry.author}</span>
          {entry.role && (
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              entry.role === "Client" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" :
              entry.role === "Internal" ? "bg-amber-100 text-amber-700" :
              "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
            }`}>{entry.role}</span>
          )}
          <span className="text-xs text-muted-foreground ml-auto">{entry.time}</span>
          <button className="p-1 rounded hover:bg-muted text-muted-foreground"><MoreHorizontal size={14} /></button>
        </div>
        <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{entry.text}</p>
        {entry.attachment && (
          <div className="mt-2 inline-flex items-center gap-2 px-3 py-2 bg-muted/50 border border-border rounded-lg text-xs text-foreground">
            <FileText size={14} className="text-green-600" />
            <div>
              <p className="font-medium">{entry.attachment.name}</p>
              <p className="text-muted-foreground">{entry.attachment.size}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ChildTicketDetailPage() {
  const { childTicketId } = useParams<{ childTicketId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Load ticket
  const storedChild = useMemo<StoredChildTicket | null>(() => {
    if (!childTicketId) return null;
    const all = loadChildTickets();
    return all.find(c => c.number === childTicketId || c.id === childTicketId) ?? null;
  }, [childTicketId]);

  const ticket = storedChild ?? (childTicketId === "TKT-2026-00077-1" ? MOCK_CHILD : null);

  // Compute derived values
  const statusDisplay = ticket ? (STATUS_MAP[ticket.status] ?? capitalise(ticket.status)) : "Open";
  const priorityDisplay = ticket ? (PRI_MAP[ticket.priority] ?? capitalise(ticket.priority)) : "Low";
  const sla = ticket ? priorityToSLA(ticket.priority) : { response: 24, resolution: 48 };
  const createdTs = ticket ? new Date(ticket.created).getTime() : Date.now() - 3600000;
  const elapsedHrs = (Date.now() - createdTs) / 3600000;
  const responseLeft  = Math.max(0, sla.response  - elapsedHrs);
  const resolutionLeft = Math.max(0, sla.resolution - elapsedHrs);
  const slaOnTrack = resolutionLeft > sla.resolution * 0.25;

  // Local state
  const [activeTab,    setActiveTab]    = useState<"conversation" | "details" | "history" | "attachments" | "activity">("conversation");
  const [conversation, setConversation] = useState<ConversationEntry[]>(
    storedChild
      ? [{
          id: "init",
          kind: "message",
          author: storedChild.createdBy || "System",
          role: "Account Manager",
          time: fmtDate(storedChild.created),
          text: storedChild.description,
        }]
      : MOCK_CONVERSATION
  );
  const [commentFilter, setCommentFilter] = useState<"all" | "internal" | "external">("all");
  const [commentType,   setCommentType]   = useState<"internal" | "external">("internal");
  const [commentText,   setCommentText]   = useState("");
  const [statusLocal,   setStatusLocal]   = useState(statusDisplay);
  const [moveDept,      setMoveDept]      = useState("");
  const [moveAssignee,  setMoveAssignee]  = useState("");
  const [ccSearch,      setCcSearch]      = useState("");
  const [showActions,   setShowActions]   = useState(false);

  const commentRef = useRef<HTMLTextAreaElement>(null);

  const postComment = () => {
    if (!commentText.trim()) return;
    const entry: ConversationEntry = {
      id: `msg-${Date.now()}`,
      kind: commentType,
      author: user?.name ?? "You",
      role: commentType === "internal" ? "Internal" : "Account Manager",
      time: fmtDate(new Date().toISOString()),
      text: commentText.trim(),
    };
    setConversation(c => [...c, entry]);
    setCommentText("");
  };

  const filteredConv = conversation.filter(e => {
    if (commentFilter === "internal") return e.kind === "internal";
    if (commentFilter === "external") return e.kind === "external" || e.kind === "message";
    return true;
  });

  if (!ticket) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={40} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-lg font-semibold text-foreground">Ticket not found</p>
          <p className="text-sm text-muted-foreground mt-1">The child ticket "{childTicketId}" does not exist.</p>
          <button onClick={() => navigate("/support/tickets")}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
            Back to Tickets
          </button>
        </div>
      </div>
    );
  }

  const TABS = [
    { id: "conversation", label: "Conversation",    icon: <MessageSquare size={14} /> },
    { id: "details",      label: "Details",         icon: <FileText size={14} /> },
    { id: "history",      label: "History",         icon: <Clock size={14} /> },
    { id: "attachments",  label: `Attachments (${conversation.filter(e => e.attachment).length})`, icon: <Paperclip size={14} /> },
    { id: "activity",     label: "Activity Log",    icon: <Activity size={14} /> },
  ] as const;

  return (
    <div className="min-h-screen bg-background">
      {/* Breadcrumb */}
      <div className="border-b border-border bg-background">
        <div className="px-4 md:px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
            <button onClick={() => navigate(-1)} className="hover:text-foreground"><Home size={13} /></button>
            <ChevronRight size={11} />
            <Link to="/support" className="hover:text-foreground">Support</Link>
            <ChevronRight size={11} />
            <Link to="/support/tickets" className="hover:text-foreground">Tickets</Link>
            <ChevronRight size={11} />
            <Link to={`/support/ticket/${ticket.parentNumber}`} className="hover:text-foreground text-primary font-medium">
              {ticket.parentNumber}
            </Link>
            <ChevronRight size={11} />
            <span className="hover:text-foreground">Child Ticket</span>
            <ChevronRight size={11} />
            <span className="text-primary font-medium">{ticket.number}</span>
          </nav>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted/50 transition-colors">
              <Edit size={14} />
              Edit Ticket
            </button>
            <div className="relative">
              <button
                onClick={() => setShowActions(p => !p)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
              >
                <MoreHorizontal size={14} />
                More Actions
                <ChevronDown size={13} />
              </button>
              {showActions && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowActions(false)} />
                  <div className="absolute right-0 top-9 z-20 w-48 bg-card border border-border rounded-xl shadow-lg py-1">
                    {getTicketAllowedTransitions(statusLocal, true).map(s => (
                      <button key={s} onClick={() => { setStatusLocal(s); setShowActions(false); }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-muted/60 ${statusLocal === s ? "text-primary font-semibold" : "text-foreground"}`}>
                        {s}
                      </button>
                    ))}
                    {getTicketAllowedTransitions(statusLocal, true).length === 0 && (
                      <p className="px-4 py-2 text-xs text-muted-foreground">No further status changes are available.</p>
                    )}
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => { setActiveTab("conversation"); setTimeout(() => commentRef.current?.focus(), 100); }}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-semibold transition-colors"
            >
              <RotateCcw size={14} />
              Reply
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          {/* ── Left column ── */}
          <div className="space-y-4">
            {/* Ticket header */}
            <div>
              <div className="mb-2">
                <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 uppercase tracking-wide">
                  Child Ticket
                </span>
              </div>
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h1 className="text-2xl font-bold text-foreground">{ticket.number}</h1>
                <StatusBadge status={statusLocal} />
              </div>
              <p className="text-base text-muted-foreground">{ticket.subject}</p>
            </div>

            <WorkflowCheckpoint
              title="Specialist workflow"
              status={statusLocal}
              ownerLabel="Assigned specialist"
              owner={ticket.assignedTo || "Not assigned"}
              nextAction={getTicketNextAction(statusLocal, true)}
              note="The parent CRM remains accountable for customer communication and closure. Resolving this child ticket does not close the parent."
            />

            {/* Meta row */}
            <div className="flex items-start gap-6 flex-wrap border border-border rounded-xl px-4 py-3 bg-card text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Parent Ticket</p>
                <Link to={`/support/ticket/${ticket.parentNumber}`}
                  className="text-primary font-semibold hover:underline">{ticket.parentNumber}</Link>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Client</p>
                <p className="font-semibold text-foreground">{ticket.clientName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Department</p>
                <div className="flex items-center gap-1">
                  <ArrowRight size={13} className="text-muted-foreground" />
                  <span className="font-semibold text-foreground">{ticket.department}</span>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Priority</p>
                <PriorityBadge priority={priorityDisplay} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Created On</p>
                <p className="text-foreground">{fmtDate(ticket.created)}</p>
                <p className="text-xs text-muted-foreground">{ticket.createdBy}@apex.com</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-border">
              <div className="flex gap-0 overflow-x-auto">
                {TABS.map(tab => (
                  <button key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab.icon}{tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            {activeTab === "conversation" && (
              <div className="space-y-4">
                {/* Conversation messages */}
                <div className="space-y-4">
                  {filteredConv.map(entry => (
                    <ConvMessage key={entry.id} entry={entry} />
                  ))}
                </div>

                {/* Add a comment */}
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-foreground">Add a comment / note</p>
                    {/* All / Internal / External filter */}
                    <div className="flex items-center border border-border rounded-lg overflow-hidden text-xs">
                      {(["all", "internal", "external"] as const).map(f => (
                        <button key={f}
                          onClick={() => setCommentFilter(f)}
                          className={`px-3 py-1.5 font-medium transition-colors ${
                            commentFilter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"
                          }`}
                        >
                          {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Internal / External update toggle */}
                  <div className="flex items-center gap-3 mb-3">
                    <button
                      onClick={() => setCommentType("internal")}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        commentType === "internal"
                          ? "bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400"
                          : "border-border text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      <span className="text-base">🔒</span>
                      Internal Update
                      {commentType === "internal" && <span className="text-xs text-muted-foreground ml-1">Visible only to Nido Tech team</span>}
                    </button>
                    <button
                      onClick={() => setCommentType("external")}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        commentType === "external"
                          ? "bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400"
                          : "border-border text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      <span className="text-base">🌐</span>
                      External Update
                      {commentType === "external" && <span className="text-xs text-muted-foreground ml-1">Visible to client</span>}
                    </button>
                  </div>

                  <textarea
                    ref={commentRef}
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    placeholder="Write your comment or update..."
                    rows={4}
                    className="w-full px-3 py-3 border border-border rounded-lg text-sm bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none mb-3"
                  />

                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3 text-muted-foreground text-xs">
                      <button className="flex items-center gap-1 hover:text-foreground transition-colors">
                        <Paperclip size={13} /> Attach File
                      </button>
                      <button className="flex items-center gap-1 hover:text-foreground transition-colors">
                        <Image size={13} /> Attach Image
                      </button>
                      <button className="flex items-center gap-1 hover:text-foreground transition-colors">
                        <Link2 size={13} /> Add Link
                      </button>
                      <p className="text-muted-foreground/60 hidden md:block">
                        You can attach up to 5 files. Max file size 10MB each. Supported formats: PDF, JPG, PNG, DOC, XLS, ZIP
                      </p>
                    </div>
                    <button
                      onClick={postComment}
                      disabled={!commentText.trim()}
                      className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      Post Comment
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "details" && (
              <div className="bg-card border border-border rounded-xl p-5 space-y-3 text-sm">
                {[
                  { label: "Subject",      value: ticket.subject },
                  { label: "Category",     value: ticket.category },
                  { label: "Sub Category", value: ticket.subCategory },
                  { label: "Department",   value: ticket.department },
                  { label: "Assigned To",  value: ticket.assignedTo },
                  { label: "Description",  value: ticket.description },
                ].map(({ label, value }) => (
                  <div key={label} className="flex gap-4">
                    <span className="text-muted-foreground w-32 shrink-0">{label}</span>
                    <span className="text-foreground whitespace-pre-line">{value || "—"}</span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "history" && (
              <div className="bg-card border border-border rounded-xl p-5">
                <p className="text-sm text-muted-foreground text-center py-6">No history entries yet.</p>
              </div>
            )}

            {activeTab === "attachments" && (
              <div className="bg-card border border-border rounded-xl p-5">
                {conversation.filter(e => e.attachment).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No attachments.</p>
                ) : (
                  <div className="space-y-2">
                    {conversation.filter(e => e.attachment).map(e => (
                      <div key={e.id} className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
                        <FileText size={16} className="text-green-600" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{e.attachment!.name}</p>
                          <p className="text-xs text-muted-foreground">{e.attachment!.size} · {e.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "activity" && (
              <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                {[
                  { time: fmtDate(ticket.created), text: `Ticket created by ${ticket.createdBy}`, icon: <CheckCircle size={13} className="text-green-500" /> },
                  { time: fmtDate(ticket.created), text: `Assigned to ${ticket.assignedTo}`,        icon: <AlertCircle size={13} className="text-blue-500" /> },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <div className="mt-0.5">{item.icon}</div>
                    <div>
                      <p className="text-foreground">{item.text}</p>
                      <p className="text-xs text-muted-foreground">{item.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Right sidebar ── */}
          <div className="space-y-4">
            {/* SLA Progress */}
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-foreground">SLA Progress</h3>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${slaOnTrack ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"}`}>
                  {slaOnTrack ? "On Track" : "At Risk"}
                </span>
              </div>
              <SLABar
                label="Response Time"
                hoursLeft={responseLeft}
                totalHours={sla.response}
                icon={<Clock size={12} />}
              />
              <SLABar
                label="Resolution Time"
                hoursLeft={resolutionLeft}
                totalHours={sla.resolution}
                icon={<Clock size={12} />}
              />
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-border text-xs text-muted-foreground">
                <span>SLA Policy: Standard SLA</span>
                <button className="text-primary hover:underline flex items-center gap-0.5">
                  View SLA Details <ArrowRight size={11} />
                </button>
              </div>
            </div>

            {/* Move Ticket to Another Department */}
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <ArrowRight size={15} className="text-primary" />
                <h3 className="text-sm font-bold text-foreground">Move Ticket to Another Department</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Current Department</p>
                  <span className="inline-block px-2.5 py-1 bg-muted border border-border rounded-lg text-xs font-semibold text-foreground">
                    {ticket.department}
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Select Department <span className="text-red-500">*</span>
                  </label>
                  <Select placeholder="Select Department" value={moveDept} options={DEPARTMENTS} onChange={setMoveDept} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Assign To (in new department) <span className="text-red-500">*</span>
                  </label>
                  <Select placeholder="Select Assignee" value={moveAssignee} options={ASSIGNEES} onChange={setMoveAssignee} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">CC (Internal) <span className="text-muted-foreground font-normal">(Optional)</span></label>
                  <div className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm bg-background">
                    <Search size={13} className="text-muted-foreground shrink-0" />
                    <input
                      value={ccSearch}
                      onChange={e => setCcSearch(e.target.value)}
                      placeholder="Search and add users..."
                      className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Add internal users to receive updates and notifications.</p>
                </div>
                <button
                  disabled={!moveDept || !moveAssignee}
                  className="w-full py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  Move Ticket
                </button>
              </div>
            </div>

            {/* Child Ticket Information */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-sm font-bold text-foreground mb-3">Child Ticket Information</h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ticket ID</span>
                  <span className="font-semibold text-foreground text-xs">{ticket.number}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Type</span>
                  <span className="px-2 py-0.5 bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 rounded text-xs font-semibold">Child Ticket</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Status</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    statusLocal === "Open" ? "bg-blue-100 text-blue-700" :
                    statusLocal === "In Progress" ? "bg-amber-100 text-amber-700" :
                    statusLocal === "Resolved" ? "bg-green-100 text-green-700" :
                    "bg-muted text-muted-foreground"
                  }`}>{statusLocal}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Priority</span>
                  <PriorityBadge priority={priorityDisplay} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Assigned To</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-foreground text-xs">{ticket.assignedTo}</span>
                    <Mail size={12} className="text-muted-foreground" />
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created On</span>
                  <span className="text-foreground text-xs text-right">{fmtDate(ticket.created)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Updated</span>
                  <span className="text-foreground text-xs text-right">{fmtDate(ticket.created)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
