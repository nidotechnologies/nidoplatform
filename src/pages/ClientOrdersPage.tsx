import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Filter, MoreVertical, X } from "lucide-react";
import { getClientOrders, saveClientOrder, type ClientOrderRecord } from "@/lib/clientDataStore";
import { getPrefix } from "@/lib/configService";
import { useAuth } from "@/contexts/AuthContext";

export const ordersData = [
  { id: "ORD-2024-1245", date: "2024-05-28", items: 12, amount: "$125,000", client: "TechSupply Co", status: "Delivered" },
  { id: "ORD-2024-1233", date: "2024-05-20", items: 8, amount: "$45,000", client: "Office Essentials", status: "In Transit" },
  { id: "ORD-2024-1198", date: "2024-05-15", items: 5, amount: "$22,000", client: "CloudServe Inc", status: "Delivered" },
  { id: "ORD-2024-1187", date: "2024-05-10", items: 15, amount: "$89,000", client: "TechSupply Co", status: "Delivered" },
];

type ClientDateRange = { start: string; end: string };

function isOrderInDateRange(date: string, range?: ClientDateRange): boolean {
  if (!range) return true;
  const normalized = date.slice(0, 10);
  return Boolean(range.start && range.end && range.start <= range.end && normalized >= range.start && normalized <= range.end);
}

export function OrderStatusBadge({ status }: { status: string }) {
  if (status === "Delivered") return (
    <span className="inline-flex items-center text-[11px] font-medium bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
      Delivered
    </span>
  );
  if (status === "In Transit") return (
    <span className="inline-flex items-center text-[11px] font-medium bg-orange-50 text-orange-600 border border-orange-200 px-2 py-0.5 rounded-full">
      In Transit
    </span>
  );
  return (
    <span className="inline-flex items-center text-[11px] font-medium bg-gray-100 text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full">
      {status}
    </span>
  );
}

