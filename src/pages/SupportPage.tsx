import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useConfig } from "@/contexts/ConfigContext";
import {
  Plus, Search, CheckCircle, Clock, AlertCircle,
  Phone, Mail, ChevronRight, Headphones, FileText,
  HelpCircle, Ticket, PhoneCall, X,
} from "lucide-react";
import { getServiceSLA } from "@/lib/slaEngine";
import { computeSLAStatus } from "@/lib/slaUtils";
import SLABadge from "@/components/shared/SLABadge";
import { saveSupportTickets } from "@/lib/supportTicketStore";

const MOCK_TICKETS = [
  { id: "tkt_001", number: "TKT-001", subject: "Unable to access vendor portal", status: "resolved",    priority: "high",   created: "2024-01-20", resolved: "2024-01-21" },
  { id: "tkt_002", number: "TKT-002", subject: "Invoice discrepancy",            status: "in_progress", priority: "medium", created: "2024-01-22", resolved: null },
  { id: "tkt_003", number: "TKT-003", subject: "Payment method update",          status: "open",        priority: "low",    created: "2024-01-23", resolved: null },
];

const FAQ_ITEMS = [
  "How do I place an order?",
  "How do I track my order?",
  "Payment methods and issues",
  "How to manage vendors?",
  "Returns and Refunds",
  "Account and access issues",
];

