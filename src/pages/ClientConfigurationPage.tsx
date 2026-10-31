import { useEffect, useState } from "react";
import { Filter, X, UserPlus, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "./ClientUsersPage";
import ClientPricingSettingsPanel from "./ClientPricingSettingsTabsPanel";
import { getPortalRoles, getPortalUsersByClient, updatePortalUser, type PortalUser } from "@/lib/portalUserStore";
import {
  getClientGeneralSettings,
  saveClientGeneralSettings,
  type ClientGeneralSettings,
} from "@/lib/clientConfigurationStore";

type InviteUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "Active" | "Inactive";
  initials: string;
  color: string;
};

function toInviteUser(user: PortalUser): InviteUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status === "active" ? "Active" : "Inactive",
    initials: user.name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase() || "U",
    color: "bg-blue-500",
  };
}

export default function ClientConfigurationPage({ clientId = "CLI-DEFAULT" }: { clientId?: string }) {
  const [configTab, setConfigTab] = useState("General");
  const configTabs = ["General", "Price Setting", "Invite Users"];

  const [savedNotifications, setSavedNotifications] = useState<ClientGeneralSettings>(
    () => getClientGeneralSettings(clientId),
  );
  const [notifications, setNotifications] = useState<ClientGeneralSettings>(
    () => getClientGeneralSettings(clientId),
  );

  useEffect(() => {
    const saved = getClientGeneralSettings(clientId);
    setSavedNotifications(saved);
    setNotifications(saved);
  }, [clientId]);

  const hasUnsavedGeneralChanges =
    JSON.stringify(notifications) !== JSON.stringify(savedNotifications);

  const toggle = (key: keyof typeof notifications) =>
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));

  const saveGeneralSettings = () => {
    saveClientGeneralSettings(clientId, notifications);
    setSavedNotifications(notifications);
    toast.success("Client settings saved");
  };

  // Invite Users state
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteRoleFilter, setInviteRoleFilter] = useState("All Roles");
  const [inviteRoleOpen, setInviteRoleOpen] = useState(false);
  const [selectedInvites, setSelectedInvites] = useState<Set<string>>(new Set());
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [showInviteConfirm, setShowInviteConfirm] = useState(false);
  const [portalUsers, setPortalUsers] = useState<InviteUser[]>(() =>
    getPortalUsersByClient(clientId).map(toInviteUser),
  );

  useEffect(() => {
    const refresh = () => setPortalUsers(getPortalUsersByClient(clientId).map(toInviteUser));
    refresh();
    window.addEventListener("nidoPortalUsersUpdated", refresh);
    window.addEventListener("nidoPortalRolesUpdated", refresh);
    return () => {
      window.removeEventListener("nidoPortalUsersUpdated", refresh);
      window.removeEventListener("nidoPortalRolesUpdated", refresh);
    };
  }, [clientId]);

  const uniqueRoles = ["All Roles", ...getPortalRoles(clientId).filter((role) => role.status === "active").map((role) => role.name)];

  const inviteFiltered = portalUsers.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(inviteSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(inviteSearch.toLowerCase()) ||
      u.role.toLowerCase().includes(inviteSearch.toLowerCase());
    const matchRole = inviteRoleFilter === "All Roles" || u.role === inviteRoleFilter;
    return matchSearch && matchRole;
  });

  const allSelectableIds = inviteFiltered.filter((u) => !invitedIds.has(u.id)).map((u) => u.id);
  const allSelected = allSelectableIds.length > 0 && allSelectableIds.every((id) => selectedInvites.has(id));

  const toggleSelectAll = () => {
    setSelectedInvites((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        allSelectableIds.forEach((id) => next.delete(id));
      } else {
        allSelectableIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleInvite = (id: string) => {
    setSelectedInvites((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const confirmAndSendInvites = () => {
    // This is the local-mode equivalent of sending an invitation: selected
    // portal accounts become active in the canonical store immediately.
    selectedInvites.forEach(id => updatePortalUser(id, { status: "active" }));
    setInvitedIds((prev) => new Set([...prev, ...selectedInvites]));
    setSelectedInvites(new Set());
    setShowInviteConfirm(false);
  };

  return (
    <div className="p-5 flex flex-col gap-4">
      <h2 className="text-base font-semibold text-gray-900">Configuration</h2>

      {/* Inner tabs */}
      <div className="flex border-b border-gray-100 -mt-2">
        {configTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setConfigTab(tab)}
            className={`px-4 py-2.5 text-xs font-medium transition-colors relative ${
              configTab === tab ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab}
            {configTab === tab && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />}
          </button>
        ))}
      </div>

      {configTab === "General" && (
        <div className="flex flex-col gap-0">
          {/* API Settings */}
          <div className="pb-5 border-b border-gray-100">
            <p className="text-xs font-semibold text-blue-600 mb-3">API Settings</p>
            <p className="text-xs text-gray-500">
              API key management is not configured for this client.
            </p>
          </div>

          {/* Notifications */}
          <div className="py-5 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-800 mb-3">Notifications</p>
            <div className="flex flex-col gap-2.5">
              {[
                { key: "emailOrders" as const, label: "Email notifications for orders" },
                { key: "emailServices" as const, label: "Email notifications for services" },
                { key: "sms" as const, label: "SMS notifications" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={notifications[key]} onChange={() => toggle(key)} className="w-4 h-4 rounded border-gray-300 accent-blue-600 cursor-pointer" />
                  <span className="text-xs text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Danger Zone */}
          <div className="pt-5">
            <p className="text-xs font-semibold text-gray-800 mb-3">Danger Zone</p>
            <button className="px-3 py-1.5 text-xs border border-red-400 text-red-500 rounded-lg hover:bg-red-50 transition-colors">
              Archive Client
            </button>
          </div>

          <div className="mt-5 flex justify-end border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={saveGeneralSettings}
              disabled={!hasUnsavedGeneralChanges}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save Changes
            </button>
          </div>
        </div>
      )}

      <div className={configTab === "Price Setting" ? "flex flex-col" : "hidden"}>
          <ClientPricingSettingsPanel clientId={clientId} />
      </div>

      {configTab === "Invite Users" && (
        <div className="flex flex-col gap-4" onClick={() => setInviteRoleOpen(false)}>
          {/* Invite confirmation popup */}
          {showInviteConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowInviteConfirm(false)}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
                <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-gray-900">Confirm Invitation</h2>
                  <button onClick={() => setShowInviteConfirm(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                    <X size={15} />
                  </button>
                </div>
                <div className="px-6 py-2 flex flex-col gap-4">
                  <p className="text-xs text-gray-500">
                    You are about to send invitations to <span className="font-semibold text-gray-800">{selectedInvites.size} user{selectedInvites.size > 1 ? "s" : ""}</span>. They will receive an email with access instructions.
                  </p>
                  <div className="border border-gray-100 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    {portalUsers.filter((u) => selectedInvites.has(u.id)).map((user, i) => (
                      <div key={user.id} className={`flex items-center gap-3 px-2 py-2.5 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                        <div className={`w-6 h-6 rounded-full ${user.color} flex items-center justify-center text-white text-[9px] font-bold shrink-0`}>{user.initials}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">{user.name}</p>
                          <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
                        </div>
                        <span className="text-[10px] text-gray-500 shrink-0">{user.role}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="px-6 py-2 border-t border-gray-100 flex items-center justify-end gap-3">
                  <button onClick={() => setShowInviteConfirm(false)} className="px-4 py-2 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                  <button onClick={confirmAndSendInvites} className="px-4 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-1.5">
                    <UserPlus size={12} /> Send Invitation{selectedInvites.size > 1 ? "s" : ""}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div>
            <p className="text-xs text-gray-500">Search and select users to invite to this client. Invited users will receive an email with access instructions.</p>
          </div>

          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              value={inviteSearch}
              onChange={(e) => setInviteSearch(e.target.value)}
              placeholder="Search by name, email or role..."
              className="w-full pl-8 pr-4 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder-gray-400"
            />
          </div>

          {/* Role filter */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setInviteRoleOpen((v) => !v)}
              className="flex items-center gap-2 px-2 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
              Filter by Role: <span className="text-blue-600 font-medium">{inviteRoleFilter}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {inviteRoleOpen && (
              <div className="absolute left-0 top-9 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-20 min-w-[160px]">
                {uniqueRoles.map((role) => (
                  <button
                    key={role}
                    onClick={() => { setInviteRoleFilter(role); setInviteRoleOpen(false); }}
                    className={`w-full text-left px-2 py-1.5 text-xs hover:bg-gray-50 transition-colors ${inviteRoleFilter === role ? "text-blue-600 font-medium" : "text-gray-700"}`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* User list */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            {inviteFiltered.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-8">No users match your search.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="w-10 px-2 py-2.5">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 accent-blue-600 cursor-pointer"
                        title="Select all"
                      />
                    </th>
                    <th className="text-left px-2 py-2.5 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">User</th>
                    <th className="text-left px-2 py-2.5 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Email</th>
                    <th className="text-left px-2 py-2.5 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Role <Filter size={9} className="inline ml-0.5 text-gray-400" /></th>
                    <th className="text-left px-2 py-2.5 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Status <Filter size={9} className="inline ml-0.5 text-gray-400" /></th>
                  </tr>
                </thead>
                <tbody>
                  {inviteFiltered.map((user, i) => {
                    const invited = invitedIds.has(user.id);
                    return (
                      <tr key={user.id} className={`border-b border-gray-100 last:border-0 transition-colors ${selectedInvites.has(user.id) ? "bg-blue-50/40" : i % 2 === 0 ? "bg-white" : "bg-gray-50/20"} ${invited ? "opacity-50" : "hover:bg-gray-50/60"}`}>
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={selectedInvites.has(user.id)}
                            disabled={invited}
                            onChange={() => toggleInvite(user.id)}
                            className="rounded border-gray-300 accent-blue-600 cursor-pointer disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full ${user.color} flex items-center justify-center text-white text-[9px] font-bold shrink-0`}>{user.initials}</div>
                            <span className="font-medium text-gray-800">{user.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-gray-500">{user.email}</td>
                        <td className="px-3 py-2.5 text-gray-600">{user.role}</td>
                        <td className="px-3 py-2.5">
                          {invited
                            ? <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full"><CheckCircle size={10} /> Invited</span>
                            : <StatusBadge status={user.status} />
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-gray-400">
              {selectedInvites.size > 0 ? `${selectedInvites.size} user${selectedInvites.size > 1 ? "s" : ""} selected` : "Select users above to invite"}
            </p>
            <button
              onClick={() => selectedInvites.size > 0 && setShowInviteConfirm(true)}
              disabled={selectedInvites.size === 0}
              className="px-4 py-2 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center gap-1.5"
            >
              <UserPlus size={12} /> Invite User{selectedInvites.size > 1 ? "s" : ""}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
