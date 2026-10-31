// ── Role Permissions Dialog ───────────────────────────────────────────────────
// Full module × action permission matrix editor for a single role.
// Super Admin (System Owner) role shows all permissions as locked/enabled.
// Supports adding custom permission modules.

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Shield, CheckSquare, Square, Minus, Plus, X, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ACTIONS,
  getRolePermissions,
  saveRolePermissions,
  isSuperAdmin,
  getAllModules,
  CUSTOM_MODULES_EVENT,
  type ActionKey,
  type ModulePermissions,
} from '@/lib/permissionsStore';
import {
  ROLE_PERMISSION_MODULE_OPTIONS,
} from '@/lib/platformModuleCatalog';
import type { NidoRole } from '@/lib/nidoUsersStore';

interface RolePermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: NidoRole | null;
}

type PermMatrix = Record<string, ModulePermissions>;

function uniqueModules<T extends { key: string; label: string }>(modules: T[]): T[] {
  const seenKeys = new Set<string>();
  const seenLabels = new Set<string>();
  return modules.filter(module => {
    const key = module.key.trim().toLowerCase();
    const label = module.label.trim().toLowerCase();
    if (seenKeys.has(key) || seenLabels.has(label)) return false;
    seenKeys.add(key);
    seenLabels.add(label);
    return true;
  });
}

