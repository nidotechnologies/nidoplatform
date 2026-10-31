import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ShieldCheck, Plus, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  getPortalRoles,
  savePortalRoles,
  getPortalUsersByClient,
  updatePortalUser,
  PORTAL_MODULES,
  PORTAL_MODULE_CATALOG,
  getPortalModuleDescription,
  createPortalRolePermission,
  type PortalRole,
  type PortalRolePermission,
} from '@/lib/portalUserStore';

const Tick = ({ v }: { v: boolean }) =>
  v ? <Check size={14} className="text-green-600" /> : <X size={14} className="text-gray-300" />;

export default function ClientPortalRolesPage() {
  const { user } = useAuth();
  const clientId = user?.clientId ?? '';
  const isAdmin = user?.userType === 'client_admin' || user?.userType === 'nido_admin';

  const [roles, setRoles] = useState<PortalRole[]>(() => getPortalRoles(clientId));
  const [selected, setSelected] = useState<PortalRole | null>(roles[0] ?? null);
  const [showAdd, setShowAdd] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [moduleToAdd, setModuleToAdd] = useState('');

  useEffect(() => {
    const refresh = () => {
      const next = getPortalRoles(clientId);
      setRoles(next);
      setSelected(current => current ? next.find(r => r.id === current.id) ?? next[0] ?? null : next[0] ?? null);
    };
    window.addEventListener('nidoPortalRolesUpdated', refresh);
    window.addEventListener('nidoPortalUsersUpdated', refresh);
    return () => {
      window.removeEventListener('nidoPortalRolesUpdated', refresh);
      window.removeEventListener('nidoPortalUsersUpdated', refresh);
    };
  }, [clientId]);

  const handleAddRole = () => {
    if (!newRoleName.trim()) return;
    const r: PortalRole = {
      id: `r-${Date.now()}`,
      name: newRoleName.trim(),
      description: newRoleDesc.trim(),
      status: 'active',
      permissions: [],
    };
    const updated = [...roles, r];
    setRoles(updated);
    savePortalRoles(clientId, updated);
    setSelected(r);
    setShowAdd(false);
    setNewRoleName('');
    setNewRoleDesc('');
  };

  const togglePerm = (roleId: string, module: string, perm: keyof Omit<PortalRolePermission, 'module'>) => {
    if (!isAdmin || perm === 'module') return;
    const updated = roles.map(r => {
      if (r.id !== roleId) return r;
      return {
        ...r,
        permissions: r.permissions.map(p =>
          p.module === module ? { ...p, [perm]: !p[perm as keyof PortalRolePermission] } : p
        ),
      };
    });
    setRoles(updated);
    savePortalRoles(clientId, updated);
    setSelected(updated.find(r => r.id === roleId) ?? null);
  };

  const editRole = (role: PortalRole) => {
    if (!isAdmin) return;
    const name = window.prompt('Role name', role.name);
    if (!name?.trim()) return;
    const description = window.prompt('Role description', role.description);
    const updated = roles.map(item => item.id === role.id
      ? { ...item, name: name.trim(), description: description?.trim() ?? item.description }
      : item);
    savePortalRoles(clientId, updated);
    setRoles(updated);
    setSelected(updated.find(item => item.id === role.id) ?? null);
    if (name.trim() !== role.name) {
      getPortalUsersByClient(clientId)
        .filter(user => user.role === role.name)
        .forEach(user => updatePortalUser(user.id, { role: name.trim() }));
    }
  };

  const addModule = () => {
    if (!isAdmin || !selected || !moduleToAdd) return;
    const updated = roles.map(role => role.id !== selected.id
      ? role
      : role.permissions.some(permission => permission.module === moduleToAdd)
        ? role
        : { ...role, permissions: [...role.permissions, createPortalRolePermission(moduleToAdd)] });
    savePortalRoles(clientId, updated);
    setRoles(updated);
    setSelected(updated.find(role => role.id === selected.id) ?? null);
    setModuleToAdd('');
  };

  const toggleRoleStatus = (roleId: string) => {
    if (!isAdmin) return;
    const updated = roles.map(role => role.id === roleId
      ? { ...role, status: role.status === 'active' ? 'inactive' as const : 'active' as const }
      : role);
    savePortalRoles(clientId, updated);
    setRoles(updated);
    setSelected(updated.find(role => role.id === roleId) ?? null);
  };

  const deleteRole = (role: PortalRole) => {
    if (!isAdmin) return;
    const assigned = getPortalUsersByClient(clientId).filter(user => user.role === role.name).length;
    if (assigned > 0) {
      window.alert(`Cannot delete "${role.name}". Reassign ${assigned} user${assigned === 1 ? '' : 's'} first.`);
      return;
    }
    if (!window.confirm(`Delete the role "${role.name}"? This cannot be undone.`)) return;
    const updated = roles.filter(item => item.id !== role.id);
    savePortalRoles(clientId, updated);
    setRoles(updated);
    setSelected(updated[0] ?? null);
  };

  return (
    <div className="min-h-screen bg-white p-6">
      {/* Header */}
      <div className="bg-transparent border-b border-gray-200/70 mb-8">
        <div className="max-w-7xlpx-2 py-2 flex justify-between items-start">
          <div>
            <p className="text-xs text-gray-500">Portal / Roles</p>
            <h1 className="text-2xl font-bold">Roles & Permissions</h1>
            <p className="text-sm text-gray-500">{user?.clientName}</p>
          </div>
          {isAdmin && (
            <Button onClick={() => setShowAdd(true)} className="flex items-center gap-2">
              <Plus size={16} /> Add Role
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-7xlpx-2 flex gap-6">
        {/* Role List */}
        <div className="w-64 shrink-0">
          <div className="space-y-1">
            {roles.map(r => (
              <button
                key={r.id}
                onClick={() => setSelected(r)}
                className={`w-full text-left px-2 py-2 rounded-xl text-sm transition-all ${
                  selected?.id === r.id
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck size={15} className={selected?.id === r.id ? 'text-blue-600' : 'text-gray-400'} />
                   {r.name}
                   <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] ${r.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                     {r.status === 'active' ? 'Active' : 'Inactive'}
                   </span>
                </div>
                {r.description && (
                  <p className="text-xs text-gray-400 mt-0.5 pl-[23px] truncate">{r.description}</p>
                )}
                {isAdmin && (
                  <span className="flex gap-2 pl-[23px] mt-1 text-[11px]">
                     <span
                      className="text-blue-600 hover:underline"
                      onClick={(event) => { event.stopPropagation(); editRole(r); }}
                    >Edit</span>
                    <span
                      className="text-gray-600 hover:underline"
                      onClick={(event) => { event.stopPropagation(); toggleRoleStatus(r.id); }}
                    >{r.status === 'active' ? 'Deactivate' : 'Activate'}</span>
                    <span
                      className="text-red-600 hover:underline"
                      onClick={(event) => { event.stopPropagation(); deleteRole(r); }}
                    >Delete</span>
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Permissions Table */}
        {selected && (
          <div className="flex-1">
            <Card>
              <CardContent className="p-0">
                <div className="px-6 py-2 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900">{selected.name}</h2>
                  {selected.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{selected.description}</p>
                  )}
                </div>
                <div className="px-6 py-2 flex items-center gap-2 border-b border-gray-100 bg-gray-50">
                  <select
                    value={moduleToAdd}
                    onChange={event => setModuleToAdd(event.target.value)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                    disabled={!isAdmin}
                  >
                    <option value="">Add module...</option>
                    {PORTAL_MODULE_CATALOG.map(module => {
                      const alreadyAdded = selected.permissions.some(permission => permission.module === module.name);
                      return (
                        <option key={module.name} value={module.name} disabled={alreadyAdded}>
                          {module.name} — {module.description}{alreadyAdded ? " (already added)" : ""}
                        </option>
                      );
                    })}
                  </select>
                  <Button variant="outline" size="sm" onClick={addModule} disabled={!isAdmin || !moduleToAdd}>
                    Add Module
                  </Button>
                  <span className="text-[11px] text-gray-400 ml-auto">
                    {selected.permissions.length} of {PORTAL_MODULES.length} modules
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b text-xs text-gray-500">
                      <th className="px-6 py-2 text-left">Module</th>
                      <th className="px-6 py-2 text-left">Details</th>
                      <th className="px-6 py-2 text-center">View</th>
                      <th className="px-6 py-2 text-center">Create</th>
                      <th className="px-6 py-2 text-center">Edit</th>
                      <th className="px-6 py-2 text-center">Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.permissions.map(p => (
                      <tr key={p.module} className="border-b last:border-b-0 hover:bg-gray-50">
                        <td className="px-6 py-2 font-medium text-gray-800">{p.module}</td>
                        <td className="px-6 py-2 text-xs text-gray-500">{getPortalModuleDescription(p.module)}</td>
                        {(['view', 'create', 'edit', 'delete'] as const).map(perm => (
                          <td
                            key={perm}
                            className="px-6 py-2 text-center"
                            onClick={() => togglePerm(selected.id, p.module, perm)}
                          >
                            <span className={isAdmin ? 'cursor-pointer' : ''}>
                              <Tick v={p[perm] as boolean} />
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {isAdmin && (
                  <div className="px-6 py-2 bg-gray-50 border-t rounded-b-xl">
                    <p className="text-xs text-gray-400">Click any permission cell to toggle it.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Add Role Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Add Role</h2>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role Name</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newRoleName}
                  onChange={e => setNewRoleName(e.target.value)}
                  placeholder="e.g. Department Head"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newRoleDesc}
                  onChange={e => setNewRoleDesc(e.target.value)}
                  placeholder="Brief description (optional)"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={handleAddRole}>Create Role</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
