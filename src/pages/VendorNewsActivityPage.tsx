import { useState, useMemo, useRef, useEffect } from "react";
import {
  Bold, Italic, List, ListOrdered, Link2, AtSign, Paperclip,
  MoreVertical, Search, ChevronDown, Info,
  FileText, MessageSquare, CreditCard, RefreshCw, FileCheck,
} from "lucide-react";
import { getAllPOs, getPODisplayStatus } from "@/lib/purchaseOrderStore";
import { belongsToVendor, hasVendorScope, type VendorScope } from "@/lib/vendorScope";

type NoteVisibility = "Private" | "Internal" | "Public";
type NoteTab = "All Notes" | "My Notes" | "Mentions";

interface Note {
  id: number;
  initials: string;
  color: string;
  name: string;
  role: string;
  visibility: NoteVisibility;
  mention?: string;
  body: string;
  date: string;
  time: string;
  isCurrentUser?: boolean;
}

interface Activity {
  icon: React.ReactNode;
  iconBg: string;
  category: string;
  title: string;
  subtitle: string;
  date: string;
  time: string;
  link: string;
}

const VISIBILITY_STYLE: Record<NoteVisibility, string> = {
  Private:  "bg-gray-100 text-gray-500",
  Internal: "bg-blue-50 text-blue-600",
  Public:   "bg-green-50 text-green-600",
};

const INITIAL_NOTES: Note[] = [
  {
    id: 1, initials: "NO", color: "bg-slate-600",
    name: "Nido Owner", role: "System Owner", visibility: "Private",
    mention: "@Amit Verma",
    body: "Please review the SLA terms in the contract CT-2024-001 before renewal.",
    date: "Apr 28, 2026", time: "02:15 PM",
  },
  {
    id: 2, initials: "AV", color: "bg-purple-500",
    name: "Amit Verma", role: "Procurement Manager", visibility: "Internal",
    body: "Vendor performance for Q4 is excellent. On-time delivery and quality scores are above target.",
    date: "Apr 16, 2026", time: "11:40 AM",
  },
  {
    id: 3, initials: "SK", color: "bg-pink-500",
    name: "Sneha Iyer", role: "Legal Manager", visibility: "Internal",
    body: "Updated NDA document has been uploaded. Please check in Documents section.",
    date: "Apr 05, 2026", time: "04:22 PM",
  },
  {
    id: 4, initials: "PK", color: "bg-orange-500",
    name: "Pavan Kumar", role: "Finance Manager", visibility: "Private",
    body: "Payment terms changed to Net 45 effective from Apr 1, 2026.",
    date: "Mar 28, 2026", time: "09:10 AM",
  },
  {
    id: 5, initials: "AV", color: "bg-purple-500",
    name: "Amit Verma", role: "Procurement Manager", visibility: "Internal",
    body: "Initiated vendor re-evaluation for FY 2026-27. Scorecard to be shared by end of month.",
    date: "Mar 15, 2026", time: "03:00 PM",
  },
  {
    id: 6, initials: "SK", color: "bg-pink-500",
    name: "Sneha Iyer", role: "Legal Manager", visibility: "Private",
    body: "Compliance certificate expires in 30 days. Reminder sent to vendor contact Rahul Sharma.",
    date: "Mar 10, 2026", time: "10:30 AM",
  },
];

const INITIAL_ACTIVITIES: Activity[] = [
  {
    icon: <FileText className="w-4 h-4 text-green-600" />,
    iconBg: "bg-green-100",
    category: "Document uploaded",
    title: "SLA Agreement v2.1.pdf",
    subtitle: "Uploaded by Amit Verma",
    date: "Apr 28, 2026", time: "02:30 PM",
    link: "View Document",
  },
  {
    icon: <MessageSquare className="w-4 h-4 text-blue-600" />,
    iconBg: "bg-blue-100",
    category: "Note added",
    title: "@Amit Verma Please review the SLA terms...",
    subtitle: "Added by Nido Owner",
    date: "Apr 28, 2026", time: "02:15 PM",
    link: "View Note",
  },
  {
    icon: <CreditCard className="w-4 h-4 text-purple-600" />,
    iconBg: "bg-purple-100",
    category: "Payment processed",
    title: "Invoice INV-2024-0187 for ₹24,50,000",
    subtitle: "Processed by Pavan Kumar",
    date: "Apr 25, 2026", time: "05:20 PM",
    link: "View Payment",
  },
  {
    icon: <FileCheck className="w-4 h-4 text-orange-500" />,
    iconBg: "bg-orange-100",
    category: "Document uploaded",
    title: "NDA - Dell India.docx",
    subtitle: "Uploaded by Sneha Iyer",
    date: "Apr 12, 2026", time: "10:15 AM",
    link: "View Document",
  },
  {
    icon: <RefreshCw className="w-4 h-4 text-teal-600" />,
    iconBg: "bg-teal-100",
    category: "Contract updated",
    title: "Contract CT-2024-001 was updated",
    subtitle: "Updated by Amit Verma",
    date: "Apr 01, 2026", time: "11:30 AM",
    link: "View Contract",
  },
];

