import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { safeReadJson } from "@/lib/utils";
import { getVendors } from "@/lib/vendorDataStore";
import { getClients } from "@/lib/clientStore";
import { generateRecurringExpensePdf } from "@/lib/expensePdf";
import {
  ArrowLeft,
  BadgePercent,
  Download,
  Ellipsis,
  FileText,
  Pencil,
  Plus,
  Receipt,
  RefreshCw,
  Save,
  Tag,
  X,
} from "lucide-react";
import { usePageMeta } from "@/contexts/PageMetaContext";

// ── Types ─────────────────────────────────────────────────────────────────────
type Frequency = "Weekly" | "Monthly" | "Quarterly";
type ProfileStatus = "ACTIVE" | "STOPPED";

interface RecurringHistory {
  id: string;
  timestamp: string;
  message: string;
  by: string;
  expenseId?: string;
}

export interface RecurringExpenseProfile {
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

// ── Constants ─────────────────────────────────────────────────────────────────
const STORAGE_KEY = "nido_recurring_expenses_v1";
const EXPENSES_STORAGE_KEY = "nido_expenses_v1";

// ── Helpers ───────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);

const addByFrequency = (date: string, frequency: Frequency) => {
  const d = new Date(`${date}T00:00:00`);
  if (frequency === "Weekly") d.setDate(d.getDate() + 7);
  if (frequency === "Monthly") d.setMonth(d.getMonth() + 1);
  if (frequency === "Quarterly") d.setMonth(d.getMonth() + 3);
  return d.toISOString().slice(0, 10);
};

const toNumber = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(v);

// ── Default data ──────────────────────────────────────────────────────────────
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
        message: "Recurring expense created for ₹500.00",
        by: "nidotechnologies",
      },
      {
        id: "h-2",
        timestamp: "2026-04-07T22:59:00.000Z",
        message: "Expense Created for ₹500.00",
        by: "nidotechnologies",
      },
    ],
  },
];

// ── Shared style tokens ───────────────────────────────────────────────────────
const inp =
  "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white placeholder-gray-400 transition-colors";
const sel =
  "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white transition-colors";

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl mb-5 overflow-hidden">
      <div className="flex items-center gap-2.5 px-6 py-3.5 border-b border-gray-100 bg-gray-50/70">
        <div className="w-1 h-4 bg-blue-600 rounded-full shrink-0" />
        {Icon && <Icon size={14} className="text-blue-600 shrink-0" />}
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-700">
          {title}
        </h3>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
      {children}
      {required && <span className="text-red-400 ml-0.5 normal-case">*</span>}
    </label>
  );
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value || "—"}</p>
    </div>
  );
}

// ── Blank form ────────────────────────────────────────────────────────────────
type FormState = Omit<RecurringExpenseProfile, "id" | "history" | "createdExpenseIds" | "lastExpenseDate" | "nextExpenseDate" | "status">;

