import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useConfig } from "@/contexts/ConfigContext";
import { createPortal } from "react-dom";
import { Plus, Search, MoreVertical, Archive, FileDown, FileText, Eye, RotateCcw, X } from "lucide-react";
import {
  getActiveOrders, getArchivedOrders, archiveOrder, restoreOrder,
  type StoredSalesOrder,
} from "@/lib/salesOrderStore";
import { downloadSalesOrderPdf } from "@/lib/salesOrderPdfGenerator";
import { useI18n } from "@/i18n/I18nProvider";
import { formatCurrency } from "@/lib/formatters";
import { useOrderStatusConfig } from "@/lib/orderStatusStore";

function statusBadge(status: string) {
  switch (status) {
    case "Completed":  return "bg-green-100 text-green-800";
    case "Confirmed":  return "bg-blue-100 text-blue-800";
    case "Processing": return "bg-yellow-100 text-yellow-800";
    case "Cancelled":  return "bg-red-100 text-red-800";
    default:           return "bg-gray-100 text-gray-800";
  }
}

const fmt = (n: number) =>
  formatCurrency(n);

export default function SalesOrdersPage() {
  const navigate = useNavigate();
  const { config } = useConfig();
  const statusConfig = useOrderStatusConfig();
  useI18n();
  const soPrefix = config.prefixes.find(p => p.key === "salesOrder")?.value || "SO-";
  const salesStatusOptions = useMemo(() => Array.from(new Set([
    ...statusConfig.statuses
      .filter(status => status.category === "Transactions" && status.visible)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(status => status.name),
    "Draft", "Confirmed", "Processing", "Completed", "Cancelled",
  ])), [statusConfig.statuses]);

  const [orders, setOrders] = useState<StoredSalesOrder[]>([]);
  const [archivedOrders, setArchivedOrders] = useState<StoredSalesOrder[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [menuOpen, setMenuOpen] = useState(false);
  const [rowMenuOpen, setRowMenuOpen] = useState<string | null>(null);
  const [rowMenuRect, setRowMenuRect] = useState<DOMRect | null>(null);
  const rowMenuButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [showArchivedModal, setShowArchivedModal] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setOrders(getActiveOrders());
      setArchivedOrders(getArchivedOrders());
    };
    refresh();
    window.addEventListener("nidoSalesOrdersUpdated", refresh);
    const closeMenusOnScroll = () => {
      setRowMenuOpen(null);
      setRowMenuRect(null);
    };
    window.addEventListener("scroll", closeMenusOnScroll, true);
    return () => {
      window.removeEventListener("nidoSalesOrdersUpdated", refresh);
      window.removeEventListener("scroll", closeMenusOnScroll, true);
    };
  }, []);

  const displayedOrders = useMemo(
    () => orders.map(o => ({ ...o, orderNumber: o.orderNumber.replace(/^SO-/, soPrefix) })),
    [orders, soPrefix]
  );

  const filtered = displayedOrders.filter(o => {
    const match = o.orderNumber.includes(search) || o.clientName.toLowerCase().includes(search.toLowerCase());
    const statusMatch = statusFilter === "all" || o.status === statusFilter;
    return match && statusMatch;
  });

  const stats = {
    total:      orders.length,
    pending:    orders.filter(o => o.status === "Draft").length,
    processing: orders.filter(o => o.status === "Processing" || o.status === "Confirmed").length,
    completed:  orders.filter(o => o.status === "Completed").length,
    totalValue: orders.reduce((s, o) => s + o.grandTotal, 0),
  };

  const handleArchive = (id: string) => {
    if (confirm("Move this order to Archived Orders?")) {
      archiveOrder(id);
      setRowMenuOpen(null);
      setRowMenuRect(null);
    }
  };

  const toggleRowMenu = (id: string) => {
    if (rowMenuOpen === id) {
      setRowMenuOpen(null);
      setRowMenuRect(null);
      return;
    }
    const rect = rowMenuButtonRefs.current[id]?.getBoundingClientRect();
    if (!rect) return;
    setRowMenuOpen(id);
    setRowMenuRect(rect);
  };

  const closeRowMenu = () => {
    setRowMenuOpen(null);
    setRowMenuRect(null);
  };

  const exportCsv = () => {
    const headers = ["Order #", "Client", "Amount", "Date", "Status"];
    const escapeCsv = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = displayedOrders.map(o => [o.orderNumber, o.clientName, o.grandTotal.toFixed(2), o.orderDate, o.status]);
    const csv = [headers, ...rows].map(row => row.map(escapeCsv).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    link.download = "sales-orders.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="space-y-6" onClick={() => { setMenuOpen(false); setRowMenuOpen(null); }}>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Create and manage sales orders</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sales Orders</h1>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <MoreVertical size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-2 z-50">
                <button
                  onClick={() => { setMenuOpen(false); navigate("/sales/orders/create"); }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
                >
                  <Plus size={16} />
                  New Order
                </button>
                <button
                  onClick={() => { setMenuOpen(false); exportCsv(); }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
                >
                  <FileDown size={16} />
                  Export CSV
                </button>
                <button
                  onClick={() => { setMenuOpen(false); setShowArchivedModal(true); }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
                >
                  <Archive size={16} />
                  Archived Orders
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: "Total",      value: stats.total,                           color: "text-blue-600 dark:text-blue-400" },
          { label: "Draft",      value: stats.pending,                         color: "text-yellow-600 dark:text-yellow-400" },
          { label: "Active",     value: stats.processing,                      color: "text-blue-600 dark:text-blue-400" },
          { label: "Completed",  value: stats.completed,                       color: "text-green-600 dark:text-green-400" },
          { label: "Value",      value: fmt(stats.totalValue),                 color: "text-purple-600 dark:text-purple-400" },
        ].map(stat => (
          <div key={stat.label} className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search orders..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All</option>
          {salesStatusOptions.map(status => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </div>

      {/* Orders Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-400 dark:text-gray-500 mb-4">No orders yet</p>
            <button
              onClick={() => navigate("/sales/orders/create")}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm"
            >
              <Plus size={16} /> Create First Order
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  {["DATE", "ORDER #", "CUSTOMER", "STATUS", "DELIVERY", "TOTAL", "ACTIONS"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => (
                  <tr key={o.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{o.orderDate}</td>
                    <td className="px-4 py-3 text-sm font-medium">
                      <button
                        onClick={() => navigate(`/sales/orders/${o.id}`)}
                        className="text-blue-600 hover:underline font-semibold bg-yellow-50 dark:bg-yellow-900/20 px-2 py-1 rounded transition-colors"
                      >
                        {o.orderNumber}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{o.clientName}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusBadge(o.status)}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{o.deliveryDate}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">{fmt(o.grandTotal)}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <div className="relative">
                          <button
                             ref={button => { rowMenuButtonRefs.current[o.id] = button; }}
                             onClick={() => toggleRowMenu(o.id)}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                          >
                            <MoreVertical size={16} className="text-gray-600 dark:text-gray-400" />
                          </button>
                           {rowMenuOpen === o.id && rowMenuRect && createPortal(
                             <div
                               style={{
                                 position: "fixed",
                                 top: Math.min(rowMenuRect.bottom + 4, window.innerHeight - 220),
                                 left: Math.max(8, rowMenuRect.right - 176),
                                 zIndex: 100000,
                               }}
                               className="w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-2"
                               onClick={e => e.stopPropagation()}
                             >
                              <button
                                 onClick={() => { navigate(`/sales/orders/${o.id}`); closeRowMenu(); }}
                                className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
                              >
                                <Eye size={15} /> View
                              </button>
                              <button
                                 onClick={() => { navigate(`/sales/orders/${o.id}/edit`); closeRowMenu(); }}
                                className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
                              >
                                Edit
                              </button>
                               <button
                                 onClick={() => { void downloadSalesOrderPdf(o); closeRowMenu(); }}
                                 className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
                               >
                                 <FileText size={15} /> Download PDF
                               </button>
                              <button
                                onClick={() => handleArchive(o.id)}
                                className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
                              >
                                <Archive size={15} /> Archive
                              </button>
                             </div>,
                             document.body,
                           )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Archived Orders Modal */}
      {showArchivedModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowArchivedModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col mx-4"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <Archive size={20} className="text-gray-500 dark:text-gray-400" />
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Archived Orders</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Orders moved out of the active list</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500 dark:text-gray-400">{archivedOrders.length} archived</span>
                <button
                  onClick={() => setShowArchivedModal(false)}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X size={18} className="text-gray-500 dark:text-gray-400" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="overflow-auto flex-1">
              {archivedOrders.length === 0 ? (
                <div className="py-16 text-center text-gray-500 dark:text-gray-400">
                  No archived orders
                </div>
              ) : (
                <table className="w-full">
                  <thead className="sticky top-0">
                    <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                      {["DATE", "ORDER #", "CUSTOMER", "STATUS", "DELIVERY", "TOTAL", "ACTIONS"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {archivedOrders.map(o => (
                      <tr key={o.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{o.orderDate}</td>
                        <td className="px-4 py-3 text-sm font-medium">
                          <button
                            onClick={() => { setShowArchivedModal(false); navigate(`/sales/orders/${o.id}`); }}
                            className="text-blue-600 hover:underline font-semibold px-2 py-1 rounded transition-colors"
                          >
                            {o.orderNumber}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{o.clientName}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusBadge(o.status)}`}>
                            {o.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{o.deliveryDate}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">{fmt(o.grandTotal)}</td>
                        <td className="px-4 py-3 text-sm">
                          <button
                            onClick={() => restoreOrder(o.id)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                          >
                            <RotateCcw size={15} /> Restore
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
