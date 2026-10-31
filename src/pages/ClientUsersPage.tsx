import { useState, useEffect } from "react";
import {
  Mail,
  Phone,
  Download,
  Users,
  DollarSign,
  Building2,
  MoreVertical,
  UserPlus,
  Upload,
  X,
  CheckCircle,
  Timer,
  Filter,
  FileText,
  Clock,
} from "lucide-react";
import { sanitizePhoneNumber, isValidPhoneNumber } from "@/lib/phoneValidation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { getPortalUsersByClient, getPortalRoles, PORTAL_MODULES, provisionPortalUser, updatePortalUser } from "@/lib/portalUserStore";
import { getClients, addClient } from "@/lib/clientStore";
import {
  getClientActivities,
  getClientOrders,
  getClientServices,
  type ClientActivityRecord,
  type ClientOrderRecord,
  type ClientServiceRecord,
} from "@/lib/clientDataStore";
import { getServiceRequests } from "@/lib/serviceRequestsStore";
import { loadApprovalBootstrap, type ApprovalRequest } from "@/lib/approvalEngine";
import { OrderStatusBadge } from "./ClientOrdersPage";


export const usersData = [
  { id: "7402c20a-a234-4593-b4c0-5de723bd6255", name: "Kevin Johnson", role: "Manager", email: "kevin.johnson@apex.com", phone: "+1-555-1102", lastActive: "2026-06-02T13:03:19.022Z", status: "Active", initials: "KJ", color: "bg-blue-500" },
  { id: "40a1ce03-730f-40a7-b006-25ef6c4d59b7", name: "Emma Clark", role: "IT Specialist", email: "emma.clark@apex.com", phone: "+1-555-1104", lastActive: "2026-06-01T13:03:19.022Z", status: "Active", initials: "EC", color: "bg-teal-500" },
  { id: "ec587a43-4639-4c31-96f8-fae1b56b7ef6", name: "Sarah Collins", role: "Procurement", email: "sarah.collins@apex.com", phone: "+1-555-1106", lastActive: "2026-05-30T13:03:19.022Z", status: "Active", initials: "SC", color: "bg-gray-500" },
  { id: "8e7c131b-3cfc-457d-9c1e-e919b0fd763d", name: "Michael Brown", role: "Accountant", email: "michael.brown@apex.com", phone: "+1-555-1107", lastActive: "2026-05-28T13:03:19.022Z", status: "Active", initials: "MB", color: "bg-blue-600" },
  { id: "e19bfa7d-0dea-4b78-a3e6-b0cb3fb7775f", name: "John Williams", role: "Sales Rep", email: "john.williams@apex.com", phone: "+1-555-1105", lastActive: "2026-05-31T13:03:19.022Z", status: "Pending", initials: "JW", color: "bg-indigo-500" },
  { id: "9fb6607a-7486-4525-94fe-f3f5889d5886", name: "Robert White", role: "Support Agent", email: "robert.white@apex.com", phone: "+1-555-1109", lastActive: "2026-05-26T13:03:19.022Z", status: "Pending", initials: "RW", color: "bg-orange-500" },
  { id: "33b222e9-d434-4dd4-b01c-304ef32492dd", name: "Linda Evans", role: "HR Specialist", email: "linda.evans@apex.com", phone: "+1-555-1110", lastActive: "2026-04-18T13:03:19.022Z", status: "Inactive", initials: "LE", color: "bg-teal-600" },
  { id: "0608fc5c-dc21-4888-a5b6-c823c8a09e4e", name: "Mark Thompson", role: "IT Director", email: "mark.thompson@apex.com", phone: "+1-555-1111", lastActive: "2026-02-02T13:03:19.022Z", status: "Inactive", initials: "MT", color: "bg-cyan-600" },
];

export function StatusBadge({ status }: { status: string }) {
  if (status === "Active") return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
      <CheckCircle size={10} /> Active
    </span>
  );
  if (status === "Pending") return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-orange-50 text-orange-600 border border-orange-200 px-2 py-0.5 rounded-full">
      <Timer size={10} /> Pending
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-red-50 text-red-500 border border-red-200 px-2 py-0.5 rounded-full">
      <X size={10} /> Inactive
    </span>
  );
}

