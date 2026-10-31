import { useEffect, useState } from "react";
import {
  FileText, MessageSquare, RefreshCw, CheckSquare, AtSign, MoreVertical,
  Bold, Italic, List, Link, AtSignIcon, Smile, Paperclip, Download,
  ChevronDown, ArrowRight, CheckCircle2, Calendar,
} from "lucide-react";
import { getClientActivities, saveClientActivity, type ClientActivityRecord } from "@/lib/clientDataStore";

const STATS = [
  { icon: <FileText size={18} className="text-blue-500" />, value: "36", label: "Total Notes", sub: "Across Contract", bg: "bg-blue-50" },
  { icon: <RefreshCw size={18} className="text-green-500" />, value: "128", label: "Activities", sub: "All Activities", bg: "bg-green-50" },
  { icon: <MessageSquare size={18} className="text-purple-500" />, value: "18", label: "Comments", sub: "From Team", bg: "bg-purple-50" },
  { icon: <Calendar size={18} className="text-orange-500" />, value: "Today, 11:45 AM", label: "Last Activity", sub: "By Priya Nair", bg: "bg-orange-50" },
  { icon: <CheckSquare size={18} className="text-teal-500" />, value: "5", label: "Upcoming Tasks", sub: "Due in Next 30 Days", bg: "bg-teal-50" },
  { icon: <AtSign size={18} className="text-red-400" />, value: "7", label: "Mentions", sub: "Require Attention", bg: "bg-red-50" },
];

const TABS = ["All Activity", "Notes", "Comments", "Updates", "Tasks", "Mentions"];

type ActivityType = "Note" | "Comment" | "Update" | "Task" | "Mention";

interface Activity {
  id: number;
  avatar: string;
  name: string;
  action: string;
  boldPart: string;
  type: ActivityType;
  completedBadge?: string;
  time: string;
  description: string;
  visibility: string;
  replies?: number;
  group: string;
  createdAt?: string;
}

const ACTIVITIES: Activity[] = [
  { id: 1, avatar: "PN", name: "Priya Nair", action: "added a note", boldPart: "", type: "Note", time: "11:45 AM", description: "Client confirmed the requirement for additional 50 users.\nPrice impact will be communicated separately.", visibility: "Visible to All", group: "Today" },
  { id: 2, avatar: "RS", name: "Rahul Sharma", action: "updated SLA KPI:", boldPart: "Platform Uptime", type: "Update", time: "10:30 AM", description: "Uptime target achieved for May 2025 – 99.62%\nAll critical services are performing within SLA.", visibility: "Visible to All", group: "Today" },
  { id: 3, avatar: "SI", name: "Sneha Iyer", action: "commented on", boldPart: "Pricing", type: "Comment", time: "09:15 AM", description: "Please review the pricing for additional storage.\nClient is expecting a discounted rate.", visibility: "Visible to All", group: "Today" },
  { id: 4, avatar: "VS", name: "Vikram Singh", action: "added a note", boldPart: "", type: "Note", time: "Yesterday, 04:20 PM", description: "Shared the implementation plan with the client.\nKick-off meeting scheduled on June 5, 2025.", visibility: "Visible to All", group: "Yesterday" },
  { id: 5, avatar: "SY", name: "System", action: "updated document:", boldPart: "Implementation Plan v1.0", type: "Update", time: "Yesterday, 02:10 PM", description: "New version uploaded by Ankit Verma.", visibility: "Visible to All", group: "Yesterday" },
  { id: 6, avatar: "AV", name: "Ankit Verma", action: "completed task:", boldPart: "Data Migration Plan", type: "Task", completedBadge: "Completed", time: "Yesterday, 11:30 AM", description: "Data migration plan document shared with Apex team.", visibility: "Visible to All", group: "Yesterday" },
  { id: 7, avatar: "PN", name: "Priya Nair", action: "mentioned you in a comment", boldPart: "", type: "Mention", time: "May 30, 2025, 03:40 PM", description: "@Rahul Sharma please review and confirm the SLA breach policy.", visibility: "", replies: 1, group: "May 30, 2025" },
  { id: 8, avatar: "RS", name: "Rahul Sharma", action: "replied to a comment", boldPart: "", type: "Comment", time: "May 30, 2025, 03:55 PM", description: "Reviewed the breach policy. Looks good.\nWill share with the client for acceptance.", visibility: "", group: "May 30, 2025" },
  { id: 9, avatar: "SY", name: "System", action: "created contract:", boldPart: "CT-2025-001", type: "Update", time: "May 29, 2025, 10:30 AM", description: "Contract created and signed by both parties.", visibility: "Visible to All", group: "May 29, 2025" },
];

