import { useState, useMemo, useRef, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ChevronRight, Home, MoreHorizontal, RotateCcw, Clock, CheckCircle,
  Paperclip, Smile, Bold, Italic, List, ListOrdered, Link2,
  ChevronDown, Search, X, ExternalLink, Mail, AlertCircle,
  FileText, Activity, MessageSquare, Info, Send,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { WorkflowCheckpoint } from "@/components/workflow/WorkflowCheckpoint";
import { getTicketAllowedTransitions, getTicketNextAction } from "@/lib/ticketWorkflow";

// ─── Types ───────────────────────────────────────────────────────────────────

interface StoredTicketRaw {
  id: string; number: string; subject: string; status: string;
  priority: string; created: string; clientName?: string; department?: string;
  createdBy?: string; category?: string; subCategory?: string;
  description?: string; ccEmail?: string; clientId?: string;
}

interface ConversationEntry {
  id: string;
  kind: "message" | "internal_note" | "system";
  author: string;
  role: string;
  time: string;
  text: string;
  note?: string;          // internal note attached to a message
  attachment?: { name: string; size: string };
}

interface TicketData {
  number: string;
  subject: string;
  type: "Parent Ticket" | "Child Ticket";
  status: string;
  priority: string;
  client: string;
  department: string;
  createdBy: string;
  createdByEmail: string;
  createdOn: string;
  lastUpdated: string;
  assignedTo: string;
  assignedRole: string;
  description: string;
  category: string;
  subCategory: string;
  conversation: ConversationEntry[];
  childCount: number;
  attachmentCount: number;
  slaResponseHrs: number;
  slaResolutionHrs: number;
  createdTimestamp: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function priorityToSLA(priority: string): { response: number; resolution: number } {
  const p = priority.toLowerCase();
  if (p === "high" || p === "critical") return { response: 4,  resolution: 12 };
  if (p === "medium")                   return { response: 8,  resolution: 24 };
  return                                       { response: 24, resolution: 48 };
}

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

function loadStoredTickets(): StoredTicketRaw[] {
  try {
    const r = localStorage.getItem("nido_support_tickets_v1");
    return r ? JSON.parse(r) : [];
  } catch { return []; }
}

function saveStoredTickets(tickets: StoredTicketRaw[]) {
  try {
    localStorage.setItem("nido_support_tickets_v1", JSON.stringify(tickets));
    window.dispatchEvent(new CustomEvent("supportTicketsUpdated"));
  } catch {}
}

// ─── Mock Conversations per ticket ──────────────────────────────────────────

const MOCK_CONVERSATIONS: Record<string, ConversationEntry[]> = {
  "TKT-2026-00077": [
    { id: "c1", kind: "message", author: "Vikram Sharma", role: "Client",
      time: "31 Jul 2026, 03:45 PM",
      text: "We need more 20L water cans for our Bangalore office pantry. Current stock will last only for 2 days.",
      attachment: { name: "water-can-request.xlsx", size: "24 KB" } },
    { id: "c2", kind: "message", author: "Arjun Kumar", role: "Account Manager",
      time: "31 Jul 2026, 04:10 PM",
      text: "Hi Vikram,\n\nThanks for reaching out. We will arrange the required water cans for your Bangalore office.\nCreating a request with the account management team to process this.\n\nRegards,\nArjun Kumar",
      note: "Client needs 20L Water Cans. Creating child ticket for Account Management team to process the request.\n– Arjun Kumar" },
    { id: "c3", kind: "system", author: "System", role: "system",
      time: "31 Jul 2026, 04:12 PM",
      text: "Child Ticket TKT-2026-00077-1 has been created and assigned to Account Management team." },
  ],
  "TKT-2026-00078": [
    { id: "c1", kind: "message", author: "Priya Nair", role: "Client",
      time: "01 Aug 2026, 09:12 AM",
      text: "The printer on Office Floor 2 has stopped working since morning. Multiple employees are affected and we need it fixed urgently." },
  ],
  "TKT-2026-00076": [
    { id: "c1", kind: "message", author: "Ravi Menon", role: "Client",
      time: "31 Jul 2026, 11:05 AM",
      text: "Our monthly pantry items for August have not been delivered yet. The order was placed 10 days ago. Please check and arrange for immediate delivery." },
  ],
  "TKT-2026-00075": [
    { id: "c1", kind: "message", author: "Meena Pillai", role: "Client",
      time: "31 Jul 2026, 09:30 AM",
      text: "We have 5 new employees joining next week and need ID cards ready by Monday. Please process this at the earliest." },
    { id: "c2", kind: "message", author: "Admin", role: "Account Manager",
      time: "31 Jul 2026, 10:15 AM",
      text: "Hi Meena, we have received your request. The ID card issuance requires sign-off from HR. We are awaiting their confirmation before proceeding." },
  ],
};

// ─── Mock Ticket fallback data ────────────────────────────────────────────────

const MOCK_TICKET_MAP: Record<string, Partial<TicketData>> = {
  "TKT-2026-00077": {
    subject: "Need more 20L Water Cans for Bangalore office",
    type: "Parent Ticket", status: "In Progress", priority: "Low",
    client: "Apex Tech Solutions", department: "Account Management",
    createdBy: "Vikram Sharma", createdByEmail: "vikram.sharma@apex.com",
    createdOn: "31 Jul 2026, 03:45 PM", lastUpdated: "31 Jul 2026, 04:12 PM",
    assignedTo: "Arjun Kumar", assignedRole: "Customer Relationship Manager",
    description: "We need more 20L water cans for our Bangalore office pantry. Current stock will last only for 2 days.",
    category: "General Enquiry", subCategory: "Information Request",
    childCount: 1, attachmentCount: 1,
    createdTimestamp: new Date("2026-07-31T10:15:00Z").getTime(),
  },
  "TKT-2026-00078": {
    subject: "Printer not working in Office Floor 2",
    type: "Parent Ticket", status: "Open", priority: "Medium",
    client: "Apex Tech Solutions", department: "Account Management",
    createdBy: "Priya Nair", createdByEmail: "priya.nair@apex.com",
    createdOn: "01 Aug 2026, 09:12 AM", lastUpdated: "01 Aug 2026, 09:12 AM",
    assignedTo: "Support Team", assignedRole: "Customer Relationship Manager",
    description: "The printer on Office Floor 2 has stopped working since morning.",
    category: "Platform / System", subCategory: "System Errors",
    childCount: 0, attachmentCount: 0,
    createdTimestamp: new Date("2026-08-01T03:42:00Z").getTime(),
  },
  "TKT-2026-00076": {
    subject: "Monthly pantry items not delivered",
    type: "Parent Ticket", status: "Open", priority: "High",
    client: "Cloud Systems India", department: "Account Management",
    createdBy: "Ravi Menon", createdByEmail: "ravi@cloudsystems.in",
    createdOn: "31 Jul 2026, 11:05 AM", lastUpdated: "31 Jul 2026, 11:05 AM",
    assignedTo: "Support Team", assignedRole: "Customer Relationship Manager",
    description: "Our monthly pantry items for August have not been delivered yet.",
    category: "General Enquiry", subCategory: "Information Request",
    childCount: 0, attachmentCount: 0,
    createdTimestamp: new Date("2026-07-31T05:35:00Z").getTime(),
  },
  "TKT-2026-00075": {
    subject: "Request for new employee ID cards",
    type: "Parent Ticket", status: "On Hold", priority: "Medium",
    client: "Cloud Systems India", department: "Account Management",
    createdBy: "Meena Pillai", createdByEmail: "meena@cloudsystems.in",
    createdOn: "31 Jul 2026, 09:30 AM", lastUpdated: "31 Jul 2026, 10:15 AM",
    assignedTo: "HR Coordinator", assignedRole: "Customer Relationship Manager",
    description: "We have 5 new employees joining next week and need ID cards ready by Monday.",
    category: "User Management", subCategory: "Account Setup",
    childCount: 0, attachmentCount: 0,
    createdTimestamp: new Date("2026-07-31T04:00:00Z").getTime(),
  },
};

// ─── Status / Priority Badges ─────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    "Open":        "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    "In Progress": "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    "On Hold":     "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    "Resolved":    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    "Closed":      "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${map[status] ?? "bg-muted text-muted-foreground"}`}>
      {status}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    High:     "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    Medium:   "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    Low:      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    Critical: "bg-red-200 text-red-800",
  };
  const p = priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase();
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${map[p] ?? "bg-muted text-muted-foreground"}`}>
      {p}
    </span>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-blue-600", "bg-teal-600", "bg-purple-600", "bg-rose-600",
  "bg-amber-600", "bg-indigo-600", "bg-green-600", "bg-cyan-600",
];
function avatarColor(name: string) {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffff;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "w-8 h-8 text-xs" : "w-9 h-9 text-sm";
  return (
    <div className={`${sz} rounded-full ${avatarColor(name)} flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {initials(name)}
    </div>
  );
}

