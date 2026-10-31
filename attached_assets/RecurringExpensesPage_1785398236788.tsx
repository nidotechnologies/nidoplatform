import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { safeReadJson } from "@/lib/utils";
import { useData } from "@/contexts/DataContext";
import { Ellipsis, Pencil, Plus, X } from "lucide-react";
import { usePageMeta } from "@/contexts/PageMetaContext";
import { useEffect } from "react";

type Frequency = "Weekly" | "Monthly" | "Quarterly";
type ProfileStatus = "ACTIVE" | "STOPPED";

interface RecurringHistory {
  id: string;
  timestamp: string;
  message: string;
  by: string;
  expenseId?: string;
}

interface RecurringExpenseProfile {
  id: string;
  profileName: string;
  expenseAccount: string;
  vendorName: string;
  frequency: Frequency;
  lastExpenseDate: string;
  nextExpenseDate: string;
  status: ProfileStatus;
  amount: number;
  paidThrough: string;
  startDate: string;
  endDate: string;
  neverExpires: boolean;
  taxLabel: string;
  amountIs: "Tax Inclusive" | "Tax Exclusive";
  notes: string;
  customerName: string;
  billable: boolean;
  projects: string;
  gstTreatment: string;
  reportingTags: string[];
  createdExpenseIds: string[];
  history: RecurringHistory[];
}

interface ExpenseEntryLite {
  id: string;
  date: string;
  expenseAccount: string;
  referenceNumber: string;
  vendorName: string;
  paidThrough: string;
  customerName: string;
  status: "BILLABLE" | "NON-BILLABLE";
  amount: number;
  expenseType: "Goods" | "Services";
  sac: string;
  gstTreatment: string;
  sourceOfSupply: string;
  destinationOfSupply: string;
  reverseCharge: boolean;
  taxLabel: string;
  taxPercent: number;
  taxAmount: number;
  amountIs: "Tax Inclusive" | "Tax Exclusive";
  invoiceNumber: string;
  notes: string;
  reportingTags: string[];
  receipts: string[];
}

const STORAGE_KEY = "nido_recurring_expenses_v1";
const EXPENSES_STORAGE_KEY = "nido_expenses_v1";

const today = () => new Date().toISOString().slice(0, 10);

const addByFrequency = (date: string, frequency: Frequency) => {
  const current = new Date(`${date}T00:00:00`);
  if (frequency === "Weekly") current.setDate(current.getDate() + 7);
  if (frequency === "Monthly") current.setMonth(current.getMonth() + 1);
  if (frequency === "Quarterly") current.setMonth(current.getMonth() + 3);
  return current.toISOString().slice(0, 10);
};

const defaultProfiles: RecurringExpenseProfile[] = [
  {
    id: "re-1",
    profileName: "Regular AMC for Laptop - 54362",
    expenseAccount: "IT and Internet Expenses",
    vendorName: "Distributions",
    frequency: "Weekly",
    lastExpenseDate: "2026-04-07",
    nextExpenseDate: "2026-04-14",
    status: "ACTIVE",
    amount: 500,
    paidThrough: "Distributions",
    startDate: "2026-04-07",
    endDate: "2026-05-02",
    neverExpires: false,
    taxLabel: "GST18",
    amountIs: "Tax Inclusive",
    notes: "-",
    customerName: "Nido Technologies",
    billable: true,
    projects: "",
    gstTreatment: "Out Of Scope",
    reportingTags: ["AMC"],
    createdExpenseIds: [],
    history: [
      {
        id: "h-1",
        timestamp: "2026-04-07T22:59:00.000Z",
        message: "Recurring expense created for Rs.500.00",
        by: "nidotechnologies",
      },
      {
        id: "h-2",
        timestamp: "2026-04-07T22:59:00.000Z",
        message: "Expense Created for Rs.500.00",
        by: "nidotechnologies",
      },
    ],
  },
];

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const fmtCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(value);