const blankForm = (): FormState => ({
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

// ── Main component ────────────────────────────────────────────────────────────
export default function RecurringExpensesPage() {
  const { setMeta } = usePageMeta();
  useEffect(() => { setMeta({ title: "Recurring Expenses" }); }, []);

  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ id?: string }>();

  const createMode = location.pathname.endsWith("/create");
  const editMode = location.pathname.endsWith("/edit") && !!params.id;
  const isFormMode = createMode || editMode;

  const vendorNames = useMemo(() => getVendors().filter((v) => !v.archived).map((v) => v.name), []);
  const clientNames = useMemo(() => getClients().map((c) => c.name), []);

  const [profiles, setProfiles] = useState<RecurringExpenseProfile[]>(() =>
    safeReadJson<RecurringExpenseProfile[]>(STORAGE_KEY, defaultProfiles),
  );
  const [selectedId, setSelectedId] = useState(params.id || profiles[0]?.id || "");
  const [tab, setTab] = useState<"overview" | "expenses">("overview");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(blankForm);

  useEffect(() => {
    if (params.id) setSelectedId(params.id);
  }, [params.id]);

  // Populate form when entering create mode
  useEffect(() => {
    if (createMode) setForm(blankForm());
  }, [createMode]);

  // Populate form when entering edit mode
  useEffect(() => {
    if (!editMode || !params.id) return;
    const target = profiles.find((p) => p.id === params.id);
    if (!target) return;
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
  }, [editMode, params.id]);

  const selected = useMemo(
    () => profiles.find((p) => p.id === selectedId) || profiles[0] || null,
    [profiles, selectedId],
  );

  const profileExpenses = useMemo(() => {
    if (!selected) return [] as ExpenseEntryLite[];
    const expenses = safeReadJson<ExpenseEntryLite[]>(EXPENSES_STORAGE_KEY, []);
    const byId = new Set(selected.createdExpenseIds);
    return expenses.filter((e) => byId.has(e.id));
  }, [selected, profiles]);

  const persist = (next: RecurringExpenseProfile[]) => {
    setProfiles(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const setF = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((c) => ({ ...c, [key]: value }));

  const backToList = () =>
    navigate("/transactions/purchase/recurring-expenses", { replace: true });

  const saveProfile = () => {
    if (!form.profileName.trim() || !form.expenseAccount || !form.paidThrough) {
      toast({ title: "Profile Name, Expense Account and Paid Through are required" });
      return;
    }
    setSaving(true);
    try {
      if (editMode && params.id) {
        persist(
          profiles.map((p) =>
            p.id === params.id
              ? {
                  ...p,
                  ...form,
                  nextExpenseDate: addByFrequency(form.startDate, form.frequency),
                  history: [
                    {
                      id: `h-${Date.now()}`,
                      timestamp: new Date().toISOString(),
                      message: "Recurring expense profile updated",
                      by: "nidotechnologies",
                    },
                    ...p.history,
                  ],
                }
              : p,
          ),
        );
        toast({ title: "Profile updated" });
      } else {
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
        persist([created, ...profiles]);
        setSelectedId(created.id);
        toast({ title: "Recurring expense profile created" });
      }
      backToList();
    } finally {
      setSaving(false);
    }
  };

  const createExpenseNow = () => {
    if (!selected) return;
    const taxPercent = Number(selected.taxLabel.replace(/\D/g, "")) || 0;
    const taxAmount =
      selected.amountIs === "Tax Inclusive"
        ? Math.round((selected.amount - selected.amount / (1 + taxPercent / 100)) * 100) / 100
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

    const all = safeReadJson<ExpenseEntryLite[]>(EXPENSES_STORAGE_KEY, []);
    localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify([expense, ...all]));

    persist(
      profiles.map((p) =>
        p.id === selected.id
          ? {
              ...p,
              lastExpenseDate: today(),
              nextExpenseDate: addByFrequency(today(), p.frequency),
              createdExpenseIds: [expense.id, ...p.createdExpenseIds],
              history: [
                {
                  id: `h-${Date.now()}`,
                  timestamp: new Date().toISOString(),
                  message: `Expense Created for ${fmtCurrency(expense.amount)}`,
                  by: "nidotechnologies",
                  expenseId: expense.id,
                },
                ...p.history,
              ],
            }
          : p,
      ),
    );
    toast({ title: "Expense created from recurring profile" });
  };

  const stopProfile = () => {
    if (!selected) return;
    persist(profiles.map((p) => (p.id === selected.id ? { ...p, status: "STOPPED" } : p)));
    toast({ title: "Profile stopped" });
  };

  const resumeProfile = () => {
    if (!selected) return;
    persist(profiles.map((p) => (p.id === selected.id ? { ...p, status: "ACTIVE" } : p)));
    toast({ title: "Profile resumed" });
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
    const next = profiles.filter((p) => p.id !== selected.id);
    persist(next);
    setSelectedId(next[0]?.id || "");
    toast({ title: "Profile deleted" });
  };

  const handleDownloadPdf = async () => {
    if (!selected) return;
    setPdfLoading(true);
    try {
      await generateRecurringExpensePdf(selected);
    } catch (err) {
      console.error(err);
      toast({ title: "PDF generation failed", description: String(err) });
    } finally {
      setPdfLoading(false);
    }
  };

  // ── FORM PAGE ──────────────────────────────────────────────────────────────
  if (isFormMode) {
    const isEdit = editMode;
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Sticky toolbar */}
        <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
          <div className="px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={backToList}
                className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors shrink-0"
              >
                <ArrowLeft size={16} /> Back
              </button>
              <span className="text-gray-300">|</span>
              <h1 className="text-sm font-bold text-gray-900 truncate">
                {isEdit ? "Edit Recurring Expense" : "New Recurring Expense"}
              </h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={backToList}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveProfile}
                disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                <Save size={14} />
                {saving ? "Saving…" : isEdit ? "Update Profile" : "Save Profile"}
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="w-full px-6 py-7">
          {/* Section 1 — Profile Setup */}
          <Section title="Profile Setup" icon={RefreshCw}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <FieldLabel required>Profile Name</FieldLabel>
                <input
                  type="text"
                  className={inp}
                  placeholder="e.g. Monthly Office Rent"
                  value={form.profileName}
                  onChange={(e) => setF("profileName", e.target.value)}
                />
              </div>
              <div>
                <FieldLabel required>Repeat Every</FieldLabel>
                <select className={sel} value={form.frequency} onChange={(e) => setF("frequency", e.target.value as Frequency)}>
                  <option value="Weekly">Weekly</option>
                  <option value="Monthly">Monthly</option>
                  <option value="Quarterly">Quarterly</option>
                </select>
              </div>
              <div>
                <FieldLabel required>Start Date</FieldLabel>
                <input
                  type="date"
                  className={inp}
                  value={form.startDate}
                  onChange={(e) => setF("startDate", e.target.value)}
                />
                {form.startDate && (
                  <p className="mt-1.5 text-xs text-gray-400">
                    First expense will be created on{" "}
                    <span className="font-medium text-gray-600">
                      {addByFrequency(form.startDate, form.frequency)}
                    </span>
                  </p>
                )}
              </div>
              <div>
                <FieldLabel>Ends On</FieldLabel>
                <input
                  type="date"
                  className={inp}
                  value={form.endDate}
                  disabled={form.neverExpires}
                  onChange={(e) => setF("endDate", e.target.value)}
                />
                <label className="mt-2 flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="accent-blue-600 w-4 h-4"
                    checked={form.neverExpires}
                    onChange={(e) => setF("neverExpires", e.target.checked)}
                  />
                  Never Expires
                </label>
              </div>
            </div>
          </Section>

          {/* Section 2 — Expense Details */}
          <Section title="Expense Details" icon={Receipt}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <FieldLabel required>Expense Account</FieldLabel>
                <select className={sel} value={form.expenseAccount} onChange={(e) => setF("expenseAccount", e.target.value)}>
                  <option value="">Select an account</option>
                  <option value="IT and Internet Expenses">IT and Internet Expenses</option>
                  <option value="Materials">Materials</option>
                  <option value="Automobile Expense">Automobile Expense</option>
                  <option value="Office Expense">Office Expense</option>
                  <option value="Travel Expense">Travel Expense</option>
                  <option value="Utilities">Utilities</option>
                  <option value="Rent Expense">Rent Expense</option>
                </select>
              </div>
              <div>
                <FieldLabel required>Amount</FieldLabel>
                <div className="flex gap-2">
                  <select className="w-20 px-2 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-400">
                    <option>INR</option>
                  </select>
                  <input
                    type="number"
                    className={inp}
                    placeholder="0.00"
                    value={form.amount || ""}
                    onChange={(e) => setF("amount", toNumber(e.target.value))}
                  />
                </div>
              </div>
              <div>
                <FieldLabel required>Paid Through</FieldLabel>
                <select className={sel} value={form.paidThrough} onChange={(e) => setF("paidThrough", e.target.value)}>
                  <option value="">Select an account</option>
                  <option value="Distributions">Distributions</option>
                  <option value="Petty Cash">Petty Cash</option>
                  <option value="GST Payable">GST Payable</option>
                  <option value="ICICI Bank">ICICI Bank</option>
                  <option value="HDFC Bank">HDFC Bank</option>
                  <option value="Corporate Credit Card">Corporate Credit Card</option>
                </select>
              </div>
              <div>
                <FieldLabel>Tax</FieldLabel>
                <select className={sel} value={form.taxLabel} onChange={(e) => setF("taxLabel", e.target.value)}>
                  <option value="">Select a tax</option>
                  <option value="GST5">GST 5%</option>
                  <option value="GST12">GST 12%</option>
                  <option value="GST18">GST 18%</option>
                  <option value="GST28">GST 28%</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <FieldLabel>Amount Is</FieldLabel>
                <div className="flex items-center gap-6 mt-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" className="accent-blue-600" checked={form.amountIs === "Tax Inclusive"} onChange={() => setF("amountIs", "Tax Inclusive")} />
                    Tax Inclusive
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" className="accent-blue-600" checked={form.amountIs === "Tax Exclusive"} onChange={() => setF("amountIs", "Tax Exclusive")} />
                    Tax Exclusive
                  </label>
                </div>
              </div>
            </div>
          </Section>

          {/* Section 3 — Vendor & Customer */}
          <Section title="Vendor & Customer" icon={Tag}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <FieldLabel>Vendor</FieldLabel>
                <select className={sel} value={form.vendorName} onChange={(e) => setF("vendorName", e.target.value)}>
                  <option value="">Select vendor</option>
                  {vendorNames.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Customer Name</FieldLabel>
                <div className="flex gap-3 items-center">
                  <select className={sel} value={form.customerName} onChange={(e) => setF("customerName", e.target.value)}>
                    <option value="">Select customer</option>
                    {clientNames.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none whitespace-nowrap">
                    <input
                      type="checkbox"
                      className="accent-blue-600 w-4 h-4"
                      checked={form.billable}
                      onChange={(e) => setF("billable", e.target.checked)}
                    />
                    Billable
                  </label>
                </div>
              </div>
              <div>
                <FieldLabel>GST Treatment</FieldLabel>
                <select className={sel} value={form.gstTreatment} onChange={(e) => setF("gstTreatment", e.target.value)}>
                  <option value="Out Of Scope">Out Of Scope</option>
                  <option value="Registered Business - Regular">Registered Business - Regular</option>
                  <option value="Registered Business - Composition">Registered Business - Composition</option>
                  <option value="Unregistered Business">Unregistered Business</option>
                  <option value="Consumer">Consumer</option>
                  <option value="Overseas">Overseas</option>
                </select>
              </div>
              <div>
                <FieldLabel>Projects</FieldLabel>
                <input
                  type="text"
                  className={inp}
                  placeholder="Project name"
                  value={form.projects}
                  onChange={(e) => setF("projects", e.target.value)}
                />
              </div>
            </div>
          </Section>

          {/* Section 4 — Notes & Tags */}
          <Section title="Notes & Tags" icon={BadgePercent}>
            <div className="grid grid-cols-1 gap-5">
              <div>
                <FieldLabel>Notes</FieldLabel>
                <textarea
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white placeholder-gray-400 transition-colors resize-none"
                  rows={3}
                  maxLength={500}
                  placeholder="Add a note (max 500 characters)"
                  value={form.notes}
                  onChange={(e) => setF("notes", e.target.value)}
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{form.notes.length}/500</p>
              </div>
              <div>
                <FieldLabel>Reporting Tags</FieldLabel>
                <button
                  type="button"
                  className="mt-1 text-sm text-blue-600 hover:underline"
                  onClick={() => toast({ title: "Associate Tags opened" })}
                >
                  + Associate Tags
                </button>
              </div>
            </div>
          </Section>

          {/* Bottom action bar */}
          <div className="flex items-center gap-3 mt-2 pt-5 border-t border-gray-200">
            <button
              type="button"
              onClick={saveProfile}
              disabled={saving}
              className="flex items-center gap-1.5 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              <Save size={14} />
              {saving ? "Saving…" : isEdit ? "Update Profile" : "Save Profile"}
            </button>
            <button
              type="button"
              onClick={backToList}
              className="px-5 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── LIST + DETAIL PAGE ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full space-y-5 p-6">

        {/* Header card */}
        <Card className="border-gray-200 shadow-sm">
          <CardContent className="px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-2xl font-bold text-gray-900">All Profiles</h2>
              <div className="flex gap-2">
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => navigate("/transactions/purchase/recurring-expenses/create")}
                >
                  <Plus className="mr-2 h-4 w-4" /> New Profile
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon">
                      <Ellipsis className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => toast({ title: "Export started" })}>
                      Export Profiles
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profiles table */}
        <Card className="border-gray-200 shadow-sm">
          <CardContent className="px-6 py-5">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-200">
                  <TableHead className="w-10 pl-2">
                    <Checkbox checked={false} />
                  </TableHead>
                  <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Profile Name</TableHead>
                  <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Expense Account</TableHead>
                  <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Vendor Name</TableHead>
                  <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Frequency</TableHead>
                  <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Last Expense Date</TableHead>
                  <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Next Expense Date</TableHead>
                  <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((p) => (
                  <TableRow
                    key={p.id}
                    className={`cursor-pointer border-gray-100 transition-colors ${
                      selected?.id === p.id ? "bg-blue-50 hover:bg-blue-50" : "hover:bg-gray-50"
                    }`}
                    onClick={() => {
                      setSelectedId(p.id);
                      navigate(`/transactions/purchase/recurring-expenses/${p.id}/edit`, { replace: false });
                    }}
                  >
                    <TableCell className="pl-2">
                      <Checkbox checked={selected?.id === p.id} onClick={(e) => e.stopPropagation()} />
                    </TableCell>
                    <TableCell className="py-3.5">
                      <span className="text-sm font-semibold text-blue-600">{p.profileName}</span>
                    </TableCell>
                    <TableCell className="text-sm text-gray-700 py-3.5">{p.expenseAccount}</TableCell>
                    <TableCell className="text-sm text-gray-600 py-3.5 max-w-[160px] truncate">{p.vendorName || "—"}</TableCell>
                    <TableCell className="text-sm text-gray-600 py-3.5">{p.frequency}</TableCell>
                    <TableCell className="text-sm text-gray-600 py-3.5 whitespace-nowrap">{p.lastExpenseDate}</TableCell>
                    <TableCell className="text-sm text-gray-600 py-3.5 whitespace-nowrap">{p.nextExpenseDate}</TableCell>
                    <TableCell className="py-3.5">
                      <Badge
                        className={`text-xs font-semibold ${
                          p.status === "ACTIVE"
                            ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                            : "bg-gray-100 text-gray-500 border-gray-200"
                        }`}
                        variant="outline"
                      >
                        {p.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {profiles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-sm text-gray-400">
                      No recurring expense profiles yet. Create your first one.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Selected profile detail */}
        {selected && (
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="px-6 py-6">
              {/* Detail toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-3 min-w-0">
                  <h3 className="text-lg font-bold text-gray-900 truncate">{selected.profileName}</h3>
                  <Badge
                    className={`text-xs font-semibold ${
                      selected.status === "ACTIVE"
                        ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                        : "bg-gray-100 text-gray-500 border-gray-200"
                    }`}
                    variant="outline"
                  >
                    {selected.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-gray-200 text-gray-600 hover:text-gray-900 gap-1.5"
                    onClick={() => navigate(`/transactions/purchase/recurring-expenses/${selected.id}/edit`)}
                  >
                    <Pencil size={13} /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pdfLoading}
                    className="h-8 text-xs border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 gap-1.5"
                    onClick={handleDownloadPdf}
                  >
                    <Download size={13} />
                    {pdfLoading ? "Generating…" : "Download PDF"}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 text-xs border-gray-200 gap-1">
                        More <Ellipsis className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={createExpenseNow}>
                        Create Expense Now
                      </DropdownMenuItem>
                      {selected.status === "ACTIVE" ? (
                        <DropdownMenuItem onSelect={stopProfile}>Stop Profile</DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onSelect={resumeProfile}>Resume Profile</DropdownMenuItem>
                      )}
                      <DropdownMenuItem onSelect={cloneProfile}>Clone Profile</DropdownMenuItem>
                      <DropdownMenuItem onSelect={deleteProfile} className="text-red-600 focus:text-red-600">
                        Delete Profile
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => navigate("/transactions/purchase/recurring-expenses", { replace: true })}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-4 border-b border-gray-100 mb-6">
                {(["overview", "expenses"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={`pb-3 text-sm font-semibold capitalize transition-colors ${
                      tab === t
                        ? "border-b-2 border-blue-500 text-gray-900"
                        : "text-gray-400 hover:text-gray-700"
                    }`}
                  >
                    {t === "overview" ? "Overview" : "All Expenses"}
                  </button>
                ))}
              </div>

              {/* Overview tab */}
              {tab === "overview" && (
                <>
                  {/* Summary hero cards */}
                  <div className="grid gap-4 md:grid-cols-3 mb-6">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-5">
                      <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-1">Expense Amount</p>
                      <p className="text-3xl font-bold text-blue-700">{fmtCurrency(selected.amount)}</p>
                      <p className="text-xs text-gray-500 mt-2">{selected.expenseAccount}</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-100 rounded-xl p-5">
                      <p className="text-xs font-semibold text-purple-400 uppercase tracking-wide mb-1">Repeats</p>
                      <p className="text-3xl font-bold text-purple-700">{selected.frequency}</p>
                      <p className="text-xs text-gray-500 mt-2">{selected.paidThrough}</p>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl p-5">
                      <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-1">Next Expense Date</p>
                      <p className="text-2xl font-bold text-emerald-700">{selected.nextExpenseDate}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        Starts {selected.startDate} · {selected.neverExpires ? "Never Expires" : `Ends ${selected.endDate || "—"}`}
                      </p>
                    </div>
                  </div>

                  {/* Other details grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-5 mb-6">
                    <DetailField label="Paid Through" value={selected.paidThrough} />
                    <DetailField label="Tax" value={selected.taxLabel || "—"} />
                    <DetailField label="Amount Is" value={selected.amountIs} />
                    <DetailField label="GST Treatment" value={selected.gstTreatment} />
                    <DetailField label="Customer" value={<span className="text-blue-600">{selected.customerName || "—"}</span>} />
                    <DetailField label="Vendor" value={<span className="text-blue-600">{selected.vendorName || "—"}</span>} />
                    <DetailField label="Billable" value={selected.billable ? "Yes" : "No"} />
                    <DetailField label="Projects" value={selected.projects || "—"} />
                  </div>

                  {selected.notes && selected.notes !== "-" && (
                    <div className="mb-6 pt-5 border-t border-gray-100">
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Notes</p>
                      <p className="text-sm text-gray-600 leading-relaxed">{selected.notes}</p>
                    </div>
                  )}

                  {/* History */}
                  <div className="pt-5 border-t border-gray-100">
                    <p className="text-sm font-bold text-gray-800 mb-4">History</p>
                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                      {selected.history.map((h, i) => (
                        <div
                          key={h.id}
                          className={`flex gap-4 px-5 py-3.5 text-sm ${i > 0 ? "border-t border-gray-100" : ""} ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}
                        >
                          <span className="text-gray-400 whitespace-nowrap shrink-0 w-44">
                            {new Date(h.timestamp).toLocaleDateString()}{" "}
                            {new Date(h.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <div className="min-w-0">
                            <p className="text-gray-700">{h.message}</p>
                            <p className="text-xs text-gray-400 mt-0.5">by {h.by}</p>
                            {h.expenseId && (
                              <button
                                type="button"
                                className="text-xs text-blue-600 hover:underline mt-0.5"
                                onClick={() => navigate(`/transactions/purchase/expenses/${h.expenseId}`)}
                              >
                                View the expense →
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {selected.history.length === 0 && (
                        <p className="py-8 text-center text-sm text-gray-400">No history yet.</p>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* All Expenses tab */}
              {tab === "expenses" && (
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 border-gray-200">
                        <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide pl-5">Date</TableHead>
                        <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Reference #</TableHead>
                        <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Expense Account</TableHead>
                        <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Paid Through</TableHead>
                        <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide text-right pr-5">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {profileExpenses.map((exp) => (
                        <TableRow key={exp.id} className="border-gray-100 hover:bg-gray-50 transition-colors">
                          <TableCell className="text-sm text-gray-600 py-3.5 pl-5">{exp.date}</TableCell>
                          <TableCell className="py-3.5">
                            <button
                              type="button"
                              className="text-sm text-blue-600 hover:underline"
                              onClick={() => navigate(`/transactions/purchase/expenses/${exp.id}`)}
                            >
                              {exp.referenceNumber}
                            </button>
                          </TableCell>
                          <TableCell className="text-sm text-gray-700 py-3.5">{exp.expenseAccount}</TableCell>
                          <TableCell className="text-sm text-gray-600 py-3.5">{exp.paidThrough}</TableCell>
                          <TableCell className="text-sm font-medium text-gray-800 py-3.5 text-right pr-5">
                            {fmtCurrency(exp.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {profileExpenses.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <FileText size={32} className="text-gray-300 mb-3" />
                      <p className="text-sm text-gray-400">No expenses created for this profile yet.</p>
                      <button
                        type="button"
                        onClick={createExpenseNow}
                        className="mt-3 text-sm text-blue-600 hover:underline font-medium"
                      >
                        Create expense now →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
