import { useEffect, useState } from "react";
import { Filter, X } from "lucide-react";
import { getClientServices, saveClientService, type ClientServiceRecord } from "@/lib/clientDataStore";
import { useAuth } from "@/contexts/AuthContext";

export const servicesData = [
  { id: "SRV-001", name: "Cloud Hosting Premium", provider: "CloudServe Inc", startDate: "2024-01-01", endDate: "2024-12-31", amount: "$12,000/year", status: "Active", category: "Hosting" },
  { id: "SRV-002", name: "IT Support & Maintenance", provider: "TechSupply Co", startDate: "2024-01-01", endDate: "2024-12-31", amount: "$24,000/year", status: "Active", category: "Support" },
  { id: "SRV-003", name: "Software Licenses", provider: "Microsoft", startDate: "2024-01-01", endDate: "2024-12-31", amount: "$36,000/year", status: "Active", category: "Software" },
];

const serviceCategories = ["All", "Hosting", "Support", "Software", "Networking", "Security"];
type ClientDateRange = { start: string; end: string };

function overlapsDateRange(startDate: string, endDate: string, range?: ClientDateRange): boolean {
  if (!range) return true;
  const start = startDate.slice(0, 10);
  const end = (endDate || startDate).slice(0, 10);
  return Boolean(range.start && range.end && range.start <= range.end && start && end && start <= range.end && end >= range.start);
}

function AddServiceModal({ onClose, onAdd }: { onClose: () => void; onAdd: (service: ClientServiceRecord) => void }) {
  const [form, setForm] = useState({
    name: "",
    provider: "",
    startDate: "",
    endDate: "",
    amount: "",
    description: "",
  });

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-2 pt-5 pb-4">
          <h2 className="text-base font-semibold text-gray-900">Add New Service</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-5 flex flex-col gap-4">
          {/* Service Name */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Service Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={set("name")}
              placeholder="e.g. Cloud Hosting Premium"
              className="w-full px-2 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder-gray-300"
            />
          </div>

          {/* Provider */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Provider <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.provider}
              onChange={set("provider")}
              placeholder="e.g. CloudServe Inc"
              className="w-full px-2 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder-gray-300"
            />
          </div>

          {/* Start Date + End Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Start Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={form.startDate}
                onChange={set("startDate")}
                className="w-full px-2 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 text-gray-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                End Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={form.endDate}
                onChange={set("endDate")}
                className="w-full px-2 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 text-gray-500"
              />
            </div>
          </div>

          {/* Annual Amount */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Annual Amount (₹) <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              value={form.amount}
              onChange={set("amount")}
              placeholder="e.g. 12000"
              className="w-full px-2 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder-gray-300"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={set("description")}
              placeholder="Short description of the service"
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
              if (!form.name.trim() || !form.provider.trim() || !form.startDate || !form.endDate || !form.amount) return;
              onAdd({
                id: `SRV-${String(Date.now()).slice(-6)}`,
                clientId: "",
                name: form.name.trim(),
                provider: form.provider.trim(),
                startDate: form.startDate,
                endDate: form.endDate,
                amount: `₹${Number(form.amount).toLocaleString("en-IN")}/year`,
                status: "Active",
                category: "Other",
                description: form.description.trim(),
              });
              onClose();
            }}
            className="px-4 py-2 text-xs bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-lg transition-colors"
          >
            Add Service
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ClientServicesPage({ clientId: requestedClientId, dateRange }: { clientId?: string; dateRange?: ClientDateRange }) {
  const { user, isClientPortalUser } = useAuth();
  const clientId = isClientPortalUser ? (user?.clientId ?? "") : (requestedClientId ?? "");
  const [rowMenu, setRowMenu] = useState<string | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("Category");
  const [page, setPage] = useState(1);
  const [showAddService, setShowAddService] = useState(false);
  const [services, setServices] = useState<ClientServiceRecord[]>(() => getClientServices(clientId));

  const reload = () => setServices(getClientServices(clientId));
  useEffect(() => {
    reload();
    window.addEventListener("nidoClientDataUpdated", reload);
    return () => window.removeEventListener("nidoClientDataUpdated", reload);
  }, [clientId]);

  const handleAdd = (service: ClientServiceRecord) => {
    saveClientService({
      ...service,
      clientId,
      requestedBy: user?.name || "",
      requestedById: user?.id || "",
      requestedByEmail: user?.email || "",
    });
    reload();
  };

  const periodServices = services.filter((service) => overlapsDateRange(service.startDate, service.endDate, dateRange));
  const filtered = selectedCategory === "Category" || selectedCategory === "All"
    ? periodServices
    : periodServices.filter((s) => s.category === selectedCategory);

  return (
    <div className="p-5 flex flex-col gap-4" onClick={() => { setRowMenu(null); setCategoryOpen(false); }}>
      {showAddService && <AddServiceModal onAdd={handleAdd} onClose={() => setShowAddService(false)} />}
      {/* Header */}
      <div className="flex items-start justify-between">
        <h2 className="text-base font-semibold text-gray-900">Service History</h2>
        <button
          onClick={(e) => { e.stopPropagation(); setShowAddService(true); }}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-2 py-2 rounded-lg transition-colors"
        >
          <span className="text-base leading-none">+</span> Add Service
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <button className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
          Filter
        </button>
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setCategoryOpen((v) => !v); }}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1.5"
          >
            {selectedCategory}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {categoryOpen && (
            <div className="absolute left-0 top-9 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-20 w-36" onClick={(e) => e.stopPropagation()}>
              {serviceCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => { setSelectedCategory(cat === "All" ? "Category" : cat); setCategoryOpen(false); }}
                  className={`w-full text-left px-2 py-1.5 text-xs hover:bg-gray-50 transition-colors ${selectedCategory === cat || (cat === "All" && selectedCategory === "Category") ? "text-blue-600 font-medium" : "text-gray-700"}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 bg-white">
              <th className="text-left px-2 py-2 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Service ID</th>
              <th className="text-left px-2 py-2 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Requested Date <Filter size={9} className="inline ml-0.5 text-gray-400" /></th>
              <th className="text-left px-2 py-2 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Service Name <Filter size={9} className="inline ml-0.5 text-gray-400" /></th>
              <th className="text-left px-2 py-2 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Requested By</th>
              <th className="text-left px-2 py-2 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Amount <Filter size={9} className="inline ml-0.5 text-gray-400" /></th>
              <th className="text-left px-2 py-2 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Status <Filter size={9} className="inline ml-0.5 text-gray-400" /></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((svc, i) => (
              <tr key={svc.id} className={`border-b border-gray-100 last:border-0 hover:bg-gray-50/60 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50/20"}`}>
                <td className="px-4 py-3">
                  <span className="text-blue-500 hover:underline cursor-pointer font-medium">{svc.id}</span>
                </td>
                <td className="px-4 py-2 text-gray-700">{svc.startDate}</td>
                <td className="px-4 py-2 font-medium text-gray-800">{svc.name}</td>
                <td className="px-4 py-3">
                  <span className="text-blue-500 hover:underline cursor-pointer">{svc.provider}</span>
                </td>
                <td className="px-4 py-2 font-semibold text-gray-900">{svc.amount}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center text-[11px] font-medium bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
                    {svc.status}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-xs text-gray-400">No services found for this category.</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Footer pagination */}
        <div className="flex items-center justify-between px-2 py-2 border-t border-gray-100 bg-white">
          <p className="text-[11px] text-orange-500 font-medium">
            Showing 1 to {filtered.length} of {filtered.length} services
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50 text-xs transition-colors disabled:opacity-40"
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