function readScopedNotes(scope: VendorScope): Note[] {
  if (!scope.vendorId) return [];
  try {
    const raw = localStorage.getItem(`nido_vendor_notes_${scope.vendorId}`);
    const records = raw ? JSON.parse(raw) : [];
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
}

function getScopedActivities(scope: VendorScope): Activity[] {
  return getAllPOs()
    .filter(po => belongsToVendor(po, scope))
    .map(po => {
      const date = new Date(po.createdOn);
      return {
        icon: <CreditCard className="w-4 h-4 text-purple-600" />,
        iconBg: "bg-purple-100",
        category: "Purchase order updated",
        title: `${po.poNumber} is ${getPODisplayStatus(po.status).toLowerCase()}`,
        subtitle: "Live purchase-order record",
        date: Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
        time: Number.isNaN(date.getTime()) ? "—" : date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
        link: "View Order",
      };
    });
}

export default function VendorNewsActivityPage(scope: VendorScope = {}) {
  const scoped = hasVendorScope(scope);
  const [notes, setNotes]               = useState<Note[]>(() => scoped ? readScopedNotes(scope) : INITIAL_NOTES);
  const [activities, setActivities]     = useState<Activity[]>(() => scoped ? getScopedActivities(scope) : INITIAL_ACTIVITIES);
  const [noteText, setNoteText]         = useState("");
  const [visibility, setVisibility]     = useState<NoteVisibility>("Internal");
  const [activeTab, setActiveTab]       = useState<NoteTab>("All Notes");
  const [search, setSearch]             = useState("");
  const [showAll, setShowAll]           = useState(false);
  const [openMenu, setOpenMenu]         = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const MAX_CHARS = 2000;

  useEffect(() => {
    const refresh = () => {
      if (scoped) {
        setNotes(readScopedNotes(scope));
        setActivities(getScopedActivities(scope));
      }
    };
    window.addEventListener("storage", refresh);
    window.addEventListener("poCreated", refresh);
    window.addEventListener("vendorNoteUpdated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("poCreated", refresh);
      window.removeEventListener("vendorNoteUpdated", refresh);
    };
  }, [scope.vendorId, scope.vendorName, scoped]);

  const visibleNotes = useMemo(() => {
    let list = notes;
    if (activeTab === "My Notes")  list = list.filter(n => n.name === "Nido Owner");
    if (activeTab === "Mentions")  list = list.filter(n => n.mention);
    if (search.trim())             list = list.filter(n =>
      n.body.toLowerCase().includes(search.toLowerCase()) ||
      n.name.toLowerCase().includes(search.toLowerCase())
    );
    return list;
  }, [notes, activeTab, search]);

  const displayedNotes = showAll ? visibleNotes : visibleNotes.slice(0, 4);

  const handleAddNote = () => {
    const trimmed = noteText.trim();
    if (!trimmed) return;
    const now = new Date();
    const newNote: Note = {
      id: Date.now(),
      initials: "NO",
      color: "bg-slate-600",
      name: "Nido Owner",
      role: "System Owner",
      visibility,
      body: trimmed,
      date: now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, " "),
      time: now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase(),
      isCurrentUser: true,
    };
    setNotes(prev => [newNote, ...prev]);
    if (scoped && scope.vendorId) {
      localStorage.setItem(`nido_vendor_notes_${scope.vendorId}`, JSON.stringify([newNote, ...notes]));
      window.dispatchEvent(new Event("vendorNoteUpdated"));
    }
    setActivities(prev => [{
      icon: <MessageSquare className="w-4 h-4 text-blue-600" />,
      iconBg: "bg-blue-100",
      category: "Note added",
      title: trimmed.length > 50 ? trimmed.slice(0, 50) + "…" : trimmed,
      subtitle: "Added by Nido Owner",
      date: newNote.date,
      time: newNote.time,
      link: "View Note",
    }, ...prev]);
    setNoteText("");
    setShowAll(false);
  };

  const insertFormatting = (prefix: string, suffix = "") => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const sel = noteText.slice(start, end);
    const next = noteText.slice(0, start) + prefix + sel + suffix + noteText.slice(end);
    if (next.length <= MAX_CHARS) setNoteText(next);
  };

  return (
    <div className="min-h-screen bg-white font-sans" onClick={() => setOpenMenu(null)}>
      <div className="max-w-[1280px]px-2 py-5">
        <div className="flex gap-5">

          {/* ── Left: Notes ── */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Note editor card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-gray-800">Notes</span>
                  <Info className="w-3.5 h-3.5 text-gray-400" />
                </div>

                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  value={noteText}
                  onChange={e => e.target.value.length <= MAX_CHARS && setNoteText(e.target.value)}
                  placeholder="Add a note... Use @ to mention someone"
                  rows={3}
                  className="w-full resize-none text-sm text-gray-700 placeholder-gray-400 border border-gray-200 rounded-lg px-2 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
                <div className="text-right text-xs text-gray-400 mt-1 mb-3">{noteText.length}/{MAX_CHARS}</div>

                {/* Formatting toolbar */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-0.5">
                    {[
                      { icon: <Bold className="w-3.5 h-3.5" />,         action: () => insertFormatting("**", "**"), title: "Bold" },
                      { icon: <Italic className="w-3.5 h-3.5" />,       action: () => insertFormatting("_", "_"),   title: "Italic" },
                      { icon: <List className="w-3.5 h-3.5" />,         action: () => insertFormatting("\n• "),     title: "Bullet list" },
                      { icon: <ListOrdered className="w-3.5 h-3.5" />,  action: () => insertFormatting("\n1. "),    title: "Numbered list" },
                      { icon: <Link2 className="w-3.5 h-3.5" />,        action: () => insertFormatting("[", "](url)"), title: "Link" },
                      { icon: <AtSign className="w-3.5 h-3.5" />,       action: () => { const t = noteText + "@"; if (t.length <= MAX_CHARS) setNoteText(t); }, title: "Mention" },
                      { icon: <Paperclip className="w-3.5 h-3.5" />,    action: () => {},                           title: "Attach" },
                    ].map((btn, i) => (
                      <button key={i} onClick={btn.action} title={btn.title}
                        className="p-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors">
                        {btn.icon}
                      </button>
                    ))}

                    <div className="w-px h-4 bg-gray-200 mx-1" />

                    {/* Visibility selector */}
                    <div className="relative">
                      <select value={visibility} onChange={e => setVisibility(e.target.value as NoteVisibility)}
                        className="appearance-none text-xs font-medium border border-gray-200 rounded-lg pl-2.5 pr-7 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer text-gray-600">
                        <option value="Internal">Internal</option>
                        <option value="Private">Private</option>
                        <option value="Public">Public</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  <button onClick={handleAddNote} disabled={!noteText.trim()}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm">
                    Add Note
                  </button>
                </div>
              </div>
            </div>

            {/* Sub-tabs + search */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                {(["All Notes", "My Notes", "Mentions"] as NoteTab[]).map(tab => (
                  <button key={tab} onClick={() => { setActiveTab(tab); setShowAll(false); }}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      activeTab === tab
                        ? "bg-blue-600 text-white"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}>
                    {tab}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 flex-1 justify-end">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search notes..."
                    className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-52 transition-all" />
                </div>
              </div>
            </div>

            {/* Notes list */}
            <div className="space-y-3">
              {displayedNotes.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm py-14 text-center">
                  <p className="text-sm text-gray-400">No notes found.</p>
                </div>
              ) : displayedNotes.map(note => (
                <div key={note.id} className="bg-white rounded-xl border border-gray-200 shadow-sm px-2 py-4"
                  onClick={e => e.stopPropagation()}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {/* Avatar */}
                      <div className={`w-9 h-9 rounded-full ${note.color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                        {note.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-semibold text-gray-900">{note.name}</span>
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded font-medium">{note.role}</span>
                        </div>
                        {note.mention && (
                          <p className="text-sm font-semibold text-blue-600 mb-1">{note.mention}</p>
                        )}
                        <p className="text-sm text-gray-700 leading-relaxed">{note.body}</p>
                        <p className="text-xs text-gray-400 mt-2">{note.date} · {note.time}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${VISIBILITY_STYLE[note.visibility]}`}>
                        {note.visibility}
                      </span>
                      <div className="relative">
                        <button onClick={e => { e.stopPropagation(); setOpenMenu(openMenu === note.id ? null : note.id); }}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {openMenu === note.id && (
                          <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
                            <button className="w-full text-left px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50">Edit</button>
                            <button className="w-full text-left px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50">Pin Note</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Load more */}
            {visibleNotes.length > 4 && (
              <div className="flex justify-center">
                <button onClick={() => setShowAll(v => !v)}
                  className="flex items-center gap-2 px-2 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 shadow-sm transition-colors">
                  <ChevronDown className={`w-4 h-4 transition-transform ${showAll ? "rotate-180" : ""}`} />
                  {showAll ? "Show Less" : `Load More Notes (${visibleNotes.length - 4} more)`}
                </button>
              </div>
            )}
          </div>

          {/* ── Right: Activity Timeline ── */}
          <div className="w-72 flex-shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-4">Activity Timeline</h3>

              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-[17px] top-3 bottom-8 w-px bg-gray-100" />

                <div className="space-y-5">
                  {activities.map((a, i) => (
                    <div key={i} className="flex gap-3">
                      <div className={`w-8 h-8 rounded-full ${a.iconBg} flex items-center justify-center flex-shrink-0 relative z-10`}>
                        {a.icon}
                      </div>
                      <div className="flex-1 min-w-0 pb-1">
                        <p className="text-xs text-gray-400 font-medium mb-0.5">{a.category}</p>
                        <p className="text-sm font-semibold text-gray-800 leading-snug mb-0.5 break-words">{a.title}</p>
                        <p className="text-xs text-gray-500">{a.subtitle} · {a.date} · {a.time}</p>
                        <button className="text-xs text-blue-600 font-medium hover:underline mt-1">{a.link}</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button className="mt-5 w-full py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                View All Activity
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