const RECENT_NOTES = [
  { text: "Client confirmed the requirement for additional 50 users.", by: "Priya Nair", when: "Today, 11:45 AM" },
  { text: "Implementation plan shared with the client.", by: "Vikram Singh", when: "Yesterday, 04:20 PM" },
  { text: "Pricing discussion for additional storage.", by: "Sneha Iyer", when: "May 30, 03:40 PM" },
];

const UPCOMING_TASKS = [
  { label: "Client Acceptance on SLA", due: "Due: Jun 03, 2025" },
  { label: "Review Pricing for Additional Storage", due: "Due: Jun 04, 2025" },
  { label: "Kick-off Meeting with Apex Team", due: "Due: Jun 05, 2025" },
  { label: "User Training Plan Approval", due: "Due: Jun 07, 2025" },
  { label: "Quarterly Business Review", due: "Due: Jun 15, 2025" },
];

const DONUT = [
  { label: "Notes", count: 36, pct: 28, color: "#3b82f6" },
  { label: "Comments", count: 18, pct: 14, color: "#a78bfa" },
  { label: "Updates", count: 40, pct: 31, color: "#22c55e" },
  { label: "Tasks", count: 24, pct: 19, color: "#f97316" },
  { label: "Mentions", count: 7, pct: 5, color: "#ef4444" },
  { label: "Others", count: 3, pct: 3, color: "#d1d5db" },
];

const TYPE_COLORS: Record<ActivityType, string> = {
  Note: "bg-blue-100 text-blue-600",
  Comment: "bg-purple-100 text-purple-600",
  Update: "bg-green-100 text-green-700",
  Task: "bg-orange-100 text-orange-600",
  Mention: "bg-pink-100 text-pink-600",
};

const AVATAR_COLORS: Record<string, string> = {
  PN: "bg-pink-200 text-pink-700",
  RS: "bg-blue-200 text-blue-700",
  SI: "bg-purple-200 text-purple-700",
  VS: "bg-teal-200 text-teal-700",
  AV: "bg-orange-200 text-orange-700",
  SY: "bg-gray-200 text-gray-600",
};

function Avatar({ initials }: { initials: string }) {
  const cls = AVATAR_COLORS[initials] ?? "bg-gray-200 text-gray-600";
  if (initials === "SY") {
    return (
      <div className={`w-9 h-9 rounded-full ${cls} flex items-center justify-center shrink-0`}>
        <RefreshCw size={15} />
      </div>
    );
  }
  return (
    <div className={`w-9 h-9 rounded-full ${cls} flex items-center justify-center shrink-0 text-xs font-semibold`}>
      {initials}
    </div>
  );
}

function DonutChart({ data = DONUT }: { data?: typeof DONUT }) {
  const size = 100;
  const cx = size / 2, cy = size / 2;
  const outerR = 44, innerR = 28;
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  let angle = -Math.PI / 2;
  const slices = data.map((d) => {
    const sweep = (d.count / total) * 2 * Math.PI;
    const x1 = cx + outerR * Math.cos(angle), y1 = cy + outerR * Math.sin(angle);
    const x2 = cx + outerR * Math.cos(angle + sweep), y2 = cy + outerR * Math.sin(angle + sweep);
    const ix1 = cx + innerR * Math.cos(angle + sweep), iy1 = cy + innerR * Math.sin(angle + sweep);
    const ix2 = cx + innerR * Math.cos(angle), iy2 = cy + innerR * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    const path = `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${large} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerR} ${innerR} 0 ${large} 0 ${ix2} ${iy2} Z`;
    angle += sweep;
    return { path, color: d.color, label: d.label };
  });
  return (
    <svg width={size} height={size}>
      {slices.map((s) => <path key={s.label} d={s.path} fill={s.color} stroke="white" strokeWidth={1.5} />)}
    </svg>
  );
}