export default function SupportPage() {
  const navigate = useNavigate();
  const { config } = useConfig();
  const tktPrefix = config.prefixes.find(p => p.key === "supportTicket")?.value || "TKT-";
  const [tickets, setTickets] = useState(MOCK_TICKETS);
  const displayedTickets = useMemo(
    () => tickets.map(t => ({ ...t, number: t.number.replace(/^TKT-/, tktPrefix) })),
    [tickets, tktPrefix]
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showTickets, setShowTickets] = useState(false);
  const [showFaqs, setShowFaqs] = useState(false);

  const filtered = displayedTickets.filter(t => {
    const match = t.number.includes(search) || t.subject.toLowerCase().includes(search.toLowerCase());
    const statusMatch = statusFilter === "all" || t.status === statusFilter;
    return match && statusMatch;
  });

  useEffect(() => {
    saveSupportTickets(tickets.map(t => ({
      id: t.id, number: t.number, subject: t.subject,
      status: t.status, priority: t.priority, created: t.created,
    })));
  }, [tickets]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "resolved":    return <CheckCircle className="text-green-600" size={18} />;
      case "in_progress": return <Clock className="text-blue-600" size={18} />;
      case "open":        return <AlertCircle className="text-yellow-600" size={18} />;
      default:            return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "resolved":    return "bg-green-100 text-green-800";
      case "in_progress": return "bg-blue-100 text-blue-800";
      case "open":        return "bg-yellow-100 text-yellow-800";
      default:            return "bg-muted text-muted-foreground";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":   return "bg-red-100 text-red-800";
      case "medium": return "bg-yellow-100 text-yellow-800";
      case "low":    return "bg-green-100 text-green-800";
      default:       return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Page Header */}
      <div className="bg-transparent border-b border-border">
        <div className="w-full px-2 md:px-6 py-2 md:py-4">
          <h1 className="text-2xl font-bold text-foreground">Support</h1>
          <p className="text-sm text-muted-foreground mt-0.5">How can we help you today?</p>
        </div>
      </div>

      <div className="w-full px-2 md:px-6 py-6 md:py-8">

        {/* ── Three-column card grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 mb-5">

          {/* ── Card 1: Contact Support ── */}
          <div className="rounded-2xl border border-border bg-[#f0f4ff] dark:bg-card p-6 flex flex-col">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-[#dce6ff] dark:bg-primary/20 flex items-center justify-center mb-4">
                <Headphones size={28} className="text-[#3b5bdb] dark:text-primary" />
              </div>
              <h2 className="text-lg font-bold text-foreground mb-1">Contact Support</h2>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-[220px]">
                Reach out to our support team for any assistance or queries.
              </p>
            </div>

            <div className="flex flex-col gap-3 flex-1">
              {/* Phone */}
              <div className="flex items-start gap-3 bg-background dark:bg-card rounded-xl border border-border p-3">
                <div className="w-9 h-9 rounded-lg bg-[#e8f0ff] dark:bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Phone size={16} className="text-[#3b5bdb] dark:text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground mb-0.5">Phone Number</p>
                  <p className="text-sm font-semibold text-[#2563eb] dark:text-primary">+91 80 1234 5678</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Mon – Fri, 9:00 AM to 6:00 PM IST</p>
                </div>
              </div>

              {/* Email */}
              <div className="flex items-start gap-3 bg-background dark:bg-card rounded-xl border border-border p-3">
                <div className="w-9 h-9 rounded-lg bg-[#e8f0ff] dark:bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Mail size={16} className="text-[#3b5bdb] dark:text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground mb-0.5">Support Email</p>
                  <p className="text-sm font-semibold text-[#2563eb] dark:text-primary">support@nido-tech.com</p>
                  <p className="text-xs text-muted-foreground mt-0.5">We typically respond within 24 hours</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Card 2: Create a Ticket ── */}
          <div className="rounded-2xl border border-border bg-[#f0faf4] dark:bg-card p-6 flex flex-col">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-[#c9f0da] dark:bg-green-900/30 flex items-center justify-center mb-4">
                <FileText size={28} className="text-[#16a34a] dark:text-green-500" />
              </div>
              <h2 className="text-lg font-bold text-foreground mb-1">Create a Ticket</h2>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-[220px]">
                Raise a support ticket and our team will assist you as soon as possible.
              </p>
            </div>

            <div className="flex flex-col gap-2.5 mb-6 flex-1">
              {[
                "Track your ticket status",
                "Get timely updates",
                "Resolve issues faster",
              ].map(item => (
                <div key={item} className="flex items-center gap-2.5">
                  <CheckCircle size={18} className="text-[#16a34a] dark:text-green-500 flex-shrink-0" />
                  <span className="text-sm text-foreground">{item}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => navigate("/support/create")}
                className="w-full py-3 rounded-xl bg-[#16a34a] hover:bg-[#15803d] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <Plus size={18} />
                Create a New Ticket
              </button>
              <button
                onClick={() => navigate("/support/tickets")}
                className="w-full py-2 flex items-center justify-center gap-2 text-sm font-medium text-[#16a34a] dark:text-green-500 hover:underline"
              >
                <Ticket size={15} />
                View My Tickets
              </button>
            </div>
          </div>

          {/* ── Card 3: FAQs ── */}
          <div className="rounded-2xl border border-border bg-[#f5f0ff] dark:bg-card p-6 flex flex-col">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-[#e3d9ff] dark:bg-purple-900/30 flex items-center justify-center mb-4">
                <HelpCircle size={28} className="text-[#7c3aed] dark:text-purple-400" />
              </div>
              <h2 className="text-lg font-bold text-foreground mb-1">FAQs</h2>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-[220px]">
                Browse through our frequently asked questions for quick answers.
              </p>
            </div>

            <div className="flex flex-col divide-y divide-border flex-1">
              {FAQ_ITEMS.map(faq => (
                <button
                  key={faq}
                  onClick={() => setShowFaqs(true)}
                  className="flex items-center justify-between py-2.5 text-left text-sm text-foreground hover:text-primary transition-colors group"
                >
                  <span>{faq}</span>
                  <ChevronRight size={15} className="text-muted-foreground group-hover:text-primary flex-shrink-0" />
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowFaqs(true)}
              className="mt-4 w-full py-2 flex items-center justify-center gap-2 text-sm font-medium text-[#7c3aed] dark:text-purple-400 hover:underline"
            >
              <FileText size={15} />
              View All FAQs
            </button>
          </div>
        </div>

        {/* ── Need immediate help? banner ── */}
        <div className="rounded-2xl border border-border bg-background flex items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full border-2 border-[#3b5bdb]/30 flex items-center justify-center flex-shrink-0">
              <Phone size={18} className="text-[#3b5bdb] dark:text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Need immediate help?</p>
              <p className="text-xs text-muted-foreground">
                If your issue is urgent, please contact our support team directly via phone for faster assistance.
              </p>
            </div>
          </div>
          <a
            href="tel:+918012345678"
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border border-[#3b5bdb] dark:border-primary rounded-xl text-sm font-semibold text-[#3b5bdb] dark:text-primary hover:bg-[#3b5bdb]/5 transition-colors"
          >
            <PhoneCall size={15} />
            Call Now
          </a>
        </div>

      </div>

      {/* ── My Tickets Modal ── */}
      {showTickets && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto py-8">
          <div className="bg-card rounded-2xl border border-border w-full max-w-4xl mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-bold text-foreground">My Tickets</h2>
              <button onClick={() => setShowTickets(false)} className="text-muted-foreground hover:text-foreground">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              {/* Search + filter */}
              <div className="mb-4 flex gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-2.5 text-muted-foreground" size={18} />
                  <input
                    type="text"
                    placeholder="Search tickets..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>

              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Ticket</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Subject</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Priority</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Created</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">SLA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(ticket => (
                      <tr key={ticket.id} className="border-b border-border hover:bg-muted/30">
                        <td className="px-4 py-3 text-sm font-medium text-primary">{ticket.number}</td>
                        <td className="px-4 py-3 text-sm text-foreground">{ticket.subject}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getPriorityColor(ticket.priority)}`}>
                            {ticket.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">{ticket.created}</td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-1.5">
                            {getStatusIcon(ticket.status)}
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getStatusColor(ticket.status)}`}>
                              {ticket.status.replace("_", " ")}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {(() => {
                            const svcSLA = getServiceSLA();
                            const priorityMap: Record<string, string> = { high: "Technical Support", medium: "Remote Support", low: "On-site Support" };
                            const cat = svcSLA.find(s => s.category === (priorityMap[ticket.priority] ?? "Technical Support"));
                            const targetHrs = cat?.resolutionTimeHrs ?? 4;
                            const done = ticket.status === "resolved";
                            const sla = computeSLAStatus(ticket.created, targetHrs, done);
                            return <SLABadge sla={sla} compact />;
                          })()}
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">No tickets found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── FAQ Modal ── */}
      {showFaqs && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl border border-border w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-bold text-foreground">Frequently Asked Questions</h2>
              <button onClick={() => setShowFaqs(false)} className="text-muted-foreground hover:text-foreground">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 divide-y divide-border">
              {FAQ_ITEMS.map(faq => (
                <div key={faq} className="py-3 flex items-center justify-between">
                  <span className="text-sm text-foreground">{faq}</span>
                  <ChevronRight size={15} className="text-muted-foreground" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