function CreateOrderModal({ clientId, clientName, onClose, onCreate }: { clientId: string; clientName: string; onClose: () => void; onCreate: (order: ClientOrderRecord) => void }) {
  const [form, setForm] = useState({ items: "", quantity: "", amount: "", deliveryDate: "", notes: "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Create New Order</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-5 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Items <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={form.items}
              onChange={set("items")}
              placeholder="e.g. Laptop, Monitor, Keyboard"
              className="w-full px-2 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder-gray-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Quantity <span className="text-red-400">*</span></label>
            <input
              type="number"
              value={form.quantity}
              onChange={set("quantity")}
              placeholder="e.g. 5"
              className="w-full px-2 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder-gray-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Amount (₹) <span className="text-red-400">*</span></label>
            <input
              type="number"
              value={form.amount}
              onChange={set("amount")}
              placeholder="e.g. 50000"
              className="w-full px-2 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder-gray-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Delivery Date <span className="text-red-400">*</span></label>
            <input
              type="date"
              value={form.deliveryDate}
              onChange={set("deliveryDate")}
              className="w-full px-2 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 text-gray-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={set("notes")}
              placeholder="Additional notes for this order"
              rows={3}
              className="w-full px-2 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder-gray-300 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-2 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!form.items.trim() || !form.quantity || !form.amount || !form.deliveryDate) return;
              const order: ClientOrderRecord = {
                id: `${getPrefix("order") || "ORD-"}${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`,
                clientId,
                date: form.deliveryDate,
                items: Number(form.quantity),
                amount: `₹${Number(form.amount).toLocaleString("en-IN")}`,
                amountNum: Number(form.amount),
                client: clientName,
                status: "Processing",
                notes: form.notes.trim(),
              };
              onCreate(order);
              onClose();
            }}
            className="px-4 py-2 text-xs bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-lg transition-colors"
          >
            Create Order
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ClientOrdersPage({
  clientId,
  clientName,
  dateRange,
}: {
  clientId: string;
  clientName: string;
  dateRange?: ClientDateRange;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rowMenu, setRowMenu] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [orders, setOrders] = useState<ClientOrderRecord[]>(() => getClientOrders(clientId, clientName));
  const visibleOrders = orders.filter((order) => isOrderInDateRange(order.date, dateRange));
  const total = visibleOrders.length;

  const reload = () => setOrders(getClientOrders(clientId, clientName));
  useEffect(() => {
    reload();
    window.addEventListener("nidoClientDataUpdated", reload);
    return () => window.removeEventListener("nidoClientDataUpdated", reload);
  }, [clientId, clientName]);

  useEffect(() => {
    setPage(1);
  }, [dateRange?.start, dateRange?.end]);

  const handleCreate = (order: ClientOrderRecord) => {
    saveClientOrder({
      ...order,
      requestedBy: user?.name || "",
      requestedById: user?.id || "",
      requestedByEmail: user?.email || "",
    });
    reload();
  };

  return (
    <div className="p-5 flex flex-col gap-4" onClick={() => setRowMenu(null)}>
      {showCreateOrder && <CreateOrderModal clientId={clientId} clientName={clientName} onCreate={handleCreate} onClose={() => setShowCreateOrder(false)} />}
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Order History</h2>
          <p className="text-xs text-gray-400 mt-0.5">View and manage all orders placed by this client.</p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setShowCreateOrder(true); }}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-2 py-2 rounded-lg transition-colors"
        >
          <span className="text-base leading-none">+</span> New Order
        </button>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 bg-white">
              <th className="text-left px-2 py-2 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Order ID</th>
              <th className="text-left px-2 py-2 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Date <Filter size={9} className="inline ml-0.5 text-gray-400" /></th>
              <th className="text-left px-2 py-2 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Items</th>
              <th className="text-left px-2 py-2 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Amount <Filter size={9} className="inline ml-0.5 text-gray-400" /></th>
              <th className="text-left px-2 py-2 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Client <Filter size={9} className="inline ml-0.5 text-gray-400" /></th>
              <th className="text-left px-2 py-2 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Status <Filter size={9} className="inline ml-0.5 text-gray-400" /></th>
              <th className="text-left px-2 py-2 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Action</th>
            </tr>
          </thead>
          <tbody>
            {visibleOrders.map((order, i) => (
              <tr key={order.id} className={`border-b border-gray-100 last:border-0 hover:bg-gray-50/60 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50/20"}`}>
                <td className="px-4 py-3">
                  <span
                    className="text-blue-500 hover:underline cursor-pointer font-medium"
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >{order.id}</span>
                </td>
                <td className="px-4 py-2 text-gray-700">{order.date}</td>
                <td className="px-4 py-2 text-gray-700">{order.items} Items</td>
                <td className="px-4 py-2 font-semibold text-gray-900">{order.amount}</td>
                <td className="px-4 py-2 text-gray-700">{order.client}</td>
                <td className="px-4 py-3">
                  <OrderStatusBadge status={order.status} />
                </td>
                <td className="px-4 py-2 relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setRowMenu(rowMenu === order.id ? null : order.id); }}
                    className="p-1 rounded hover:bg-gray-100 text-gray-400 transition-colors"
                  >
                    <MoreVertical size={13} />
                  </button>
                  {rowMenu === order.id && (
                    <div className="absolute right-8 top-2 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-20 w-36" onClick={(e) => e.stopPropagation()}>
                      {["View Details", "Edit Order", "Download Invoice", "Cancel Order"].map((action) => (
                        <button key={action} onClick={() => setRowMenu(null)} className={`w-full text-left px-2 py-1.5 text-xs hover:bg-gray-50 transition-colors ${action === "Cancel Order" ? "text-red-500" : "text-gray-700"}`}>
                          {action}
                        </button>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {visibleOrders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-xs text-gray-400">
                  No orders found for this date range.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Footer pagination */}
        <div className="flex items-center justify-between px-2 py-2 border-t border-gray-100 bg-white">
          <p className="text-[11px] text-orange-500 font-medium">Showing 1 to {total} of {total} orders</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50 text-xs transition-colors disabled:opacity-40"
              disabled={page === 1}
            >
              –
            </button>
            <span className="w-7 h-7 flex items-center justify-center rounded bg-blue-600 text-white text-xs font-semibold">{page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50 text-xs transition-colors"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