const addUserDeviceOptions = [
  { sku: "MBP-14-M3-512", name: "Apple MacBook Pro (2023)", category: "Laptop", img: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=60&h=60&fit=crop&auto=format" },
  { sku: "IP15PRO-128-BLK", name: "Apple iPhone 15 Pro", category: "Mobile", img: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=60&h=60&fit=crop&auto=format" },
  { sku: "DELL-U2722D", name: "Dell UltraSharp 27\" Monitor", category: "Display", img: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=60&h=60&fit=crop&auto=format" },
  { sku: "LG-MX-KEYS-ADV", name: "Logitech MX Keys Keyboard", category: "Peripheral", img: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=60&h=60&fit=crop&auto=format" },
  { sku: "SONY-WH1000XM5", name: "Sony WH-1000XM5 Headphones", category: "Audio", img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=60&h=60&fit=crop&auto=format" },
  { sku: "IPAD-PRO-12-M4", name: "Apple iPad Pro 12.9\" (M4)", category: "Tablet", img: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=60&h=60&fit=crop&auto=format" },
  { sku: "HP-ELITEBOOK-840", name: "HP EliteBook 840 G11", category: "Laptop", img: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=60&h=60&fit=crop&auto=format" },
  { sku: "SAM-GALAXY-S25", name: "Samsung Galaxy S25 Ultra", category: "Mobile", img: "https://images.unsplash.com/photo-1610945264803-c22b62d2a7b3?w=60&h=60&fit=crop&auto=format" },
  { sku: "WEBCAM-LOGITECH-C920", name: "Logitech C920 HD Webcam", category: "Peripheral", img: "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=60&h=60&fit=crop&auto=format" },
  { sku: "DOCK-THUNDERBOLT-4", name: "CalDigit Thunderbolt 4 Dock", category: "Peripheral", img: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=60&h=60&fit=crop&auto=format" },
];

export type AssignedDeviceEntry = {
  sku: string;
  name: string;
  category: string;
  img: string;
  serialNo: string;
  modelNo: string;
  referenceNo: string;
  assignedOn: string;
  status: "Active" | "In Repair";
};

function getOrganizationOptions(
  clients: Array<{ id: string; name: string }>,
  additionalNames: Array<string | undefined> = [],
) {
  const options = [...clients];
  additionalNames
    .map(name => name?.trim())
    .filter((name): name is string => Boolean(name))
    .forEach(name => {
      if (!options.some(client => client.name.toLowerCase() === name.toLowerCase())) {
        options.push({ id: `organization-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, name });
      }
    });
  return options;
}

function getCurrentOrganizationName(clientId?: string, clientName?: string) {
  return clientName
    || getClients().find(client => client.id === clientId)?.name
    || "";
}

function AddUserModal({ clientId, clientName, onClose, onCreate }: { clientId?: string; clientName?: string; onClose: () => void; onCreate: (user: UserRecord) => void }) {
  const [activeTab, setActiveTab] = useState("Overview");
  const modalTabs = ["Overview", "Permissions", "Expenses", "Assigned Devices"];
  const [notification, setNotification] = useState("");

  const [form, setForm] = useState({
    employeeId: "",
    fullName: "",
    email: "",
    phone: "",
    jobTitle: "",
    department: "",
    reportingManager: "",
    gender: "",
    joiningDate: "",
    role: getPortalRoles(clientId || "").find(item => item.status === "active")?.name || "",
    orgAccess: getCurrentOrganizationName(clientId, clientName),
    dataVisibility: "All Data",
    locationAccess: "All Locations",
    status: "Active",
  });

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  const [availableClients, setAvailableClients] = useState(() =>
    getOrganizationOptions(getClients(), [getCurrentOrganizationName(clientId, clientName)]),
  );
  useEffect(() => {
    const refreshClients = () => setAvailableClients(getOrganizationOptions(getClients(), [
      getCurrentOrganizationName(clientId, clientName),
    ]));
    refreshClients();
    window.addEventListener("nidoClientsUpdated", refreshClients);
    return () => window.removeEventListener("nidoClientsUpdated", refreshClients);
  }, []);

  const handleOrganizationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value !== "__add_new__") {
      setForm((p) => ({ ...p, orgAccess: e.target.value }));
      return;
    }
    const name = window.prompt("Enter the new client name");
    if (!name?.trim()) return;
    const trimmedName = name.trim();
    const existing = availableClients.find(client => client.name.toLowerCase() === trimmedName.toLowerCase());
    if (existing) {
      setForm((p) => ({ ...p, orgAccess: existing.name }));
      return;
    }
    const newClient = {
      id: `CI-${Date.now()}`,
      name: trimmedName,
      status: "active",
    };
    addClient(newClient);
    setAvailableClients(getClients());
    setForm((p) => ({ ...p, orgAccess: newClient.name }));
  };

  // Permissions
  // Client users only receive permissions for modules available in their
  // client portal, never the internal NIDO platform modules.
  const addUserModules = [...PORTAL_MODULES];
  const addUserPermCols = ["View", "Create", "Edit", "Delete", "Approve"] as const;
  const inheritedPermissions = getPortalRoles(clientId || "")
    .find(role => role.name === form.role)?.permissions ?? [];

  // Expenses
  const [expenseForm, setExpenseForm] = useState({
    monthlyLimit: "",
    annualLimit: "",
    currency: "INR",
    approvalRequired: true,
    approvalThreshold: "",
    categories: [] as string[],
  });
  const expenseCategories = ["Hardware", "Software", "Travel", "Furniture", "Accessories", "Training"];
  const toggleCategory = (cat: string) =>
    setExpenseForm((p) => ({
      ...p,
      categories: p.categories.includes(cat)
        ? p.categories.filter((c) => c !== cat)
        : [...p.categories, cat],
    }));

  // Assigned Devices
  const [assignedDevices, setAssignedDevices] = useState<typeof addUserDeviceOptions>([]);
  const [deviceSearch, setDeviceSearch] = useState("");
  const [deviceDropOpen, setDeviceDropOpen] = useState(false);
  const filteredDeviceOptions = addUserDeviceOptions.filter(
    (d) =>
      (d.name.toLowerCase().includes(deviceSearch.toLowerCase()) ||
        d.sku.toLowerCase().includes(deviceSearch.toLowerCase())) &&
      !assignedDevices.some((a) => a.sku === d.sku)
  );
  const assignDevice = (d: typeof addUserDeviceOptions[0]) => {
    setAssignedDevices((prev) => [...prev, d]);
    setDeviceSearch("");
    setDeviceDropOpen(false);
  };
  const removeDevice = (sku: string) =>
    setAssignedDevices((prev) => prev.filter((d) => d.sku !== sku));

  const inputCls = "w-full px-2 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder-gray-300 bg-white";
  const labelCls = "block text-xs text-blue-600 mb-1";
  const disabledCls = "w-full px-2 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 text-gray-400 cursor-not-allowed";

  const handleCreate = () => {
    const requiredFields: Array<[keyof typeof form, string]> = [
      ["employeeId", "Employee ID"],
      ["fullName", "Full Name"],
      ["email", "Email ID"],
      ["phone", "Phone Number"],
      ["role", "Role"],
      ["orgAccess", "Organization Access"],
    ];
    const missing = requiredFields
      .filter(([key]) => !form[key].trim())
      .map(([, label]) => label);

    if (missing.length > 0) {
      setNotification(`Please fill in the required fields: ${missing.join(", ")}.`);
      return;
    }
    if (!isValidPhoneNumber(form.phone)) {
      setNotification("Phone number must contain exactly 10 digits.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setNotification("Please enter a valid email address.");
      return;
    }
    if (!getPortalRoles(clientId || "").some(role => role.name === form.role && role.status === "active")) {
      setNotification("Create and activate a client role before creating a portal user.");
      return;
    }

    const initials = form.fullName
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    const newUser: UserRecord = {
      id: typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `user-${Date.now()}`,
      name: form.fullName.trim(),
      role: form.role,
      email: form.email.trim(),
      phone: form.phone.trim(),
      lastActive: new Date().toISOString(),
      status: form.status,
      initials,
      color: "bg-blue-500",
      details: {
        employeeId: form.employeeId.trim(),
        jobTitle: form.jobTitle.trim(),
        department: form.department.trim(),
        reportingManager: form.reportingManager.trim(),
        gender: form.gender,
        joiningDate: form.joiningDate,
        orgAccess: form.orgAccess,
        dataVisibility: form.dataVisibility,
        locationAccess: form.locationAccess,
        expenseForm: { ...expenseForm },
        assignedDevices: [...assignedDevices],
        permissions: [...inheritedPermissions],
      },
    };

    onCreate(newUser);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-white" onClick={onClose}>
      <div
        className="bg-white w-full h-full flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {notification && (
          <div className="fixed top-5 right-5 z-[60] max-w-md rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-lg" role="alert">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 font-bold">!</span>
              <p className="flex-1 leading-5">{notification}</p>
              <button
                type="button"
                onClick={() => setNotification("")}
                className="text-red-400 hover:text-red-700"
                aria-label="Dismiss notification"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        )}
        {/* Modal header */}
        <div className="px-6 pt-5 pb-0 border-b border-gray-100">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Add User</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Create a new user and define their{" "}
                <span className="text-orange-500">access</span>,{" "}
                <span className="text-blue-500">role</span> and{" "}
                <span className="text-blue-500">permissions</span>.
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5">
              <X size={16} />
            </button>
          </div>
          {/* Tabs */}
          <div className="flex">
            {modalTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                  activeTab === tab ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-2 py-5">

          {/* ── OVERVIEW ── */}
          {activeTab === "Overview" && (
            <div className="flex flex-col gap-5">
              {/* Section: Personal Information */}
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-700">Personal Information</p>
                </div>
                <div className="p-4 flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>User ID</label>
                      <input type="text" value="UI-00009" disabled className={disabledCls} />
                      <p className="text-[10px] text-gray-400 mt-0.5">Auto-generated</p>
                    </div>
                    <div>
                      <label className={labelCls}>Employee ID <span className="text-red-400">*</span></label>
                      <input type="text" value={form.employeeId} onChange={set("employeeId")} placeholder="e.g. EMP-001" className={inputCls} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>User Type</label>
                      <input type="text" value="Client User" disabled className={disabledCls} />
                      <p className="text-[10px] text-gray-400 mt-0.5">Default user type</p>
                    </div>
                    <div>
                      <label className={labelCls}>Full Name <span className="text-red-400">*</span></label>
                      <input type="text" value={form.fullName} onChange={set("fullName")} placeholder="Enter full name" className={inputCls} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Email ID <span className="text-red-400">*</span></label>
                      <input type="email" value={form.email} onChange={set("email")} placeholder="Enter email address" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Phone Number <span className="text-red-400">*</span></label>
                      <input type="tel" inputMode="numeric" maxLength={10} value={form.phone} onChange={e => set("phone")({ ...e, target: { ...e.target, value: sanitizePhoneNumber(e.target.value) } } as React.ChangeEvent<HTMLInputElement>)} placeholder="10-digit phone number" className={inputCls} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Job Title</label>
                      <input type="text" value={form.jobTitle} onChange={set("jobTitle")} placeholder="e.g. Procurement Manager" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Department</label>
                      <input type="text" value={form.department} onChange={set("department")} placeholder="e.g. Operations" className={inputCls} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Reporting Manager</label>
                      <input type="text" value={form.reportingManager} onChange={set("reportingManager")} placeholder="e.g. John Smith" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Gender</label>
                      <select value={form.gender} onChange={set("gender")} className={inputCls + " appearance-none"}>
                        <option value="">Select gender</option>
                        <option>Male</option>
                        <option>Female</option>
                        <option>Other</option>
                        <option>Prefer not to say</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Joining Date</label>
                      <input type="date" value={form.joiningDate} onChange={set("joiningDate")} className={inputCls + " text-gray-600"} />
                    </div>
                    <div>
                      <label className={labelCls}>Status <span className="text-red-400">*</span></label>
                      <select value={form.status} onChange={set("status")} className={inputCls + " appearance-none text-gray-700"}>
                        <option>Active</option>
                        <option>Inactive</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section: Role & Access */}
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-700">Role & Access</p>
                </div>
                <div className="p-4 flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Role <span className="text-red-400">*</span></label>
                      <select value={form.role} onChange={set("role")} className={inputCls + " appearance-none text-gray-600"}>
                        <option value="">Select role</option>
                        {getPortalRoles(clientId || "")
                          .filter(role => role.status === "active" || role.name === form.role)
                          .map(role => <option key={role.id} value={role.name}>{role.name}</option>)}
                      </select>
                      <button className="text-[11px] text-blue-500 hover:underline mt-1">+ Add New Role</button>
                    </div>
                    <div>
                      <label className={labelCls}>Organization Access <span className="text-red-400">*</span></label>
                      <select value={form.orgAccess} onChange={handleOrganizationChange} className={inputCls + " appearance-none text-gray-500"}>
                        <option value="">Select organization</option>
                        {availableClients.map(client => (
                          <option key={client.id} value={client.name}>{client.name}</option>
                        ))}
                        <option value="__add_new__">＋ Add New Client</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Data Visibility</label>
                      <select value={form.dataVisibility} onChange={set("dataVisibility")} className={inputCls + " appearance-none text-gray-700"}>
                        <option>All Data</option>
                        <option>Department Only</option>
                        <option>Own Only</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Location Access</label>
                      <select value={form.locationAccess} onChange={set("locationAccess")} className={inputCls + " appearance-none text-gray-700"}>
                        <option>All Locations</option>
                        <option>Home Location Only</option>
                        <option>Assigned Locations</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── PERMISSIONS ── */}
          {activeTab === "Permissions" && (
            <div className="flex flex-col gap-4">
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-700">Module Permissions</p>
                  <p className="text-[10px] text-gray-400">Inherited from the selected role</p>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-2 py-2.5 font-semibold text-gray-500 text-[10px] uppercase tracking-wide">Module</th>
                      {addUserPermCols.map((col) => (
                        <th key={col} className="text-center px-2 py-2.5 font-semibold text-gray-500 text-[10px] uppercase tracking-wide">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {addUserModules.map((mod, i) => (
                      <tr key={mod} className={`border-b border-gray-50 last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                        <td className="px-4 py-2.5 text-gray-700 font-medium text-[11px]">{mod}</td>
                        {addUserPermCols.map((col) => (
                          <td key={col} className="px-3 py-2.5 text-center">
                            <span
                              aria-label={`${col} ${inheritedPermissions.find(permission => permission.module === mod)?.[col.toLowerCase() as "view" | "create" | "edit" | "delete" | "approve"] ? "enabled" : "disabled"}`}
                              className={`inline-flex w-4 h-4 rounded-full border-2 items-center justify-center ${
                                inheritedPermissions.find(permission => permission.module === mod)?.[col.toLowerCase() as "view" | "create" | "edit" | "delete" | "approve"]
                                  ? "border-blue-500 bg-blue-500"
                                  : "border-gray-300 bg-white"
                              }`}
                            >
                              {inheritedPermissions.find(permission => permission.module === mod)?.[col.toLowerCase() as "view" | "create" | "edit" | "delete" | "approve"] && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── EXPENSES ── */}
          {activeTab === "Expenses" && (
            <div className="flex flex-col gap-5">
              {/* Limits */}
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-700">Expense Limits</p>
                </div>
                <div className="p-4 flex flex-col gap-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className={labelCls}>Currency</label>
                      <select
                        value={expenseForm.currency}
                        onChange={(e) => setExpenseForm((p) => ({ ...p, currency: e.target.value }))}
                        className={inputCls + " appearance-none text-gray-700"}
                      >
                        <option>INR</option>
                        <option>USD</option>
                        <option>EUR</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Monthly Limit</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs select-none">₹</span>
                        <input
                          type="number"
                          value={expenseForm.monthlyLimit}
                          onChange={(e) => setExpenseForm((p) => ({ ...p, monthlyLimit: e.target.value }))}
                          placeholder="0"
                          min="0"
                          className={inputCls + " pl-7"}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Annual Limit</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs select-none">₹</span>
                        <input
                          type="number"
                          value={expenseForm.annualLimit}
                          onChange={(e) => setExpenseForm((p) => ({ ...p, annualLimit: e.target.value }))}
                          placeholder="0"
                          min="0"
                          className={inputCls + " pl-7"}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Approval settings */}
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-700">Approval Settings</p>
                </div>
                <div className="p-4 flex flex-col gap-4">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={expenseForm.approvalRequired}
                      onChange={() => setExpenseForm((p) => ({ ...p, approvalRequired: !p.approvalRequired }))}
                      className="mt-0.5 rounded border-gray-300 accent-blue-600 cursor-pointer"
                    />
                    <div>
                      <p className="text-xs font-medium text-gray-700">Require Approval</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">Expenses above the threshold need manager approval</p>
                    </div>
                  </label>
                  {expenseForm.approvalRequired && (
                    <div className="max-w-xs">
                      <label className={labelCls}>Approval Threshold</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs select-none">₹</span>
                        <input
                          type="number"
                          value={expenseForm.approvalThreshold}
                          onChange={(e) => setExpenseForm((p) => ({ ...p, approvalThreshold: e.target.value }))}
                          placeholder="e.g. 5000"
                          min="0"
                          className={inputCls + " pl-7"}
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">Expenses above this amount trigger an approval request</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Allowed categories */}
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-700">Allowed Expense Categories</p>
                </div>
                <div className="p-4">
                  <div className="flex flex-wrap gap-2">
                    {expenseCategories.map((cat) => {
                      const active = expenseForm.categories.includes(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => toggleCategory(cat)}
                          className={`px-3 py-1.5 text-xs rounded-lg border transition-colors font-medium ${
                            active
                              ? "bg-blue-600 border-blue-600 text-white"
                              : "border-gray-200 text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2">Leave all unselected to allow all categories</p>
                </div>
              </div>
            </div>
          )}

          {/* ── ASSIGNED DEVICES ── */}
          {activeTab === "Assigned Devices" && (
            <div className="flex flex-col gap-5">
              {/* Search & assign */}
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-700">Assign Devices</p>
                </div>
                <div className="p-4">
                  <div
                    className="relative"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="relative">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                      <input
                        type="text"
                        value={deviceSearch}
                        onChange={(e) => { setDeviceSearch(e.target.value); setDeviceDropOpen(true); }}
                        onFocus={() => setDeviceDropOpen(true)}
                        placeholder="Search device by name or SKU..."
                        className="w-full pl-8 pr-4 py-2.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder-gray-400"
                      />
                    </div>
                    {deviceDropOpen && deviceSearch && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 py-1 max-h-48 overflow-y-auto">
                        {filteredDeviceOptions.length === 0 ? (
                          <p className="px-4 py-2 text-xs text-gray-400">No devices found</p>
                        ) : filteredDeviceOptions.map((d) => (
                          <button
                            key={d.sku}
                            onClick={() => assignDevice(d)}
                            className="w-full flex items-center gap-3 px-2 py-2.5 hover:bg-gray-50 transition-colors text-left"
                          >
                            <img src={d.img} alt={d.name} className="w-8 h-8 rounded object-cover bg-gray-100 shrink-0" />
                            <div>
                              <p className="text-xs font-medium text-gray-800">{d.name}</p>
                              <p className="text-[10px] text-gray-400">{d.sku} · {d.category}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Assigned device cards */}
              {assignedDevices.length > 0 ? (
                <div className="grid grid-cols-2 gap-4">
                  {assignedDevices.map((device) => (
                    <div key={device.sku} className="border border-gray-200 rounded-xl p-2 flex items-start gap-2 bg-white">
                      <div className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                        <img src={device.img} alt={device.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold text-gray-900 leading-snug">{device.name}</p>
                          <button
                            onClick={() => removeDevice(device.sku)}
                            className="text-[10px] text-red-500 hover:text-red-700 font-medium shrink-0 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{device.sku}</p>
                        <span className="inline-block mt-1.5 bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full text-[10px]">{device.category}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-2 border border-dashed border-gray-200 rounded-xl">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                  <p className="text-xs text-gray-400">No devices assigned yet</p>
                  <p className="text-[11px] text-gray-300">Search and select devices above</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-2 border-t border-gray-100 flex items-center justify-between">
          <div className="flex gap-2">
            {modalTabs.map((tab, i) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`w-2 h-2 rounded-full transition-colors ${activeTab === tab ? "bg-blue-600" : "bg-gray-200"}`}
                title={tab}
              />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleCreate} className="px-4 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
              Create User
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function downloadUserTemplate() {
  const headers = ["User ID", "Employee ID", "User Type", "Full Name", "Email ID", "Phone Number", "Job Title", "Role", "Organization Access", "Status"];
  const example = ["UI-00009", "EMP-001", "Client User", "John Doe", "john.doe@example.com", "+91 98765 43210", "Procurement Manager", "Client User", "Nitin Supplies HQ", "Active"];
  const csv = [headers.join(","), example.join(",")].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "user_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function exportUsersCSV(currentUsers: Array<Record<string, unknown>>) {
  if (!currentUsers.length) return;

  const preferredOrder = [
    "employeeId",
    "name",
    "email",
    "phone",
    "role",
    "jobTitle",
    "department",
    "clientId",
    "clientName",
    "status",
    "lastActive",
    "createdAt",
    "provisionedAt",
    "provisionReason",
  ];
  const excludedExportKeys = (key: string) => {
    const normalizedKey = key.toLowerCase();
    return normalizedKey === "id"
      || normalizedKey === "usertype"
      || normalizedKey === "initials"
      || normalizedKey === "color"
      || normalizedKey === "details.permissions"
      || normalizedKey.startsWith("details.permissions.");
  };

  const flattenUser = (user: Record<string, unknown>) => {
    const flattened: Record<string, string> = {};
    const flatten = (value: unknown, prefix: string) => {
      if (prefix.toLowerCase().includes("password")) return;
      if (value === null || value === undefined) {
        flattened[prefix] = "";
        return;
      }
      if (Array.isArray(value)) {
        flattened[prefix] = value.every(item => item === null || ["string", "number", "boolean"].includes(typeof item))
          ? value.map(item => String(item ?? "")).join("; ")
          : JSON.stringify(value);
        return;
      }
      if (typeof value === "object") {
        Object.entries(value as Record<string, unknown>).forEach(([key, nestedValue]) =>
          flatten(nestedValue, `${prefix}.${key}`),
        );
        return;
      }
      flattened[prefix] = String(value);
    };

    Object.entries(user).forEach(([key, value]) => {
      if (key.toLowerCase() === "password" || key === "details") {
        if (key === "details" && value && typeof value === "object") {
          Object.entries(value as Record<string, unknown>).forEach(([detailKey, detailValue]) =>
            flatten(detailValue, `details.${detailKey}`),
          );
        }
        return;
      }
      flatten(value, key);
    });
    return flattened;
  };

  const flattenedUsers = currentUsers.map(flattenUser);
  const keys = Array.from(new Set(flattenedUsers.flatMap(user => Object.keys(user))))
    .filter(key => !key.toLowerCase().includes("password") && !excludedExportKeys(key));
  const detailKeys = keys.filter(key => key.startsWith("details."));
  const headers = [
    ...preferredOrder.filter(key => keys.includes(key)),
    ...detailKeys.sort(),
    ...keys.filter(key => !preferredOrder.includes(key) && !key.startsWith("details.")),
  ];
  const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [
    headers.map(header => escapeCsv(header)),
    ...flattenedUsers.map(user => headers.map(header => escapeCsv(user[header]))),
  ].map(row => row.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "users_export.csv";
  a.click();
  URL.revokeObjectURL(url);
}

const archivedUsersData = [
  { id: "arc-001", name: "David Kim", role: "Analyst", email: "david.kim@apex.com", phone: "+1-555-1201", lastActive: "2025-11-15T10:00:00.000Z", status: "Archived", archivedOn: "2025-12-01", reason: "Left company", initials: "DK", color: "bg-slate-500" },
  { id: "arc-002", name: "Priya Sharma", role: "Finance Officer", email: "priya.sharma@apex.com", phone: "+1-555-1202", lastActive: "2025-10-20T08:00:00.000Z", status: "Archived", archivedOn: "2025-11-01", reason: "Contract ended", initials: "PS", color: "bg-rose-400" },
  { id: "arc-003", name: "Tom Baker", role: "Support Lead", email: "tom.baker@apex.com", phone: "+1-555-1203", lastActive: "2025-09-05T14:30:00.000Z", status: "Archived", archivedOn: "2025-10-01", reason: "Role restructured", initials: "TB", color: "bg-amber-500" },
];

function ResetPasswordModal({
  userId,
  userName,
  onClose,
}: {
  userId: string;
  userName: string;
  onClose: () => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleReset = () => {
    if (!newPassword) { setError("Please enter a new password."); return; }
    if (newPassword.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match."); return; }
    setError("");
    updatePortalUser(userId, { password: newPassword });
    setDone(true);
  };

  const inputCls = "w-full px-2 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder-gray-300 pr-9";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Reset Password</h2>
            <p className="text-xs text-gray-500 mt-0.5">Set a new password for <span className="font-medium text-gray-700">{userName}</span></p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={16} /></button>
        </div>
        <div className="px-6 py-2 flex flex-col gap-4">
          {!done ? (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">New Password <span className="text-red-400">*</span></label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className={inputCls}
                  />
                  <button type="button" onClick={() => setShowNew((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showNew
                      ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Confirm Password <span className="text-red-400">*</span></label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className={inputCls}
                  />
                  <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showConfirm
                      ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>
              {error && <p className="text-[11px] text-red-500">{error}</p>}
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-2 py-2 text-[11px] text-blue-600">
                Password must be at least 8 characters and contain a mix of letters and numbers.
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle size={24} className="text-green-500" />
              </div>
              <p className="text-sm font-semibold text-gray-900">Password Reset Successfully</p>
              <p className="text-xs text-gray-400 text-center">A confirmation email has been sent to the user.</p>
            </div>
          )}
        </div>
        <div className="px-6 py-2 border-t border-gray-100 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
            {done ? "Close" : "Cancel"}
          </button>
          {!done && (
            <button onClick={handleReset} className="px-4 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
              Reset Password
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ArchivedUserDetailPage({ user, onBack }: { user: typeof archivedUsersData[0]; onBack: () => void }) {
  const formattedDate = new Date(user.lastActive).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Back to Archived Users
        </button>
      </div>

      {/* Read-only notice */}
      <div className="flex items-center gap-2 px-2 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        This is an archived user — the profile is read-only and cannot be edited.
      </div>

      {/* Profile header */}
      <div className="bg-white rounded-xl border border-gray-200 p-2 flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-full ${user.color} flex items-center justify-center text-white text-lg font-bold shrink-0 opacity-70`}>
            {user.initials}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-base font-semibold text-gray-700">{user.name}</h2>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-gray-100 text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full">
                Archived
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-2">{user.role}</p>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <div className="flex items-center gap-1.5"><Mail size={11} className="text-gray-400" />{user.email}</div>
              <div className="flex items-center gap-1.5"><Phone size={11} className="text-gray-400" />{user.phone}</div>
              <div className="flex items-center gap-1.5"><Clock size={11} className="text-gray-400" />Last active {formattedDate}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Details card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-xs font-semibold text-gray-700 mb-4">Archive Details</p>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs">
          {[
            { label: "Full Name", value: user.name },
            { label: "Role", value: user.role },
            { label: "Email", value: user.email },
            { label: "Phone", value: user.phone },
            { label: "Last Active", value: formattedDate },
            { label: "Archived On", value: user.archivedOn },
            { label: "Reason", value: user.reason },
            { label: "Status", value: "Archived" },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-gray-400 mb-0.5">{label}</p>
              <p className="text-gray-700 font-medium">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export type UserRecord = typeof usersData[0] & {
  details?: Record<string, unknown>;
  userType?: string;
  clientId?: string;
  clientName?: string;
  provisionReason?: string;
  provisionedAt?: string;
  createdAt?: string;
};

function portalUserToRecord(user: ReturnType<typeof getPortalUsersByClient>[number]): UserRecord {
  const initials = user.name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase() || "U";
  const { password: _password, ...safeUser } = user;
  return {
    ...safeUser,
    id: user.id,
    name: user.name,
    role: user.role,
    email: user.email,
    phone: user.phone || "",
    lastActive: user.createdAt,
    status: user.status === "active" ? "Active" : "Inactive",
    initials,
    color: "bg-blue-500",
  };
}

function getDisplayedUserId(user: UserRecord, rowIndex: number) {
  const legacyIndex = usersData.findIndex(candidate => candidate.id === user.id);
  const displayIndex = legacyIndex >= 0 ? legacyIndex + 1 : rowIndex + 1;
  return `UI-${String(displayIndex).padStart(5, "0")}`;
}

function EditUserPage({ clientId, clientName, user, onBack, onSave }: { clientId?: string; clientName?: string; user: UserRecord; onBack: () => void; onSave: (updated: UserRecord) => void }) {
  const modalTabs = ["Overview", "Permissions", "Expenses", "Assigned Devices"];
  const [activeTab, setActiveTab] = useState("Overview");
  const savedDetails = user.details ?? {};
  const savedDetailString = (key: string, fallback = "") =>
    typeof savedDetails[key] === "string" ? savedDetails[key] as string : fallback;
  const savedExpense = savedDetails.expenseForm && typeof savedDetails.expenseForm === "object"
    ? savedDetails.expenseForm as Record<string, unknown>
    : {};
  const savedCategories = Array.isArray(savedExpense.categories)
    ? savedExpense.categories.filter((category): category is string => typeof category === "string")
    : [];
  const savedDevices = Array.isArray(savedDetails.assignedDevices)
    ? savedDetails.assignedDevices as typeof addUserDeviceOptions
    : [];

  const [form, setForm] = useState({
    fullName: user.name,
    email: user.email,
    phone: user.phone || savedDetailString("phone"),
    employeeId: savedDetailString("employeeId"),
    jobTitle: savedDetailString("jobTitle", user.role),
    department: savedDetailString("department"),
    reportingManager: savedDetailString("reportingManager"),
    gender: savedDetailString("gender"),
    joiningDate: savedDetailString("joiningDate"),
    role: user.role,
    orgAccess: savedDetailString(
      "orgAccess",
      getCurrentOrganizationName(clientId, clientName || user.clientName),
    ),
    dataVisibility: savedDetailString("dataVisibility", "All Data"),
    locationAccess: savedDetailString("locationAccess", "All Locations"),
    status: user.status,
  });

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  const [availableClients, setAvailableClients] = useState(() =>
    getOrganizationOptions(getClients(), [
      getCurrentOrganizationName(clientId, clientName),
      user.clientName,
      savedDetailString("orgAccess"),
    ]),
  );
  useEffect(() => {
    const refreshClients = () => setAvailableClients(getOrganizationOptions(getClients(), [
      getCurrentOrganizationName(clientId, clientName),
      user.clientName,
      savedDetailString("orgAccess"),
      form.orgAccess,
    ]));
    refreshClients();
    window.addEventListener("nidoClientsUpdated", refreshClients);
    return () => window.removeEventListener("nidoClientsUpdated", refreshClients);
  }, [clientName, user.clientName, user.id]);

  const handleOrganizationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value !== "__add_new__") {
      setForm((p) => ({ ...p, orgAccess: e.target.value }));
      return;
    }
    const name = window.prompt("Enter the new client name");
    if (!name?.trim()) return;
    const trimmedName = name.trim();
    const existing = availableClients.find(client => client.name.toLowerCase() === trimmedName.toLowerCase());
    if (existing) {
      setForm((p) => ({ ...p, orgAccess: existing.name }));
      return;
    }
    const newClient = {
      id: `CI-${Date.now()}`,
      name: trimmedName,
      status: "active",
    };
    addClient(newClient);
    setAvailableClients(getOrganizationOptions(getClients(), [trimmedName, clientName, user.clientName]));
    setForm((p) => ({ ...p, orgAccess: newClient.name }));
  };

  const addUserModules = [...PORTAL_MODULES];
  const addUserPermCols = ["View", "Create", "Edit", "Delete", "Approve"] as const;
  const inheritedPermissions = getPortalRoles(clientId || "")
    .find(role => role.name === form.role)?.permissions ?? [];

  const [expenseForm, setExpenseForm] = useState({
    monthlyLimit: typeof savedExpense.monthlyLimit === "string" ? savedExpense.monthlyLimit : "",
    annualLimit: typeof savedExpense.annualLimit === "string" ? savedExpense.annualLimit : "",
    currency: typeof savedExpense.currency === "string" ? savedExpense.currency : "INR",
    approvalRequired: typeof savedExpense.approvalRequired === "boolean" ? savedExpense.approvalRequired : true,
    approvalThreshold: typeof savedExpense.approvalThreshold === "string" ? savedExpense.approvalThreshold : "",
    categories: savedCategories,
  });
  const expenseCategories = ["Hardware", "Software", "Travel", "Furniture", "Accessories", "Training"];
  const toggleCategory = (cat: string) =>
    setExpenseForm((p) => ({ ...p, categories: p.categories.includes(cat) ? p.categories.filter((c) => c !== cat) : [...p.categories, cat] }));

  const [assignedDevices, setAssignedDevices] = useState<typeof addUserDeviceOptions>(savedDevices);
  const [deviceSearch, setDeviceSearch] = useState("");
  const [deviceDropOpen, setDeviceDropOpen] = useState(false);
  const filteredDeviceOptions = addUserDeviceOptions.filter(
    (d) => (d.name.toLowerCase().includes(deviceSearch.toLowerCase()) || d.sku.toLowerCase().includes(deviceSearch.toLowerCase())) && !assignedDevices.some((a) => a.sku === d.sku)
  );

  const handleSave = () => {
    if (!isValidPhoneNumber(form.phone)) {
      setNotification("Phone number must contain exactly 10 digits.");
      return;
    }
    const nameParts = form.fullName.trim().split(" ");
    const initials = nameParts.length >= 2
      ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
      : form.fullName.slice(0, 2).toUpperCase();
    onSave({
      ...user,
      name: form.fullName || user.name,
      role: form.role || user.role,
      email: form.email || user.email,
      phone: form.phone,
      status: form.status,
      initials,
      details: {
        ...savedDetails,
         employeeId: form.employeeId,
        jobTitle: form.jobTitle,
        department: form.department,
        reportingManager: form.reportingManager,
        gender: form.gender,
        joiningDate: form.joiningDate,
        orgAccess: form.orgAccess,
        dataVisibility: form.dataVisibility,
        locationAccess: form.locationAccess,
        expenseForm: { ...expenseForm },
        assignedDevices: [...assignedDevices],
        permissions: [...inheritedPermissions],
      },
    });
    onBack();
  };

  const inputCls = "w-full px-2 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder-gray-300 bg-white";
  const labelCls = "block text-xs text-blue-600 mb-1";
  const disabledCls = "w-full px-2 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 text-gray-400 cursor-not-allowed";

  return (
    <div className="flex flex-col gap-0">
      {/* Page header */}
      <div className="bg-white rounded-xl border border-gray-200 px-2 pt-5 pb-0">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Edit User</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Editing <span className="font-medium text-gray-700">{user.name}</span> — update their{" "}
                <span className="text-orange-500">access</span>,{" "}
                <span className="text-blue-500">role</span> and{" "}
                <span className="text-blue-500">details</span>.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <button onClick={onBack} className="px-4 py-2 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
            <button onClick={handleSave} className="px-4 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">Save Changes</button>
          </div>
        </div>
        {/* Tabs */}
        <div className="flex">
          {modalTabs.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${activeTab === tab ? "text-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
              {tab}
              {activeTab === tab && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="mt-4 bg-white rounded-xl border border-gray-200 px-2 py-5">

        {activeTab === "Overview" && (
          <div className="flex flex-col gap-5">
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100"><p className="text-xs font-semibold text-gray-700">Personal Information</p></div>
              <div className="p-4 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Employee ID</label>
                    <input type="text" value={form.employeeId} onChange={set("employeeId")} placeholder="e.g. EMP-001" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Full Name <span className="text-red-400">*</span></label>
                    <input type="text" value={form.fullName} onChange={set("fullName")} placeholder="Enter full name" className={inputCls} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Email ID <span className="text-red-400">*</span></label>
                    <input type="email" value={form.email} onChange={set("email")} placeholder="Enter email address" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Phone Number <span className="text-red-400">*</span></label>
                    <input type="tel" inputMode="numeric" maxLength={10} value={form.phone} onChange={e => set("phone")({ ...e, target: { ...e.target, value: sanitizePhoneNumber(e.target.value) } } as React.ChangeEvent<HTMLInputElement>)} placeholder="10-digit phone number" className={inputCls} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Job Title</label>
                    <input type="text" value={form.jobTitle} onChange={set("jobTitle")} placeholder="e.g. Procurement Manager" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Department</label>
                    <input type="text" value={form.department} onChange={set("department")} placeholder="e.g. Operations" className={inputCls} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Reporting Manager</label>
                    <input type="text" value={form.reportingManager} onChange={set("reportingManager")} placeholder="e.g. John Smith" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Gender</label>
                    <select value={form.gender} onChange={set("gender")} className={inputCls + " appearance-none"}>
                      <option value="">Select gender</option>
                      <option>Male</option><option>Female</option><option>Other</option><option>Prefer not to say</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Joining Date</label>
                    <input type="date" value={form.joiningDate} onChange={set("joiningDate")} className={inputCls + " text-gray-600"} />
                  </div>
                  <div>
                    <label className={labelCls}>Status <span className="text-red-400">*</span></label>
                    <select value={form.status} onChange={set("status")} className={inputCls + " appearance-none text-gray-700"}>
                       <option>Active</option><option>Inactive</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100"><p className="text-xs font-semibold text-gray-700">Role & Access</p></div>
              <div className="p-4 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Role <span className="text-red-400">*</span></label>
                    <select value={form.role} onChange={set("role")} className={inputCls + " appearance-none text-gray-700"}>
                      {getPortalRoles(clientId || "")
                        .filter(role => role.status === "active" || role.name === form.role)
                        .map(role => <option key={role.id} value={role.name}>{role.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Organization Access</label>
                    <select value={form.orgAccess} onChange={handleOrganizationChange} className={inputCls + " appearance-none text-gray-700"}>
                      <option value="">Select organization</option>
                      {availableClients.map(client => (
                        <option key={client.id} value={client.name}>{client.name}</option>
                      ))}
                      <option value="__add_new__">＋ Add New Client</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Data Visibility</label>
                    <select value={form.dataVisibility} onChange={set("dataVisibility")} className={inputCls + " appearance-none text-gray-700"}>
                      <option>All Data</option><option>Department Only</option><option>Own Only</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Location Access</label>
                    <select value={form.locationAccess} onChange={set("locationAccess")} className={inputCls + " appearance-none text-gray-700"}>
                      <option>All Locations</option><option>Home Location Only</option><option>Assigned Locations</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "Permissions" && (
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-700">Module Permissions</p>
              <p className="text-[10px] text-gray-400">Inherited from the selected role</p>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-2 py-2.5 font-semibold text-gray-500 text-[10px] uppercase tracking-wide">Module</th>
                  {addUserPermCols.map((col) => <th key={col} className="text-center px-2 py-2.5 font-semibold text-gray-500 text-[10px] uppercase tracking-wide">{col}</th>)}
                </tr>
              </thead>
              <tbody>
                {addUserModules.map((mod, i) => (
                  <tr key={mod} className={`border-b border-gray-50 last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                    <td className="px-4 py-2.5 text-gray-700 font-medium text-[11px]">{mod}</td>
                    {addUserPermCols.map((col) => (
                      <td key={col} className="px-3 py-2.5 text-center">
                        <span
                          aria-label={`${col} ${inheritedPermissions.find(permission => permission.module === mod)?.[col.toLowerCase() as "view" | "create" | "edit" | "delete" | "approve"] ? "enabled" : "disabled"}`}
                          className={`inline-flex w-4 h-4 rounded-full border-2 items-center justify-center ${
                            inheritedPermissions.find(permission => permission.module === mod)?.[col.toLowerCase() as "view" | "create" | "edit" | "delete" | "approve"]
                              ? "border-blue-500 bg-blue-500"
                              : "border-gray-300 bg-white"
                          }`}
                        >
                          {inheritedPermissions.find(permission => permission.module === mod)?.[col.toLowerCase() as "view" | "create" | "edit" | "delete" | "approve"] && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "Expenses" && (
          <div className="flex flex-col gap-5">
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100"><p className="text-xs font-semibold text-gray-700">Expense Limits</p></div>
              <div className="p-4 flex flex-col gap-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>Currency</label>
                    <select value={expenseForm.currency} onChange={(e) => setExpenseForm((p) => ({ ...p, currency: e.target.value }))} className={inputCls + " appearance-none text-gray-700"}>
                      <option>INR</option><option>USD</option><option>EUR</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Monthly Limit</label>
                    <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs select-none">₹</span>
                      <input type="number" value={expenseForm.monthlyLimit} onChange={(e) => setExpenseForm((p) => ({ ...p, monthlyLimit: e.target.value }))} placeholder="0" min="0" className={inputCls + " pl-7"} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Annual Limit</label>
                    <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs select-none">₹</span>
                      <input type="number" value={expenseForm.annualLimit} onChange={(e) => setExpenseForm((p) => ({ ...p, annualLimit: e.target.value }))} placeholder="0" min="0" className={inputCls + " pl-7"} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100"><p className="text-xs font-semibold text-gray-700">Approval Settings</p></div>
              <div className="p-4 flex flex-col gap-4">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={expenseForm.approvalRequired}
                    onChange={() => setExpenseForm((p) => ({ ...p, approvalRequired: !p.approvalRequired }))}
                    className="mt-0.5 rounded border-gray-300 accent-blue-600 cursor-pointer"
                  />
                  <div>
                    <p className="text-xs font-medium text-gray-700">Require Approval</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Expenses above the threshold need manager approval</p>
                  </div>
                </label>
                {expenseForm.approvalRequired && (
                  <div className="max-w-xs">
                    <label className={labelCls}>Approval Threshold</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs select-none">₹</span>
                      <input
                        type="number"
                        value={expenseForm.approvalThreshold}
                        onChange={(e) => setExpenseForm((p) => ({ ...p, approvalThreshold: e.target.value }))}
                        placeholder="e.g. 5000"
                        min="0"
                        className={inputCls + " pl-7"}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100"><p className="text-xs font-semibold text-gray-700">Allowed Expense Categories</p></div>
              <div className="p-4">
                <div className="flex flex-wrap gap-2">
                  {expenseCategories.map((cat) => {
                    const active = expenseForm.categories.includes(cat);
                    return (
                      <button key={cat} type="button" onClick={() => toggleCategory(cat)} className={`px-3 py-1.5 text-xs rounded-lg border transition-colors font-medium ${active ? "bg-blue-600 border-blue-600 text-white" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>{cat}</button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "Assigned Devices" && (
          <div className="flex flex-col gap-5">
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100"><p className="text-xs font-semibold text-gray-700">Assign Devices</p></div>
              <div className="p-4">
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" value={deviceSearch} onChange={(e) => { setDeviceSearch(e.target.value); setDeviceDropOpen(true); }} onFocus={() => setDeviceDropOpen(true)} placeholder="Search device by name or SKU..." className="w-full pl-8 pr-4 py-2.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder-gray-400" />
                  </div>
                  {deviceDropOpen && deviceSearch && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 py-1 max-h-48 overflow-y-auto">
                      {filteredDeviceOptions.length === 0 ? <p className="px-4 py-2 text-xs text-gray-400">No devices found</p>
                        : filteredDeviceOptions.map((d) => (
                          <button key={d.sku} onClick={() => { setAssignedDevices((prev) => [...prev, d]); setDeviceSearch(""); setDeviceDropOpen(false); }} className="w-full flex items-center gap-3 px-2 py-2.5 hover:bg-gray-50 transition-colors text-left">
                            <img src={d.img} alt={d.name} className="w-8 h-8 rounded object-cover bg-gray-100 shrink-0" />
                            <div><p className="text-xs font-medium text-gray-800">{d.name}</p><p className="text-[10px] text-gray-400">{d.sku} · {d.category}</p></div>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {assignedDevices.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                {assignedDevices.map((device) => (
                  <div key={device.sku} className="border border-gray-200 rounded-xl p-2 flex items-start gap-2 bg-white">
                    <div className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden shrink-0"><img src={device.img} alt={device.name} className="w-full h-full object-cover" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-gray-900 leading-snug">{device.name}</p>
                        <button onClick={() => setAssignedDevices((prev) => prev.filter((d) => d.sku !== device.sku))} className="text-[10px] text-red-500 hover:text-red-700 font-medium shrink-0 transition-colors">Remove</button>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{device.sku}</p>
                      <span className="inline-block mt-1.5 bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full text-[10px]">{device.category}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ArchivedUsersPage({ onBack, archivedUsers }: { onBack: () => void; archivedUsers: typeof archivedUsersData }) {
  const [selectedUser, setSelectedUser] = useState<typeof archivedUsersData[0] | null>(null);

  if (selectedUser) return <ArchivedUserDetailPage user={selectedUser} onBack={() => setSelectedUser(null)} />;

  return (
    <div className="p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Back to Users
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Archived Users</h2>
          <p className="text-xs text-gray-400 mt-0.5">Archived users are read-only and cannot be edited or activated from here.</p>
        </div>
        <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full font-medium">{archivedUsers.length} archived</span>
      </div>

      <div className="border border-gray-200 rounded-xl overflow-visible">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-2 py-2 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Name / Role <Filter size={9} className="inline ml-0.5 text-gray-400" /></th>
              <th className="text-left px-2 py-2 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Email</th>
              <th className="text-left px-2 py-2 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Phone</th>
              <th className="text-left px-2 py-2 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Archived On <Filter size={9} className="inline ml-0.5 text-gray-400" /></th>
              <th className="text-left px-2 py-2 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Reason <Filter size={9} className="inline ml-0.5 text-gray-400" /></th>
              <th className="text-left px-2 py-2 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Action</th>
            </tr>
          </thead>
          <tbody>
            {archivedUsers.map((user, i) => (
              <tr key={user.id} className={`border-b border-gray-100 last:border-0 hover:bg-gray-50/60 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50/20"}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full ${user.color} flex items-center justify-center text-white text-[10px] font-bold shrink-0 opacity-70`}>
                      {user.initials}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-600 text-[11px]">{user.name}</p>
                      <p className="text-gray-400 text-[10px]">{user.role}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2 text-gray-500"><div className="flex items-center gap-1"><Mail size={11} className="text-gray-400 shrink-0" />{user.email}</div></td>
                <td className="px-4 py-2 text-gray-500"><div className="flex items-center gap-1"><Phone size={11} className="text-gray-400 shrink-0" />{user.phone}</div></td>
                <td className="px-4 py-2 text-gray-500 font-mono text-[10px]">{user.archivedOn}</td>
                <td className="px-4 py-3"><span className="inline-block text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{user.reason}</span></td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setSelectedUser(user)}
                    className="text-[11px] text-blue-500 hover:text-blue-700 font-medium transition-colors"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ImportUsersModal({ onClose }: { onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[][]>([]);
  const [dragging, setDragging] = useState(false);
  const [imported, setImported] = useState(false);

  const parseCSV = (text: string) => {
    const lines = text.trim().split("\n").filter(Boolean);
    return lines.map((line) =>
      line.split(",").map((cell) => cell.replace(/^"|"$/g, "").trim())
    );
  };

  const handleFile = (f: File) => {
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setPreview(parseCSV(text));
    };
    reader.readAsText(f);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.name.endsWith(".csv")) handleFile(f);
  };

  const headers = preview[0] ?? [];
  const rows = preview.slice(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-fullmx-4 flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Import Users</h2>
            <p className="text-xs text-gray-500 mt-0.5">Upload a CSV file to bulk-import users.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={16} /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-2 py-2 flex flex-col gap-5">
          {/* Upload area */}
          {!file && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`border-2 border-dashed rounded-xl p-2 flex flex-col items-center gap-3 transition-colors ${dragging ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-gray-50/50 hover:border-gray-300"}`}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <p className="text-sm text-gray-600 font-medium">Drag & drop your CSV file here</p>
              <p className="text-xs text-gray-400">or</p>
              <label className="px-4 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors cursor-pointer">
                Browse File
                <input type="file" accept=".csv" onChange={onInputChange} className="hidden" />
              </label>
              <p className="text-[11px] text-gray-400">Supported format: .csv</p>
            </div>
          )}

          {/* Preview */}
          {file && !imported && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                  <span className="font-medium text-gray-800">{file.name}</span>
                  <span className="text-gray-400">· {rows.length} user{rows.length !== 1 ? "s" : ""} found</span>
                </div>
                <button onClick={() => { setFile(null); setPreview([]); }} className="text-[11px] text-red-400 hover:text-red-600 transition-colors">Remove</button>
              </div>

              {rows.length > 0 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto max-h-52">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          {headers.map((h, i) => (
                            <th key={i} className="text-left px-2 py-2 font-semibold text-gray-500 text-[10px] uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 10).map((row, i) => (
                          <tr key={i} className={`border-b border-gray-100 last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                            {row.map((cell, j) => (
                              <td key={j} className="px-3 py-2 text-gray-700 whitespace-nowrap">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {rows.length > 10 && (
                    <p className="px-3 py-2 text-[10px] text-gray-400 border-t border-gray-100">… and {rows.length - 10} more rows</p>
                  )}
                </div>
              )}
            </>
          )}

          {imported && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle size={24} className="text-green-500" />
              </div>
              <p className="text-sm font-semibold text-gray-900">Import Successful</p>
              <p className="text-xs text-gray-400">{rows.length} user{rows.length !== 1 ? "s" : ""} imported successfully.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-2 border-t border-gray-100 flex items-center justify-between">
          <button onClick={() => { downloadUserTemplate(); }} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors">
            <Download size={12} /> Download Template
          </button>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
              {imported ? "Close" : "Cancel"}
            </button>
            {!imported && (
              <button
                disabled={!file || rows.length === 0}
                onClick={() => setImported(true)}
                className="px-4 py-2 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                Import {rows.length > 0 ? `${rows.length} User${rows.length !== 1 ? "s" : ""}` : "Users"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const userActivityLog = [
  { action: "Logged in", date: "2026-06-02 1:03 PM", icon: "login" },
  { action: "Placed order #ORD-2024-1245", date: "2026-05-28 10:30 AM", icon: "order" },
  { action: "Updated profile information", date: "2026-05-20 3:15 PM", icon: "edit" },
  { action: "Password changed", date: "2026-05-10 11:00 AM", icon: "lock" },
];

const pendingApprovals = [
  {
    id: "WO-2026-0841",
    type: "Work Order",
    title: "Office Furniture Replacement — Floor 3",
    requestedBy: "Priya Sharma",
    requestedByRole: "Procurement Specialist",
    requestedOn: "2026-06-18",
    amount: "₹1,85,000",
    priority: "High",
    description: "Replacement of 24 workstation chairs and 6 standing desks on Floor 3 due to wear and tear. Vendor: FurniCraft Solutions. Delivery expected within 10 working days of approval.",
    items: [
      { name: "Ergonomic Chair (FurniCraft EC-200)", qty: 24, unitPrice: "₹5,500", total: "₹1,32,000" },
      { name: "Height-Adjustable Desk (FurniCraft SD-Pro)", qty: 6, unitPrice: "₹8,800", total: "₹52,800" },
      { name: "Delivery & Installation", qty: 1, unitPrice: "₹200", total: "₹200" },
    ],
    attachments: ["Quotation_FurniCraft_WO0841.pdf", "Floor3_Layout.png"],
    statusHistory: [
      { status: "Submitted", by: "Priya Sharma", date: "2026-06-18 09:14 AM" },
      { status: "Forwarded to Manager", by: "System", date: "2026-06-18 09:15 AM" },
    ],
  },
  {
    id: "PO-2026-3312",
    type: "Purchase Order",
    title: "Q3 IT Hardware Procurement — Laptops & Monitors",
    requestedBy: "Arjun Mehta",
    requestedByRole: "IT Specialist",
    requestedOn: "2026-06-15",
    amount: "₹4,20,000",
    priority: "Medium",
    description: "Quarterly hardware refresh for the engineering team. 14 laptops and 14 monitors to replace units older than 4 years. Vendor: TechSupply Co.",
    items: [
      { name: "Dell Latitude 5540 (i7, 16GB, 512 SSD)", qty: 14, unitPrice: "₹22,500", total: "₹3,15,000" },
      { name: "Dell 27\" IPS Monitor (P2723D)", qty: 14, unitPrice: "₹7,500", total: "₹1,05,000" },
    ],
    attachments: ["PO_TechSupply_3312.pdf", "Asset_Replacement_List.xlsx"],
    statusHistory: [
      { status: "Submitted", by: "Arjun Mehta", date: "2026-06-15 11:40 AM" },
      { status: "Level-1 Approved", by: "Sarah Collins", date: "2026-06-16 10:05 AM" },
      { status: "Pending Manager Approval", by: "System", date: "2026-06-16 10:06 AM" },
    ],
  },
  {
    id: "PR-2026-0099",
    type: "Purchase Requisition",
    title: "Pantry Supplies Restock — Monthly",
    requestedBy: "Neha Verma",
    requestedByRole: "Admin Executive",
    requestedOn: "2026-06-20",
    amount: "₹12,400",
    priority: "Low",
    description: "Monthly restock of pantry consumables including coffee, tea, mineral water, and snack items for the office pantry.",
    items: [
      { name: "Filter Coffee Powder (1kg × 4)", qty: 4, unitPrice: "₹650", total: "₹2,600" },
      { name: "Green Tea Bags (Box × 6)", qty: 6, unitPrice: "₹320", total: "₹1,920" },
      { name: "Mineral Water 20L (Bisleri)", qty: 20, unitPrice: "₹95", total: "₹1,900" },
      { name: "Assorted Snack Packs", qty: 60, unitPrice: "₹99", total: "₹5,940" },
      { name: "Sugar (1kg × 4)", qty: 4, unitPrice: "₹60", total: "₹240" },
    ],
    attachments: ["Pantry_Restock_Jun2026.pdf"],
    statusHistory: [
      { status: "Submitted", by: "Neha Verma", date: "2026-06-20 08:55 AM" },
    ],
  },
  {
    id: "SRQ-2026-0217",
    type: "Service Request",
    title: "AMC Renewal — HVAC Systems (Block B)",
    requestedBy: "Ravi Kumar",
    requestedByRole: "Facilities Manager",
    requestedOn: "2026-06-12",
    amount: "₹78,000",
    priority: "High",
    description: "Annual Maintenance Contract renewal for 8 HVAC units in Block B. Current contract expires June 30, 2026. Vendor: CoolTech Services. Includes quarterly servicing and emergency callouts.",
    items: [
      { name: "AMC — HVAC Units (8 units × ₹8,500)", qty: 8, unitPrice: "₹8,500", total: "₹68,000" },
      { name: "Emergency Callout Coverage (annual)", qty: 1, unitPrice: "₹10,000", total: "₹10,000" },
    ],
    attachments: ["AMC_CoolTech_Renewal_2026.pdf", "HVAC_Inspection_Report.pdf"],
    statusHistory: [
      { status: "Submitted", by: "Ravi Kumar", date: "2026-06-12 03:20 PM" },
      { status: "Level-1 Approved", by: "Priya Sharma", date: "2026-06-13 09:30 AM" },
      { status: "Pending Senior Approval", by: "System", date: "2026-06-13 09:31 AM" },
    ],
  },
];

type UserDetailExpense = {
  id: string;
  date: string;
  expenseAccount?: string;
  vendorName?: string;
  amount?: number;
  referenceNumber?: string;
  status?: string;
  notes?: string;
  [key: string]: unknown;
};

type UserApprovalRecord = {
  id: string;
  type: string;
  title: string;
  requestedBy: string;
  requestedByRole: string;
  requestedOn: string;
  amount: string;
  priority: string;
  description: string;
  items: Array<{ name: string; qty: number; unitPrice: string; total: string }>;
  attachments: string[];
  statusHistory: Array<{ status: string; by: string; date: string }>;
  status: string;
};

function recordBelongsToUser(record: unknown, user: UserRecord): boolean {
  if (!record || typeof record !== "object") return false;
  const value = record as Record<string, unknown>;
  const ids = [
    value.userId, value.requestedById, value.requesterId, value.createdById, value.actorId,
  ].map(item => String(item || "").trim()).filter(Boolean);
  const emails = [
    value.email, value.requestedByEmail, value.requesterEmail, value.createdByEmail, value.actorEmail,
  ].map(item => String(item || "").trim().toLowerCase()).filter(Boolean);
  const names = [
    value.name, value.requestedBy, value.requestedByName, value.requester, value.createdBy, value.actor,
  ].map(item => String(item || "").trim().toLowerCase()).filter(Boolean);
  return ids.includes(user.id)
    || emails.includes(user.email.toLowerCase())
    || names.includes(user.name.toLowerCase());
}

function formatDetailAmount(amount: number | string | null | undefined): string {
  if (typeof amount === "number" && Number.isFinite(amount)) return `₹${amount.toLocaleString("en-IN")}`;
  if (typeof amount === "string" && amount.trim()) return amount;
  return "—";
}

function approvalRequestToDetail(request: ApprovalRequest): UserApprovalRecord {
  const context = request.context || {};
  const rawItems = Array.isArray(context.items) ? context.items : [];
  const items = rawItems.map((item, index) => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const qty = Number(row.qty || row.quantity || 1);
    const unitPrice = row.unitPrice ?? row.unit_price ?? row.price ?? "";
    const total = row.total ?? row.amount ?? (Number(unitPrice) * qty || "");
    return {
      name: String(row.name || row.item || `Item ${index + 1}`),
      qty: Number.isFinite(qty) ? qty : 1,
      unitPrice: formatDetailAmount(unitPrice as number | string),
      total: formatDetailAmount(total as number | string),
    };
  });
  const rawTimeline = Array.isArray(request.timeline) ? request.timeline : [];
  return {
    id: request.id,
    type: String(context.type || request.module || "Approval Request"),
    title: String(context.title || request.workflow || request.trigger || request.reference),
    requestedBy: request.requestedByName || request.requestedBy,
    requestedByRole: String(context.requestedByRole || context.role || ""),
    requestedOn: request.createdAt ? request.createdAt.slice(0, 10) : "—",
    amount: formatDetailAmount(request.amount),
    priority: String(context.priority || "Medium"),
    description: String(context.description || context.reason || request.trigger || ""),
    items,
    attachments: Array.isArray(context.attachments) ? context.attachments.map(String) : [],
    statusHistory: rawTimeline.map((step: any) => ({
      status: String(step.new_status || step.action || "Updated"),
      by: String(step.user_name || step.userName || "System"),
      date: step.created_at ? String(step.created_at).slice(0, 16).replace("T", " ") : "—",
    })),
    status: request.status,
  };
}

function UserDetailPage({ user, displayUserId, onBack, onEdit, onResetPassword, onDeactivate, assignedDevices = [], onOpenAssignPage }: { user: UserRecord; displayUserId?: string; onBack: () => void; onEdit?: () => void; onResetPassword?: () => void; onDeactivate?: () => void; assignedDevices?: AssignedDeviceEntry[]; onOpenAssignPage?: () => void }) {
  const [detailTab, setDetailTab] = useState("Overview");
  const detailTabs = ["Overview", "Activity", "Orders", "Services", "Expenses", "Assigned Devices", "Pending Approvals"];
  const [selectedApproval, setSelectedApproval] = useState<UserApprovalRecord | null>(null);
  const [dotMenuOpen, setDotMenuOpen] = useState(false);
  const [expMonth, setExpMonth] = useState("2026-06");
  const [activities, setActivities] = useState<ClientActivityRecord[]>([]);
  const [orders, setOrders] = useState<ClientOrderRecord[]>([]);
  const [services, setServices] = useState<ClientServiceRecord[]>([]);
  const [expenses, setExpenses] = useState<UserDetailExpense[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<UserApprovalRecord[]>([]);

  const userDetails = user.details ?? {};
  const clientId = user.clientId || "";
  const organizationName = String(userDetails.orgAccess || user.clientName || "—");
  const employeeId = String(userDetails.employeeId || "—");
  const gender = String(userDetails.gender || "—");
  const department = String(userDetails.department || "—");
  const reportingManager = String(userDetails.reportingManager || "—");
  const joiningDate = String(userDetails.joiningDate || "—");
  const accountInfo = String(userDetails.accountInfo || "—");
  const userDevices = Array.isArray(userDetails.assignedDevices)
    ? userDetails.assignedDevices as AssignedDeviceEntry[]
    : assignedDevices;

  const formattedDate = new Date(user.lastActive).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
  const userId = displayUserId || user.id;

  useEffect(() => {
    const reload = () => {
      setActivities(clientId ? getClientActivities(clientId).filter(item => recordBelongsToUser(item, user)) : []);
      setOrders(clientId ? getClientOrders(clientId, user.clientName).filter(item => recordBelongsToUser(item, user)) : []);
      const clientServices = clientId
        ? getClientServices(clientId).filter(item => recordBelongsToUser(item, user))
        : [];
      const requestedServices = getServiceRequests()
        .filter(request => recordBelongsToUser({ requestedBy: request.requestedBy }, user))
        .map(request => ({
          id: request.id,
          clientId,
          name: request.requestType,
          provider: "Service request",
          startDate: request.requestDate,
          endDate: request.requestDate,
          amount: "—",
          status: request.status,
          category: request.requestType,
          description: request.itemAsset,
          requestedBy: request.requestedBy,
        }));
      setServices([...clientServices, ...requestedServices]);
      try {
        const raw = JSON.parse(localStorage.getItem("nido_expenses_v1") || "[]");
        setExpenses(Array.isArray(raw)
          ? raw.filter((item): item is UserDetailExpense => Boolean(item && typeof item === "object" && recordBelongsToUser(item, user)))
          : []);
      } catch {
        setExpenses([]);
      }
    };
    reload();
    window.addEventListener("nidoClientDataUpdated", reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener("nidoClientDataUpdated", reload);
      window.removeEventListener("storage", reload);
    };
  }, [clientId, user.id, user.email, user.name, user.clientName]);

  useEffect(() => {
    let active = true;
    loadApprovalBootstrap()
      .then(result => {
        if (!active) return;
        setApprovalRequests(result.requests
          .filter(request => ["Pending", "In Progress", "Escalated"].includes(request.status))
          .filter(request => recordBelongsToUser({
            requestedById: request.requestedBy,
            requestedByEmail: request.requestedBy,
            requestedByName: request.requestedByName,
          }, user))
          .map(approvalRequestToDetail));
      })
      .catch(() => {
        if (active) setApprovalRequests([]);
      });
    return () => { active = false; };
  }, [user.id, user.email, user.name]);

  const orderApprovals: UserApprovalRecord[] = orders
    .filter(order => !["Delivered", "Cancelled", "Completed"].includes(order.status))
    .map(order => ({
      id: order.id,
      type: "Purchase Order",
      title: `Order ${order.id}`,
      requestedBy: order.requestedBy || user.name,
      requestedByRole: user.role,
      requestedOn: order.date,
      amount: formatDetailAmount(order.amount),
      priority: "Medium",
      description: order.notes || "Client order awaiting completion.",
      items: [{ name: `${order.items} item${order.items === 1 ? "" : "s"}`, qty: order.items, unitPrice: order.amount, total: order.amount }],
      attachments: [],
      statusHistory: [{ status: order.status, by: order.requestedBy || user.name, date: order.date }],
      status: order.status,
    }));
  const liveApprovals = [...approvalRequests, ...orderApprovals];
  const totalExpense = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const selectedMonthExpense = expenses
    .filter(expense => String(expense.date || "").slice(0, 7) === expMonth)
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const pendingExpense = expenses.filter(expense => String(expense.status || "").toLowerCase().includes("pending"));
  const avatarGender = gender.toLowerCase();
  const avatarSrc = avatarGender === "male"
    ? "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&h=160&fit=crop&auto=format"
    : avatarGender === "female"
      ? "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=160&h=160&fit=crop&auto=format"
      : "";

  return (
    <div className="flex flex-col gap-4">
      {/* Back button + header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            Back to Users
          </button>
          <span className="text-gray-300 text-xs">/</span>
          <span className="text-xs font-semibold text-gray-800">{user.name}</span>
          <StatusBadge status={user.status} />
        </div>
        {/* 3-dot menu */}
        <div className="relative">
          <button
            onClick={() => setDotMenuOpen((v) => !v)}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
          >
            <MoreVertical size={15} />
          </button>
          {dotMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setDotMenuOpen(false)} />
              <div className="absolute right-0 top-9 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[160px]">
                <button
                  onClick={() => { setDotMenuOpen(false); onResetPassword?.(); }}
                  className="w-full flex items-center gap-2.5 px-2 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors text-left"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  Reset Password
                </button>
                <button
                  onClick={() => { setDotMenuOpen(false); onEdit?.(); }}
                  className="w-full flex items-center gap-2.5 px-2 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors text-left"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Edit User
                </button>
                <button
                  onClick={() => { setDotMenuOpen(false); onDeactivate?.(); }}
                  className="w-full flex items-center gap-2.5 px-2 py-2.5 text-xs text-orange-600 hover:bg-orange-50 transition-colors text-left"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                  {user.status === "Inactive" ? "Activate" : "Deactivate"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tabs + content card */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-gray-100 px-4">
          {detailTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setDetailTab(tab)}
              className={`px-4 py-2 text-sm font-medium transition-colors relative whitespace-nowrap ${
                detailTab === tab ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab}
              {detailTab === tab && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
              )}
            </button>
          ))}
        </div>

        {/* Overview tab */}
        {detailTab === "Overview" && (
          <div className="grid grid-cols-[210px_1fr]">
            {/* Left sidebar */}
            <div className="border-r border-gray-100 p-2 flex flex-col gap-3">
              {/* Avatar photo */}
              <div className="flex flex-col items-center gap-2 pb-3 border-b border-gray-100">
                <div className="w-20 h-20 rounded-full overflow-hidden bg-blue-100 shrink-0 ring-2 ring-gray-100 flex items-center justify-center">
                  {avatarSrc ? (
                    <img src={avatarSrc} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl font-bold text-blue-700">{user.initials}</span>
                  )}
                </div>
                <p className="text-sm font-semibold text-gray-900 text-center leading-tight">{user.name}</p>
                <p className="text-xs text-gray-500">{user.role}</p>
              </div>
              {/* Contact details */}
              <div className="flex flex-col gap-2.5 text-[11px] text-gray-600">
                <div className="flex items-center gap-2">
                  <Mail size={12} className="text-gray-400 shrink-0" />
                  <span className="truncate">{user.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={12} className="text-gray-400 shrink-0" />
                  {user.phone}
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle size={12} className="text-green-500 shrink-0" />
                  {user.status} · {formattedDate}
                </div>
                <div className="flex items-center gap-2">
                  <Building2 size={12} className="text-gray-400 shrink-0" />
                  {organizationName}
                </div>
              </div>
              <button className="mt-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium py-2 rounded-lg transition-colors">
                <Mail size={12} /> Send Email
              </button>
              <div className="text-[10px] text-gray-400 space-y-0.5 leading-relaxed">
                <p>Last Login: {String(userDetails.lastLogin || formattedDate)}</p>
                <p>{String(userDetails.location || "Location not recorded")}{userDetails.ipAddress ? ` · IP ${String(userDetails.ipAddress)}` : ""}</p>
              </div>
            </div>

            {/* Right content */}
            <div className="flex flex-col">
              {/* Stats bar */}
              <div className="grid grid-cols-5 border-b border-gray-100">
                {/* User ID */}
                <div className="px-4 py-2 flex flex-col gap-1.5 border-r border-gray-100">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <Users size={11} className="text-blue-600" />
                    </div>
                    <span className="text-[10px] text-gray-500">User ID</span>
                  </div>
                   <p className="text-sm font-bold text-gray-900 truncate" title={userId}>{userId}</p>
                </div>
                {/* Status */}
                <div className="px-4 py-2 flex flex-col gap-1.5 border-r border-gray-100">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                      <CheckCircle size={11} className="text-green-600" />
                    </div>
                    <span className="text-[10px] text-gray-500">Status</span>
                  </div>
                  <p className="text-sm font-bold text-green-600">{user.status}</p>
                </div>
                {/* Cost Center */}
                <div className="px-4 py-2 flex flex-col gap-1.5 border-r border-gray-100">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                      <Building2 size={11} className="text-indigo-600" />
                    </div>
                    <span className="text-[10px] text-gray-500">Organization</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900 truncate">{organizationName}</p>
                </div>
                {/* Total Orders */}
                <div className="px-4 py-2 flex flex-col gap-1.5 border-r border-gray-100">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                    </div>
                    <span className="text-[10px] text-gray-500">Total Orders</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 leading-none">{orders.length}</p>
                  <p className="text-[10px] text-gray-400">Year-to-Date</p>
                </div>
                {/* Expenses */}
                <div className="px-4 py-2 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                        <DollarSign size={11} className="text-green-600" />
                      </div>
                      <span className="text-[10px] text-gray-500">Expenses</span>
                    </div>
                    <span className="text-[10px] text-blue-500 cursor-pointer hover:underline whitespace-nowrap">View All &gt;</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-600 leading-none">{formatDetailAmount(totalExpense)}</p>
                  <p className="text-[10px] text-gray-400">Year-to-Date</p>
                  <p className="text-[10px] text-gray-400">IP: 192.168.1.224</p>
                </div>
              </div>

              {/* Personal + Professional info */}
              <div className="grid grid-cols-2 flex-1">
                <div className="p-5 border-r border-gray-100">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                    <p className="text-xs font-semibold text-gray-700">Personal Information</p>
                  </div>
                  <div className="flex flex-col gap-3">
                    {[
                      { label: "Full Name", value: user.name },
                      { label: "Employee ID", value: employeeId },
                      { label: "Email Address", value: user.email },
                      { label: "Phone Number", value: user.phone || "—" },
                      { label: "Gender", value: gender },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex flex-col gap-0.5">
                        <p className="text-[10px] text-gray-400">{label}</p>
                        <p className="text-xs text-gray-800 font-medium">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                    </div>
                    <p className="text-xs font-semibold text-gray-700">Professional Information</p>
                  </div>
                  <div className="flex flex-col gap-3">
                    {[
                      { label: "Job Title", value: String(userDetails.jobTitle || user.role || "—") },
                      { label: "Department", value: department },
                      { label: "Reporting Manager", value: reportingManager },
                      { label: "Joining Date", value: joiningDate },
                      { label: "Account Info", value: accountInfo },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex flex-col gap-0.5">
                        <p className="text-[10px] text-gray-400">{label}</p>
                        <p className="text-xs text-gray-800 font-medium">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {detailTab === "Activity" && (
          <div className="p-5 flex flex-col gap-0">
            <p className="text-xs font-semibold text-gray-700 mb-4">Recent Activity</p>
            {activities.length === 0 ? (
              <p className="text-xs text-gray-400 py-8 text-center">No activity recorded for this user.</p>
            ) : activities.map((item, i) => (
              <div key={item.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                    <FileText size={13} className="text-blue-500" />
                  </div>
                  {i < activities.length - 1 && <div className="w-px flex-1 bg-gray-100 my-1" />}
                </div>
                <div className="pb-5">
                  <p className="text-xs font-medium text-gray-800">{item.name} {item.action} {item.boldPart}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{item.time} · {item.createdAt?.slice(0, 10) || item.group}</p>
                  {item.description && <p className="text-[11px] text-gray-500 mt-1 whitespace-pre-line">{item.description}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {detailTab === "Orders" && (
          <div className="p-5">
            <p className="text-xs font-semibold text-gray-700 mb-3">Orders by this user</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Order ID", "Date", "Items", "Amount", "Status"].map(h => (
                    <th key={h} className="text-left py-2.5 font-semibold text-gray-400 text-[10px] uppercase tracking-wide pr-4">
                      {h}{(h === "Status") && <Filter size={9} className="inline ml-0.5 text-gray-300" />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-xs text-gray-400">No orders recorded for this user.</td></tr>
                ) : orders.map((o, i) => (
                  <tr key={o.id} className={`border-b border-gray-50 last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                    <td className="py-2.5 pr-4 text-blue-500 font-medium">{o.id}</td>
                    <td className="py-2.5 pr-4 text-gray-600">{o.date}</td>
                    <td className="py-2.5 pr-4 text-gray-600">{o.items} items</td>
                    <td className="py-2.5 pr-4 font-semibold text-gray-900">{o.amount}</td>
                    <td className="py-2.5 pr-4"><OrderStatusBadge status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {detailTab === "Services" && (
          <div className="p-5">
            <p className="text-xs font-semibold text-gray-700 mb-3">Services by this user</p>
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {["Service ID", "Requested Date", "Service Name", "Requested By", "Amount", "Status"].map(h => (
                      <th key={h} className="text-left px-2 py-2.5 font-semibold text-gray-400 text-[10px] uppercase tracking-wide">
                        {h}{(h === "Status" || h === "Requested Date") && <Filter size={9} className="inline ml-0.5 text-gray-300" />}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {services.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-gray-400">No services recorded for this user.</td></tr>
                  ) : services.map((svc, i) => (
                    <tr key={svc.id} className={`border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50/20"}`}>
                      <td className="px-4 py-2.5 text-blue-500 font-medium">{svc.id}</td>
                      <td className="px-4 py-2.5 text-gray-600">{svc.startDate}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-800">{svc.name}</td>
                      <td className="px-4 py-2.5 text-blue-500">{svc.requestedBy || user.name}</td>
                      <td className="px-4 py-2.5 font-semibold text-gray-900">{svc.amount}</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center text-[11px] font-medium bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">{svc.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {detailTab === "Expenses" && (
          <div className="p-5 flex flex-col gap-5">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="border border-gray-100 rounded-xl px-2 py-2 bg-gray-50/60">
                <p className="text-[10px] text-gray-400 mb-1">Total Expenses</p>
                <p className="text-xl font-bold text-gray-900">{formatDetailAmount(totalExpense)}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Year to date</p>
              </div>
              <div className="border border-blue-100 rounded-xl px-2 py-2 bg-blue-50/40">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] text-gray-400">This Month</p>
                  <select
                    value={expMonth}
                    onChange={(e) => setExpMonth(e.target.value)}
                    className="text-[10px] text-blue-600 border border-blue-200 rounded-md px-1.5 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
                  >
                    <option value="2026-01">Jan 2026</option>
                    <option value="2026-02">Feb 2026</option>
                    <option value="2026-03">Mar 2026</option>
                    <option value="2026-04">Apr 2026</option>
                    <option value="2026-05">May 2026</option>
                    <option value="2026-06">Jun 2026</option>
                    <option value="2025-12">Dec 2025</option>
                    <option value="2025-11">Nov 2025</option>
                    <option value="2025-10">Oct 2025</option>
                  </select>
                </div>
                <p className="text-xl font-bold text-blue-600">{formatDetailAmount(selectedMonthExpense)}</p>
                <p className="text-[11px] text-blue-400 mt-0.5">
                  {new Date(expMonth + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </p>
              </div>
              <div className="border border-gray-100 rounded-xl px-2 py-2 bg-gray-50/60">
                <p className="text-[10px] text-gray-400 mb-1">Pending Approval</p>
                <p className="text-xl font-bold text-orange-500">{formatDetailAmount(pendingExpense.reduce((sum, expense) => sum + Number(expense.amount || 0), 0))}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{pendingExpense.length} requests</p>
              </div>
            </div>

            {/* Chart + Top 5 */}
            <div className="grid grid-cols-5 gap-5">
              {/* Bar chart */}
              <div className="col-span-3">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-gray-700">Monthly Expenses</p>
                  <span className="text-[10px] border border-gray-200 rounded-md px-2 py-0.5 text-gray-500">This Year</span>
                </div>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart
                    data={Array.from({ length: 12 }, (_, index) => {
                      const month = String(index + 1).padStart(2, "0");
                      return {
                        month: new Date(2026, index, 1).toLocaleDateString("en-US", { month: "short" }),
                        value: expenses
                          .filter(expense => String(expense.date || "").startsWith(`2026-${month}`))
                          .reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
                      };
                    })}
                    barSize={10}
                    margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                  >
                    <XAxis key="exp-xaxis" dataKey="month" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <YAxis key="exp-yaxis" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v) => v ? `$${v / 1000}K` : ""} />
                    <Tooltip
                      key="exp-tooltip"
                      formatter={(v: number) => [`$${v.toLocaleString()}`, "Expenses"]}
                      contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #e5e7eb" }}
                    />
                    <Bar key="exp-bar" dataKey="value" fill="#3b82f6" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Top 5 items */}
              <div className="col-span-2">
                <p className="text-xs font-semibold text-gray-700 mb-3">Top 5 Items</p>
                <div className="flex flex-col gap-2">
                  {expenses.length === 0 ? (
                    <p className="text-xs text-gray-400">No expenses recorded for this user.</p>
                  ) : expenses
                    .slice()
                    .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
                    .slice(0, 5)
                    .map((expense) => (
                    <div key={expense.id}>
                      <div className="flex items-center justify-between text-[11px] mb-0.5">
                        <span className="text-gray-700 truncate max-w-[130px]">{expense.expenseAccount || expense.vendorName || expense.referenceNumber || expense.id}</span>
                        <span className="text-gray-500 font-medium shrink-0">{formatDetailAmount(expense.amount)}</span>
                      </div>
                      <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400 rounded-full" style={{ width: `${totalExpense ? Math.max(4, Number(expense.amount || 0) / totalExpense * 100) : 0}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        )}

        {detailTab === "Assigned Devices" && (() => {
          const staticDevices: AssignedDeviceEntry[] = [];
          const allDevices = userDevices;
          const activeCount = allDevices.filter((d) => d.status === "Active").length;
          const repairCount = allDevices.filter((d) => d.status === "In Repair").length;
          return (
            <div className="p-5 flex flex-col gap-5">
              {/* Summary + action row */}
              <div className="flex items-center justify-between">
                <div className="grid grid-cols-3 gap-3 flex-1">
                  {[
                    { label: "Total Devices", value: String(allDevices.length), sub: "Assigned to user" },
                    { label: "Active", value: String(activeCount), sub: "In use", color: "text-green-600" },
                    { label: "In Repair", value: String(repairCount), sub: repairCount > 0 ? "Est. return Jun 28" : "None", color: "text-orange-500" },
                  ].map((card) => (
                    <div key={card.label} className="border border-gray-100 rounded-xl px-2 py-2 bg-gray-50/60">
                      <p className="text-[10px] text-gray-400 mb-1">{card.label}</p>
                      <p className={`text-xl font-bold ${card.color ?? "text-gray-900"}`}>{card.value}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{card.sub}</p>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => onOpenAssignPage?.()}
                  className="ml-4 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-2 py-2 rounded-lg transition-colors shrink-0"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                  Assign Device
                </button>
              </div>

              {/* Newly assigned devices (from AssignDevicePage) */}
              {userDevices.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide mb-2">Recently Assigned</p>
                  <div className="grid grid-cols-2 gap-4">
                    {userDevices.map((device) => (
                      <div key={device.sku + device.assignedOn} className="border border-blue-200 bg-blue-50/30 rounded-xl p-2 flex items-start gap-2 hover:shadow-sm transition-shadow">
                        <div className="w-16 h-16 rounded-lg bg-white border border-blue-100 overflow-hidden shrink-0">
                          <img src={device.img} alt={device.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-semibold text-gray-900 leading-snug">{device.name}</p>
                            <span className="shrink-0 inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border bg-green-50 text-green-700 border-green-200">
                              {device.status}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{device.sku}</p>
                          <div className="flex flex-wrap gap-2 mt-2 text-[10px] text-gray-500">
                            <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{device.category}</span>
                            {device.serialNo && <span className="font-mono">S/N: {device.serialNo}</span>}
                          </div>
                          <div className="flex flex-wrap gap-2 mt-1 text-[10px] text-gray-400">
                            {device.modelNo && <span>Model: {device.modelNo}</span>}
                            {device.referenceNo && <span>Ref: {device.referenceNo}</span>}
                          </div>
                          <p className="text-[10px] text-blue-500 mt-1">Assigned {new Date(device.assignedOn).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Static existing device cards */}
              <div>
                {assignedDevices.length > 0 && <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Previously Assigned</p>}
                <div className="grid grid-cols-2 gap-4">
                  {staticDevices.map((device) => (
                    <div key={device.sku} className="border border-gray-200 rounded-xl p-2 flex items-start gap-2 hover:shadow-sm transition-shadow bg-white">
                      <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                        <img src={device.img} alt={device.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold text-gray-900 leading-snug">{device.name}</p>
                          <span className={`shrink-0 inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
                            device.status === "Active"
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-orange-50 text-orange-600 border-orange-200"
                          }`}>
                            {device.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{device.sku}</p>
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-500">
                          <span className="inline-block bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full text-[10px]">{device.category}</span>
                          <span>Assigned {new Date(device.assignedOn).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        {detailTab === "Pending Approvals" && (() => {
          if (selectedApproval) {
            const priorityColor: Record<string, string> = {
              High: "bg-red-50 text-red-600 border-red-200",
              Medium: "bg-orange-50 text-orange-600 border-orange-200",
              Low: "bg-green-50 text-green-700 border-green-200",
            };
            const typeColor: Record<string, string> = {
              "Work Order": "bg-purple-50 text-purple-700 border-purple-200",
              "Purchase Order": "bg-blue-50 text-blue-700 border-blue-200",
              "Purchase Requisition": "bg-teal-50 text-teal-700 border-teal-200",
              "Service Request": "bg-indigo-50 text-indigo-700 border-indigo-200",
            };
            return (
              <div className="p-5 flex flex-col gap-5">
                {/* Detail header */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedApproval(null)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                    Back
                  </button>
                  <span className="text-gray-300 text-xs">/</span>
                  <span className="text-xs font-semibold text-gray-800">{selectedApproval.id}</span>
                </div>

                {/* Title row */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${typeColor[selectedApproval.type] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>{selectedApproval.type}</span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${priorityColor[selectedApproval.priority]}`}>{selectedApproval.priority} Priority</span>
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900">{selectedApproval.title}</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">Requested by <span className="font-medium text-gray-600">{selectedApproval.requestedBy}</span> · {selectedApproval.requestedByRole} · {selectedApproval.requestedOn}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] text-gray-400">Total Amount</p>
                    <p className="text-base font-bold text-gray-900">{selectedApproval.amount}</p>
                  </div>
                </div>

                {/* Description */}
                <div className="border border-gray-200 rounded-xl p-4">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description</p>
                  <p className="text-xs text-gray-700 leading-relaxed">{selectedApproval.description}</p>
                </div>

                {/* Line items */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                    <p className="text-[11px] font-semibold text-gray-700">Line Items</p>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Item</th>
                        <th className="text-center px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Qty</th>
                        <th className="text-right px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Unit Price</th>
                        <th className="text-right px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedApproval.items.map((item, i) => (
                        <tr key={i} className={`border-b border-gray-100 last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                          <td className="px-4 py-2.5 text-gray-700">{item.name}</td>
                          <td className="px-3 py-2.5 text-center text-gray-600">{item.qty}</td>
                          <td className="px-3 py-2.5 text-right text-gray-600">{item.unitPrice}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{item.total}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gray-200 bg-gray-50">
                        <td colSpan={3} className="px-4 py-2.5 text-xs font-semibold text-gray-700 text-right">Grand Total</td>
                        <td className="px-4 py-2.5 text-right text-sm font-bold text-blue-600">{selectedApproval.amount}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Attachments + status history side by side */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="border border-gray-200 rounded-xl p-4">
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Attachments</p>
                    <div className="flex flex-col gap-1.5">
                      {selectedApproval.attachments.map((file) => (
                        <div key={file} className="flex items-center gap-2 text-xs text-blue-600 hover:underline cursor-pointer">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          {file}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="border border-gray-200 rounded-xl p-4">
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Approval Trail</p>
                    <div className="flex flex-col gap-0">
                      {selectedApproval.statusHistory.map((step, i) => (
                        <div key={i} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className="w-2 h-2 rounded-full bg-blue-500 mt-1 shrink-0" />
                            {i < selectedApproval.statusHistory.length - 1 && <div className="w-px flex-1 bg-gray-200 my-0.5" />}
                          </div>
                          <div className="pb-3">
                            <p className="text-[11px] font-medium text-gray-700">{step.status}</p>
                            <p className="text-[10px] text-gray-400">{step.by} · {step.date}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center justify-end gap-3 pt-1">
                  <button
                    onClick={() => setSelectedApproval(null)}
                    className="px-4 py-2 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Back to List
                  </button>
                  <button className="px-4 py-2 text-xs border border-red-200 text-red-500 hover:bg-red-50 rounded-lg transition-colors font-medium">
                    Reject
                  </button>
                  <button className="px-4 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
                    Approve
                  </button>
                </div>
              </div>
            );
          }

          const priorityColor: Record<string, string> = {
            High: "bg-red-50 text-red-600 border-red-200",
            Medium: "bg-orange-50 text-orange-600 border-orange-200",
            Low: "bg-green-50 text-green-700 border-green-200",
          };
          const typeIcon: Record<string, React.ReactNode> = {
            "Work Order": <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2M8 7V5a2 2 0 0 0-4 0v2"/></svg>,
            "Purchase Order": <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
            "Purchase Requisition": <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
            "Service Request": <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>,
          };

          return (
            <div className="p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-900">Pending Approvals</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Requests raised by team members awaiting your approval</p>
                </div>
                <span className="text-[11px] font-semibold bg-orange-50 text-orange-600 border border-orange-200 px-2 py-0.5 rounded-full">{liveApprovals.length} pending</span>
              </div>

              <div className="flex flex-col gap-3">
                {liveApprovals.length === 0 ? (
                  <p className="text-xs text-gray-400 py-8 text-center">No pending approvals recorded for this user.</p>
                ) : liveApprovals.map((approval) => (
                  <button
                    key={approval.id}
                    onClick={() => setSelectedApproval(approval)}
                    className="w-full text-left border border-gray-200 rounded-xl p-2 bg-white hover:shadow-sm hover:border-blue-200 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-blue-50 flex items-center justify-center text-gray-500 group-hover:text-blue-500 shrink-0 transition-colors">
                          {typeIcon[approval.type]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] font-mono text-gray-400">{approval.id}</span>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${priorityColor[approval.priority]}`}>{approval.priority}</span>
                          </div>
                          <p className="text-xs font-semibold text-gray-900 truncate">{approval.title}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            <span className="text-gray-500">{approval.type}</span> · {approval.requestedBy} · {approval.requestedOn}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1.5">
                        <p className="text-xs font-bold text-gray-900">{approval.amount}</p>
                        <div className="flex items-center gap-1 text-[10px] text-blue-500 font-medium group-hover:underline">
                          View details
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

function ArchiveConfirmModal({ user, onConfirm, onCancel }: { user: { name: string; role: string; initials: string; color: string }; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Archive User</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-2 flex flex-col items-center gap-2 text-center">
          <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Archive {user.name}?</p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              This user will be moved to Archived Users and will lose access to the system. This action can be reviewed in the archived users list.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-2 py-2 w-full">
            <div className={`w-8 h-8 rounded-full ${user.color} flex items-center justify-center text-white text-[11px] font-bold shrink-0`}>
              {user.initials}
            </div>
            <div className="text-left">
              <p className="text-xs font-semibold text-gray-800">{user.name}</p>
              <p className="text-[11px] text-gray-400">{user.role}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-2 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-xs bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors"
          >
            Yes, Archive User
          </button>
        </div>
      </div>
    </div>
  );
}

function AssignDevicePage({ userName, onBack, onAssign }: { userName: string; onBack: () => void; onAssign: (device: AssignedDeviceEntry) => void }) {
  const [search, setSearch] = useState("");
  const [showDrop, setShowDrop] = useState(false);
  const [selected, setSelected] = useState<typeof addUserDeviceOptions[0] | null>(null);
  const [serialNo, setSerialNo] = useState("");
  const [modelNo, setModelNo] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [activeField, setActiveField] = useState<"serial" | "model" | "reference">("serial");

  const filtered = addUserDeviceOptions.filter(
    (d) => d.name.toLowerCase().includes(search.toLowerCase()) || d.sku.toLowerCase().includes(search.toLowerCase())
  );

  const handleAssign = () => {
    if (!selected) return;
    onAssign({
      sku: selected.sku,
      name: selected.name,
      category: selected.category,
      img: selected.img,
      serialNo,
      modelNo,
      referenceNo,
      assignedOn: new Date().toISOString().slice(0, 10),
      status: "Active",
    });
    onBack();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Back breadcrumb */}
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        <span className="text-gray-300 text-xs">/</span>
        <span className="text-xs text-gray-500">{userName}</span>
        <span className="text-gray-300 text-xs">/</span>
        <span className="text-xs font-semibold text-gray-800">Assign Device</span>
      </div>

      {/* Main card */}
      <div className="bg-white rounded-xl border border-gray-200 flex flex-col" style={{ minHeight: "560px" }}>
        {/* Card header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Assign Device</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Search the master catalog and assign a device to{" "}
            <span className="font-medium text-gray-700">{userName}</span>.
          </p>
        </div>

        {/* Card body */}
        <div className="px-6 py-2 flex flex-col gap-2 flex-1">

          {/* Search bar */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              Search Master Catalog <span className="text-red-400">*</span>
            </label>
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setShowDrop(true); }}
                onFocus={() => setShowDrop(true)}
                placeholder="Search by device name or SKU..."
                className="w-full pl-8 pr-4 py-2.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder-gray-400"
              />
              {showDrop && search.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 py-1 max-h-60 overflow-y-auto">
                  {filtered.length === 0 ? (
                    <p className="px-4 py-2 text-xs text-gray-400">No devices found</p>
                  ) : (
                    filtered.map((d) => (
                      <button
                        key={d.sku}
                        onClick={() => { setSelected(d); setSearch(""); setShowDrop(false); }}
                        className="w-full flex items-center gap-3 px-2 py-2 hover:bg-blue-50 transition-colors text-left group"
                      >
                        <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                          <img src={d.img} alt={d.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800 group-hover:text-blue-700">{d.name}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{d.sku} · {d.category}</p>
                        </div>
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full shrink-0">{d.category}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Selected product card */}
          {selected && (
            <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-2 flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-white border border-blue-100 overflow-hidden shrink-0 shadow-sm">
                <img src={selected.img} alt={selected.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{selected.name}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{selected.sku}</p>
                <span className="inline-block mt-1.5 bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-[10px] font-medium">
                  {selected.category}
                </span>
              </div>
              <button
                onClick={() => { setSelected(null); setSerialNo(""); setModelNo(""); setReferenceNo(""); }}
                className="text-gray-300 hover:text-gray-500 transition-colors shrink-0 p-1"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* 3-tab entry fields */}
          {selected && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              {/* Tab strip */}
              <div className="flex border-b border-gray-200 bg-gray-50">
                {(["serial", "model", "reference"] as const).map((field, idx) => {
                  const labels = { serial: "Serial No", model: "Model No", reference: "Reference No" };
                  const values = { serial: serialNo, model: modelNo, reference: referenceNo };
                  return (
                    <button
                      key={field}
                      onClick={() => setActiveField(field)}
                      className={`flex-1 px-2 py-2 text-xs font-medium transition-colors relative border-r last:border-r-0 border-gray-200 ${
                        activeField === field
                          ? "text-blue-600 bg-white"
                          : "text-gray-500 hover:text-gray-700 hover:bg-gray-100/60"
                      }`}
                    >
                      <span className="block">{labels[field]}</span>
                      {values[field] && (
                        <span className="block text-[9px] text-blue-400 mt-0.5 font-mono truncate max-w-[80px] mx-auto">{values[field]}</span>
                      )}
                      {activeField === field && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                      )}
                    </button>
                  );
                })}
              </div>
              {/* Tab input */}
              <div className="p-5">
                {activeField === "serial" && (
                  <div>
                    <label className="block text-[11px] text-blue-600 mb-1.5">Serial Number</label>
                    <input
                      type="text"
                      value={serialNo}
                      onChange={(e) => setSerialNo(e.target.value)}
                      placeholder="e.g. C02XL0UKJHD5"
                      autoFocus
                      className="w-full px-2 py-2.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder-gray-300 font-mono"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Located on the device label or packaging</p>
                  </div>
                )}
                {activeField === "model" && (
                  <div>
                    <label className="block text-[11px] text-blue-600 mb-1.5">Model Number</label>
                    <input
                      type="text"
                      value={modelNo}
                      onChange={(e) => setModelNo(e.target.value)}
                      placeholder="e.g. A2779"
                      autoFocus
                      className="w-full px-2 py-2.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder-gray-300 font-mono"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Model identifier from the manufacturer</p>
                  </div>
                )}
                {activeField === "reference" && (
                  <div>
                    <label className="block text-[11px] text-blue-600 mb-1.5">Reference Number</label>
                    <input
                      type="text"
                      value={referenceNo}
                      onChange={(e) => setReferenceNo(e.target.value)}
                      placeholder="e.g. REF-2024-00198"
                      autoFocus
                      className="w-full px-2 py-2.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder-gray-300 font-mono"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Internal reference or asset tag number</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer — Assign Device button at bottom right */}
        <div className="px-6 py-2 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            onClick={onBack}
            className="px-4 py-2 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!selected}
            className="px-5 py-2 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            Assign Device
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ClientUsersPage({ clientId, clientName }: { clientId?: string; clientName?: string } = {}) {
  const { user: authenticatedUser, startImpersonation } = useAuth();
  const { hasPermission } = usePermissions();
  const [impersonationTarget, setImpersonationTarget] = useState<UserRecord | null>(null);
  const [users, setUsers] = useState<UserRecord[]>(() =>
    clientId ? getPortalUsersByClient(clientId).map(portalUserToRecord) : []
  );
  const [archived, setArchived] = useState<typeof archivedUsersData>([...archivedUsersData]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [rowMenu, setRowMenu] = useState<string | null>(null);
  const [rowMenuPosition, setRowMenuPosition] = useState({ top: 8, right: 8 });
  const [showAddUser, setShowAddUser] = useState(false);
  const [showImportUsers, setShowImportUsers] = useState(false);
  const [showArchivedUsers, setShowArchivedUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<UserRecord | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<UserRecord | null>(null);
  const [userDevices, setUserDevices] = useState<Record<string, AssignedDeviceEntry[]>>({});
  const [assigningDeviceFor, setAssigningDeviceFor] = useState<UserRecord | null>(null);
  useEffect(() => {
    if (!rowMenu) return;
    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (
        (target as Element).closest("[data-user-row-menu]") ||
        (target as Element).closest("[data-user-row-menu-trigger]")
      ) {
        return;
      }
      setRowMenu(null);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
  }, [rowMenu]);
  useEffect(() => {
    const refreshUsers = () => {
      if (clientId) setUsers(getPortalUsersByClient(clientId).map(portalUserToRecord));
    };
    refreshUsers();
    window.addEventListener("nidoPortalUsersUpdated", refreshUsers);
    window.addEventListener("nidoPortalRolesUpdated", refreshUsers);
    return () => {
      window.removeEventListener("nidoPortalUsersUpdated", refreshUsers);
      window.removeEventListener("nidoPortalRolesUpdated", refreshUsers);
    };
  }, [clientId]);
  const canImpersonate = Boolean(
    clientId &&
    authenticatedUser?.userType === "nido_admin" &&
    hasPermission("client_user_impersonation", "manage"),
  );
  const getPortalTarget = (row: UserRecord) => {
    const portalUser = getPortalUsersByClient(clientId || "").find(
      (candidate) =>
        candidate.email.toLowerCase() === row.email.toLowerCase() &&
        candidate.status === "active" &&
        row.status === "Active",
    );
    return portalUser ? {
      id: portalUser.id,
      email: portalUser.email,
      name: portalUser.name,
      role: portalUser.role,
      userType: portalUser.userType,
      clientId: portalUser.clientId,
      clientName: portalUser.clientName || clientName,
    } : null;
  };

  const provisionPortalAccess = (row: UserRecord) => {
    if (!clientId || row.status !== "Active") return;
    const existingPortalUser = getPortalUsersByClient(clientId).find(
      candidate => candidate.email.trim().toLowerCase() === row.email.trim().toLowerCase(),
    );
    try {
      const credentials = provisionPortalUser(clientId, clientName || "Client", {
        email: row.email,
        name: row.name,
        role: existingPortalUser?.role || row.role,
        phone: row.phone,
        details: row.details,
      });
      setRowMenu(null);
      window.alert(
        `Client Portal access is active.\n\nEmail: ${credentials.email}\nPassword: ${credentials.password}\n\nSave these credentials. The password is shown only now.`,
      );
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not activate portal access.");
    }
  };

  const createUser = (user: UserRecord) => {
    if (clientId) {
      let credentials: ReturnType<typeof provisionPortalUser>;
      try {
        credentials = provisionPortalUser(clientId, clientName || "Client", {
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status === "Active" ? "active" : "inactive",
          phone: user.phone,
          details: user.details,
        });
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "Could not create portal access.");
        return;
      }
      window.alert(
        `Client Portal sign-in credentials:\n\nEmail: ${credentials.email}\nTemporary password: ${credentials.password}\n\n${user.status === "Active" ? "Access is active." : "This account is inactive and must be activated before sign-in."}\nSave these credentials; the password is shown only now.`,
      );
      // Use the canonical persisted record (and its ID) rather than the
      // temporary table record. This keeps edit/deactivate actions live.
      const persisted = getPortalUsersByClient(clientId).find(
        candidate => candidate.email.toLowerCase() === user.email.toLowerCase(),
      );
      if (persisted) {
        setUsers(prev => [portalUserToRecord(persisted), ...prev.filter(item => item.id !== persisted.id)]);
        return;
      }
    }
    setUsers((prev) => [user, ...prev]);
  };

  const archiveUser = (id: string) => {
    const u = users.find((u) => u.id === id);
    if (!u) return;
    setArchived((prev) => [...prev, { ...u, status: "Archived", archivedOn: new Date().toISOString().slice(0, 10), reason: "Manually archived" }] as typeof archivedUsersData);
    setUsers((prev) => prev.filter((u) => u.id !== id));
    setArchiveTarget(null);
    setRowMenu(null);
    if (selectedUser?.id === id) setSelectedUser(null);
  };

  const deactivateUser = (id: string) => {
    const portalUser = getPortalUsersByClient(clientId || "").find(item => item.id === id);
    if (portalUser) {
      updatePortalUser(id, { status: portalUser.status === "active" ? "inactive" : "active" });
    }
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, status: u.status === "Inactive" ? "Active" : "Inactive" } : u));
    if (selectedUser?.id === id) setSelectedUser((prev) => prev ? { ...prev, status: prev.status === "Inactive" ? "Active" : "Inactive" } : prev);
    setRowMenu(null);
  };

  const saveEditedUser = (updated: UserRecord) => {
    const portalUser = getPortalUsersByClient(clientId || "").find(item => item.id === updated.id);
    if (portalUser) {
      updatePortalUser(updated.id, {
        name: updated.name,
        email: updated.email,
        role: updated.role,
        status: updated.status === "Active" ? "active" : "inactive",
        phone: updated.phone,
        details: updated.details,
      });
    }
    setUsers((prev) => prev.map((u) => u.id === updated.id ? updated : u));
    if (selectedUser?.id === updated.id) setSelectedUser(updated);
  };

  const liveSelectedUser = selectedUser ? (users.find((u) => u.id === selectedUser.id) ?? selectedUser) : null;

  if (showArchivedUsers) return <ArchivedUsersPage onBack={() => setShowArchivedUsers(false)} archivedUsers={archived} />;
  if (editingUser) return <EditUserPage clientId={clientId} clientName={clientName} user={editingUser} onBack={() => setEditingUser(null)} onSave={saveEditedUser} />;
  if (assigningDeviceFor) return (
    <AssignDevicePage
      userName={assigningDeviceFor.name}
      onBack={() => setAssigningDeviceFor(null)}
      onAssign={(device) => {
        const currentDetails = assigningDeviceFor.details ?? {};
        const existingDevices = Array.isArray(currentDetails.assignedDevices)
          ? currentDetails.assignedDevices as AssignedDeviceEntry[]
          : [];
        const updatedDetails = {
          ...currentDetails,
          assignedDevices: [...existingDevices, device],
        };
        updatePortalUser(assigningDeviceFor.id, { details: updatedDetails });
        const updatedUser = { ...assigningDeviceFor, details: updatedDetails };
        setUserDevices((prev) => ({
          ...prev,
          [assigningDeviceFor.id]: [...existingDevices, device],
        }));
        setUsers((prev) => prev.map(item => item.id === updatedUser.id ? updatedUser : item));
        setSelectedUser(prev => prev?.id === updatedUser.id ? updatedUser : prev);
        setAssigningDeviceFor(null);
      }}
    />
  );
  if (liveSelectedUser) return (
    <UserDetailPage
      user={liveSelectedUser}
      displayUserId={getDisplayedUserId(
        liveSelectedUser,
        users.findIndex(candidate => candidate.id === liveSelectedUser.id),
      )}
      onBack={() => setSelectedUser(null)}
      onEdit={() => setEditingUser(liveSelectedUser)}
      onResetPassword={() => setResetPasswordUser(liveSelectedUser)}
      onDeactivate={() => deactivateUser(liveSelectedUser.id)}
       assignedDevices={
         Array.isArray(liveSelectedUser.details?.assignedDevices)
           ? liveSelectedUser.details.assignedDevices as AssignedDeviceEntry[]
           : userDevices[liveSelectedUser.id] ?? []
       }
      onOpenAssignPage={() => setAssigningDeviceFor(liveSelectedUser)}
    />
  );

  const allIds = users.map((u) => u.id);
  const allChecked = selected.size === allIds.length && allIds.length > 0;

  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(allIds));
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const total = users.length;
  const active = users.filter((u) => u.status === "Active").length;
  const pending = users.filter((u) => u.status === "Pending").length;
  const inactive = users.filter((u) => u.status === "Inactive").length;

  return (
    <div className="p-5 flex flex-col gap-4" onClick={() => { setHeaderMenuOpen(false); setRowMenu(null); }}>
      {showAddUser && (
        <AddUserModal
          clientId={clientId}
          clientName={clientName}
          onClose={() => setShowAddUser(false)}
          onCreate={createUser}
        />
      )}
      {showImportUsers && <ImportUsersModal onClose={() => setShowImportUsers(false)} />}
      {resetPasswordUser && (
        <ResetPasswordModal
          userId={resetPasswordUser.id}
          userName={resetPasswordUser.name}
          onClose={() => setResetPasswordUser(null)}
        />
      )}
      {archiveTarget && (
        <ArchiveConfirmModal
          user={archiveTarget}
          onConfirm={() => archiveUser(archiveTarget.id)}
          onCancel={() => setArchiveTarget(null)}
        />
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Users</h2>
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setHeaderMenuOpen((v) => !v); setRowMenu(null); }}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <MoreVertical size={16} />
          </button>
          {headerMenuOpen && (
            <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-20 w-48" onClick={(e) => e.stopPropagation()}>
              {[
                { icon: <UserPlus size={13} />, label: "Add Users", action: () => { setShowAddUser(true); setHeaderMenuOpen(false); } },
                { icon: <Download size={13} />, label: "Export Users", action: () => { exportUsersCSV(users); setHeaderMenuOpen(false); } },
                { icon: <Upload size={13} />, label: "Import Users", action: () => { setShowImportUsers(true); setHeaderMenuOpen(false); } },
                { icon: <FileText size={13} />, label: "Download Template", action: () => { downloadUserTemplate(); setHeaderMenuOpen(false); } },
                { icon: <Users size={13} />, label: "Archived Users", action: () => { setShowArchivedUsers(true); setHeaderMenuOpen(false); }, divider: true },
              ].map(({ icon, label, action, divider }) => (
                <div key={label}>
                  {divider && <div className="my-1 border-t border-gray-100" />}
                  <button onClick={action} className="w-full flex items-center gap-2.5 px-2 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors">
                    <span className="text-gray-400">{icon}</span>{label}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="border border-gray-200 rounded-xl px-2 py-2 bg-white flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
            <Users size={16} className="text-gray-500" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Users</p>
            <p className="text-xl font-bold text-gray-900 leading-tight">{total}</p>
            <p className="text-[11px] text-gray-400">{active} Active</p>
          </div>
        </div>
        <div className="border border-gray-200 rounded-xl px-2 py-2 bg-white flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
            <Timer size={16} className="text-orange-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Pending</p>
            <p className="text-xl font-bold text-gray-900 leading-tight">{pending}</p>
          </div>
        </div>
        <div className="border border-gray-200 rounded-xl px-2 py-2 bg-white flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center shrink-0">
            <X size={16} className="text-red-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Inactive</p>
            <p className="text-xl font-bold text-gray-900 leading-tight">{inactive}</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="w-10 px-2 py-3">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} className="rounded border-gray-300 text-blue-500 cursor-pointer" />
              </th>
              <th className="text-left px-2 py-2 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">User ID</th>
              <th className="text-left px-2 py-2 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Name / Role <Filter size={9} className="inline ml-0.5 text-gray-400" /></th>
              <th className="text-left px-2 py-2 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Email</th>
              <th className="text-left px-2 py-2 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Phone</th>
              <th className="text-left px-2 py-2 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Last Active <Filter size={9} className="inline ml-0.5 text-gray-400" /></th>
              <th className="text-left px-2 py-2 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Status <Filter size={9} className="inline ml-0.5 text-gray-400" /></th>
              <th className="w-10 px-2 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((user, i) => (
              <tr key={user.id} className={`border-b border-gray-100 last:border-0 hover:bg-gray-50/60 transition-colors ${selected.has(user.id) ? "bg-blue-50/40" : i % 2 === 0 ? "bg-white" : "bg-gray-50/20"}`}>
                <td className="px-3 py-3">
                  <input type="checkbox" checked={selected.has(user.id)} onChange={() => toggleOne(user.id)} className="rounded border-gray-300 text-blue-500 cursor-pointer" />
                </td>
                <td className="px-3 py-3">
                  <span
                    className="text-blue-500 font-mono text-[10px] hover:underline cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); setSelectedUser(user); }}
                  >{getDisplayedUserId(user, i)}</span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full ${user.color} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                      {user.initials}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-[11px]">{user.name}</p>
                      <p className="text-gray-400 text-[10px]">{user.role}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1 text-gray-600">
                    <Mail size={11} className="text-gray-400 shrink-0" />
                    {user.email}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1 text-gray-600">
                    <Phone size={11} className="text-gray-400 shrink-0" />
                    {user.phone}
                  </div>
                </td>
                <td className="px-3 py-2 text-gray-500 font-mono text-[10px]">{user.lastActive}</td>
                <td className="px-3 py-3">
                  <StatusBadge status={user.status} />
                </td>
                <td className="px-3 py-2 relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (rowMenu === user.id) {
                        setRowMenu(null);
                        return;
                      }
                      const buttonRect = e.currentTarget.getBoundingClientRect();
                      const menuHeight = 220;
                      const opensBelow = buttonRect.bottom + 8 + menuHeight <= window.innerHeight;
                      setRowMenuPosition({
                        top: opensBelow
                          ? buttonRect.bottom + 8
                          : Math.max(8, buttonRect.top - menuHeight - 8),
                        right: Math.max(8, window.innerWidth - buttonRect.right),
                      });
                      setRowMenu(user.id);
                      setHeaderMenuOpen(false);
                    }}
                    data-user-row-menu-trigger
                    className="p-1 rounded hover:bg-gray-100 text-gray-400 transition-colors"
                  >
                    <MoreVertical size={13} />
                  </button>
                  {rowMenu === user.id && (
                    <div
                      className="fixed bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-[60] w-48 max-h-[calc(100vh-1rem)] overflow-y-auto"
                      style={rowMenuPosition}
                      data-user-row-menu
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button onClick={() => { setEditingUser(user); setRowMenu(null); }} className="w-full text-left px-2 py-1.5 text-xs hover:bg-gray-50 transition-colors text-gray-700">Edit User</button>
                      <button onClick={() => { setResetPasswordUser(user); setRowMenu(null); }} className="w-full text-left px-2 py-1.5 text-xs hover:bg-gray-50 transition-colors text-gray-700">Reset Password</button>
                      <button onClick={() => deactivateUser(user.id)} className="w-full text-left px-2 py-1.5 text-xs hover:bg-gray-50 transition-colors text-gray-700">
                        {user.status === "Inactive" ? "Activate" : "Deactivate"}
                      </button>
                      <div className="my-1 border-t border-gray-100" />
                      {canImpersonate && user.status === "Active" && (
                         <>
                           {!getPortalTarget(user) && (
                             <button
                               onClick={() => provisionPortalAccess(user)}
                               className="w-full text-left px-2 py-1.5 text-xs hover:bg-green-50 transition-colors text-green-700"
                             >
                               Provision Portal Access
                             </button>
                           )}
                         </>
                       )}
                       {canImpersonate && user.status === "Active" && (
                        <button
                          onClick={() => {
                            const target = getPortalTarget(user);
                            setRowMenu(null);
                            if (target) {
                              setImpersonationTarget(user);
                            } else {
                              window.alert(
                                "This user does not have an active Client Portal account. Provision or create Client Portal access for this email before impersonating.",
                              );
                            }
                          }}
                          className="w-full text-left px-2 py-1.5 text-xs hover:bg-blue-50 transition-colors text-blue-600"
                        >
                          Impersonate
                        </button>
                      )}
                      <button onClick={() => { setArchiveTarget(user); setRowMenu(null); }} className="w-full text-left px-2 py-1.5 text-xs hover:bg-gray-50 transition-colors text-orange-500">Archive User</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {impersonationTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={() => setImpersonationTarget(null)}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-gray-900">Impersonate Client User?</h2>
            <p className="mt-3 text-sm text-gray-600">You are about to enter the NIDO Client Portal as:</p>
            <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-sm font-semibold text-gray-900">{impersonationTarget.name}</p>
              <p className="text-xs text-gray-500">{impersonationTarget.email}</p>
              <p className="text-xs text-gray-500">{clientName || "Client portal"}</p>
            </div>
            <p className="mt-3 text-xs text-amber-700">The session is view-only and expires automatically after one hour.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setImpersonationTarget(null)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600">Cancel</button>
              <button
                onClick={() => {
                  const target = getPortalTarget(impersonationTarget);
                  if (target && startImpersonation(target)) window.location.assign("/portal/dashboard");
                  else setImpersonationTarget(null);
                }}
                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
              >
                Start Impersonation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
