import { useEffect, useState } from "react";
import { FileText, ShoppingBag, Wrench, Receipt } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getClientOrders, getClientServices } from "@/lib/clientDataStore";
import { getInvoices } from "@/lib/invoiceStore";

interface ClientReportCounts {
  orders: ReturnType<typeof getClientOrders>;
  services: ReturnType<typeof getClientServices>;
  invoices: ReturnType<typeof getInvoices>;
}

function loadClientReportCounts(clientId: string, clientName: string): ClientReportCounts {
  return {
    orders: clientId ? getClientOrders(clientId, clientName) : [],
    services: clientId ? getClientServices(clientId) : [],
    invoices: getInvoices().filter(invoice =>
      invoice.clientName === clientName ||
      (invoice as typeof invoice & { clientId?: string }).clientId === clientId
    ),
  };
}

export default function ClientPortalReportsPage() {
  const { user } = useAuth();
  const clientId = user?.clientId ?? "";
  const clientName = user?.clientName ?? "";
  const [reportData, setReportData] = useState(() => loadClientReportCounts(clientId, clientName));

  useEffect(() => {
    const refresh = () => setReportData(loadClientReportCounts(clientId, clientName));
    const events = ["nidoClientDataUpdated", "nidoMyOrdersUpdated", "nidoInvoicesUpdated"];
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    events.forEach((eventName) => window.addEventListener(eventName, refresh));
    refresh();
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      events.forEach((eventName) => window.removeEventListener(eventName, refresh));
    };
  }, [clientId, clientName]);

  const { orders, services, invoices } = reportData;
  const cards = [
    { label: "My Orders", value: orders.length, icon: ShoppingBag, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "My Services", value: services.length, icon: Wrench, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "My Invoices", value: invoices.length, icon: Receipt, color: "text-emerald-600", bg: "bg-emerald-50" },
  ];
  return (
    <div className="min-h-screen bg-white p-6">
      <div className="border-b border-gray-200/70 mb-8 pb-4">
        <p className="text-xs text-gray-500">Portal / Reports</p>
        <h1 className="text-2xl font-bold">My Reports</h1>
        <p className="text-sm text-gray-500">{clientName}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map(card => {
          const Icon = card.icon;
          return <div key={card.label} className="rounded-xl border border-gray-200 p-5">
            <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg ${card.bg}`}><Icon className={card.color} size={20} /></div>
            <p className="text-2xl font-bold">{card.value}</p>
            <p className="text-sm text-gray-500">{card.label}</p>
          </div>;
        })}
      </div>
      <div className="mt-6 rounded-xl border border-gray-200 p-6">
        <FileText className="mb-3 text-gray-400" size={22} />
        <h2 className="font-semibold text-gray-900">Client activity summary</h2>
        <p className="mt-1 text-sm text-gray-500">Only orders, services, and invoices belonging to your client account are included.</p>
      </div>
    </div>
  );
}