import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getClients } from "@/lib/clientStore";
import {
  createAutoAssignmentRule,
  getAutoAssignmentSettings,
  saveAutoAssignmentSettings,
  type AutoAssignmentRule,
} from "@/lib/autoAssignmentStore";
import { getRoles, getUsers, NIDO_ROLES_EVENT, NIDO_USERS_EVENT } from "@/lib/nidoUsersStore";

function reorder(rules: AutoAssignmentRule[], index: number, direction: -1 | 1) {
  const next = [...rules];
  const target = index + direction;
  if (target < 0 || target >= next.length) return rules;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export default function ServiceTicketAssignmentRules({ canManage }: { canManage: boolean }) {
  const [enabled, setEnabled] = useState(true);
  const [rules, setRules] = useState<AutoAssignmentRule[]>([]);
  const [users, setUsers] = useState(getUsers());
  const [roles, setRoles] = useState(getRoles());
  const [clients, setClients] = useState(getClients());
  const [saving, setSaving] = useState(false);

  const activeUsers = useMemo(() => users.filter((user) => user.status === "Active"), [users]);
  const departments = useMemo(
    () => Array.from(new Set(users.map((user) => user.department).filter(Boolean))).sort(),
    [users],
  );

  useEffect(() => {
    const saved = getAutoAssignmentSettings();
    setEnabled(saved.enabled);
    setRules(saved.rules);
    const refresh = () => {
      setUsers(getUsers());
      setRoles(getRoles());
      setClients(getClients());
    };
    window.addEventListener(NIDO_USERS_EVENT, refresh);
    window.addEventListener(NIDO_ROLES_EVENT, refresh);
    window.addEventListener("nidoClientsUpdated", refresh);
    return () => {
      window.removeEventListener(NIDO_USERS_EVENT, refresh);
      window.removeEventListener(NIDO_ROLES_EVENT, refresh);
      window.removeEventListener("nidoClientsUpdated", refresh);
    };
  }, []);

  const updateRule = (id: string, changes: Partial<AutoAssignmentRule>) => {
    setRules((current) => current.map((rule) => rule.id === id ? { ...rule, ...changes } : rule));
  };

  const save = () => {
    setSaving(true);
    try {
      saveAutoAssignmentSettings({ enabled, rules });
      toast({ title: "Saved", description: "Service and ticket assignment rules were saved." });
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Could not save service assignment settings.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Service and ticket assignment</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Existing department/role rules remain separate from order-tier round robin. Earlier rules have priority.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={enabled}
              disabled={!canManage}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            {enabled ? "Enabled" : "Disabled"}
          </label>
        </CardContent>
      </Card>

      {rules.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No department or role rules have been configured.
          </CardContent>
        </Card>
      )}

      {rules.map((rule, index) => (
        <Card key={rule.id}>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Rule {index + 1}</CardTitle>
              <CardDescription>First matching rule wins for support tickets and service requests.</CardDescription>
            </div>
            {canManage && (
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" aria-label={`Move rule ${index + 1} up`} disabled={index === 0} onClick={() => setRules(reorder(rules, index, -1))}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label={`Move rule ${index + 1} down`} disabled={index === rules.length - 1} onClick={() => setRules(reorder(rules, index, 1))}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label={`Delete rule ${index + 1}`} onClick={() => setRules((current) => current.filter((item) => item.id !== rule.id))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`ticket-department-${rule.id}`} className="mb-1.5 block text-sm font-medium">Department</label>
                <select id={`ticket-department-${rule.id}`} value={rule.department} disabled={!canManage} onChange={(event) => updateRule(rule.id, { department: event.target.value })} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm">
                  <option value="">Any department</option>
                  {departments.map((department) => <option key={department}>{department}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor={`ticket-role-${rule.id}`} className="mb-1.5 block text-sm font-medium">Role</label>
                <select id={`ticket-role-${rule.id}`} value={rule.role} disabled={!canManage} onChange={(event) => updateRule(rule.id, { role: event.target.value })} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm">
                  <option value="">Any role</option>
                  {roles.filter((role) => role.status === "Active").map((role) => <option key={role.id} value={role.name}>{role.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Assigned employees</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {activeUsers.map((user) => (
                  <label key={user.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={rule.assignedUserIds.includes(user.id)}
                      disabled={!canManage}
                      onChange={(event) => updateRule(rule.id, {
                        assignedUserIds: event.target.checked
                          ? [...rule.assignedUserIds, user.id]
                          : rule.assignedUserIds.filter((id) => id !== user.id),
                      })}
                    />
                    <span>{user.name || user.email}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{user.role}</span>
                  </label>
                ))}
              </div>
            </div>

            <details>
              <summary className="cursor-pointer text-sm font-medium">Limit this rule to selected clients</summary>
              <p className="mb-2 mt-2 text-xs text-muted-foreground">Leave all unchecked to allow every client.</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {clients.map((client) => (
                  <label key={client.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={rule.clientIds.includes(client.id)}
                      disabled={!canManage}
                      onChange={(event) => updateRule(rule.id, {
                        clientIds: event.target.checked
                          ? [...rule.clientIds, client.id]
                          : rule.clientIds.filter((id) => id !== client.id),
                      })}
                    />
                    {client.name}
                  </label>
                ))}
              </div>
            </details>
          </CardContent>
        </Card>
      ))}

      {canManage && (
        <div className="flex flex-wrap justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => setRules((current) => [...current, createAutoAssignmentRule({
              department: "",
              role: "",
              assignedUserIds: [],
              clientIds: [],
            })])}
          >
            <Plus className="mr-2 h-4 w-4" /> Add rule
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save service rules
          </Button>
        </div>
      )}
      {!canManage && <p className="text-sm text-muted-foreground">You have view-only access to these settings.</p>}
    </div>
  );
}
