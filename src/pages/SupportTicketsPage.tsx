import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Fragment } from "react";
import {
  Headphones, Plus, Search, RotateCcw, Download,
  ChevronLeft, ChevronRight, ChevronDown, MoreVertical,
  Clock, CheckCircle, Paperclip, Eye,
} from "lucide-react";
import { useOrderStatusConfig } from "@/lib/orderStatusStore";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChildTicket {
  id: string;
  subject: string;
  department: string;
  priority: "High" | "Medium" | "Low";
  status: string;
  slaMinutesLeft: number | null; // null = SLA met / resolved
  slaTargetLabel: string;
  lastUpdated: string;
}

interface Ticket {
  id: string;
  type: "Parent" | "Child";
  subject: string;
  client: string;
  department: string;
  priority: "High" | "Medium" | "Low";
  status: string;
  slaMinutesLeft: number | null;
  slaTargetLabel: string;
  lastUpdated: string;
  children: ChildTicket[];
}

// ─── Real ticket loader ───────────────────────────────────────────────────────

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function mapStoredToTicket(raw: {
  id: string; number: string; subject: string; status: string;
  priority: string; created: string; clientName?: string; department?: string;
  createdBy?: string;
}): Ticket {
  const statusMap: Record<string, Ticket["status"]> = {
    open: "Open", in_progress: "In Progress", on_hold: "On Hold",
    resolved: "Resolved", closed: "Closed",
  };
  const priMap: Record<string, Ticket["priority"]> = {
    low: "Low", medium: "Medium", high: "High", critical: "High",
  };
  const status   = statusMap[raw.status]   ?? "Open";
  const priority = priMap[raw.priority]    ?? "Medium";
  const isDone   = status === "Resolved" || status === "Closed";

  // SLA: High=12h, Medium=24h, Low=48h
  const slaHours = priority === "High" ? 12 : priority === "Medium" ? 24 : 48;
  let slaMinutesLeft: number | null = null;
  if (!isDone) {
    const elapsed = Math.floor((Date.now() - new Date(raw.created).getTime()) / 60000);
    slaMinutesLeft = Math.max(0, slaHours * 60 - elapsed);
  }

  // Format lastUpdated from ISO date
  const d = new Date(raw.created);
  const lastUpdated = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    + "\n" + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

  return {
    id:            raw.number || raw.id,
    type:          "Parent",
    subject:       raw.subject,
    client:        raw.clientName || "—",
    department:    raw.department || "Customer Relationship Manager",
    priority,
    status,
    slaMinutesLeft,
    slaTargetLabel: `${slaHours}h`,
    lastUpdated,
    children:      [],
  };
}

function loadRealChildTickets(): ChildTicket[] {
  try {
    const raw = localStorage.getItem("nido_child_tickets_v1");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as {
      number: string; parentNumber: string; subject: string;
      department: string; priority: string; status: string; created: string;
    }[];
    const statusMap: Record<string, ChildTicket["status"]> = {
      open: "Open", in_progress: "In Progress", on_hold: "On Hold",
      resolved: "Resolved", closed: "Closed",
    };
    const priMap: Record<string, ChildTicket["priority"]> = {
      low: "Low", medium: "Medium", high: "High", critical: "High",
    };
    return parsed.map(c => {
      const priority = priMap[c.priority] ?? "Medium";
      const status   = statusMap[c.status]   ?? "Open";
      const isDone   = status === "Resolved" || status === "Closed";
      const slaHours = priority === "High" ? 12 : priority === "Medium" ? 24 : 48;
      const elapsed  = Math.floor((Date.now() - new Date(c.created).getTime()) / 60000);
      const slaMinutesLeft = isDone ? null : Math.max(0, slaHours * 60 - elapsed);
      const d = new Date(c.created);
      return {
        id: c.number,
        subject: c.subject,
        department: c.department,
        priority,
        status,
        slaMinutesLeft,
        slaTargetLabel: `${slaHours}h`,
        lastUpdated: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
          + ", " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
        parentNumber: c.parentNumber,
      } as ChildTicket & { parentNumber: string };
    });
  } catch {
    return [];
  }
}

