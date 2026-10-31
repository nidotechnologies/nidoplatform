import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getPortalUsersByClient,
  addPortalUser,
  updatePortalUser,
  deletePortalUser,
  getPortalRoleNames,
  getUsersWithInvalidPortalRoles,
  type PortalUser,
} from '@/lib/portalUserStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Users,
  Plus,
  MoreVertical,
  UserCheck,
  UserX,
  Trash2,
  KeyRound,
  X,
} from 'lucide-react';

interface UserFormState {
  name: string;
  email: string;
  password: string;
  role: string;
  userType: 'client_admin' | 'client_user';
}

const BLANK_FORM: UserFormState = {
  name: '',
  email: '',
  password: '',
  role: 'Employee',
  userType: 'client_user',
};

interface ClientPortalUsersPageProps {
  readOnly?: boolean;
}

export default function ClientPortalUsersPage({ readOnly = false }: ClientPortalUsersPageProps) {
  const { user } = useAuth();
  const clientId = user?.clientId ?? '';
  const clientName = user?.clientName ?? '';
  const isAdmin = user?.userType === 'client_admin' || user?.userType === 'nido_admin';
  const canManageUsers = isAdmin && !readOnly;

  const [users, setUsers] = useState<PortalUser[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [invalidRoleUsers, setInvalidRoleUsers] = useState<PortalUser[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UserFormState>(BLANK_FORM);
  const [resetTarget, setResetTarget] = useState<PortalUser | null>(null);
  const [newPwd, setNewPwd] = useState('');

  const refresh = () => {
    setUsers(getPortalUsersByClient(clientId));
    setRoles(getPortalRoleNames(clientId));
    setInvalidRoleUsers(getUsersWithInvalidPortalRoles(clientId));
  };

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener('nidoPortalUsersUpdated', handler);
    window.addEventListener('nidoPortalRolesUpdated', handler);
    return () => {
      window.removeEventListener('nidoPortalUsersUpdated', handler);
      window.removeEventListener('nidoPortalRolesUpdated', handler);
    };
  }, [clientId]);

  const openAdd = () => {
    setForm({ ...BLANK_FORM, role: getPortalRoleNames(clientId)[0] || BLANK_FORM.role });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (u: PortalUser) => {
    setForm({ name: u.name, email: u.email, password: u.password, role: u.role, userType: u.userType });
    setEditingId(u.id);
    setShowForm(true);
  };

  const handleSave = () => {
    const normalizedEmail = form.email.trim().toLowerCase();
    const duplicate = users.some(u =>
      u.id !== editingId && u.email.trim().toLowerCase() === normalizedEmail
    );
    if (!form.name.trim() || !normalizedEmail || !form.password.trim() || duplicate) return;

    if (editingId) {
      updatePortalUser(editingId, {
        name: form.name,
        email: normalizedEmail,
        password: form.password,
        role: form.role,
        userType: form.userType,
      });
    } else {
      const id = `portal-${clientId}-${Date.now()}`;
      addPortalUser({
        id,
        name: form.name,
         email: normalizedEmail,
        password: form.password,
        role: form.role,
        userType: form.userType,
        clientId,
        clientName,
        status: 'active',
        createdAt: new Date().toISOString(),
      });
    }
    setShowForm(false);
    refresh();
  };

  const handleToggle = (u: PortalUser) => {
    updatePortalUser(u.id, { status: u.status === 'active' ? 'inactive' : 'active' });
    refresh();
  };

  const handleDelete = (id: string) => {
    deletePortalUser(id);
    refresh();
  };

  const handleResetPassword = () => {
    if (!resetTarget || !newPwd.trim()) return;
    updatePortalUser(resetTarget.id, { password: newPwd });
    setResetTarget(null);
    setNewPwd('');
    refresh();
  };

  return (
    <div className="min-h-screen bg-white p-6">
      {/* Header */}
      <div className="bg-transparent border-b border-gray-200/70 mb-8">
        <div className="max-w-7xlpx-2 py-2 flex justify-between items-start">
          <div>
            <p className="text-xs text-gray-500">Portal / Users</p>
            <h1 className="text-2xl font-bold">Users</h1>
            <p className="text-sm text-gray-500">{clientName}</p>
          </div>
          {canManageUsers && (
            <Button onClick={openAdd} className="flex items-center gap-2">
              <Plus size={16} /> Add User
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-7xlpx-6">
        {invalidRoleUsers.length > 0 && (
          <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <strong>{invalidRoleUsers.length} user{invalidRoleUsers.length === 1 ? '' : 's'}</strong> have a role that is no longer present in this client’s role list:
            <span className="ml-1">{invalidRoleUsers.map(u => `${u.name} (${u.role})`).join(', ')}</span>.
            Update their role before they sign in so portal permissions are applied correctly.
          </div>
        )}
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-8">
          <Card>
            <CardContent className="p-6 flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="text-3xl font-bold mt-2">{users.length}</p>
              </div>
              <Users className="text-gray-400" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-600">Active</p>
                <p className="text-3xl font-bold text-green-600 mt-2">
                  {users.filter(u => u.status === 'active').length}
                </p>
              </div>
              <UserCheck className="text-green-400" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-600">Inactive</p>
                <p className="text-3xl font-bold text-red-600 mt-2">
                  {users.filter(u => u.status === 'inactive').length}
                </p>
              </div>
              <UserX className="text-red-400" />
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b text-xs text-gray-600">
                  <th className="px-6 py-2 text-left">Name</th>
                  <th className="px-6 py-2 text-left">Email</th>
                  <th className="px-6 py-2 text-left">Role</th>
                  <th className="px-6 py-2 text-left">Type</th>
                  <th className="px-6 py-2 text-left">Status</th>
                  <th className="px-6 py-2 text-left">Created</th>
                  {canManageUsers && <th className="px-6 py-2 text-center">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={canManageUsers ? 7 : 6} className="px-6 py-12 text-center text-gray-400 text-sm">
                      No users yet. {canManageUsers && 'Click "Add User" to create one.'}
                    </td>
                  </tr>
                ) : (
                  users.map(u => (
                    <tr key={u.id} className="border-b hover:bg-gray-50">
                      <td className="px-6 py-2 font-medium text-gray-900">{u.name}</td>
                      <td className="px-6 py-2 text-gray-600">{u.email}</td>
                      <td className="px-6 py-4">
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">{u.role}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-gray-500">
                          {u.userType === 'client_admin' ? 'Admin' : 'User'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          className={
                            u.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-600'
                          }
                        >
                          {u.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-2 text-xs text-gray-400">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      {canManageUsers && (
                        <td className="px-6 py-2 text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(u)}>
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggle(u)}>
                                {u.status === 'active' ? 'Disable' : 'Enable'}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => { setResetTarget(u); setNewPwd(''); }}
                                className="flex items-center gap-2"
                              >
                                <KeyRound size={14} /> Reset Password
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600 flex items-center gap-2"
                                onClick={() => handleDelete(u.id)}
                              >
                                <Trash2 size={14} /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* Add / Edit User Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold">{editingId ? 'Edit User' : 'Add User'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="jane@company.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="text"
                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Temporary password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                >
                   {roles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User Type</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.userType}
                  onChange={e => setForm(f => ({ ...f, userType: e.target.value as 'client_admin' | 'client_user' }))}
                >
                  <option value="client_user">Client User</option>
                  <option value="client_admin">Client Admin</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleSave}>
                {editingId ? 'Save Changes' : 'Create User'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Reset Password</h2>
              <button onClick={() => setResetTarget(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Set a new password for <strong>{resetTarget.name}</strong>.
            </p>
            <input
              type="text"
              className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              value={newPwd}
              onChange={e => setNewPwd(e.target.value)}
              placeholder="New password"
            />
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setResetTarget(null)}>Cancel</Button>
              <Button onClick={handleResetPassword}>Reset Password</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
