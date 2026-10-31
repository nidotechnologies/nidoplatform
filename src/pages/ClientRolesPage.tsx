import { useEffect, useState, type ChangeEvent } from "react";
import { useParams } from "react-router-dom";
import { MoreVertical, X } from "lucide-react";
import {
  createPortalRolePermission,
  getPortalModuleDescription,
  getPortalRoles,
  getPortalUsersByClient,
  PORTAL_MODULE_CATALOG,
  PORTAL_MODULES,
  savePortalRoles,
  updatePortalUser,
  type PortalRole,
  type PortalRolePermission,
  type PortalUser,
} from "@/lib/portalUserStore";

const CLIENT_ACTIONS: Array<keyof Omit<PortalRolePermission, "module">> = [
  "view", "create", "edit", "delete", "approve", "export", "import", "manage", "configure",
];

const CLIENT_PERMISSION_CSV_COLUMNS = [
  "role_name", "description", "status", "module", "module_description",
  ...CLIENT_ACTIONS,
] as const;

function csvEscape(value: string | boolean): string {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(value.trim());
      if (row.some(cell => cell.length > 0)) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  if (quoted) throw new Error("The CSV contains an unclosed quote.");
  if (value.length > 0 || row.length > 0) {
    row.push(value.trim());
    if (row.some(cell => cell.length > 0)) rows.push(row);
  }
  return rows;
}

function parseCsvBoolean(value: string, rowNumber: number, column: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (["true", "yes", "1"].includes(normalized)) return true;
  if (["false", "no", "0", ""].includes(normalized)) return false;
  throw new Error(`Row ${rowNumber}: ${column} must be true or false.`);
}