export default function RecurringExpensesPage() {
  const { setMeta } = usePageMeta();
  useEffect(() => { setMeta({ title: "Recurring Expenses" }); }, []);

  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { vendors, clients } = useData();

  const createMode = location.pathname.endsWith("/create");
  const editMode = location.pathname.endsWith("/edit") && !!params.id;

  const [profiles, setProfiles] = useState<RecurringExpenseProfile[]>(() =>
    safeReadJson<RecurringExpenseProfile[]>(STORAGE_KEY, defaultProfiles),
  );
  const [selectedId, setSelectedId] = useState(
    params.id || profiles[0]?.id || "",
  );
  const [open, setOpen] = useState(createMode);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "expenses">("overview");

  const [form, setForm] = useState<
    Omit<
      RecurringExpenseProfile,
      | "id"
      | "history"
      | "createdExpenseIds"
      | "lastExpenseDate"
      | "nextExpenseDate"
      | "status"
    >
  >({
    profileName: "",
    expenseAccount: "",
    vendorName: "",
    frequency: "Weekly",
    amount: 0,
    paidThrough: "",
    startDate: today(),
    endDate: "",
    neverExpires: true,
    taxLabel: "",
    amountIs: "Tax Inclusive",
    notes: "",
    customerName: "",
    billable: true,
    projects: "",
    gstTreatment: "Out Of Scope",
    reportingTags: [],
  });

  const persist = (next: RecurringExpenseProfile[]) => {
    setProfiles(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  useEffect(() => {
    if (params.id) setSelectedId(params.id);
  }, [params.id]);

  useEffect(() => {
    if (createMode) {
      setEditingId(null);
      setOpen(true);
      setForm({
        profileName: "",
        expenseAccount: "",
        vendorName: "",
        frequency: "Weekly",
        amount: 0,
        paidThrough: "",
        startDate: today(),
        endDate: "",
        neverExpires: true,
        taxLabel: "",
        amountIs: "Tax Inclusive",
        notes: "",
        customerName: "",
        billable: true,
        projects: "",
        gstTreatment: "Out Of Scope",
        reportingTags: [],
      });
    }
  }, [createMode]);

  useEffect(() => {
    if (!editMode) return;
    const target = profiles.find((entry) => entry.id === params.id);
    if (!target) return;
    setEditingId(target.id);
    setForm({
      profileName: target.profileName,
      expenseAccount: target.expenseAccount,
      vendorName: target.vendorName,
      frequency: target.frequency,
      amount: target.amount,
      paidThrough: target.paidThrough,
      startDate: target.startDate,
      endDate: target.endDate,
      neverExpires: target.neverExpires,
      taxLabel: target.taxLabel,
      amountIs: target.amountIs,
      notes: target.notes,
      customerName: target.customerName,
      billable: target.billable,
      projects: target.projects,
      gstTreatment: target.gstTreatment,
      reportingTags: target.reportingTags,
    });
    setOpen(true);
  }, [editMode, params.id, profiles]);

  const selected = useMemo(
    () =>
      profiles.find((entry) => entry.id === selectedId) || profiles[0] || null,
    [profiles, selectedId],
  );

  const profileExpenses = useMemo(() => {
    if (!selected) return [] as ExpenseEntryLite[];
    const expenses = safeReadJson<ExpenseEntryLite[]>(EXPENSES_STORAGE_KEY, []);
    const byId = new Set(selected.createdExpenseIds);
    return expenses.filter((entry) => byId.has(entry.id));
  }, [selected, profiles]);

  const closeDialog = () => {
    setOpen(false);
    setEditingId(null);
    navigate("/transactions/purchase/recurring-expenses", { replace: true });
  };

  const saveProfile = () => {
    if (!form.profileName.trim() || !form.expenseAccount || !form.paidThrough) {
      toast({
        title: "Profile Name, Expense Account and Paid Through are required",
      });
      return;
    }

    if (editingId) {
      persist(
        profiles.map((entry) =>
          entry.id === editingId
            ? {
                ...entry,
                ...form,
                nextExpenseDate: addByFrequency(form.startDate, form.frequency),
                history: [
                  {
                    id: `h-${Date.now()}`,
                    timestamp: new Date().toISOString(),
                    message: "Recurring expense profile updated",
                    by: "nidotechnologies",
                  },
                  ...entry.history,
                ],
              }
            : entry,
        ),
      );
      toast({ title: "Recurring expense profile updated" });
      closeDialog();
      return;
    }

    const created: RecurringExpenseProfile = {
      id: `re-${Date.now()}`,
      ...form,
      lastExpenseDate: form.startDate,
      nextExpenseDate: addByFrequency(form.startDate, form.frequency),
      status: "ACTIVE",
      createdExpenseIds: [],
      history: [
        {
          id: `h-${Date.now()}`,
          timestamp: new Date().toISOString(),
          message: `Recurring expense created for ${fmtCurrency(form.amount)}`,
          by: "nidotechnologies",
        },
      ],
    };

    const next = [created, ...profiles];
    persist(next);
    setSelectedId(created.id);
    toast({ title: "Recurring expense profile created" });
    closeDialog();
  };

  const createExpenseNow = () => {
    if (!selected) return;

    const taxPercent = Number(selected.taxLabel.replace(/\D/g, "")) || 0;
    const taxAmount =
      selected.amountIs === "Tax Inclusive"
        ? Math.round(
            (selected.amount - selected.amount / (1 + taxPercent / 100)) * 100,
          ) / 100
        : Math.round(((selected.amount * taxPercent) / 100) * 100) / 100;

    const expense: ExpenseEntryLite = {
      id: `ex-${Date.now()}`,
      date: today(),
      expenseAccount: selected.expenseAccount,
      referenceNumber: `R${Date.now().toString().slice(-5)}`,
      vendorName: selected.vendorName,
      paidThrough: selected.paidThrough,
      customerName: selected.customerName || "-",
      status: selected.billable ? "BILLABLE" : "NON-BILLABLE",
      amount: selected.amount,
      expenseType: "Services",
      sac: "",
      gstTreatment: selected.gstTreatment,
      sourceOfSupply: "Karnataka",
      destinationOfSupply: "Karnataka",
      reverseCharge: false,
      taxLabel: selected.taxLabel || "GST18",
      taxPercent,
      taxAmount,
      amountIs: selected.amountIs,
      invoiceNumber: "",
      notes: selected.notes,
      reportingTags: selected.reportingTags,
      receipts: [],
    };

    const allExpenses = safeReadJson<ExpenseEntryLite[]>(
      EXPENSES_STORAGE_KEY,
      [],
    );
    localStorage.setItem(
      EXPENSES_STORAGE_KEY,
      JSON.stringify([expense, ...allExpenses]),
    );

    persist(
      profiles.map((entry) =>
        entry.id === selected.id
          ? {
              ...entry,
              lastExpenseDate: today(),
              nextExpenseDate: addByFrequency(today(), entry.frequency),
              createdExpenseIds: [expense.id, ...entry.createdExpenseIds],
              history: [
                {
                  id: `h-${Date.now()}`,
                  timestamp: new Date().toISOString(),
                  message: `Expense Created for ${fmtCurrency(expense.amount)}`,
                  by: "nidotechnologies",
                  expenseId: expense.id,
                },
                ...entry.history,
              ],
            }
          : entry,
      ),
    );

    toast({ title: "Expense created from recurring profile" });
  };

  const stopProfile = () => {
    if (!selected) return;
    persist(
      profiles.map((entry) =>
        entry.id === selected.id ? { ...entry, status: "STOPPED" } : entry,
      ),
    );
    toast({ title: "Profile stopped" });
  };

  const cloneProfile = () => {
    if (!selected) return;
    const copy: RecurringExpenseProfile = {
      ...selected,
      id: `re-${Date.now()}`,
      profileName: `${selected.profileName} - Copy`,
      createdExpenseIds: [],
      history: [
        {
          id: `h-${Date.now()}`,
          timestamp: new Date().toISOString(),
          message: "Profile cloned",
          by: "nidotechnologies",
        },
      ],
    };
    persist([copy, ...profiles]);
    setSelectedId(copy.id);
    toast({ title: "Profile cloned" });
  };

  const deleteProfile = () => {
    if (!selected) return;
    const next = profiles.filter((entry) => entry.id !== selected.id);
    persist(next);
    setSelectedId(next[0]?.id || "");
    toast({ title: "Profile deleted" });
  };

  return (
    <div>
            <div className="space-y-4 p-6">
        <Card>
          <CardContent className="pt-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-3xl font-semibold">All Profiles</h2>
              <div className="flex gap-2">
                <Button
                  onClick={() =>
                    navigate("/transactions/purchase/recurring-expenses/create")
                  }
                >
                  <Plus className="mr-2 h-4 w-4" /> New
                </Button>
                <Button variant="outline" size="icon">
                  <Ellipsis className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox checked={false} />
                  </TableHead>
                  <TableHead>PROFILE NAME</TableHead>
                  <TableHead>EXPENSE ACCOUNT</TableHead>
                  <TableHead>VENDOR NAME</TableHead>
                  <TableHead>FREQUENCY</TableHead>
                  <TableHead>LAST EXPENSE DATE</TableHead>
                  <TableHead>NEXT EXPENSE DATE</TableHead>
                  <TableHead>STATUS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((entry) => (
                  <TableRow
                    key={entry.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setSelectedId(entry.id);
                      navigate(
                        `/transactions/purchase/recurring-expenses/${entry.id}/edit`,
                      );
                    }}
                  >
                    <TableCell>
                      <Checkbox checked={false} />
                    </TableCell>
                    <TableCell className="font-medium text-blue-600">
                      {entry.profileName}
                    </TableCell>
                    <TableCell>{entry.expenseAccount}</TableCell>
                    <TableCell>{entry.vendorName}</TableCell>
                    <TableCell>{entry.frequency}</TableCell>
                    <TableCell>{entry.lastExpenseDate}</TableCell>
                    <TableCell>{entry.nextExpenseDate}</TableCell>
                    <TableCell>
                      <span
                        className={
                          entry.status === "ACTIVE"
                            ? "text-emerald-600"
                            : "text-slate-500"
                        }
                      >
                        {entry.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {selected && (
          <Card>
            <CardContent className="pt-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-4xl font-semibold">
                    {selected.profileName}
                  </h3>
                  <Badge className="bg-emerald-600 text-white">
                    {selected.status === "ACTIVE" ? "Active" : "Stopped"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      navigate(
                        `/transactions/purchase/recurring-expenses/${selected.id}/edit`,
                      )
                    }
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline">
                        More <Ellipsis className="ml-2 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={createExpenseNow}>
                        Create Expense
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={stopProfile}>
                        Stop
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={cloneProfile}>
                        Clone
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={deleteProfile}>
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      navigate("/transactions/purchase/recurring-expenses", {
                        replace: true,
                      })
                    }
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              <div className="mb-4 flex items-center gap-4 border-b pb-2">
                <button
                  type="button"
                  className={`pb-2 text-sm font-semibold ${
                    tab === "overview"
                      ? "border-b-2 border-blue-500 text-slate-900"
                      : "text-muted-foreground"
                  }`}
                  onClick={() => setTab("overview")}
                >
                  Overview
                </button>
                <button
                  type="button"
                  className={`pb-2 text-sm font-semibold ${
                    tab === "expenses"
                      ? "border-b-2 border-blue-500 text-slate-900"
                      : "text-muted-foreground"
                  }`}
                  onClick={() => setTab("expenses")}
                >
                  All Expenses
                </button>
              </div>

              {tab === "overview" ? (
                <>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-lg border p-4">
                      <p className="text-3xl font-semibold">
                        {fmtCurrency(selected.amount)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Expense Amount
                      </p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-3xl font-semibold">
                        {selected.frequency}
                      </p>
                      <p className="text-sm text-muted-foreground">Repeats</p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-3xl font-semibold">
                        {selected.nextExpenseDate}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Next Expense Date
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Expense Account
                      </p>
                      <p className="font-medium">{selected.expenseAccount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Paid Through
                      </p>
                      <p className="font-medium">{selected.paidThrough}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Start On</p>
                      <p className="font-medium">{selected.startDate}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Ends On
                      </p>
                      <p className="font-medium">
                        {selected.neverExpires
                          ? "Never Expires"
                          : selected.endDate || "-"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 border-t pt-4">
                    <p className="text-2xl font-semibold">Other Details</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Customer
                        </p>
                        <p className="text-blue-600">
                          {selected.customerName || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          GST Treatment
                        </p>
                        <p>{selected.gstTreatment}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Notes</p>
                        <p>{selected.notes || "-"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 rounded-lg border bg-muted/20 p-4">
                    <p className="text-2xl font-semibold">History</p>
                    <div className="mt-3 space-y-3">
                      {selected.history.map((h) => (
                        <div
                          key={h.id}
                          className="grid gap-2 md:grid-cols-[180px_minmax(0,1fr)] text-sm"
                        >
                          <p className="text-muted-foreground">
                            {new Date(h.timestamp).toLocaleDateString()}{" "}
                            {new Date(h.timestamp).toLocaleTimeString()}
                          </p>
                          <div>
                            <p>{h.message}</p>
                            <p className="text-muted-foreground">by {h.by}</p>
                            {h.expenseId ? (
                              <button
                                type="button"
                                className="text-blue-600 hover:underline"
                                onClick={() =>
                                  navigate(
                                    `/transactions/purchase/expenses/${h.expenseId}`,
                                  )
                                }
                              >
                                View the expense
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-lg border p-3">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Reference#</TableHead>
                        <TableHead>Expense Account</TableHead>
                        <TableHead>Paid Through</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {profileExpenses.map((exp) => (
                        <TableRow key={exp.id}>
                          <TableCell>{exp.date}</TableCell>
                          <TableCell>
                            <button
                              type="button"
                              className="text-blue-600 hover:underline"
                              onClick={() =>
                                navigate(
                                  `/transactions/purchase/expenses/${exp.id}`,
                                )
                              }
                            >
                              {exp.referenceNumber}
                            </button>
                          </TableCell>
                          <TableCell>{exp.expenseAccount}</TableCell>
                          <TableCell>{exp.paidThrough}</TableCell>
                          <TableCell className="text-right">
                            {fmtCurrency(exp.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {profileExpenses.length === 0 && (
                    <p className="py-5 text-center text-sm text-muted-foreground">
                      No expenses created for this profile yet.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog
        open={open}
        onOpenChange={(v) => (!v ? closeDialog() : setOpen(v))}
      >
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Recurring Expense</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Profile Name*</Label>
                <Input
                  value={form.profileName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      profileName: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label>Repeat Every*</Label>
                <Select
                  value={form.frequency}
                  onValueChange={(value: Frequency) =>
                    setForm((current) => ({ ...current, frequency: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Weekly">Week</SelectItem>
                    <SelectItem value="Monthly">Month</SelectItem>
                    <SelectItem value="Quarterly">Quarter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      startDate: event.target.value,
                    }))
                  }
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  The recurring expense will be created on{" "}
                  {addByFrequency(form.startDate, form.frequency)}
                </p>
              </div>
              <div>
                <Label>Ends On</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  disabled={form.neverExpires}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      endDate: event.target.value,
                    }))
                  }
                />
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.neverExpires}
                    onCheckedChange={(checked) =>
                      setForm((current) => ({
                        ...current,
                        neverExpires: !!checked,
                      }))
                    }
                  />
                  Never Expires
                </label>
              </div>
              <div>
                <Label>Expense Account*</Label>
                <Select
                  value={form.expenseAccount || "none"}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      expenseAccount: value === "none" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select</SelectItem>
                    <SelectItem value="IT and Internet Expenses">
                      IT and Internet Expenses
                    </SelectItem>
                    <SelectItem value="Materials">Materials</SelectItem>
                    <SelectItem value="Automobile Expense">
                      Automobile Expense
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount*</Label>
                <div className="flex gap-2">
                  <Select defaultValue="INR">
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INR">INR</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={String(form.amount || "")}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        amount: toNumber(event.target.value),
                      }))
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Paid Through*</Label>
                <Select
                  value={form.paidThrough || "none"}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      paidThrough: value === "none" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select</SelectItem>
                    <SelectItem value="Distributions">Distributions</SelectItem>
                    <SelectItem value="Petty Cash">Petty Cash</SelectItem>
                    <SelectItem value="GST Payable">GST Payable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tax</Label>
                <Select
                  value={form.taxLabel || "none"}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      taxLabel: value === "none" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a Tax" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select a Tax</SelectItem>
                    <SelectItem value="GST18">GST18</SelectItem>
                    <SelectItem value="GST12">GST12</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount Is</Label>
                <div className="mt-2 flex items-center gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={form.amountIs === "Tax Inclusive"}
                      onChange={() =>
                        setForm((current) => ({
                          ...current,
                          amountIs: "Tax Inclusive",
                        }))
                      }
                    />
                    Tax Inclusive
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={form.amountIs === "Tax Exclusive"}
                      onChange={() =>
                        setForm((current) => ({
                          ...current,
                          amountIs: "Tax Exclusive",
                        }))
                      }
                    />
                    Tax Exclusive
                  </label>
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  maxLength={500}
                  placeholder="Max. 500 characters"
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label>Customer Name</Label>
                <div className="flex items-center gap-2">
                  <Select
                    value={form.customerName || "none"}
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        customerName: value === "none" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select</SelectItem>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.name}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-1 text-xs">
                    <Checkbox
                      checked={form.billable}
                      onCheckedChange={(checked) =>
                        setForm((current) => ({
                          ...current,
                          billable: !!checked,
                        }))
                      }
                    />
                    Billable
                  </label>
                </div>
              </div>
              <div>
                <Label>Projects</Label>
                <Input
                  value={form.projects}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      projects: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label>Vendor</Label>
                <Select
                  value={form.vendorName || "none"}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      vendorName: value === "none" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select</SelectItem>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.name}>
                        {vendor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Reporting Tags</Label>
                <button
                  type="button"
                  className="mt-2 text-sm text-blue-600 hover:underline"
                  onClick={() => toast({ title: "Associate Tags opened" })}
                >
                  Associate Tags
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 border-t pt-3">
              <Button onClick={saveProfile}>Save</Button>
              <Button variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
