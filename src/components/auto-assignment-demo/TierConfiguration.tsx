import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, RotateCcw, Search, UsersRound, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { getEmployee, type Employee, type TierConfig } from "./model";

interface TierConfigurationProps {
  config: TierConfig;
  employees: Employee[];
  onChange: (config: TierConfig) => void;
}

export default function TierConfiguration({ config, employees, onChange }: TierConfigurationProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [selectedToAdd, setSelectedToAdd] = useState<string[]>([]);
  const eligibleIds = useMemo(() => new Set(config.eligibleEmployeeIds), [config.eligibleEmployeeIds]);
  const availableEmployees = useMemo(() => {
    const search = employeeSearch.trim().toLowerCase();
    return employees.filter((employee) =>
      employee.status === "Active"
      && !eligibleIds.has(employee.id)
      && (!search || [employee.name, employee.employeeId, employee.department, employee.role]
        .some((value) => value.toLowerCase().includes(search))),
    );
  }, [employeeSearch, eligibleIds, employees]);
  const addableSelectedCount = selectedToAdd.filter((id) =>
    employees.some((employee) => employee.id === id && employee.status === "Active")
    && !eligibleIds.has(id),
  ).length;
  const activeEligible = config.sequence.filter((id) =>
    config.eligibleEmployeeIds.includes(id) && getEmployee(id, employees)?.status === "Active",
  ).length;

  const addEmployees = () => {
    const newIds = [...new Set(selectedToAdd)].filter((id) =>
      employees.some((employee) => employee.id === id && employee.status === "Active")
      && !eligibleIds.has(id),
    );
    if (!newIds.length) return;
    const eligibleEmployeeIds = [...new Set([...config.eligibleEmployeeIds, ...newIds])];
    const sequence = [...new Set([...config.sequence.filter((id) => eligibleEmployeeIds.includes(id)), ...newIds])];
    onChange({
      ...config,
      eligibleEmployeeIds,
      sequence,
      rotationPosition: Math.min(config.rotationPosition, Math.max(0, sequence.length - 1)),
    });
    setSelectedToAdd([]);
    setEmployeeSearch("");
    setAddDialogOpen(false);
  };

  const removeEmployee = (id: string) => {
    const oldIndex = config.sequence.indexOf(id);
    const sequence = config.sequence.filter((employeeId) => employeeId !== id);
    const eligibleEmployeeIds = config.eligibleEmployeeIds.filter((employeeId) => employeeId !== id);
    const position = oldIndex >= 0 && oldIndex < config.rotationPosition
      ? Math.max(0, config.rotationPosition - 1)
      : Math.min(config.rotationPosition, Math.max(0, sequence.length - 1));
    onChange({
      ...config,
      eligibleEmployeeIds,
      sequence,
      rotationPosition: sequence.length ? position : 0,
      fallback: config.fallback === id ? null : config.fallback,
    });
  };

  const moveEmployee = (index: number, direction: -1 | 1) => {
    const next = [...config.sequence];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange({ ...config, sequence: next });
  };

  const resetRotation = () => onChange({ ...config, rotationPosition: 0 });
  const currentEmployeeId = config.sequence[config.rotationPosition] ?? null;

  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100 bg-slate-50/70 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CardDescription className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                Client tier
              </CardDescription>
              <Badge variant="outline" className="border-slate-200 bg-white font-mono text-[10px] text-slate-500">
                {String(config.sequence.length).padStart(2, "0")} IN SEQUENCE
              </Badge>
            </div>
            <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">{config.tier}</h3>
          </div>
          <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700">
            <span>{config.enabled ? "Rule on" : "Rule off"}</span>
            <Switch
              checked={config.enabled}
              onCheckedChange={(checked) => onChange({ ...config, enabled: checked })}
              aria-label={`Enable ${config.tier} tier assignment rule`}
            />
          </label>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          Serial round robin <span className="px-1 text-slate-300">/</span> {activeEligible} active eligible
        </p>
      </CardHeader>
      <CardContent className="space-y-5 p-5">
        <section aria-label={`${config.tier} eligible employees`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-[0.09em] text-slate-700">Eligible employees</h4>
              <p className="mt-1 text-[11px] text-slate-400">Selected from active NIDO platform users</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-[11px]"
              onClick={() => {
                setSelectedToAdd([]);
                setEmployeeSearch("");
                setAddDialogOpen(true);
              }}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add employees
            </Button>
          </div>
          {config.eligibleEmployeeIds.length ? (
            <ul className="space-y-1.5">
              {config.eligibleEmployeeIds.map((employeeId) => {
                const employee = getEmployee(employeeId, employees);
                if (!employee) return null;
                return (
                  <li key={employee.id} className="flex min-w-0 items-center gap-2 rounded-lg border border-sky-100 bg-sky-50/50 px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-xs font-semibold text-slate-800">{employee.name}</span>
                        <span className={`text-[9px] font-semibold uppercase tracking-wide ${employee.status === "Active" ? "text-emerald-700" : "text-amber-700"}`}>
                          {employee.status}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] text-slate-500">
                        {employee.employeeId} · {employee.department} · {employee.role}
                      </span>
                    </span>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeEmployee(employee.id)} aria-label={`Remove ${employee.name} from ${config.tier} eligible employees`}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center">
              <p className="text-xs font-medium text-slate-700">No eligible employees selected</p>
              <p className="mt-1 text-[11px] text-slate-500">Add one or more active NIDO users for this tier.</p>
            </div>
          )}
        </section>

        <section aria-label={`${config.tier} employee sequence`}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-[0.09em] text-slate-700">Rotation sequence</h4>
              <Badge variant="secondary" className="h-5 gap-1 bg-slate-100 px-1.5 text-[10px] font-normal text-slate-600">
                <UsersRound className="h-3 w-3" /> {activeEligible} active
              </Badge>
            </div>
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px] text-slate-500" onClick={resetRotation}>
              <RotateCcw className="mr-1 h-3 w-3" /> Reset position
            </Button>
          </div>
          {config.sequence.length ? (
            <ol className="space-y-1.5">
              {config.sequence.map((employeeId, index) => {
                const employee = getEmployee(employeeId, employees);
                const isCurrent = index === config.rotationPosition;
                return (
                  <li key={`${employeeId}-${index}`} className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${isCurrent ? "border-sky-200 bg-sky-50/70" : "border-slate-100 bg-slate-50/50"}`}>
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white font-mono text-[10px] font-semibold text-slate-500 ring-1 ring-slate-200">{String(index + 1).padStart(2, "0")}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-xs font-medium text-slate-800">{employee?.name ?? "Unknown employee"}</span>
                        {isCurrent && <span className="text-[9px] font-semibold uppercase tracking-wide text-sky-700">Next in rotation</span>}
                        {employee?.status === "Inactive" && <span className="text-[9px] font-medium text-amber-700">Skipped while inactive</span>}
                      </span>
                    </span>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={index === 0} onClick={() => moveEmployee(index, -1)} aria-label={`Move ${employee?.name ?? "employee"} up in ${config.tier} sequence`}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={index === config.sequence.length - 1} onClick={() => moveEmployee(index, 1)} aria-label={`Move ${employee?.name ?? "employee"} down in ${config.tier} sequence`}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-4 text-center text-xs text-amber-800">
              Add at least one employee to create a rotation sequence.
            </div>
          )}
        </section>

        <section className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
          <div className="rounded-lg bg-slate-50 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Current position</p>
            <p className="mt-1 text-xs font-medium text-slate-800">
               {currentEmployeeId ? `${getEmployee(currentEmployeeId, employees)?.name ?? "Employee"} · #${config.rotationPosition + 1}` : "No position"}
            </p>
          </div>
          <div>
            <label htmlFor={`fallback-${config.tier}`} className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Fallback employee</label>
            <select
              id={`fallback-${config.tier}`}
              value={config.fallback ?? "none"}
              onChange={(event) => onChange({ ...config, fallback: event.target.value === "none" ? null : event.target.value })}
              className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
            >
              <option value="none">Leave unassigned</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>{employee.name}{employee.status === "Inactive" ? " — inactive" : ""}</option>
              ))}
            </select>
          </div>
        </section>
        {!config.enabled && <p className="rounded-md bg-amber-50 px-3 py-2 text-[11px] text-amber-800">This tier is disabled. Simulated orders will remain unassigned.</p>}
        {config.eligibleEmployeeIds.length > 0 && activeEligible === 0 && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-[11px] text-amber-800">No active eligible employees. The fallback is used when available; otherwise orders remain unassigned.</p>
        )}
      </CardContent>
      <Dialog open={addDialogOpen} onOpenChange={(open) => {
        setAddDialogOpen(open);
        if (!open) {
          setSelectedToAdd([]);
          setEmployeeSearch("");
        }
      }}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add eligible employees to {config.tier}</DialogTitle>
            <DialogDescription>
              Select multiple active employees from the NIDO platform user directory. This only updates this browser’s demo configuration.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={employeeSearch}
              onChange={(event) => setEmployeeSearch(event.target.value)}
              placeholder="Search name, employee ID, department or role"
              aria-label="Search NIDO platform employees"
              className="pl-9"
            />
          </div>
          <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
            {availableEmployees.map((employee) => (
              <label key={employee.id} className="flex cursor-pointer items-start gap-2.5 rounded-md px-2.5 py-2 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={selectedToAdd.includes(employee.id)}
                  onChange={(event) => setSelectedToAdd((current) => event.target.checked
                    ? [...new Set([...current, employee.id])]
                    : current.filter((id) => id !== employee.id))}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-sky-700"
                  aria-label={`Select ${employee.name}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-slate-800">{employee.name}</span>
                  <span className="mt-0.5 block truncate text-[10px] text-slate-500">
                    {employee.employeeId} · {employee.department} · {employee.role}
                  </span>
                </span>
              </label>
            ))}
            {availableEmployees.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-slate-500">
                {employees.some((employee) => employee.status === "Active")
                  ? "No matching active employees available to add."
                  : "No active NIDO employees are available. Add or activate users in Configuration → NIDO Users."}
              </p>
            )}
          </div>
          <DialogFooter className="flex-row items-center justify-between sm:justify-between">
            <span className="text-xs text-slate-500">{addableSelectedCount} selected</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
              <Button type="button" onClick={addEmployees} disabled={!addableSelectedCount}>
                Add {addableSelectedCount || ""} employees
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