export default function ClientActivityPage({ clientId }: { clientId?: string }) {
  const [activeTab, setActiveTab] = useState("All Activity");
  const [noteText, setNoteText] = useState("");
  const [visibility, setVisibility] = useState("Select Visibility");
  const [dateRange, setDateRange] = useState("This Month");
  const [activityType, setActivityType] = useState("All Types");
  const [visibilityFilter, setVisibilityFilter] = useState("All");
  const [userFilter, setUserFilter] = useState("All Users");
  const [visibleCount, setVisibleCount] = useState(9);
  const [activities, setActivities] = useState<Activity[]>(() =>
    clientId ? getClientActivities(clientId) : ACTIVITIES
  );

  useEffect(() => {
    if (!clientId) return;
    const reload = () => setActivities(getClientActivities(clientId));
    reload();
    window.addEventListener("nidoClientDataUpdated", reload);
    return () => window.removeEventListener("nidoClientDataUpdated", reload);
  }, [clientId]);

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const newNote: Activity = {
      id: Date.now(),
      avatar: "PN",
      name: "You",
      action: "added a note",
      boldPart: "",
      type: "Note",
      time: timeStr,
      description: noteText.trim(),
      visibility: visibility === "Select Visibility" ? "Visible to All" : visibility,
      group: "Today",
      createdAt: now.toISOString(),
    };
    if (clientId) {
      const record: ClientActivityRecord = {
        ...newNote,
        clientId,
        createdAt: newNote.createdAt || now.toISOString(),
      };
      saveClientActivity(record);
      setActivities(getClientActivities(clientId));
    } else {
      setActivities((prev) => [newNote, ...prev]);
    }
    setNoteText("");
    setActiveTab("All Activity");
  };

  const filtered = activities.filter((a) => {
    if (activeTab === "All Activity") return true;
    if (activeTab === "Notes") return a.type === "Note";
    if (activeTab === "Comments") return a.type === "Comment";
    if (activeTab === "Updates") return a.type === "Update";
    if (activeTab === "Tasks") return a.type === "Task";
    if (activeTab === "Mentions") return a.type === "Mention";
    if (activityType !== "All Types" && a.type !== activityType.replace(/s$/, "")) return false;
    if (visibilityFilter !== "All" && a.visibility !== visibilityFilter) return false;
    if (userFilter !== "All Users" && a.name !== userFilter) return false;
    return true;
  }).slice(0, visibleCount);

  const groups = filtered.reduce<Record<string, Activity[]>>((acc, a) => {
    if (!acc[a.group]) acc[a.group] = [];
    acc[a.group].push(a);
    return acc;
  }, {});

  const groupOrder = Object.keys(groups);
  const noteCount = activities.filter((a) => a.type === "Note").length;
  const commentCount = activities.filter((a) => a.type === "Comment").length;
  const updateCount = activities.filter((a) => a.type === "Update").length;
  const taskCount = activities.filter((a) => a.type === "Task").length;
  const mentionCount = activities.filter((a) => a.type === "Mention").length;
  const liveStats = [
    { ...STATS[0], value: String(noteCount) },
    { ...STATS[1], value: String(activities.length) },
    { ...STATS[2], value: String(commentCount) },
    { ...STATS[3], value: activities[0]?.time || "No activity", sub: activities[0] ? `By ${activities[0].name}` : "No activity yet" },
    { ...STATS[4], value: String(taskCount), sub: "Open tasks" },
    { ...STATS[5], value: String(mentionCount) },
  ];
  const liveDonut = [
    { label: "Notes", count: noteCount, pct: activities.length ? Math.round(noteCount / activities.length * 100) : 0, color: "#3b82f6" },
    { label: "Comments", count: commentCount, pct: activities.length ? Math.round(commentCount / activities.length * 100) : 0, color: "#a78bfa" },
    { label: "Updates", count: updateCount, pct: activities.length ? Math.round(updateCount / activities.length * 100) : 0, color: "#22c55e" },
    { label: "Tasks", count: taskCount, pct: activities.length ? Math.round(taskCount / activities.length * 100) : 0, color: "#f97316" },
    { label: "Mentions", count: mentionCount, pct: activities.length ? Math.round(mentionCount / activities.length * 100) : 0, color: "#ef4444" },
  ];
  const recentNotes = activities.filter((a) => a.type === "Note").slice(0, 3);
  const upcomingTasks = activities.filter((a) => a.type === "Task" && a.completedBadge !== "Completed").slice(0, 5);

  return (
    <div className="p-5 flex flex-col gap-4">
      {/* Stat cards */}
      <div className="grid grid-cols-6 gap-3">
        {liveStats.map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-2 flex flex-col gap-1.5">
            <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center`}>{s.icon}</div>
            <p className="text-sm font-bold text-gray-900 leading-tight">{s.value}</p>
            <p className="text-[10px] font-medium text-gray-700">{s.label}</p>
            <p className="text-[10px] text-gray-400">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 items-start">
        {/* LEFT: note editor + timeline */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {/* Add Note */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-700 mb-2">Add Note</p>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Write a note or add comments..."
              className="w-full text-xs text-gray-600 border border-gray-100 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 placeholder:text-gray-300"
            />
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-3 text-gray-400">
                {[
                  { icon: <Bold size={13} />, label: "Bold" },
                  { icon: <Italic size={13} />, label: "Italic" },
                  { icon: <List size={13} />, label: "List" },
                  { icon: <span className="text-xs font-mono">—</span>, label: "Divider" },
                  { icon: <Link size={13} />, label: "Link" },
                  { icon: <AtSignIcon size={13} />, label: "Mention" },
                  { icon: <Smile size={13} />, label: "Emoji" },
                  { icon: <Paperclip size={13} />, label: "Attach" },
                ].map((btn) => (
                  <button key={btn.label} title={btn.label} className="hover:text-gray-600 transition-colors">{btn.icon}</button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 pr-7 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-600 bg-white"
                  >
                    <option>Select Visibility</option>
                    <option>Visible to All</option>
                    <option>Internal Only</option>
                    <option>Client Visible</option>
                  </select>
                  <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
                <button
                  onClick={handleAddNote}
                  disabled={!noteText.trim()}
                  className="text-xs bg-blue-600 text-white px-2 py-1.5 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Add Note
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-0 border-b border-gray-200">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setVisibleCount(9); }}
                className={`relative text-xs px-2 py-2.5 font-medium transition-colors ${activeTab === tab ? "text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
              >
                {tab}
                {activeTab === tab && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />}
              </button>
            ))}
          </div>

          {/* Timeline */}
          <div className="flex flex-col gap-1">
            {groupOrder.map((group) => {
              const items = groups[group];
              if (!items || items.length === 0) return null;
              return (
                <div key={group}>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3 mt-1">{group}</p>
                  <div className="flex flex-col gap-4">
                    {items.map((item) => (
                      <div key={item.id} className="flex gap-3 items-start group">
                        {/* Timeline dot */}
                        <div className="flex flex-col items-center pt-1">
                          <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0 mt-1" />
                        </div>

                        {/* Avatar */}
                        <Avatar initials={item.avatar} />

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-semibold text-gray-800">{item.name}</span>
                              <span className="text-xs text-gray-500">{item.action}</span>
                              {item.boldPart && <span className="text-xs font-semibold text-gray-800">{item.boldPart}</span>}
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TYPE_COLORS[item.type]}`}>{item.type}</span>
                              {item.completedBadge && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">{item.completedBadge}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[11px] text-gray-400 whitespace-nowrap">{item.time}</span>
                              <button className="text-gray-300 hover:text-gray-500 transition-colors opacity-0 group-hover:opacity-100">
                                <MoreVertical size={13} />
                              </button>
                            </div>
                          </div>
                          <p className="text-xs text-gray-600 mt-1 leading-relaxed whitespace-pre-line">{item.description}</p>
                          <div className="flex items-center gap-3 mt-1.5">
                            {item.visibility && (
                              <span className="text-[10px] border border-gray-200 rounded px-1.5 py-0.5 text-gray-400">{item.visibility}</span>
                            )}
                            {item.replies && (
                              <button className="text-[11px] text-blue-500 hover:underline">{item.replies} Reply</button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load more */}
          {visibleCount < activities.length && (
            <div className="flex justify-center mt-2">
              <button
                onClick={() => setVisibleCount((v) => v + 5)}
                className="flex items-center gap-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg px-2 py-2 hover:bg-gray-50 transition-colors"
              >
                Load More Activities <Download size={12} />
              </button>
            </div>
          )}
        </div>

        {/* RIGHT sidebar */}
        <div className="w-64 shrink-0 flex flex-col gap-4">
          {/* Activity Summary */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-800 mb-3">Activity Summary</p>
            <div className="flex items-center gap-3 mb-3">
              <DonutChart data={liveDonut} />
              <div className="flex flex-col gap-1">
                {liveDonut.map((d) => (
                  <div key={d.label} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-[10px] text-gray-600">{d.label} {d.count} ({d.pct}%)</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 pt-2 mt-1">
              <span className="text-[11px] text-gray-500">Total Activities</span>
               <span className="text-xs font-bold text-gray-800">{activities.length}</span>
            </div>
          </div>

          {/* Recent Notes */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-800 mb-3">Recent Notes</p>
            <div className="flex flex-col gap-3">
              {recentNotes.map((n, i) => (
                <div key={i} className="flex gap-2">
                  <FileText size={12} className="text-gray-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] text-gray-700 leading-snug">{n.description}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">By {n.name} • {n.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <button className="flex items-center gap-1 text-[11px] text-blue-500 hover:underline mt-3">
              View all notes <ArrowRight size={11} />
            </button>
          </div>

          {/* Upcoming Tasks */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-800 mb-3">Upcoming Tasks</p>
            <div className="flex flex-col gap-2.5">
              {upcomingTasks.map((t, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <CheckCircle2 size={13} className="text-green-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] text-gray-700 leading-snug">{t.boldPart || t.description}</p>
                    <p className="text-[10px] text-gray-400">{t.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <button className="flex items-center gap-1 text-[11px] text-blue-500 hover:underline mt-3">
              View all tasks <ArrowRight size={11} />
            </button>
          </div>

          {/* Filters */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-800 mb-3">Filters</p>
            <div className="flex flex-col gap-3">
              {[
                { label: "Date Range", value: dateRange, setter: setDateRange, options: ["This Month", "Last 7 Days", "Last 30 Days", "Custom"] },
                { label: "Activity Type", value: activityType, setter: setActivityType, options: ["All Types", "Notes", "Comments", "Updates", "Tasks", "Mentions"] },
                { label: "Visibility", value: visibilityFilter, setter: setVisibilityFilter, options: ["All", "Visible to All", "Internal Only"] },
                { label: "User", value: userFilter, setter: setUserFilter, options: ["All Users", "Priya Nair", "Rahul Sharma", "Sneha Iyer", "Vikram Singh", "Ankit Verma"] },
              ].map(({ label, value, setter, options }) => (
                <div key={label}>
                  <p className="text-[10px] text-gray-500 mb-1">{label}</p>
                  <div className="relative">
                    <select
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                      className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 pr-6 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 bg-white"
                    >
                      {options.map((o) => <option key={o}>{o}</option>)}
                    </select>
                    <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              ))}
              <button className="w-full flex items-center justify-center gap-1.5 text-xs bg-blue-600 text-white rounded-lg py-2 hover:bg-blue-700 transition-colors font-medium mt-1">
                <span>⊟</span> Apply Filters
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
