"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"
import {
  Search, Plus, Download, FileText, MoreHorizontal,
  Pencil, Trash2, Key, UserCheck, UserX, PauseCircle,
  MailPlus, AlertTriangle, Lock, Unlock, History, Eye, EyeOff,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import AddEditUserDialog from "./AddEditUserDialog"
import {
  type NidoUser, type NidoRole,
  getUsers, getRoles, addUser, updateUser, deleteUser, unlockUser,
  exportUsersCsv, exportUsersPdf,
  NIDO_ROLES_EVENT, NIDO_USERS_EVENT,
  MAX_FAILED_LOGIN_ATTEMPTS,
  isSystemOwner,
} from "@/lib/nidoUsersStore"

/** Returns true when a user should be treated as locked — covers both the explicit
 *  `locked` boolean and the case where failedLoginAttempts hit the threshold but
 *  the flag wasn't persisted (edge-case migration / stale read guard). */
function isUserLocked(user: NidoUser): boolean {
  return !!user.locked || (user.failedLoginAttempts ?? 0) >= MAX_FAILED_LOGIN_ATTEMPTS;
}

// ── Status badge ───────────────────────────────────────────────────────────────
function StatusBadge({ status, locked }: { status: NidoUser["status"]; locked?: boolean }) {
  if (locked) {
    return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Locked</Badge>;
  }
  const cls =
    status === "Active"   ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
    status === "Suspended"? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                            "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400";
  return <Badge className={cls}>{status}</Badge>;
}

// ── Reset Password dialog ──────────────────────────────────────────────────────
export function ResetPasswordDialog({
  user, open, onOpenChange,
}: { user: NidoUser | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [newPw, setNewPw] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => { if (open) { setNewPw(""); setErr(""); } }, [open]);

  const handleSave = () => {
    if (newPw.length < 6) { setErr("Password must be at least 6 characters."); return; }
    if (user) {
      updateUser(user.id, { password: newPw, forcePasswordChange: false });
      toast.success("Password reset", { description: `${user.name}'s password has been updated.` });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Key size={18} /> Reset Password</DialogTitle>
          <DialogDescription>Set a new password for <strong>{user?.name}</strong>.</DialogDescription>
        </DialogHeader>
        <div>
          <Label className="mb-2 block text-sm font-medium">New Password</Label>
          <Input
            type="password"
            value={newPw}
            onChange={e => { setNewPw(e.target.value); setErr(""); }}
            placeholder="Minimum 6 characters"
          />
          {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Reset Password</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── View Login History dialog ──────────────────────────────────────────────────
export function LoginHistoryDialog({
  user, open, onOpenChange,
}: { user: NidoUser | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const history = [...(user?.loginHistory ?? [])].reverse();
  const resultLabel: Record<string, string> = {
    success: "Signed in",
    invalid_password: "Failed — wrong password",
    inactive: "Blocked — account disabled",
    suspended: "Blocked — account suspended",
    locked: "Blocked — account locked",
  };
  const resultCls: Record<string, string> = {
    success: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    invalid_password: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    inactive: "bg-muted text-muted-foreground",
    suspended: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    locked: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><History size={18} /> Login History</DialogTitle>
          <DialogDescription>Recent sign-in attempts for <strong>{user?.name}</strong>.</DialogDescription>
        </DialogHeader>
        <div className="max-h-80 overflow-y-auto space-y-2">
          {history.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">No login history recorded yet.</p>
          )}
          {history.map((h, idx) => (
            <div key={idx} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
              <span className="text-sm text-muted-foreground">{new Date(h.timestamp).toLocaleString()}</span>
              <Badge className={resultCls[h.result] ?? "bg-muted text-muted-foreground"}>
                {resultLabel[h.result] ?? h.result}
              </Badge>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Per-row actions dropdown ───────────────────────────────────────────────────
export function ActionsMenu({
  user,
  onEdit,
  onRefresh,
}: { user: NidoUser; onEdit: () => void; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 16 });
  const [resetPwOpen, setResetPwOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [invitationSentOpen, setInvitationSentOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const menuHeight = 390;
      const opensAbove = rect.bottom + menuHeight + 4 > window.innerHeight;
      setMenuPosition({
        top: opensAbove
          ? Math.max(8, rect.top - menuHeight - 4)
          : rect.bottom + 4,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    };
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!ref.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    updatePosition();
    document.addEventListener("mousedown", close);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const act = (fn: () => void) => { fn(); setOpen(false); };

  const handleStatus = (status: NidoUser["status"]) => {
    updateUser(user.id, { status });
    onRefresh();
    toast.success(`User ${status === "Active" ? "enabled" : status === "Inactive" ? "disabled" : "suspended"}`,
      { description: `${user.name} is now ${status}.` });
  };

  const handleForcePasswordChange = () => {
    updateUser(user.id, { forcePasswordChange: true });
    onRefresh();
    toast.success("Force password change set", { description: `${user.name} will be prompted to change their password on next login.` });
  };

  const handleSendInvitation = () => {
    setInvitationSentOpen(true);
  };

  const handleUnlock = () => {
    unlockUser(user.id);
    onRefresh();
    toast.success("Account unlocked", { description: `${user.name} can now sign in again.` });
  };

  const handleDelete = () => {
    setDeleteOpen(true);
  };

  const confirmDelete = () => {
    deleteUser(user.id);
    onRefresh();
    setDeleteOpen(false);
    toast.success("User removed");
  };

  const itemCls = "w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-foreground hover:bg-muted rounded transition-colors cursor-pointer";

  return (
    <>
      <div className="relative" ref={ref}>
        <Button
          ref={triggerRef}
          variant="ghost"
          size="icon"
          aria-label={`Actions for ${user.name}`}
          aria-expanded={open}
          onClick={() => setOpen(v => !v)}
        >
          <MoreHorizontal size={16} />
        </Button>

        {open && createPortal(
          <div
            ref={menuRef}
            className="fixed max-h-[calc(100vh-16px)] overflow-y-auto bg-card text-foreground border border-border rounded-lg shadow-2xl z-[9999] w-[240px] py-1"
            style={{ top: menuPosition.top, right: menuPosition.right }}
            role="menu"
          >
            <button className={itemCls} onClick={() => act(onEdit)}>
              <Pencil size={14} className="text-muted-foreground" /> Edit User
            </button>
            <button className={itemCls} onClick={() => { setResetPwOpen(true); setOpen(false); }}>
              <Key size={14} className="text-muted-foreground" /> Reset Password
            </button>
            <button className={itemCls} onClick={() => { setHistoryOpen(true); setOpen(false); }}>
              <History size={14} className="text-muted-foreground" /> View Login History
            </button>
            <div className="my-1 border-t border-border" />
            {isUserLocked(user) && (
              <button className={itemCls} onClick={() => act(handleUnlock)}>
                <Unlock size={14} className="text-green-600" /> Unlock Account
              </button>
            )}
            {user.status !== "Active" && (
              <button className={itemCls} onClick={() => act(() => handleStatus("Active"))}>
                <UserCheck size={14} className="text-green-600" /> Enable Account
              </button>
            )}
            {user.status === "Active" && (
              <button className={itemCls} onClick={() => act(() => handleStatus("Inactive"))}>
                <UserX size={14} className="text-muted-foreground" /> Disable Account
              </button>
            )}
            {user.status === "Active" && (
              <button className={itemCls} onClick={() => act(() => handleStatus("Suspended"))}>
                <PauseCircle size={14} className="text-amber-600" /> Suspend Account
              </button>
            )}
            <div className="my-1 border-t border-border" />
            <button className={itemCls} onClick={() => act(handleForcePasswordChange)}>
              <AlertTriangle size={14} className="text-amber-600" /> Force Password Change
            </button>
            <button className={itemCls} onClick={() => act(handleSendInvitation)}>
              <MailPlus size={14} className="text-muted-foreground" /> Send Invitation
            </button>
            <div className="my-1 border-t border-border" />
            <button data-confirmation-skip className={`${itemCls} text-red-600`} onClick={() => act(handleDelete)}>
              <Trash2 size={14} /> Delete User
            </button>
          </div>,
          document.body,
        )}
      </div>

      <ResetPasswordDialog user={user} open={resetPwOpen} onOpenChange={setResetPwOpen} />
      <LoginHistoryDialog user={user} open={historyOpen} onOpenChange={setHistoryOpen} />
      <Dialog open={invitationSentOpen} onOpenChange={setInvitationSentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MailPlus size={18} className="text-green-600" />
              Invitation Sent
            </DialogTitle>
            <DialogDescription>
              An invitation email has been sent to <strong>{user.email}</strong>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setInvitationSentOpen(false)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent data-confirmation-skip className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{user.name}</strong> ({user.email})?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProtectedOwnerBadge() {
  return (
    <span
      title="System Owner is protected and cannot be changed or removed"
      className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700"
    >
      <Lock size={13} /> Protected
    </span>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────
/** Roles that are allowed to view passwords in the user table. */
const SHOW_PASSWORD_ROLES = new Set(["System Owner", "System Admin"])

export default function ManageUsersPanel() {
  const { user: currentUser } = useAuth()
  const navigate = useNavigate()
  const canViewPasswords = SHOW_PASSWORD_ROLES.has(currentUser?.role ?? "")

  const [search, setSearch] = useState("")
  const [users, setUsers] = useState<NidoUser[]>([])
  const [roles, setRoles] = useState<NidoRole[]>([])
  const [userDialogOpen, setUserDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<NidoUser | null>(null)
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const togglePassword = (id: string) =>
    setVisiblePasswords(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    })

  const refresh = () => { setUsers(getUsers()); setRoles(getRoles()); }

  useEffect(() => {
    refresh()
    const handler = () => refresh()
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "nido_config_users" || event.key === "nido_config_roles") handler()
    }
    window.addEventListener(NIDO_ROLES_EVENT, handler)
    window.addEventListener(NIDO_USERS_EVENT, handler)
    window.addEventListener("storage", handleStorage)
    return () => {
      window.removeEventListener(NIDO_ROLES_EVENT, handler)
      window.removeEventListener(NIDO_USERS_EVENT, handler)
      window.removeEventListener("storage", handleStorage)
    }
  }, [])

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.department.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase()) ||
    (u.employeeId || "").toLowerCase().includes(search.toLowerCase())
  )
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize))
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  useEffect(() => {
    setCurrentPage(1)
  }, [search])

  useEffect(() => {
    setCurrentPage(page => Math.min(page, totalPages))
  }, [totalPages])

  const handleAddUser = () => { setEditingUser(null); setUserDialogOpen(true); }
  const handleEditUser = (user: NidoUser) => {
    if (isSystemOwner(user)) {
      toast.error("System Owner is protected", { description: "The System Owner account must remain unchanged." })
      return
    }
    setEditingUser(user)
    setUserDialogOpen(true)
  }

  const handleSaveUser = (values: Omit<NidoUser, "id">) => {
    try {
      if (editingUser) {
        if (isSystemOwner(editingUser)) {
          toast.error("System Owner is protected", { description: "The System Owner account must remain unchanged." })
          return
        }
        const duplicate = users.some(u => u.id !== editingUser.id && u.email.toLowerCase() === values.email.toLowerCase())
        if (duplicate) { toast.error("Email already in use"); return; }
        updateUser(editingUser.id, values)
        toast.success("User updated", { description: `${values.name}'s details have been saved.` })
      } else {
        const duplicate = users.some(u => u.email.toLowerCase() === values.email.toLowerCase())
        if (duplicate) { toast.error("Email already in use"); return; }
        addUser(values)
        toast.success("User added", { description: `${values.name} can now access the platform.` })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save this user."
      toast.error("User could not be saved", { description: message })
      return
    }
    refresh()
  }

  return (
    <div className="space-y-6">
      {/* Actions bar */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm text-muted-foreground">Manage NIDO internal platform employees and their access.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { if (!filteredUsers.length) { toast.info("Nothing to export"); return; } exportUsersCsv(filteredUsers); toast.success("CSV exported"); }}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
          <Button variant="outline" onClick={() => { if (!filteredUsers.length) { toast.info("Nothing to export"); return; } exportUsersPdf(filteredUsers); toast.success("PDF exported"); }}>
            <FileText className="mr-2 h-4 w-4" /> Export PDF
          </Button>
          <Button onClick={handleAddUser}><Plus className="mr-2 h-4 w-4" /> Add User</Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative w-full max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search users…" className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/40">
                {["Emp ID", "Name", "Email", "Role", "Department", "Password", "Status", "Last Login", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.map(user => (
                <tr key={user.id} className="border-b hover:bg-muted/20">
                  <td className="px-4 py-3 text-xs font-mono">
                    {user.employeeId ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/configuration/nido-users/users/${encodeURIComponent(user.id)}/profile`)}
                        className="text-primary hover:underline font-semibold"
                        title={`View ${user.name}'s profile`}
                      >
                        {user.employeeId}
                      </button>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm">{user.name}</div>
                    {user.designation && <div className="text-xs text-muted-foreground">{user.designation}</div>}
                    {user.forcePasswordChange && (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600 mt-0.5">
                        <AlertTriangle size={10} /> Password change required
                      </span>
                    )}
                    {isUserLocked(user) && (
                      <span className="inline-flex items-center gap-1 text-xs text-red-600 mt-0.5">
                        <Lock size={10} /> Locked
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{user.email}</td>
                  <td className="px-4 py-3 text-sm">{user.role}</td>
                  <td className="px-4 py-3 text-sm">{user.department}</td>
                  <td className="px-4 py-3 text-sm">
                    {canViewPasswords ? (
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs text-gray-700">
                          {visiblePasswords.has(user.id) ? user.password : "••••••••"}
                        </span>
                        <button
                          type="button"
                          onClick={() => togglePassword(user.id)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title={visiblePasswords.has(user.id) ? "Hide password" : "Show password"}
                        >
                          {visiblePasswords.has(user.id) ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={user.status} locked={isUserLocked(user)} /></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{user.lastLogin ?? "Never"}</td>
                  <td className="px-4 py-3">
                     {isSystemOwner(user) ? (
                       <ProtectedOwnerBadge />
                     ) : (
                       <ActionsMenu user={user} onEdit={() => handleEditUser(user)} onRefresh={refresh} />
                     )}
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No users match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="flex flex-col gap-3 border-t px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              {filteredUsers.length === 0
                ? "Showing 0 users"
                : `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredUsers.length)} of ${filteredUsers.length} matching users (${users.length} total)`}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
              >
                Previous
              </Button>
              <span className="min-w-20 text-center">Page {currentPage} of {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AddEditUserDialog
        open={userDialogOpen}
        onOpenChange={setUserDialogOpen}
        user={editingUser}
        roles={roles}
        onSave={handleSaveUser}
        fullScreen={!editingUser}
      />
    </div>
  )
}