function loadRealTickets(): Ticket[] {
  try {
    const raw = localStorage.getItem("nido_support_tickets_v1");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Parameters<typeof mapStoredToTicket>[0][];
    const tickets = [...parsed].reverse().map(mapStoredToTicket);
    // Attach real child tickets to their parents
    const realChildren = loadRealChildTickets() as (ChildTicket & { parentNumber: string })[];
    for (const ticket of tickets) {
      const mine = realChildren.filter(c => c.parentNumber === ticket.id);
      if (mine.length > 0) ticket.children = mine;
    }
    return tickets;
  } catch {
    return [];
  }
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_TICKETS: Ticket[] = [
  {
    id: "TKT-2026-00078",
    type: "Parent",
    subject: "Printer not working in Office Floor 2",
    client: "Apex Tech Solutions",
    department: "Account Management",
    priority: "Medium",
    status: "Open",
    slaMinutesLeft: 23 * 60 + 30,
    slaTargetLabel: "24h",
    lastUpdated: "01 Aug 2026\n09:12 AM",
    children: [],
  },
  {
    id: "TKT-2026-00077",
    type: "Parent",
    subject: "Need more 20L Water Cans for Bangalore office",
    client: "Apex Tech Solutions",
    department: "Account Management",
    priority: "Low",
    status: "In Progress",
    slaMinutesLeft: 1 * 24 * 60 + 5 * 60,
    slaTargetLabel: "24h",
    lastUpdated: "31 Jul 2026\n03:45 PM",
    children: [
      {
        id: "TKT-2026-00077-1",
        subject: "Alternative supplier options for water cans",
        department: "Account Management",
        priority: "Low",
        status: "Open",
        slaMinutesLeft: 18 * 60 + 10,
        slaTargetLabel: "24h",
        lastUpdated: "31 Jul 2026, 04:10 PM",
      },
    ],
  },
  {
    id: "TKT-2026-00076",
    type: "Parent",
    subject: "Monthly pantry items not delivered",
    client: "Cloud Systems India",
    department: "Account Management",
    priority: "High",
    status: "Open",
    slaMinutesLeft: 18 * 60 + 10,
    slaTargetLabel: "24h",
    lastUpdated: "31 Jul 2026\n11:05 AM",
    children: [],
  },
  {
    id: "TKT-2026-00075",
    type: "Parent",
    subject: "Request for new employee ID cards",
    client: "Cloud Systems India",
    department: "Account Management",
    priority: "Medium",
    status: "On Hold",
    slaMinutesLeft: 2 * 24 * 60 + 3 * 60,
    slaTargetLabel: "48h",
    lastUpdated: "31 Jul 2026\n09:30 AM",
    children: [],
  },
  {
    id: "TKT-2026-00074",
    type: "Parent",
    subject: "Laptop heating issue",
    client: "Nido Tech CorpEssentials",
    department: "IT Support",
    priority: "High",
    status: "In Progress",
    slaMinutesLeft: 6 * 60 + 45,
    slaTargetLabel: "12h",
    lastUpdated: "30 Jul 2026\n05:15 PM",
    children: [],
  },
  {
    id: "TKT-2026-00073",
    type: "Parent",
    subject: "Invoice not received for Order ORD-00012",
    client: "Nido Tech CorpEssentials",
    department: "Finance",
    priority: "Low",
    status: "Resolved",
    slaMinutesLeft: null,
    slaTargetLabel: "",
    lastUpdated: "30 Jul 2026\n02:10 PM",
    children: [],
  },
  {
    id: "TKT-2026-00072",
    type: "Parent",
    subject: "Office AC not cooling properly",
    client: "Apex Tech Solutions",
    department: "Facilities",
    priority: "High",
    status: "Closed",
    slaMinutesLeft: null,
    slaTargetLabel: "",
    lastUpdated: "29 Jul 2026\n11:00 AM",
    children: [],
  },
  {
    id: "TKT-2026-00071",
    type: "Parent",
    subject: "Network connectivity issues in Block B",
    client: "Cloud Systems India",
    department: "IT Support",
    priority: "High",
    status: "Resolved",
    slaMinutesLeft: null,
    slaTargetLabel: "",
    lastUpdated: "29 Jul 2026\n09:15 AM",
    children: [],
  },
  {
    id: "TKT-2026-00070",
    type: "Parent",
    subject: "Stationery reorder for Q3",
    client: "Nido Tech CorpEssentials",
    department: "Procurement",
    priority: "Low",
    status: "Open",
    slaMinutesLeft: 20 * 60,
    slaTargetLabel: "24h",
    lastUpdated: "28 Jul 2026\n04:30 PM",
    children: [],
  },
  {
    id: "TKT-2026-00069",
    type: "Parent",
    subject: "Software license renewal reminder",
    client: "Apex Tech Solutions",
    department: "IT Support",
    priority: "Medium",
    status: "On Hold",
    slaMinutesLeft: 5 * 60,
    slaTargetLabel: "48h",
    lastUpdated: "28 Jul 2026\n02:00 PM",
    children: [],
  },
];

// Fill remaining tickets to reach 42 total
for (let i = 68; i >= 37; i--) {
  const statuses: Ticket["status"][] = ["Open", "In Progress", "Resolved", "Closed", "On Hold"];
  const priorities: Ticket["priority"][] = ["High", "Medium", "Low"];
  const clients = ["Apex Tech Solutions", "Cloud Systems India", "Nido Tech CorpEssentials"];
  const depts = ["IT Support", "Finance", "Account Management", "Procurement", "Facilities"];
  MOCK_TICKETS.push({
    id: `TKT-2026-000${i}`,
    type: "Parent",
    subject: `Support request #${i}`,
    client: clients[i % 3],
    department: depts[i % 5],
    priority: priorities[i % 3],
    status: statuses[i % 5],
    slaMinutesLeft: i % 2 === 0 ? 4 * 60 + 30 : null,
    slaTargetLabel: "24h",
    lastUpdated: `28 Jul 2026\n12:00 PM`,
    children: [],
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSLA(minutesLeft: number | null, targetLabel: string) {
  if (minutesLeft === null) return null; // resolved/SLA met
  const days = Math.floor(minutesLeft / (24 * 60));
  const hrs = Math.floor((minutesLeft % (24 * 60)) / 60);
  const mins = minutesLeft % 60;
  let label = "";
  if (days > 0) label += `${days}d `;
  label += `${hrs}h`;
  if (mins > 0) label += ` ${mins}m`;
  label += ` left (${targetLabel})`;
  return label.trim();
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    High:   "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    Medium: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    Low:    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  };
  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[priority] ?? "bg-muted text-muted-foreground"}`}>
      {priority}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    "Open":        "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    "In Progress": "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    "On Hold":     "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    "Resolved":    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    "Closed":      "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };
  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] ?? "bg-muted text-muted-foreground"}`}>
      {status}
    </span>
  );
}

function SLACell({ minutesLeft, targetLabel }: { minutesLeft: number | null; targetLabel: string }) {
  if (minutesLeft === null) {
    return (
      <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-xs font-medium">
        <CheckCircle size={13} />
        (SLA Met)
      </span>
    );
  }
  const label = formatSLA(minutesLeft, targetLabel);
  const isUrgent = minutesLeft < 6 * 60;
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${isUrgent ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
      <Clock size={13} className="flex-shrink-0" />
      {label}
    </span>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

const LEGACY_SUPPORT_STATUSES = ["Open", "In Progress", "On Hold", "Resolved", "Closed"];
const PRIORITY_LIST   = ["All Priority", "High", "Medium", "Low"];
const PAGE_SIZE_OPTIONS = [10, 25, 50];

export default function SupportTicketsPage() {
  const navigate = useNavigate();
  const statusConfig = useOrderStatusConfig();
  const supportStatusOptions = useMemo(() => Array.from(new Set([
    ...statusConfig.statuses
      .filter(status => status.category === "Support Services" && status.visible)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(status => status.name),
    ...LEGACY_SUPPORT_STATUSES,
  ])), [statusConfig.statuses]);
  const statusFilterOptions = ["All Status", ...supportStatusOptions];

  // Real tickets from localStorage (prepended, newest first)
  const [realTickets, setRealTickets] = useState<Ticket[]>(() => loadRealTickets());

  // Combined: real tickets first, then mock (deduplicated by id)
  const allTickets = useMemo(() => {
    const realIds = new Set(realTickets.map(t => t.id));
    return [...realTickets, ...MOCK_TICKETS.filter(t => !realIds.has(t.id))];
  }, [realTickets]);

  // Reload whenever a ticket or child ticket is saved from another page
  useEffect(() => {
    const handler = () => setRealTickets(loadRealTickets());
    window.addEventListener("supportTicketsUpdated", handler);
    window.addEventListener("childTicketsUpdated", handler);
    return () => {
      window.removeEventListener("supportTicketsUpdated", handler);
      window.removeEventListener("childTicketsUpdated", handler);
    };
  }, []);

  // Dynamic filter dropdown options
  const CLIENTS_LIST = useMemo(() =>
    ["All Clients", ...Array.from(new Set(allTickets.map(t => t.client).filter(Boolean)))],
    [allTickets]
  );
  const DEPT_LIST = useMemo(() =>
    ["All Departments", ...Array.from(new Set(allTickets.map(t => t.department).filter(Boolean)))],
    [allTickets]
  );

  // Filters
  const [tab,        setTab]        = useState<"all" | "parent" | "child">("all");
  const [clientF,    setClientF]    = useState("All Clients");
  const [deptF,      setDeptF]      = useState("All Departments");
  const [statusF,    setStatusF]    = useState("All Status");
  const [priorityF,  setPriorityF]  = useState("All Priority");
  const [search,     setSearch]     = useState("");
  const [tileFilter, setTileFilter] = useState<string | null>(null);

  // Pagination
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Expanded rows
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["TKT-2026-00077"]));

  // ── Counts for tiles (live) ──
  // ── Filter + search ──
  const filtered = useMemo(() => {
    return allTickets.filter(t => {
      if (tab === "parent" && t.type !== "Parent") return false;
      if (tab === "child")  return false; // child tickets live inside parent rows

      if (clientF   !== "All Clients"     && t.client     !== clientF)   return false;
      if (deptF     !== "All Departments" && t.department  !== deptF)     return false;
      if (priorityF !== "All Priority"    && t.priority    !== priorityF) return false;

      // status filter: either dropdown OR tile click
      const activeStatus = tileFilter ?? (statusF !== "All Status" ? statusF : null);
      if (activeStatus && t.status !== activeStatus) return false;

      if (search) {
        const q = search.toLowerCase();
        if (
          !t.id.toLowerCase().includes(q) &&
          !t.subject.toLowerCase().includes(q) &&
          !t.client.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [tab, clientF, deptF, statusF, priorityF, search, tileFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageTickets = filtered.slice((page - 1) * pageSize, page * pageSize);

  function handleReset() {
    setClientF("All Clients");
    setDeptF("All Departments");
    setStatusF("All Status");
    setPriorityF("All Priority");
    setSearch("");
    setTileFilter(null);
    setTab("all");
    setPage(1);
  }

  function handleTileClick(status: string | null) {
    setTileFilter(prev => prev === status ? null : status);
    setStatusF("All Status");
    setPage(1);
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleExport() {
    const rows = [
      ["Ticket ID", "Type", "Subject", "Client", "Department", "Priority", "Status", "Last Updated"],
      ...filtered.map(t => [t.id, t.type, t.subject, t.client, t.department, t.priority, t.status, t.lastUpdated.replace("\n", " ")]),
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "support_tickets.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  // ── Tile definition ──
  const TILES = [
    { label: "Total Tickets", value: allTickets.length, status: null, valueClass: "text-foreground" },
    ...supportStatusOptions.map((status, index) => ({
      label: status,
      value: allTickets.filter(ticket => ticket.status === status).length,
      status,
      valueClass: [
        "text-blue-600 dark:text-blue-400",
        "text-orange-500 dark:text-orange-400",
        "text-purple-600 dark:text-purple-400",
        "text-green-600 dark:text-green-400",
        "text-muted-foreground",
      ][index % 5],
    })),
  ];

  const activeStatus = tileFilter ?? (statusF !== "All Status" ? statusF : null);

  return (
    <div className="min-h-screen bg-background">

      {/* ── Page Header ── */}
      <div className="border-b border-border bg-background">
        <div className="px-4 md:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Headphones size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground leading-tight">Support Tickets</h1>
              <p className="text-xs text-muted-foreground">View and manage all client support tickets</p>
            </div>
          </div>
          <button
            onClick={() => navigate("/support/create")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-colors"
          >
            <Plus size={16} />
            Create Ticket
          </button>
        </div>
      </div>

      <div className="px-4 md:px-6 py-5 space-y-4">

        {/* ── Tabs ── */}
        <div className="flex gap-0 border-b border-border">
          {(["all", "parent", "child"] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setPage(1); }}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
                tab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "all" ? "All Tickets" : t === "parent" ? "Parent Tickets" : "Child Tickets"}
            </button>
          ))}
        </div>

        {/* ── Filter Bar ── */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Dropdowns */}
          {[
            { value: clientF,   setValue: setClientF,   options: CLIENTS_LIST   },
            { value: deptF,     setValue: setDeptF,     options: DEPT_LIST      },
            { value: statusF,   setValue: (v: string) => { setStatusF(v); setTileFilter(null); }, options: statusFilterOptions   },
            { value: priorityF, setValue: setPriorityF, options: PRIORITY_LIST  },
          ].map(({ value, setValue, options }) => (
            <div key={options[0]} className="relative">
              <select
                value={value}
                onChange={e => { setValue(e.target.value); setPage(1); }}
                className="appearance-none pl-3 pr-8 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
              >
                {options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          ))}

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search tickets by Ticket ID, Subject, Client..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm hover:bg-muted/50 transition-colors"
          >
            <RotateCcw size={14} />
            Reset
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm hover:bg-muted/50 transition-colors"
          >
            <Download size={14} />
            Export
          </button>
        </div>

        {/* ── Stat Tiles (act as filters) ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {TILES.map(tile => {
            const isActive = tile.status === null ? tileFilter === null && activeStatus === null : activeStatus === tile.status;
            return (
              <button
                key={tile.label}
                onClick={() => handleTileClick(tile.status)}
                className={`rounded-xl border text-left p-4 transition-all ${
                  isActive && tile.status !== null
                    ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                    : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
                }`}
              >
                <p className="text-xs text-muted-foreground mb-1 font-medium">{tile.label}</p>
                <p className={`text-2xl font-bold ${tile.valueClass}`}>{tile.value}</p>
              </button>
            );
          })}
        </div>

        {/* ── Table ── */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {tab === "child" ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              Child tickets are nested under their parent tickets. Switch to <strong>All Tickets</strong> or <strong>Parent Tickets</strong> tab and expand a row to view child tickets.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="w-8 px-3 py-3" />
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">Ticket ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Subject</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Client</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Department</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Priority</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">SLA</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">
                      Last Updated ↓
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageTickets.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-4 py-12 text-center text-sm text-muted-foreground">
                        No tickets match the current filters.
                      </td>
                    </tr>
                  )}
                  {pageTickets.map(ticket => {
                    const isExpanded = expanded.has(ticket.id);
                    const hasChildren = ticket.children.length > 0;
                    return (
                      <Fragment key={ticket.id}>
                        <tr className="border-b border-border hover:bg-muted/20 transition-colors">
                          {/* Expand toggle */}
                          <td className="px-3 py-3 text-center">
                            {hasChildren ? (
                              <button
                                onClick={() => toggleExpand(ticket.id)}
                                className={`w-5 h-5 rounded border flex items-center justify-center text-xs font-bold transition-colors ${
                                  isExpanded
                                    ? "bg-primary/10 border-primary/40 text-primary"
                                    : "bg-muted border-border text-muted-foreground hover:border-primary/40"
                                }`}
                              >
                                {isExpanded ? "−" : "+"}
                              </button>
                            ) : (
                              <button
                                className="w-5 h-5 rounded border border-border bg-muted/30 flex items-center justify-center text-xs text-muted-foreground/40 cursor-default"
                                disabled
                              >
                                +
                              </button>
                            )}
                          </td>

                          <td className="px-4 py-3 font-medium text-primary whitespace-nowrap">
                            <button
                              onClick={() => navigate(`/support/ticket/${ticket.id}`)}
                              className="hover:underline underline-offset-2"
                            >
                              {ticket.id}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex px-2.5 py-0.5 rounded text-xs font-medium border border-blue-200 text-blue-700 dark:border-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20">
                              {ticket.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-foreground max-w-[200px]">{ticket.subject}</td>
                          <td className="px-4 py-3 text-foreground whitespace-nowrap">{ticket.client}</td>
                          <td className="px-4 py-3 text-foreground whitespace-nowrap">{ticket.department}</td>
                          <td className="px-4 py-3"><PriorityBadge priority={ticket.priority} /></td>
                          <td className="px-4 py-3"><StatusBadge status={ticket.status} /></td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <SLACell minutesLeft={ticket.slaMinutesLeft} targetLabel={ticket.slaTargetLabel} />
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-pre-line">{ticket.lastUpdated}</td>
                          <td className="px-4 py-3">
                            <TicketActionsMenu ticketId={ticket.id} navigate={navigate} />
                          </td>
                        </tr>

                        {/* ── Expanded child tickets ── */}
                        {isExpanded && hasChildren && (
                          <tr key={`${ticket.id}-children`} className="border-b border-border">
                            <td colSpan={11} className="px-6 py-3 bg-blue-50/50 dark:bg-blue-950/20">
                              <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-card overflow-hidden">
                                {/* Child header */}
                                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/30">
                                  <Paperclip size={14} className="text-blue-500" />
                                  <span className="text-sm font-semibold text-foreground">
                                    Child Ticket ({ticket.children.length})
                                  </span>
                                  <span className="ml-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 text-xs font-semibold">
                                    {ticket.children.length} Child
                                  </span>
                                </div>
                                {/* Child table */}
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-blue-100 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/10">
                                      <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Child Ticket ID</th>
                                      <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Subject</th>
                                      <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Department</th>
                                      <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Priority</th>
                                      <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Status</th>
                                      <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">SLA</th>
                                      <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Last Updated</th>
                                      <th className="px-4 py-2" />
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {ticket.children.map(child => (
                                      <tr key={child.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors">
                                        <td className="px-4 py-2.5 font-medium text-primary whitespace-nowrap">{child.id}</td>
                                        <td className="px-4 py-2.5 text-foreground">{child.subject}</td>
                                        <td className="px-4 py-2.5 text-foreground whitespace-nowrap">{child.department}</td>
                                        <td className="px-4 py-2.5"><PriorityBadge priority={child.priority} /></td>
                                        <td className="px-4 py-2.5"><StatusBadge status={child.status} /></td>
                                        <td className="px-4 py-2.5 whitespace-nowrap">
                                          <SLACell minutesLeft={child.slaMinutesLeft} targetLabel={child.slaTargetLabel} />
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{child.lastUpdated}</td>
                                        <td className="px-4 py-2.5">
                                          <button
                                            onClick={() => navigate(`/support/child-ticket/${child.id}`)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400 text-xs font-medium hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                                          >
                                            <Eye size={12} />
                                            View
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Pagination ── */}
        {tab !== "child" && (
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm text-muted-foreground">
              Showing {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1} to{" "}
              {Math.min(page * pageSize, filtered.length)} of {filtered.length} tickets
            </p>

            <div className="flex items-center gap-2">
              {/* Prev */}
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>

              {/* Page numbers */}
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let p: number;
                if (totalPages <= 5) {
                  p = i + 1;
                } else if (page <= 3) {
                  p = i + 1;
                } else if (page >= totalPages - 2) {
                  p = totalPages - 4 + i;
                } else {
                  p = page - 2 + i;
                }
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      page === p
                        ? "bg-primary text-primary-foreground"
                        : "border border-border text-foreground hover:bg-muted/50"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}

              {/* Next */}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>

              {/* Page size */}
              <div className="relative ml-2">
                <select
                  value={pageSize}
                  onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="appearance-none pl-3 pr-7 py-1.5 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                >
                  {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s} / page</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Actions Menu ─────────────────────────────────────────────────────────────

function TicketActionsMenu({ ticketId, navigate }: { ticketId: string; navigate: (path: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(prev => !prev)}
        className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 w-44 bg-card border border-border rounded-xl shadow-lg overflow-hidden py-1">
            {[
              { label: "View Details",    action: () => { navigate(`/support/track/${ticketId}`); setOpen(false); } },
              { label: "Edit Ticket",     action: () => setOpen(false) },
              { label: "Change Status",   action: () => setOpen(false) },
              { label: "Add Comment",     action: () => setOpen(false) },
              { label: "Close Ticket",    action: () => setOpen(false) },
            ].map(item => (
              <button
                key={item.label}
                onClick={item.action}
                className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted/60 transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