export default function RolePermissionsDialog({ open, onOpenChange, role }: RolePermissionsDialogProps) {
  const [matrix, setMatrix] = useState<PermMatrix>({});
  const [modules, setModules] = useState(getAllModules());
  const [removedModuleKeys, setRemovedModuleKeys] = useState<Set<string>>(new Set());
  const [showAddModule, setShowAddModule] = useState(false);
  const [selectedModuleKeys, setSelectedModuleKeys] = useState<string[]>([]);
  const [addError, setAddError] = useState('');

  const superAdmin = !!(role && isSuperAdmin(role.name));

  useEffect(() => {
    if (open && role) setRemovedModuleKeys(new Set());
  }, [open, role?.id, role?.name]);

  useEffect(() => {
    const handler = () => {
      setModules(previous => {
        const builtInsAndCustom = getAllModules();
        const currentPlatformModules = previous.filter(module =>
          module.key.startsWith('platform_') &&
          !builtInsAndCustom.some(existing => existing.key === module.key),
        );
        return uniqueModules([...builtInsAndCustom, ...currentPlatformModules]);
      });
    };
    window.addEventListener(CUSTOM_MODULES_EVENT, handler);
    return () => window.removeEventListener(CUSTOM_MODULES_EVENT, handler);
  }, []);

  useEffect(() => {
    if (open && role) {
      const perms = getRolePermissions(role.name);
      const builtInsAndCustom = getAllModules();
      const selectedPlatformModules = ROLE_PERMISSION_MODULE_OPTIONS.filter(module =>
        Object.prototype.hasOwnProperty.call(perms, module.key),
      );
      // A role without a saved permission map is newly created. Start with an
      // empty module list so permissions are explicitly granted by an admin.
      // Existing roles keep their current module list and defaults.
      const hasConfiguredModules =
        Object.keys(perms).length > 0 || selectedPlatformModules.length > 0;
      const allPlatformModules = ROLE_PERMISSION_MODULE_OPTIONS.filter(module =>
        !builtInsAndCustom.some(existing => existing.key === module.key),
      );
      const selectedPlatformLabels = new Set(
        selectedPlatformModules.map(module => module.label.trim().toLowerCase()),
      );
      const configuredLegacyModules = builtInsAndCustom.filter(module =>
        Object.prototype.hasOwnProperty.call(perms, module.key) &&
        !selectedPlatformLabels.has(module.label.trim().toLowerCase()),
      );
      const allRoleModules = superAdmin
        ? uniqueModules([...allPlatformModules, ...builtInsAndCustom])
        : hasConfiguredModules
        ? uniqueModules([...selectedPlatformModules, ...configuredLegacyModules])
        : uniqueModules([...allPlatformModules, ...builtInsAndCustom]);
      setModules(allRoleModules);
      const full: PermMatrix = {};
      for (const m of allRoleModules) {
        full[m.key] = { ...(perms[m.key] ?? {}) };
      }
      setMatrix(full);
      setShowAddModule(false);
      setSelectedModuleKeys([]);
      setAddError('');
    }
  }, [open, role?.id, role?.name]);

  const toggle = (moduleKey: string, action: ActionKey) => {
    if (superAdmin) return;
    setMatrix(prev => ({
      ...prev,
      [moduleKey]: { ...prev[moduleKey], [action]: !prev[moduleKey]?.[action] },
    }));
  };

  const toggleRow = (moduleKey: string) => {
    if (superAdmin) return;
    const current = matrix[moduleKey] ?? {};
    const allOn = ACTIONS.every(a => current[a.key]);
    const next: ModulePermissions = {};
    if (!allOn) ACTIONS.forEach(a => { next[a.key] = true; });
    setMatrix(prev => ({ ...prev, [moduleKey]: next }));
  };

  const toggleColumn = (action: ActionKey) => {
    if (superAdmin) return;
    const allOn = modules.length > 0 && modules.every(m => matrix[m.key]?.[action]);
    setMatrix(prev => {
      const next = { ...prev };
      modules.forEach(m => { next[m.key] = { ...next[m.key], [action]: !allOn }; });
      return next;
    });
  };

  const handleAddModule = () => {
    const selected = ROLE_PERMISSION_MODULE_OPTIONS.filter(module => selectedModuleKeys.includes(module.key));
    if (!selected.length) { setAddError('Select at least one platform module first.'); return; }
    const duplicates = selected.filter(module =>
      modules.some(existing => existing.key === module.key || existing.label === module.label),
    );
    if (duplicates.length > 0) {
      setAddError('One or more selected modules are already in the permissions list.');
      return;
    }
    setMatrix(prev => ({
      ...prev,
      ...Object.fromEntries(selected.map(module => [module.key, {}])),
    }));
    setModules(prev => [...prev, ...selected]);
    setSelectedModuleKeys([]);
    setAddError('');
    setShowAddModule(false);
    toast.success(`${selected.length} module${selected.length === 1 ? '' : 's'} added`, {
      description: selected.map(module => module.label).join(', '),
    });
  };

  const handleRemoveModuleFromRole = (key: string, label: string) => {
    setMatrix(prev => { const next = { ...prev }; delete next[key]; return next; });
    setRemovedModuleKeys(prev => new Set(prev).add(key));
    setModules(prev => prev.filter(module => module.key !== key));
    toast.info('Module removed from role', { description: `"${label}" has been removed from this role's permissions.` });
  };

  const handleSave = () => {
    if (!role) return;
    saveRolePermissions(role.name, matrix);
    toast.success('Permissions saved', { description: `Permissions for "${role.name}" have been updated.` });
    onOpenChange(false);
  };

  if (!role) return null;

  const customModules = modules.filter(m => 'custom' in m && m.custom);
  const visibleModules = modules.filter(module => !removedModuleKeys.has(module.key));
  const listedModuleKeys = new Set(modules.map(module => module.key));
  const listedModuleLabels = new Set(modules.map(module => module.label));
  const availablePlatformModules = ROLE_PERMISSION_MODULE_OPTIONS.filter(
    platformModule =>
      !listedModuleKeys.has(platformModule.key) &&
      !listedModuleLabels.has(platformModule.label),
  );
  const isRowAllSelected = (moduleKey: string) =>
    superAdmin || ACTIONS.every(action => matrix[moduleKey]?.[action.key]);
  const isRowPartiallySelected = (moduleKey: string) =>
    !superAdmin &&
    ACTIONS.some(action => matrix[moduleKey]?.[action.key]) &&
    !isRowAllSelected(moduleKey);
  const isColumnAllSelected = (action: ActionKey) =>
    superAdmin || (modules.length > 0 && modules.every(module => matrix[module.key]?.[action]));
  const isColumnPartiallySelected = (action: ActionKey) =>
    !superAdmin &&
    modules.some(module => matrix[module.key]?.[action]) &&
    !isColumnAllSelected(action);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Full-screen dialog split into 3 fixed sections: header / scroll-body / footer */}
      <DialogContent className="w-screen h-screen max-w-none max-h-none sm:rounded-none p-0 flex flex-col overflow-hidden">

        {/* ── Header (fixed, never scrolls) ── */}
        <div className="shrink-0 px-6 pt-6 pb-4 border-b border-border">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-lg">Permissions — {role.name}</DialogTitle>
                <DialogDescription>
                  {superAdmin
                    ? 'System Owner has unrestricted access to all modules.'
                    : 'Toggle permissions for each module. Click a module name to toggle its entire row.'}
                </DialogDescription>
              </div>
            </div>
            {superAdmin && (
              <Badge className="w-fit bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 mt-3">
                Super Administrator — All permissions always granted
              </Badge>
            )}
          </DialogHeader>
        </div>

        {/* ── Scrollable table body ── */}
        <div className="flex-1 overflow-auto px-6 py-4">
          <table className="w-full border-collapse text-sm min-w-[700px]">
            <thead className="sticky top-0 bg-background z-10">
              <tr>
                <th className="py-3 px-3 text-left font-semibold text-foreground border-b border-border w-52">
                  Module
                </th>
                <th className="py-3 px-3 text-left font-semibold text-foreground border-b border-border min-w-[280px]">
                  Details
                </th>
                {ACTIONS.map(a => (
                  <th key={a.key} className="py-3 px-2 text-center font-semibold text-foreground border-b border-border">
                    <button
                      className={`flex flex-col items-center gap-1 mx-auto text-xs ${superAdmin ? 'cursor-default' : 'hover:text-primary transition-colors cursor-pointer'}`}
                      onClick={() => toggleColumn(a.key)}
                      disabled={superAdmin}
                      aria-label={`Select all ${a.label} permissions`}
                      aria-pressed={isColumnAllSelected(a.key)}
                      title={superAdmin ? undefined : `Select all ${a.label} permissions`}
                    >
                      {isColumnAllSelected(a.key) ? (
                        <CheckSquare size={16} className="text-primary" />
                      ) : isColumnPartiallySelected(a.key) ? (
                        <Minus size={16} className="text-primary" />
                      ) : (
                        <Square size={16} className="text-muted-foreground/50" />
                      )}
                      {a.label}
                    </button>
                  </th>
                ))}
                <th className="w-8 border-b border-border" />
              </tr>
            </thead>
            <tbody>
              {visibleModules.map((m, idx) => {
                const modPerms = matrix[m.key] ?? {};
                return (
                  <tr key={m.key} className={idx % 2 === 0 ? 'bg-muted/20' : ''}>
                    <td className="py-2.5 px-3 border-b border-border">
                      <div className="flex items-center gap-2">
                        <button
                          className={`flex items-center gap-2 text-left font-medium text-foreground ${superAdmin ? 'cursor-default' : 'hover:text-primary transition-colors cursor-pointer'}`}
                          onClick={() => toggleRow(m.key)}
                          disabled={superAdmin}
                          aria-label={`Select all permissions for ${m.label}`}
                          aria-pressed={isRowAllSelected(m.key)}
                          title={superAdmin ? undefined : `Select all permissions for ${m.label}`}
                        >
                          {isRowAllSelected(m.key) ? (
                            <CheckSquare size={16} className="text-primary shrink-0" />
                          ) : isRowPartiallySelected(m.key) ? (
                            <Minus size={16} className="text-primary shrink-0" />
                          ) : (
                            <Square size={16} className="text-muted-foreground/50 shrink-0" />
                          )}
                          {m.label}
                        </button>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 border-b border-border text-xs text-muted-foreground">
                      {'description' in m ? m.description : 'Custom permission module.'}
                    </td>
                    {ACTIONS.map(a => {
                      const enabled = superAdmin || !!modPerms[a.key];
                      return (
                        <td key={a.key} className="py-2.5 px-2 text-center border-b border-border">
                          <button
                            className={`mx-auto flex items-center justify-center w-5 h-5 transition-colors ${
                              superAdmin
                                ? 'cursor-default text-primary'
                                : enabled
                                  ? 'text-primary hover:text-primary/80 cursor-pointer'
                                  : 'text-muted-foreground/30 hover:text-muted-foreground cursor-pointer'
                            }`}
                            onClick={() => toggle(m.key, a.key)}
                            disabled={superAdmin}
                          >
                            {enabled ? <CheckSquare size={16} /> : <Square size={16} />}
                          </button>
                        </td>
                      );
                    })}
                    <td className="py-2.5 px-1 border-b border-border text-center">
                      {!superAdmin && (
                        <button
                          onClick={() => handleRemoveModuleFromRole(m.key, m.label)}
                          className="text-muted-foreground/40 hover:text-red-500 transition-colors"
                          title={`Remove "${m.label}" from this role`}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* Add Module inline input row */}
              {showAddModule && !superAdmin && (
                <tr className="bg-blue-50/60 dark:bg-blue-950/20">
                  <td colSpan={ACTIONS.length + 3} className="px-3 py-3 border-b border-border">
                    <div className="flex items-center gap-2 max-w-2xl">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="h-8 flex-1 justify-start text-sm font-normal">
                            {selectedModuleKeys.length > 0
                              ? `${selectedModuleKeys.length} module${selectedModuleKeys.length === 1 ? '' : 's'} selected`
                              : 'Select platform modules'}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-[360px] max-h-80 overflow-y-auto">
                           {availablePlatformModules.length > 0 ? (
                            availablePlatformModules.map(module => (
                              <DropdownMenuCheckboxItem
                                key={module.key}
                                checked={selectedModuleKeys.includes(module.key)}
                                onCheckedChange={checked => {
                                  setSelectedModuleKeys(previous =>
                                    checked
                                      ? [...previous, module.key]
                                      : previous.filter(key => key !== module.key),
                                  );
                                  setAddError('');
                                }}
                                onSelect={event => event.preventDefault()}
                              >
                                <span className="flex flex-col">
                                  <span>{module.label}</span>
                                  <span className="text-xs text-muted-foreground">{module.description}</span>
                                </span>
                              </DropdownMenuCheckboxItem>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-sm text-muted-foreground">
                              All platform modules are already listed.
                            </div>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button size="sm" onClick={handleAddModule} className="h-8 shrink-0">Add</Button>
                      <button
                        onClick={() => { setShowAddModule(false); setSelectedModuleKeys([]); setAddError(''); }}
                        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    {addError && <p className="text-xs text-red-600 mt-1">{addError}</p>}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Module count summary */}
          <p className="text-xs text-muted-foreground mt-3 px-1">
            {modules.filter(m => !('custom' in m && m.custom)).length} built-in modules
            {customModules.length > 0 && ` · ${customModules.length} custom module${customModules.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {/* ── Footer (fixed, never scrolls) ── */}
        <div className="shrink-0 border-t border-border bg-background px-6 py-4 min-h-[68px] flex flex-row items-center justify-between gap-3">
          {/* Left side */}
          {superAdmin ? (
            /* Lock notice for System Owner */
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Shield size={15} className="shrink-0" />
              <span className="text-xs font-medium">All permissions are permanently granted for this role</span>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowAddModule(v => !v); setSelectedModuleKeys([]); setAddError(''); }}
              className="flex items-center gap-1.5"
            >
              <Plus size={14} />
              {showAddModule ? 'Cancel Add' : 'Add Module'}
            </Button>
          )}

          {/* Right side: action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {superAdmin ? 'Close' : 'Cancel'}
            </Button>
            {!superAdmin && (
              <Button onClick={handleSave}>Save Permissions</Button>
            )}
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