function downloadCsv(filename: string, rows: string[][]): void {
  const blob = new Blob([rows.map(row => row.join(",")).join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ClientRolesPage() {
  const { id: routeClientId } = useParams<{ id: string }>();
  const clientId = routeClientId || localStorage.getItem("nido_shop_selected_client") || "";
  const [roles, setRoles] = useState<PortalRole[]>(() => getPortalRoles(clientId));
  const [portalUsers, setPortalUsers] = useState<PortalUser[]>(() => getPortalUsersByClient(clientId));
  const [selectedId, setSelectedId] = useState(roles[0]?.id || "");
  const [showAddRole, setShowAddRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [moduleToAdd, setModuleToAdd] = useState("");
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [draftRole, setDraftRole] = useState<PortalRole | null>(null);

  useEffect(() => {
    const refresh = () => {
      const nextRoles = getPortalRoles(clientId);
      setRoles(nextRoles);
      setPortalUsers(getPortalUsersByClient(clientId));
      setSelectedId(current => nextRoles.some(role => role.id === current)
        ? current
        : nextRoles[0]?.id || "");
    };
    const handleStorage = (event: StorageEvent) => {
      if (
        event.key === null ||
        event.key === "nido_portal_users" ||
        event.key === `nido_portal_roles_${clientId}`
      ) refresh();
    };

    refresh();
    window.addEventListener("nidoPortalRolesUpdated", refresh);
    window.addEventListener("nidoPortalUsersUpdated", refresh);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("nidoPortalRolesUpdated", refresh);
      window.removeEventListener("nidoPortalUsersUpdated", refresh);
      window.removeEventListener("storage", handleStorage);
    };
  }, [clientId]);

  const selected = roles.find(role => role.id === selectedId) || null;
  const displayedRole = draftRole || selected;
  const isEditing = Boolean(draftRole);

  const persist = (next: PortalRole[]) => {
    setRoles(next);
    savePortalRoles(clientId, next);
  };

  const togglePermission = (
    module: string,
    action: keyof Omit<PortalRolePermission, "module">,
  ) => {
    if (!draftRole) return;
    setDraftRole({
      ...draftRole,
      permissions: draftRole.permissions.map(permission =>
        permission.module === module
          ? { ...permission, [action]: !permission[action] }
          : permission,
      ),
    });
  };

  const addModule = () => {
    if (!draftRole || !moduleToAdd) return;
    if (!draftRole.permissions.some(item => item.module === moduleToAdd)) {
      setDraftRole({
        ...draftRole,
        permissions: [...draftRole.permissions, createPortalRolePermission(moduleToAdd)],
      });
    }
    setModuleToAdd("");
  };

  const addRole = () => {
    const name = newRoleName.trim();
    if (!name || roles.some(role => role.name.toLowerCase() === name.toLowerCase())) {
      if (name) window.alert("A role with this name already exists for this client.");
      return;
    }
    const role: PortalRole = {
      id: `client-role-${Date.now()}`,
      name,
      description: newRoleDescription.trim(),
      status: "active",
      permissions: [],
    };
    persist([...roles, role]);
    setSelectedId(role.id);
    setNewRoleName("");
    setNewRoleDescription("");
    setShowAddRole(false);
  };

  const beginEditing = (role: PortalRole) => {
    setDraftRole({
      ...role,
      permissions: role.permissions.map(permission => ({ ...permission })),
    });
  };

  const saveDraftRole = () => {
    if (!draftRole || !draftRole.name.trim()) return;
    const normalizedDraft = {
      ...draftRole,
      name: draftRole.name.trim(),
      description: draftRole.description.trim(),
    };
    const duplicate = roles.some(role =>
      role.id !== normalizedDraft.id &&
      role.name.toLowerCase() === normalizedDraft.name.toLowerCase(),
    );
    if (duplicate) {
      window.alert("A role with this name already exists for this client.");
      return;
    }

    const previous = roles.find(role => role.id === normalizedDraft.id);
    if (!previous) return;
    persist(roles.map(role => role.id === normalizedDraft.id ? normalizedDraft : role));
    if (previous.name !== normalizedDraft.name) {
      portalUsers
        .filter(user => user.role === previous.name)
        .forEach(user => updatePortalUser(user.id, { role: normalizedDraft.name }));
    }
    setDraftRole(null);
  };

  const discardDraftRole = () => {
    setDraftRole(null);
    setModuleToAdd("");
  };

  const downloadCsvTemplate = () => {
    setShowActionsMenu(false);
    const rows = [
      CLIENT_PERMISSION_CSV_COLUMNS.map(column => csvEscape(column)),
      ...PORTAL_MODULE_CATALOG.map(module => [
        "New Client Role",
        "Replace with your role description",
        "active",
        module.name,
        module.description,
        ...CLIENT_ACTIONS.map(() => false),
      ].map(value => csvEscape(value))),
    ];
    downloadCsv("client-role-permissions-template.csv", rows);
  };

  const exportRolesCsv = () => {
    setShowActionsMenu(false);
    const rows = [CLIENT_PERMISSION_CSV_COLUMNS.map(column => csvEscape(column))];
    roles.forEach(role => {
      const permissions: Array<PortalRolePermission | null> = role.permissions.length
        ? role.permissions
        : [null];
      permissions.forEach(permission => {
        rows.push([
          role.name,
          role.description,
          role.status,
          permission?.module || "",
          permission ? getPortalModuleDescription(permission.module) : "",
          ...CLIENT_ACTIONS.map(action => Boolean(permission?.[action])),
        ].map(value => csvEscape(value)));
      });
    });
    downloadCsv("client-role-permissions.csv", rows);
  };

  const handleBulkUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    setShowActionsMenu(false);
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const rows = parseCsv(await file.text());
      if (rows.length < 2) throw new Error("The CSV must contain a header and at least one role row.");

      const header = rows[0].map(cell => cell.toLowerCase());
      const missingColumns = CLIENT_PERMISSION_CSV_COLUMNS.filter(column => !header.includes(column));
      if (missingColumns.length > 0) {
        throw new Error(`Missing CSV columns: ${missingColumns.join(", ")}.`);
      }

      const columnIndex = Object.fromEntries(header.map((column, index) => [column, index]));
      const moduleByName = new Map(PORTAL_MODULES.map(module => [module.toLowerCase(), module]));
      const imported = new Map<string, {
        name: string;
        description: string;
        status: "active" | "inactive";
        permissions: Map<string, PortalRolePermission>;
      }>();

      rows.slice(1).forEach((cells, index) => {
        const rowNumber = index + 2;
        const roleName = cells[columnIndex.role_name]?.trim();
        const rawModule = (cells[columnIndex.module] || "").trim();
        const moduleName = rawModule ? moduleByName.get(rawModule.toLowerCase()) : undefined;
        if (!roleName) throw new Error(`Row ${rowNumber}: role_name is required.`);
        if (rawModule && !moduleName) {
          throw new Error(`Row ${rowNumber}: module must be one of ${PORTAL_MODULES.join(", ")}.`);
        }

        const rawStatus = (cells[columnIndex.status] || "active").trim().toLowerCase();
        if (rawStatus !== "active" && rawStatus !== "inactive") {
          throw new Error(`Row ${rowNumber}: status must be active or inactive.`);
        }

        const permission = createPortalRolePermission(moduleName || "", Object.fromEntries(
          CLIENT_ACTIONS.map(action => [
            action,
            parseCsvBoolean(cells[columnIndex[action]] || "", rowNumber, action),
          ]),
        ) as Partial<PortalRolePermission>);
        if (!moduleName && CLIENT_ACTIONS.some(action => permission[action])) {
          throw new Error(`Row ${rowNumber}: a module is required when permissions are enabled.`);
        }

        const roleKey = roleName.toLowerCase();
        const current = imported.get(roleKey) || {
          name: roleName,
          description: cells[columnIndex.description]?.trim() || "",
          status: rawStatus as "active" | "inactive",
          permissions: new Map<string, PortalRolePermission>(),
        };
        current.description = cells[columnIndex.description]?.trim() || current.description;
        current.status = rawStatus as "active" | "inactive";
        if (moduleName) current.permissions.set(moduleName, permission);
        imported.set(roleKey, current);
      });

      const existingByName = new Map(roles.map(role => [role.name.toLowerCase(), role]));
      const importedRoles = Array.from(imported.values()).map((incoming, index) => {
        const existing = existingByName.get(incoming.name.toLowerCase());
        return {
          id: existing?.id || `client-role-${Date.now()}-${index}`,
          name: incoming.name,
          description: incoming.description,
          status: incoming.status,
          permissions: [...incoming.permissions.values()].filter(permission =>
            CLIENT_ACTIONS.some(action => permission[action]),
          ),
        };
      });

      const updateCount = importedRoles.filter(role => existingByName.has(role.name.toLowerCase())).length;
      const createCount = importedRoles.length - updateCount;
      if (!window.confirm(
        `Import ${importedRoles.length} role${importedRoles.length === 1 ? "" : "s"} (${createCount} new, ${updateCount} updated)? Existing role permissions will be replaced by the CSV values.`,
      )) return;

      const importedByName = new Map(importedRoles.map(role => [role.name.toLowerCase(), role]));
      const untouchedRoles = roles.filter(role => !importedByName.has(role.name.toLowerCase()));
      const nextRoles = [...untouchedRoles, ...importedRoles];
      persist(nextRoles);
      setSelectedId(importedRoles[0]?.id || selectedId);
      window.alert(`Imported ${importedRoles.length} role${importedRoles.length === 1 ? "" : "s"} successfully.`);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not import the CSV file.");
    }
  };

  return (
    <div className="p-5 flex flex-col gap-5">
      <div className="flex items-start justify-between border-b border-gray-200 pb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Roles &amp; Permissions</h2>
          <p className="text-xs text-gray-500 mt-1">
            Saved roles and currently assigned users for this client account.
          </p>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowActionsMenu(open => !open)}
            aria-label="Role and permission actions"
            aria-expanded={showActionsMenu}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            <MoreVertical size={17} />
          </button>
          {showActionsMenu && (
            <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-gray-200 bg-white p-1.5 shadow-xl">
              <button
                type="button"
                onClick={() => { setShowActionsMenu(false); setShowAddRole(true); }}
                className="w-full rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                Add Role
              </button>
              <button
                type="button"
                onClick={downloadCsvTemplate}
                className="w-full rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                Download Template
              </button>
              <button
                type="button"
                onClick={exportRolesCsv}
                className="w-full rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                Export CSV
              </button>
              <label className="block w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
                Bulk Upload CSV
                <input type="file" accept=".csv,text/csv" onChange={handleBulkUpload} className="sr-only" />
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[240px_1fr] gap-5 max-[760px]:grid-cols-1">
        <div className="space-y-1">
          {roles.map(role => {
            const assigned = portalUsers.filter(user => user.role === role.name).length;
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => {
                  if (isEditing) {
                    if (!window.confirm("Discard unsaved role changes?")) return;
                    discardDraftRole();
                  }
                  setSelectedId(role.id);
                }}
                disabled={isEditing && role.id !== selectedId}
                className={`w-full text-left px-3 py-2.5 rounded-lg border ${selectedId === role.id ? "border-blue-300 bg-blue-50" : "border-transparent hover:bg-gray-50"}`}
              >
                <div className="text-sm font-medium text-gray-800">{role.name}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">
                  {assigned} assigned user{assigned === 1 ? "" : "s"}
                </div>
              </button>
            );
          })}
          {roles.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-300 p-5 text-center">
              <p className="text-sm font-medium text-gray-700">No roles configured</p>
              <p className="mt-1 text-xs text-gray-500">
                This client has no saved roles yet.
              </p>
              <button
                type="button"
                onClick={() => setShowAddRole(true)}
                className="mt-3 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
              >
                Create first role
              </button>
            </div>
          )}
        </div>

        {displayedRole ? (
          <div className="min-w-0 border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <input
                      value={displayedRole.name}
                      onChange={event => setDraftRole(current => current ? { ...current, name: event.target.value } : current)}
                      className="rounded-lg border border-blue-200 px-2 py-1 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      aria-label="Role name"
                    />
                  ) : (
                    <h3 className="text-sm font-semibold text-gray-900">{displayedRole.name}</h3>
                  )}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${displayedRole.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                    {displayedRole.status === "active" ? "Active" : "Inactive"}
                  </span>
                </div>
                {isEditing ? (
                  <textarea
                    value={displayedRole.description}
                    onChange={event => setDraftRole(current => current ? { ...current, description: event.target.value } : current)}
                    className="mt-1 w-full max-w-xl rounded-lg border border-blue-200 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    rows={2}
                    aria-label="Role description"
                  />
                ) : (
                  <p className="text-xs text-gray-500 mt-1">{displayedRole.description || "No description"}</p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {isEditing ? (
                  <>
                    <button type="button" onClick={discardDraftRole} className="text-xs text-gray-600 hover:underline">Cancel</button>
                    <button
                      type="button"
                      onClick={saveDraftRole}
                      disabled={!displayedRole.name.trim()}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40"
                    >
                      Save Changes
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => beginEditing(displayedRole)} className="text-xs text-blue-600 hover:underline">
                    Edit role
                  </button>
                )}
              </div>
            </div>

            <div className="px-4 py-3 flex flex-wrap items-center gap-2 border-b border-gray-100 bg-gray-50">
              <select
                value={moduleToAdd}
                onChange={event => setModuleToAdd(event.target.value)}
                disabled={!isEditing}
                className="max-w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                aria-label="Add module"
              >
                <option value="">Add module...</option>
                {PORTAL_MODULE_CATALOG.map(module => {
                  const alreadyAdded = displayedRole.permissions.some(item => item.module === module.name);
                  return (
                    <option key={module.name} value={module.name} disabled={alreadyAdded}>
                      {module.name} — {module.description}{alreadyAdded ? " (already added)" : ""}
                    </option>
                  );
                })}
              </select>
              <button
                type="button"
                onClick={addModule}
                disabled={!isEditing || !moduleToAdd}
                className="px-3 py-1.5 text-xs border border-blue-200 text-blue-600 rounded-lg disabled:opacity-40"
              >
                Add Module
              </button>
              {!isEditing && (
                <button type="button" onClick={() => beginEditing(displayedRole)} className="text-xs text-blue-600 hover:underline">
                  Edit Role to Change Permissions
                </button>
              )}
              {isEditing && (
                <button
                  type="button"
                  onClick={() => setDraftRole(current => current ? {
                    ...current,
                    status: current.status === "active" ? "inactive" : "active",
                  } : current)}
                  className="text-xs text-gray-600 hover:underline"
                >
                  {displayedRole.status === "active" ? "Deactivate" : "Activate"}
                </button>
              )}
              <span className="text-[11px] text-gray-400 ml-auto">
                {displayedRole.permissions.length} configured module{displayedRole.permissions.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500">MODULE</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-500">DETAILS</th>
                    {CLIENT_ACTIONS.map(action => (
                      <th key={action} className="text-center px-3 py-2.5 font-semibold text-gray-500 uppercase">{action}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayedRole.permissions.map((permission, index) => (
                    <tr key={permission.module} className={index % 2 ? "bg-gray-50/50" : "bg-white"}>
                      <td className="px-4 py-2.5 font-medium text-gray-700">{permission.module}</td>
                      <td className="px-3 py-2.5 text-[11px] text-gray-400 min-w-[220px]">
                        {getPortalModuleDescription(permission.module)}
                      </td>
                      {CLIENT_ACTIONS.map(action => (
                        <td key={action} className="text-center px-3 py-2.5">
                          <button
                            type="button"
                            disabled={!isEditing}
                            onClick={() => togglePermission(permission.module, action)}
                            aria-label={`${action} ${permission.module}`}
                            aria-pressed={Boolean(permission[action])}
                            className={`w-4 h-4 rounded-full border-2 inline-flex items-center justify-center ${permission[action] ? "bg-blue-600 border-blue-600" : "border-gray-300 hover:border-blue-300"} disabled:cursor-not-allowed disabled:opacity-60`}
                          >
                            {permission[action] && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                  {displayedRole.permissions.length === 0 && (
                    <tr>
                      <td colSpan={CLIENT_ACTIONS.length + 2} className="px-4 py-10 text-center text-sm text-gray-500">
                        No modules are configured for this role.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="px-4 py-3 text-[11px] text-gray-400 border-t border-gray-100">
              {isEditing
                ? "Changes are staged locally. Press Save Changes to update this role, or Cancel to discard them."
                : "Select Edit role to stage permission, module, status, name, and description changes."}
            </p>
          </div>
        ) : null}
      </div>

      {showAddRole && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-sm shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Add Client Role</h3>
              <button type="button" onClick={() => setShowAddRole(false)} aria-label="Close"><X size={18} /></button>
            </div>
            <input
              value={newRoleName}
              onChange={event => setNewRoleName(event.target.value)}
              placeholder="Role name"
              aria-label="New role name"
              className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
            />
            <textarea
              value={newRoleDescription}
              onChange={event => setNewRoleDescription(event.target.value)}
              placeholder="Description (optional)"
              aria-label="New role description"
              className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
              rows={3}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={() => setShowAddRole(false)} className="px-3 py-2 text-sm border rounded-lg">Cancel</button>
              <button
                type="button"
                onClick={addRole}
                disabled={!newRoleName.trim()}
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-40"
              >
                Create Role
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