// ─── SLA Progress Bar ─────────────────────────────────────────────────────────

function SLABar({ elapsedMins, targetHrs, label }: { elapsedMins: number; targetHrs: number; label: string }) {
  const targetMins = targetHrs * 60;
  const pct = Math.min(100, Math.round((elapsedMins / targetMins) * 100));
  const remaining = Math.max(0, targetMins - elapsedMins);
  const days = Math.floor(remaining / (24 * 60));
  const hrs  = Math.floor((remaining % (24 * 60)) / 60);
  const mins = remaining % 60;
  let timeStr = "";
  if (days > 0) timeStr += `${days}d `;
  timeStr += `${hrs}h`;
  if (mins > 0) timeStr += ` ${mins}m`;
  timeStr += ` left (${targetHrs}h)`;

  const color = pct > 80 ? "bg-red-500" : pct > 50 ? "bg-orange-400" : "bg-green-500";
  const isDanger = pct > 80;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock size={11} />
          {remaining === 0 ? "SLA Breached" : timeStr}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color} ${isDanger ? "opacity-80" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── CC Users component ───────────────────────────────────────────────────────

const SAMPLE_USERS = [
  "Neha Singh", "Rohit Mehta", "Priya Nair", "Arjun Kumar",
  "Meena Pillai", "Ravi Menon", "Sanjay Gupta", "Anita Reddy",
];

function CCUsers() {
  const [query, setQuery]   = useState("");
  const [added, setAdded]   = useState<string[]>(["Neha Singh", "Rohit Mehta"]);
  const [focused, setFocused] = useState(false);

  const suggestions = query.length > 0
    ? SAMPLE_USERS.filter(u => u.toLowerCase().includes(query.toLowerCase()) && !added.includes(u))
    : [];

  return (
    <div>
      <div className="flex items-center gap-1 mb-2">
        <span className="text-xs font-semibold text-foreground">CC (Internal)</span>
        <span className="text-xs text-muted-foreground">(Optional)</span>
      </div>
      <div className="relative">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border rounded-lg bg-background">
          <Search size={13} className="text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            placeholder="Search users..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            className="flex-1 text-xs bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
          />
        </div>
        {focused && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 py-1">
            {suggestions.map(u => (
              <button key={u} onMouseDown={() => { setAdded(a => [...a, u]); setQuery(""); }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-muted/60 text-foreground">
                {u}
              </button>
            ))}
          </div>
        )}
      </div>
      {added.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {added.map(u => (
            <span key={u} className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-full text-xs font-medium">
              {u}
              <button onClick={() => setAdded(a => a.filter(x => x !== u))} className="hover:text-red-500 transition-colors">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
      <p className="flex items-start gap-1 text-xs text-muted-foreground mt-2">
        <Info size={11} className="mt-0.5 flex-shrink-0" />
        These users will be notified and can view this ticket.
      </p>
    </div>
  );
}

// ─── Conversation Message ─────────────────────────────────────────────────────

function ConvMessage({ entry }: { entry: ConversationEntry }) {
  const [menuOpen, setMenuOpen] = useState(false);

  if (entry.kind === "system") {
    return (
      <div className="flex items-start gap-3 py-3">
        <div className="w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
          <Activity size={15} className="text-purple-600 dark:text-purple-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">System</span>
            <span className="text-xs text-muted-foreground">{entry.time}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{entry.text}</p>
        </div>
      </div>
    );
  }

  const isClient = entry.role === "Client";
  const roleStyle = isClient
    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";

  return (
    <div className="flex items-start gap-3 py-4 border-b border-border last:border-0">
      <Avatar name={entry.author} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">{entry.author}</span>
            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${roleStyle}`}>{entry.role}</span>
            <span className="text-xs text-muted-foreground">{entry.time}</span>
          </div>
          <div className="relative flex-shrink-0">
            <button onClick={() => setMenuOpen(p => !p)}
              className="p-1 rounded hover:bg-muted/60 text-muted-foreground">
              <MoreHorizontal size={15} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-7 z-20 w-36 bg-card border border-border rounded-xl shadow-lg py-1">
                  {["Reply", "Quote Reply", "Copy Text"].map(item => (
                    <button key={item} onClick={() => setMenuOpen(false)}
                      className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-muted/60">{item}</button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <p className="text-sm text-foreground mt-1.5 whitespace-pre-line">{entry.text}</p>

        {entry.attachment && (
          <div className="mt-2 inline-flex items-center gap-2 px-3 py-2 bg-muted/40 border border-border rounded-lg text-xs">
            <FileText size={14} className="text-muted-foreground" />
            <span className="text-foreground font-medium">{entry.attachment.name}</span>
            <span className="text-muted-foreground">{entry.attachment.size}</span>
          </div>
        )}

        {entry.note && (
          <div className="mt-3 px-3 py-2.5 bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 rounded-r-lg">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-0.5">Note (Internal)</p>
            <p className="text-xs text-amber-800 dark:text-amber-300 whitespace-pre-line">{entry.note}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TicketDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate     = useNavigate();
  const { user }     = useAuth();

  // ── Load ticket data ──
  const ticketData = useMemo<TicketData | null>(() => {
    if (!ticketId) return null;

    // Try localStorage first (real tickets)
    const stored = loadStoredTickets().find(t => t.number === ticketId || t.id === ticketId);
    if (stored) {
      const sla = priorityToSLA(stored.priority);
      const ts  = new Date(stored.created).getTime();
      const statusMap: Record<string, string> = {
        open: "Open", in_progress: "In Progress", on_hold: "On Hold",
        resolved: "Resolved", closed: "Closed",
      };
      const priMap: Record<string, string> = {
        low: "Low", medium: "Medium", high: "High", critical: "Critical",
      };
      const createdDate = new Date(stored.created);
      const createdOn = createdDate.toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
      }) + ", " + createdDate.toLocaleTimeString("en-IN", {
        hour: "2-digit", minute: "2-digit", hour12: true,
      });

      const initialMsg: ConversationEntry = {
        id: "init",
        kind: "message",
        author: stored.createdBy || user?.name || "User",
        role: "Client",
        time: createdOn,
        text: stored.description || stored.subject,
        attachment: undefined,
        note: undefined,
      };

      return {
        number:       stored.number,
        subject:      stored.subject,
        type:         "Parent Ticket",
        status:       statusMap[stored.status] ?? "Open",
        priority:     priMap[stored.priority]  ?? "Medium",
        client:       stored.clientName || "—",
        department:   stored.department || "Customer Relationship Manager",
        createdBy:    stored.createdBy  || "System",
        createdByEmail: "",
        createdOn,
        lastUpdated:  createdOn,
        assignedTo:   "CRM",
        assignedRole: "Customer Relationship Manager",
        description:  stored.description || stored.subject,
        category:     stored.category    || "General",
        subCategory:  stored.subCategory || "—",
        childCount:   0,
        attachmentCount: 0,
        slaResponseHrs:   sla.response,
        slaResolutionHrs: sla.resolution,
        createdTimestamp: ts,
        conversation: [initialMsg],
      };
    }

    // Fallback to mock data
    const mock = MOCK_TICKET_MAP[ticketId!];
    if (!mock) return null;

    const sla = priorityToSLA(mock.priority || "medium");
    return {
      number:           ticketId!,
      subject:          mock.subject          || "",
      type:             mock.type             || "Parent Ticket",
      status:           mock.status           || "Open",
      priority:         mock.priority         || "Medium",
      client:           mock.client           || "—",
      department:       mock.department       || "—",
      createdBy:        mock.createdBy        || "—",
      createdByEmail:   mock.createdByEmail   || "",
      createdOn:        mock.createdOn        || "—",
      lastUpdated:      mock.lastUpdated      || "—",
      assignedTo:       mock.assignedTo       || "Support Team",
      assignedRole:     mock.assignedRole     || "Customer Relationship Manager",
      description:      mock.description      || "",
      category:         mock.category         || "—",
      subCategory:      mock.subCategory      || "—",
      childCount:       mock.childCount        ?? 0,
      attachmentCount:  mock.attachmentCount   ?? 0,
      slaResponseHrs:   sla.response,
      slaResolutionHrs: sla.resolution,
      createdTimestamp: mock.createdTimestamp  ?? Date.now() - 3600000,
      conversation: MOCK_CONVERSATIONS[ticketId!] ?? [],
    };
  }, [ticketId, user]);

  // ── Local state ──
  const [activeTab,     setActiveTab]     = useState<"conversation"|"details"|"children"|"attachments"|"activity">("conversation");
  const [replyText,     setReplyText]     = useState("");
  const [conversation,  setConversation]  = useState<ConversationEntry[]>(ticketData?.conversation ?? []);
  const [statusLocal,   setStatusLocal]   = useState(ticketData?.status   ?? "Open");
  const [priorityLocal, setPriorityLocal] = useState(ticketData?.priority ?? "Medium");
  const [showMoreMenu,  setShowMoreMenu]  = useState(false);
  const [showStatusSub, setShowStatusSub] = useState(false);
  const replyRef = useRef<HTMLTextAreaElement>(null);

  // Keep conversation in sync if ticketData changes (e.g. navigation)
  useEffect(() => {
    if (ticketData) {
      setConversation(ticketData.conversation);
      setStatusLocal(ticketData.status);
      setPriorityLocal(ticketData.priority);
    }
  }, [ticketData]);

  // ── SLA ──
  const elapsedMins = ticketData
    ? Math.floor((Date.now() - ticketData.createdTimestamp) / 60000)
    : 0;

  // ── Not found ──
  if (!ticketData) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <AlertCircle size={48} className="text-muted-foreground" />
        <h1 className="text-xl font-bold text-foreground">Ticket not found</h1>
        <p className="text-sm text-muted-foreground">"{ticketId}" does not exist.</p>
        <button onClick={() => navigate("/support/tickets")}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold">
          Back to Tickets
        </button>
      </div>
    );
  }

  // ── Send reply ──
  function handleSendReply() {
    const text = replyText.trim();
    if (!text) return;
    const now = new Date();
    const time = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
      + ", " + now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
    const entry: ConversationEntry = {
      id: `reply_${Date.now()}`,
      kind: "message",
      author: user?.name || "You",
      role: "Customer Relationship Manager",
      time,
      text,
    };
    setConversation(prev => [...prev, entry]);
    setReplyText("");

    // Persist last-updated in localStorage if it's a real ticket
    const all = loadStoredTickets();
    const idx = all.findIndex(t => t.number === ticketId || t.id === ticketId);
    if (idx !== -1) {
      all[idx] = { ...all[idx], status: statusLocal.toLowerCase().replace(" ", "_") };
      saveStoredTickets(all);
    }
  }

  // ── Change status ──
  function changeStatus(s: string) {
    setStatusLocal(s);
    setShowMoreMenu(false);
    const all = loadStoredTickets();
    const idx = all.findIndex(t => t.number === ticketId || t.id === ticketId);
    if (idx !== -1) {
      all[idx] = { ...all[idx], status: s.toLowerCase().replace(/ /g, "_") };
      saveStoredTickets(all);
    }
  }

  // ── execFormat for reply toolbar ──
  function execFormat(cmd: string) {
    const ta = replyRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const sel   = replyText.slice(start, end);
    const wrapMap: Record<string, [string, string]> = {
      bold: ["**", "**"], italic: ["_", "_"],
    };
    if (wrapMap[cmd]) {
      const [open, close] = wrapMap[cmd];
      setReplyText(replyText.slice(0, start) + open + sel + close + replyText.slice(end));
    }
    ta.focus();
  }

  const PRIORITIES = ["Low", "Medium", "High", "Critical"];

  return (
    <div className="min-h-screen bg-background">

      {/* ── Breadcrumb ── */}
      <div className="border-b border-border bg-background">
        <div className="px-4 md:px-6 py-3">
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground flex items-center"><Home size={12} /></Link>
            <ChevronRight size={10} />
            <Link to="/support" className="hover:text-foreground">Support</Link>
            <ChevronRight size={10} />
            <button onClick={() => navigate("/support/tickets")} className="hover:text-foreground">Tickets</button>
            <ChevronRight size={10} />
            <span className="text-foreground font-medium">{ticketData.number}</span>
          </nav>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-0 h-[calc(100vh-89px)]">

        {/* ════ LEFT PANEL ════════════════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* ── Ticket header ── */}
          <div className="px-4 md:px-6 py-4 border-b border-border bg-background">
            {/* Row 1: ID + badges */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <h1 className="text-xl font-bold text-foreground">{ticketData.number}</h1>
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold border border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20">
                {ticketData.type}
              </span>
              <StatusBadge status={statusLocal} />
            </div>

            {/* Row 2: subject */}
            <p className="text-base font-semibold text-foreground mb-1">{ticketData.subject}</p>

            {/* Row 3: meta + actions */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <p className="text-xs text-muted-foreground">
                Created on {ticketData.createdOn}&nbsp;•&nbsp;by {ticketData.client} ({ticketData.createdBy})
              </p>

              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Assigned To */}
                <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground mr-2">
                  <span>Assigned To ({ticketData.assignedRole})</span>
                  <div className="flex items-center gap-1.5">
                    <Avatar name={ticketData.assignedTo} size="sm" />
                    <div>
                      <p className="text-xs font-semibold text-foreground leading-tight">{ticketData.assignedTo}</p>
                      <p className="text-xs text-muted-foreground leading-tight">{ticketData.assignedRole}</p>
                    </div>
                    <button className="ml-1 p-1 rounded hover:bg-muted/60 text-muted-foreground">
                      <Mail size={13} />
                    </button>
                  </div>
                </div>

                {/* More button */}
                <div className="relative">
                  <button
                    onClick={() => setShowMoreMenu(p => !p)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <MoreHorizontal size={15} />
                    More
                  </button>
                  {showMoreMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => { setShowMoreMenu(false); setShowStatusSub(false); }} />
                      <div className="absolute right-0 top-9 z-20 w-52 bg-card border border-border rounded-xl shadow-lg py-1">

                        {/* 1. Create Child Ticket */}
                        <button
                          onClick={() => { setShowMoreMenu(false); setShowStatusSub(false); navigate(`/support/create-child-ticket/${ticketData?.number}`); }}
                          className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted/60 transition-colors"
                        >
                          Create Child Ticket
                        </button>

                        <div className="border-t border-border my-1" />

                        {/* 2. Change Status (with submenu) */}
                        <div className="relative">
                          <button
                            onClick={() => setShowStatusSub(p => !p)}
                            className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted/60 transition-colors flex items-center justify-between"
                          >
                            Change Status
                            <ChevronRight size={14} className={`transition-transform ${showStatusSub ? "rotate-90" : ""}`} />
                          </button>
                          {showStatusSub && (
                            <div className="bg-muted/40 border-t border-border">
                              {getTicketAllowedTransitions(statusLocal).map(s => (
                                <button key={s} onClick={() => { changeStatus(s); setShowStatusSub(false); }}
                                  className={`w-full text-left px-6 py-2 text-sm hover:bg-muted/60 transition-colors ${statusLocal === s ? "text-primary font-semibold" : "text-foreground"}`}>
                                  {s}
                                </button>
                              ))}
                              {getTicketAllowedTransitions(statusLocal).length === 0 && (
                                <p className="px-6 py-2 text-xs text-muted-foreground">No further status changes are available.</p>
                              )}
                            </div>
                          )}
                        </div>

                      </div>
                    </>
                  )}
                </div>

                {/* Reply button */}
                <button
                  onClick={() => { setActiveTab("conversation"); setTimeout(() => replyRef.current?.focus(), 100); }}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-semibold transition-colors"
                >
                  <RotateCcw size={14} />
                  Reply
                </button>
              </div>
            </div>
          </div>

          {/* ── Issue Description box ── */}
          <div className="px-4 md:px-6 py-4 border-b border-border bg-blue-50/30 dark:bg-blue-950/10">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <MessageSquare size={15} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Issue Description (as submitted by client)</p>
                <p className="text-sm text-foreground">{ticketData.description}</p>
              </div>
            </div>
          </div>

          <div className="px-4 md:px-6 py-3 border-b border-border bg-background">
            <WorkflowCheckpoint
              title="Ticket workflow"
              status={statusLocal}
              ownerLabel="Client CRM / relationship owner"
              owner={/crm/i.test(ticketData.assignedRole) ? ticketData.assignedTo : "Not recorded"}
              nextAction={getTicketNextAction(statusLocal)}
              note={
                ticketData.childCount > 0
                  ? `Review the ${ticketData.childCount} linked child ticket${ticketData.childCount === 1 ? "" : "s"} before resolving or closing the parent. Specialist work does not close the parent ticket.`
                  : "Resolved means work is complete with evidence. Closed means the client or CRM has validated and accepted the resolution."
              }
            />
          </div>

          {/* ── Tabs ── */}
          <div className="px-4 md:px-6 border-b border-border bg-background">
            <div className="flex gap-0">
              {([
                { id: "conversation", label: "Conversation",       icon: <MessageSquare size={13} /> },
                { id: "details",      label: "Details",            icon: <Info size={13} /> },
                { id: "children",     label: `Child Tickets${ticketData.childCount > 0 ? ` (${ticketData.childCount})` : ""}`, icon: <Paperclip size={13} /> },
                { id: "attachments",  label: `Attachments${ticketData.attachmentCount > 0 ? ` (${ticketData.attachmentCount})` : ""}`, icon: <FileText size={13} /> },
                { id: "activity",     label: "Activity Log",       icon: <Activity size={13} /> },
              ] as const).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Tab content ── */}
          <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4">

            {/* Conversation tab */}
            {activeTab === "conversation" && (
              <div>
                {conversation.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No messages yet.</p>
                ) : (
                  conversation.map(entry => (
                    <ConvMessage key={entry.id} entry={entry} />
                  ))
                )}
              </div>
            )}

            {/* Details tab */}
            {activeTab === "details" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                {[
                  { label: "Category",    value: ticketData.category    },
                  { label: "Sub Category",value: ticketData.subCategory },
                  { label: "Department",  value: ticketData.department  },
                  { label: "Client",      value: ticketData.client      },
                  { label: "Created By",  value: ticketData.createdBy   },
                  { label: "Assigned To", value: ticketData.assignedTo  },
                ].map(item => (
                  <div key={item.label} className="p-3 rounded-lg border border-border bg-card">
                    <p className="text-xs text-muted-foreground mb-0.5">{item.label}</p>
                    <p className="text-sm font-medium text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Child Tickets tab */}
            {activeTab === "children" && (
              <div>
                {ticketData.childCount === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Paperclip size={32} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No child tickets for this ticket.</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Child ticket data coming from conversation thread.</p>
                )}
              </div>
            )}

            {/* Attachments tab */}
            {activeTab === "attachments" && (
              <div>
                {ticketData.attachmentCount === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText size={32} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No attachments on this ticket.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {conversation.filter(c => c.attachment).map(c => (
                      <div key={c.id} className="flex items-center gap-3 px-4 py-3 border border-border rounded-lg bg-card">
                        <FileText size={18} className="text-blue-500" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{c.attachment!.name}</p>
                          <p className="text-xs text-muted-foreground">{c.attachment!.size}</p>
                        </div>
                        <button className="text-xs text-primary hover:underline">Download</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Activity Log tab */}
            {activeTab === "activity" && (
              <div className="space-y-3">
                {[
                  { time: ticketData.createdOn,    text: `Ticket ${ticketData.number} created by ${ticketData.createdBy}`, icon: <CheckCircle size={13} className="text-green-500" /> },
                  { time: ticketData.lastUpdated,  text: `Status set to ${statusLocal}`,                                    icon: <Activity size={13} className="text-blue-500" /> },
                  { time: ticketData.createdOn,    text: `Priority set to ${priorityLocal}`,                                icon: <AlertCircle size={13} className="text-orange-500" /> },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                    <div className="mt-0.5">{item.icon}</div>
                    <div className="flex-1">
                      <p className="text-sm text-foreground">{item.text}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Reply area ── */}
          {activeTab === "conversation" && (
            <div className="border-t border-border bg-background px-4 md:px-6 py-4 flex-shrink-0">
              {/* Reply type tabs */}
              <div className="flex gap-0 mb-3 border-b border-border">
                <button
                  className="px-4 py-2 text-sm font-medium border-b-2 border-primary text-primary"
                >
                  External Reply
                </button>
              </div>

              <textarea
                ref={replyRef}
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="Type your message..."
                rows={3}
                className={`w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none mb-3 ${
                  ""
                }`}
              />

              {/* Toolbar + send */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  {[
                    { icon: <Paperclip size={15} />, action: () => {} },
                    { icon: <Smile size={15} />,     action: () => {} },
                    { icon: <Bold size={15} />,       action: () => execFormat("bold") },
                    { icon: <Italic size={15} />,     action: () => execFormat("italic") },
                    { icon: <List size={15} />,       action: () => {} },
                    { icon: <ListOrdered size={15} />,action: () => {} },
                    { icon: <Link2 size={15} />,      action: () => {} },
                  ].map((btn, i) => (
                    <button key={i} type="button" onClick={btn.action}
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                      {btn.icon}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-0">
                  <button
                    onClick={handleSendReply}
                    disabled={!replyText.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-l-lg text-sm font-semibold disabled:opacity-50 transition-colors"
                  >
                    <Send size={14} />
                    Send Reply
                  </button>
                  <button className="px-2 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-r-lg border-l border-primary-foreground/20 transition-colors">
                    <ChevronDown size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ════ RIGHT SIDEBAR ═════════════════════════════════════════════════ */}
        <div className="w-full lg:w-80 xl:w-96 border-l border-border bg-card overflow-y-auto flex-shrink-0">
          <div className="p-4 space-y-5">

            {/* SLA Progress */}
            <div className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-foreground">SLA Progress</span>
                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  elapsedMins < ticketData.slaResolutionHrs * 60 * 0.8
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                }`}>
                  {elapsedMins < ticketData.slaResolutionHrs * 60 * 0.8 ? "On Track" : "At Risk"}
                </span>
              </div>

              {/* Description snippet */}
              <div className="mb-3 p-2.5 bg-muted/30 rounded-lg">
                <p className="text-xs font-semibold text-muted-foreground mb-0.5">Issue Description (as submitted by client)</p>
                <p className="text-xs text-foreground line-clamp-2">"{ticketData.description}"</p>
              </div>

              <SLABar elapsedMins={elapsedMins} targetHrs={ticketData.slaResponseHrs}   label="Response Time"   />
              <SLABar elapsedMins={elapsedMins} targetHrs={ticketData.slaResolutionHrs} label="Resolution Time" />

              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-muted-foreground">SLA Policy: Standard SLA</span>
                <button className="flex items-center gap-1 text-xs text-primary hover:underline">
                  View SLA Details <ExternalLink size={10} />
                </button>
              </div>
            </div>

            {/* CC (Internal) */}
            <div className="rounded-xl border border-border bg-background p-4">
              <CCUsers />
            </div>

            {/* Ticket Information */}
            <div className="rounded-xl border border-border bg-background p-4">
              <h3 className="text-sm font-bold text-foreground mb-4">Ticket Information</h3>
              <div className="space-y-3">
                {[
                  { label: "Ticket ID",   value: <span className="text-sm text-foreground font-medium">{ticketData.number}</span> },
                  { label: "Type",        value: <span className="inline-flex px-2.5 py-0.5 rounded text-xs font-semibold border border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20">{ticketData.type}</span> },
                  { label: "Status",      value: <StatusBadge status={statusLocal} /> },
                  { label: "Priority",    value: <PriorityBadge priority={priorityLocal} /> },
                  { label: "Client",      value: <span className="text-sm text-primary font-semibold">{ticketData.client}</span> },
                  { label: "Department",  value: <span className="text-sm text-foreground">{ticketData.department}</span> },
                  { label: "Created By",  value: (
                      <div>
                        <p className="text-sm text-foreground font-medium">{ticketData.createdBy}</p>
                        {ticketData.createdByEmail && <p className="text-xs text-muted-foreground">{ticketData.createdByEmail}</p>}
                      </div>
                    )},
                  { label: "Created On",   value: <span className="text-sm text-foreground">{ticketData.createdOn}</span> },
                  { label: "Last Updated", value: <span className="text-sm text-foreground">{ticketData.lastUpdated}</span> },
                ].map(row => (
                  <div key={row.label} className="flex items-start justify-between gap-3">
                    <span className="text-xs text-muted-foreground flex-shrink-0 pt-0.5 w-24">{row.label}</span>
                    <div className="flex-1 text-right">{row.value}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
