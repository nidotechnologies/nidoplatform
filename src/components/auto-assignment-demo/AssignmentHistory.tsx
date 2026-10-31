import { useMemo, useState, type FormEvent } from "react";
import { ArrowDownUp, ChevronLeft, ChevronRight, Search, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CLIENT_TIERS, getEmployee,
  type AssignmentMethod, type AssignmentStatus, type ClientTier, type Employee, type HistoryItem,
} from "./model";

interface AssignmentHistoryProps {
  history: HistoryItem[];
  employees: Employee[];
  onReassign: (orderId: string, employeeId: string, reason: string) => void;
}

const PAGE_SIZE = 6;

function statusClass(status: AssignmentStatus) {
  if (status === "Completed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "In Progress") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "Unassigned") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function AssignmentHistory({ history, employees, onReassign }: AssignmentHistoryProps) {
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(0);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return history.filter((item) => {
      const employeeName = getEmployee(item.assignedEmployeeId, employees)?.name ?? "";
      return (!needle || [item.orderId, item.clientName, employeeName].some((value) => value.toLowerCase().includes(needle)))
        && (tierFilter === "all" || item.tier === tierFilter)
        && (employeeFilter === "all" || item.assignedEmployeeId === employeeFilter)
        && (statusFilter === "all" || item.status === statusFilter)
        && (methodFilter === "all" || item.method === methodFilter);
    }).sort((a, b) => {
      const dateDiff = new Date(a.assignedAt).getTime() - new Date(b.assignedAt).getTime();
      return sortOrder === "newest" ? -dateDiff : dateDiff;
    });
  }, [employeeFilter, employees, history, methodFilter, query, sortOrder, statusFilter, tierFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const selectedOrder = history.find((item) => item.orderId === openOrderId) ?? null;

  const submitReassignment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedOrder) return;
    if (!selectedEmployee) {
      setFormError("Choose an active employee.");
      return;
    }
    if (!reason.trim()) {
      setFormError("A reason is required to record this reassignment.");
      return;
    }
    if (selectedEmployee === selectedOrder.assignedEmployeeId) {
      setFormError("Choose someone other than the currently assigned employee.");
      return;
    }
    onReassign(selectedOrder.orderId, selectedEmployee, reason.trim());
    setReason("");
    setSelectedEmployee("");
    setFormError("");
  };

  const openDetails = (item: HistoryItem) => {
    setOpenOrderId(item.orderId);
    setSelectedEmployee("");
    setReason("");
    setFormError("");
  };

  return (
    <section id="demo-history" className="scroll-mt-5 rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700">04 / Activity</span>
            <Badge variant="outline" className="h-5 border-slate-200 text-[10px] font-normal text-slate-500">{history.length} demo records</Badge>
          </div>
          <h2 className="mt-1 text-base font-semibold text-slate-900">Assignment history</h2>
          <p className="mt-1 text-xs text-slate-500">Mock and simulated orders only. Open an order to inspect or reassign it.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 self-start border-slate-200 text-xs text-slate-600 md:self-auto"
          onClick={() => setSortOrder((value) => value === "newest" ? "oldest" : "newest")}
          aria-label={`Sort ${sortOrder === "newest" ? "oldest first" : "newest first"}`}
        >
          <ArrowDownUp className="mr-2 h-3.5 w-3.5" /> {sortOrder === "newest" ? "Newest first" : "Oldest first"}
        </Button>
      </div>

      <div className="space-y-3 border-b border-slate-100 bg-slate-50/60 p-4">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Search order, client or employee" aria-label="Search assignment history" className="h-9 border-slate-200 bg-white pl-9 text-xs" />
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
          <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
            <select aria-label="Filter by client tier" value={tierFilter} onChange={(event) => { setTierFilter(event.target.value); setPage(0); }} className="h-9 min-w-0 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-600">
              <option value="all">All tiers</option>
              {CLIENT_TIERS.map((tier) => <option key={tier} value={tier}>{tier}</option>)}
            </select>
            <select aria-label="Filter by employee" value={employeeFilter} onChange={(event) => { setEmployeeFilter(event.target.value); setPage(0); }} className="h-9 min-w-0 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-600">
              <option value="all">All employees</option>
              {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
            </select>
            <select aria-label="Filter by status" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(0); }} className="h-9 min-w-0 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-600">
              <option value="all">All statuses</option>
              {(["Assigned", "In Progress", "Completed", "Unassigned"] satisfies AssignmentStatus[]).map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <select aria-label="Filter by assignment method" value={methodFilter} onChange={(event) => { setMethodFilter(event.target.value); setPage(0); }} className="h-9 min-w-0 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-600">
              <option value="all">All methods</option>
              {(["Round Robin", "Fallback", "Manual reassignment", "Unassigned"] satisfies AssignmentMethod[]).map((method) => <option key={method} value={method}>{method}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-100 hover:bg-transparent">
              <TableHead className="whitespace-nowrap pl-5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Order / Date</TableHead>
              <TableHead className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Client</TableHead>
              <TableHead className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Tier</TableHead>
              <TableHead className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Employee</TableHead>
              <TableHead className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Method</TableHead>
              <TableHead className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Status</TableHead>
              <TableHead className="pr-5 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.map((item) => (
              <TableRow key={item.orderId} className="border-slate-100">
                <TableCell className="whitespace-nowrap pl-5">
                  <span className="block font-mono text-xs font-semibold text-slate-800">{item.orderId}</span>
                  <span className="mt-1 block text-[10px] text-slate-400">{formatDate(item.assignedAt)}</span>
                </TableCell>
                <TableCell className="min-w-[155px]">
                  <span className="block truncate text-xs font-medium text-slate-700">{item.clientName}</span>
                  <span className="mt-1 block text-[10px] text-slate-400">Mock client</span>
                </TableCell>
                <TableCell><Badge variant="outline" className="border-slate-200 font-normal text-slate-600">{item.tier}</Badge></TableCell>
                <TableCell className="whitespace-nowrap text-xs text-slate-600">{getEmployee(item.assignedEmployeeId, employees)?.name ?? <span className="text-slate-400">Not assigned</span>}</TableCell>
                <TableCell className="whitespace-nowrap text-[11px] text-slate-500">{item.method}</TableCell>
                <TableCell><Badge variant="outline" className={`whitespace-nowrap font-medium ${statusClass(item.status)}`}>{item.status}</Badge></TableCell>
                <TableCell className="pr-5 text-right">
                  <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-sky-800 hover:bg-sky-50" onClick={() => openDetails(item)}>View</Button>
                </TableCell>
              </TableRow>
            ))}
            {pageItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-36 text-center">
                  <div className="mx-auto max-w-xs">
                    <p className="text-sm font-medium text-slate-700">No matching demo orders</p>
                    <p className="mt-1 text-xs text-slate-500">Adjust the filters or search a different order, client, or employee.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
        <span className="text-[11px] text-slate-500">
          {filtered.length ? `Showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, filtered.length)} of ${filtered.length}` : "0 results"}
        </span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0} aria-label="Previous history page">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-14 text-center font-mono text-[11px] text-slate-500">{page + 1} / {pageCount}</span>
          <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} disabled={page >= pageCount - 1} aria-label="Next history page">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={!!selectedOrder} onOpenChange={(open) => { if (!open) setOpenOrderId(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          {selectedOrder && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <DialogTitle className="font-mono text-base">{selectedOrder.orderId}</DialogTitle>
                  <Badge variant="outline" className={`font-medium ${statusClass(selectedOrder.status)}`}>{selectedOrder.status}</Badge>
                </div>
                <DialogDescription>Demo order detail · no live order data</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-4">
                <div><p className="text-[10px] uppercase tracking-wide text-slate-400">Client</p><p className="mt-1 text-xs font-medium text-slate-800">{selectedOrder.clientName}</p></div>
                <div><p className="text-[10px] uppercase tracking-wide text-slate-400">Tier</p><p className="mt-1 text-xs font-medium text-slate-800">{selectedOrder.tier}</p></div>
                 <div><p className="text-[10px] uppercase tracking-wide text-slate-400">Assigned to</p><p className="mt-1 text-xs font-medium text-slate-800">{getEmployee(selectedOrder.assignedEmployeeId, employees)?.name ?? "Unassigned"}</p></div>
                <div><p className="text-[10px] uppercase tracking-wide text-slate-400">Method</p><p className="mt-1 text-xs font-medium text-slate-800">{selectedOrder.method}</p></div>
                <div className="col-span-2 sm:col-span-4"><p className="text-[10px] uppercase tracking-wide text-slate-400">Recorded</p><p className="mt-1 text-xs text-slate-700">{formatDate(selectedOrder.assignedAt)}</p></div>
              </div>
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-600">Reassignment history</h3>
                {selectedOrder.reassignments.length ? (
                  <ol className="mt-3 space-y-2">
                    {selectedOrder.reassignments.map((entry, index) => (
                      <li key={`${entry.reassignedAt}-${index}`} className="rounded-lg border border-slate-200 p-3">
                        <p className="text-xs font-medium text-slate-800">
                          {getEmployee(entry.previousEmployeeId, employees)?.name ?? "Unassigned"} <span className="px-1 text-slate-400">→</span> {getEmployee(entry.newEmployeeId, employees)?.name ?? "Employee"}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">{entry.reason}</p>
                        <p className="mt-1 font-mono text-[10px] text-slate-400">{formatDate(entry.reassignedAt)}</p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-2 rounded-lg border border-dashed border-slate-200 px-3 py-4 text-xs text-slate-500">No manual reassignments recorded for this demo order.</p>
                )}
              </section>
              <form onSubmit={submitReassignment} className="space-y-3 border-t border-slate-100 pt-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Manual reassignment</h3>
                   <p className="mt-1 text-xs text-slate-500">Only active NIDO platform employees are available. A reason is added to this order’s demo history.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="reassign-employee" className="mb-1.5 block text-xs font-medium text-slate-700">New employee <span className="text-rose-600">*</span></label>
                    <select id="reassign-employee" value={selectedEmployee} onChange={(event) => { setSelectedEmployee(event.target.value); setFormError(""); }} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700">
                      <option value="">Choose an active employee</option>
                      {employees.filter((employee) => employee.status === "Active").map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.employeeId}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="reassign-reason" className="mb-1.5 block text-xs font-medium text-slate-700">Reason <span className="text-rose-600">*</span></label>
                    <Input id="reassign-reason" value={reason} onChange={(event) => { setReason(event.target.value); setFormError(""); }} placeholder="Why is this changing?" className="h-10 text-xs" required maxLength={240} />
                  </div>
                </div>
                {formError && <p role="alert" className="text-xs font-medium text-rose-700">{formError}</p>}
                <div className="flex justify-end">
                  <Button type="submit" size="sm" className="bg-sky-800 text-xs text-white hover:bg-sky-900">Record reassignment</Button>
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
