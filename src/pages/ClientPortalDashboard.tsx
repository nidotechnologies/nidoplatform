import { useAuth } from '@/contexts/AuthContext';
import { getPortalUsersByClient } from '@/lib/portalUserStore';
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  Wrench,
  FileText,
  Bell,
  Zap,
  ArrowRight,
  Users,
  Package,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getClientOrders, getClientServices } from '@/lib/clientDataStore';
import { getInvoices } from '@/lib/invoiceStore';

export default function ClientPortalDashboard() {
  const { user } = useAuth();
  const clientId = user?.clientId ?? '';
  const clientName = user?.clientName ?? 'Your Company';

  const portalUsers = getPortalUsersByClient(clientId);
  const clientOrders = clientId ? getClientOrders(clientId, clientName) : [];
  const clientServices = clientId ? getClientServices(clientId) : [];
  const clientInvoices = getInvoices().filter((invoice) => {
    const invoiceClientId = (invoice as typeof invoice & { clientId?: string }).clientId;
    return invoiceClientId
      ? invoiceClientId === clientId
      : invoice.clientName === clientName;
  });
  const pendingOrders = clientOrders.filter(order =>
    !["Delivered", "Cancelled"].includes(order.status)
  ).length;
  const activeServices = clientServices.filter(service => service.status === "Active").length;
  const outstandingInvoices = clientInvoices.filter(invoice =>
    ["Pending", "Overdue", "Sent"].includes(invoice.status)
  ).length;

  const stats = [
    {
      label: 'Total Orders',
      value: clientOrders.length,
      icon: <ShoppingBag size={22} className="text-blue-600" />,
      bg: 'bg-blue-50',
    },
    {
      label: 'Pending Orders',
      value: pendingOrders,
      icon: <Clock size={22} className="text-orange-600" />,
      bg: 'bg-orange-50',
    },
    {
      label: 'Completed Orders',
      value: clientOrders.filter(order => order.status === "Delivered").length,
      icon: <CheckCircle2 size={22} className="text-green-600" />,
      bg: 'bg-green-50',
    },
    {
      label: 'Active Services',
      value: activeServices,
      icon: <Wrench size={22} className="text-purple-600" />,
      bg: 'bg-purple-50',
    },
    {
      label: 'Outstanding Invoices',
      value: outstandingInvoices,
      icon: <FileText size={22} className="text-red-600" />,
      bg: 'bg-red-50',
    },
    {
      label: 'Portal Users',
      value: portalUsers.length,
      icon: <Users size={22} className="text-indigo-600" />,
      bg: 'bg-indigo-50',
    },
  ];

  const quickActions = [
    { label: 'Browse Catalog', path: '/portal/catalog', icon: <Package size={16} /> },
    { label: 'Place an Order', path: '/portal/catalog', icon: <ShoppingBag size={16} /> },
    { label: 'View Invoices', path: '/portal/invoices', icon: <FileText size={16} /> },
    { label: 'Raise a Support Ticket', path: '/portal/support', icon: <Bell size={16} /> },
  ];

  return (
    <div className="min-h-screen bg-white p-6">
      {/* Header */}
      <div className="bg-transparent border-b border-gray-200/70 mb-8">
        <div className="max-w-7xlpx-2 py-4">
          <p className="text-xs text-gray-500">Portal / Dashboard</p>
          <h1 className="text-2xl font-bold">Welcome, {user?.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{clientName} — Client Portal</p>
        </div>
      </div>

      <div className="max-w-7xlpx-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-8">
          {stats.map((s) => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-2 flex flex-col gap-2">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.bg}`}>
                {s.icon}
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-gray-500 leading-tight">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity */}
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl">
            <div className="px-6 py-2 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Recent Activity</h2>
            </div>
            <div className="px-6 py-10 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                <Clock size={22} className="text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-600">No activity yet</p>
              <p className="text-xs text-gray-400 mt-1">
                Your orders, invoices, and service updates will appear here.
              </p>
            </div>
          </div>

          {/* Quick Actions + Notifications */}
          <div className="flex flex-col gap-4">
            <div className="bg-white border border-gray-200 rounded-xl">
              <div className="px-6 py-2 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">Quick Actions</h2>
              </div>
              <div className="p-4 space-y-2">
                {quickActions.map((a) => (
                  <Link
                    key={a.label}
                    to={a.path}
                    className="flex items-center justify-between px-2 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors group"
                  >
                    <span className="flex items-center gap-2">
                      {a.icon}
                      {a.label}
                    </span>
                    <ArrowRight size={14} className="text-gray-300 group-hover:text-blue-500" />
                  </Link>
                ))}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl">
              <div className="px-6 py-2 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">Notifications</h2>
              </div>
              <div className="px-6 py-2 flex flex-col items-center text-center">
                <Bell size={20} className="text-gray-300 mb-2" />
                <p className="text-xs text-gray-400">No new notifications</p>
              </div>
            </div>
          </div>
        </div>

        {/* Portal Info Banner */}
        <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl px-2 py-2 flex items-start gap-3">
          <div className="w-8 h-8 shrink-0 bg-blue-600 rounded-lg flex items-center justify-center mt-0.5">
            <Zap size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-900">Your dedicated procurement portal</p>
            <p className="text-xs text-blue-700 mt-0.5">
              All data shown here belongs exclusively to <strong>{clientName}</strong>. Use the sidebar to navigate to your catalog, orders, services, and more.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
