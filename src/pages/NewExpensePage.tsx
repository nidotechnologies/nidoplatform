import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  Receipt,
  Tag,
  BadgePercent,
  ImageUp,
  Search,
  X,
  GripVertical,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { safeReadJson } from "@/lib/utils";
import { getVendors } from "@/lib/vendorDataStore";
import { getClients } from "@/lib/clientStore";
import { useAuth } from "@/contexts/AuthContext";

// ── Types ─────────────────────────────────────────────────────────────────────
type ExpenseType = "Goods" | "Services";

export interface ReceiptFile {
  name: string;
  dataUrl: string;
  type: string;
}

interface ExpenseEntry {
  id: string;
  date: string;
  expenseAccount: string;
  referenceNumber: string;
  vendorName: string;
  paidThrough: string;
  customerName: string;
  status: "BILLABLE" | "NON-BILLABLE";
  amount: number;
  expenseType: ExpenseType;
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
  receipts: ReceiptFile[];
  createdBy?: string;
  createdById?: string;
  createdByEmail?: string;
  submittedBy?: string;
  submittedById?: string;
  submittedByEmail?: string;
}

const STORAGE_KEY = "nido_expenses_v1";

// ── Helpers ───────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);

const toNumber = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const calcTax = (amount: number, pct: number, inclusive: boolean) => {
  if (pct <= 0) return 0;
  if (inclusive)
    return Math.round((amount - amount / (1 + pct / 100)) * 100) / 100;
  return Math.round(((amount * pct) / 100) * 100) / 100;
};

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(v);

const getVendorNames = (): string[] =>
  getVendors()
    .filter((v) => !v.archived)
    .map((v) => v.name)
    .filter(Boolean);

const getClientNames = (): string[] =>
  getClients()
    .map((c) => c.name)
    .filter(Boolean);

// ── Shared style tokens (match app-wide pattern) ──────────────────────────────
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

// ── Main component ────────────────────────────────────────────────────────────
export default function NewExpensePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const uploadRef = useRef<HTMLInputElement>(null);

  const vendorNames = getVendorNames();
  const clientNames = getClientNames();

  const [expenseTab, setExpenseTab] = useState<"expense" | "mileage">(
    "expense",
  );
  const [receipts, setReceipts] = useState<ReceiptFile[]>([]);
  const [saving, setSaving] = useState(false);
  // Right-column panel order (drag to reorder)
  const [panelOrder, setPanelOrder] = useState<("receipts" | "summary")[]>(["receipts", "summary"]);
  const dragPanelRef = useRef<"receipts" | "summary" | null>(null);

  const [form, setForm] = useState({
    date: today(),
    expenseAccount: "",
    amount: "",
    paidThrough: "",
    expenseType: "Services" as ExpenseType,
    sac: "",
    vendorName: "",
    gstTreatment: "",
    sourceOfSupply: "",
    destinationOfSupply: "[KA] - Karnataka",
    reverseCharge: false,
    taxLabel: "",
    amountIs: "Tax Inclusive" as "Tax Inclusive" | "Tax Exclusive",
    invoiceNumber: "",
    notes: "",
    customerName: "",
    referenceNumber: "",
  });

  const setF = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((c) => ({ ...c, [key]: value }));

  const taxPercent = Number(form.taxLabel.replace(/\D/g, "")) || 0;
  const amountValue = toNumber(form.amount, 0);
  const taxAmount = calcTax(
    amountValue,
    taxPercent,
    form.amountIs === "Tax Inclusive",
  );
  const baseAmount =
    form.amountIs === "Tax Inclusive"
      ? amountValue - taxAmount
      : amountValue;

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    let loaded = 0;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setReceipts((c) => [
          ...c,
          { name: file.name, dataUrl: reader.result as string, type: file.type },
        ]);
        loaded += 1;
        if (loaded === files.length)
          toast({ title: `${files.length} receipt(s) attached` });
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const handleSave = (andNew = false) => {
    if (!form.expenseAccount || !form.amount || !form.paidThrough) {
      toast({
        title: "Required fields missing",
        description: "Expense Account, Amount and Paid Through are required.",
      });
      return;
    }

    setSaving(true);
    try {
      const entry: ExpenseEntry = {
        id: `ex-${Date.now()}`,
        date: form.date,
        expenseAccount: form.expenseAccount,
        referenceNumber:
          form.referenceNumber || `R${Date.now().toString().slice(-5)}`,
        vendorName: form.vendorName || "-",
        paidThrough: form.paidThrough,
        customerName: form.customerName || "-",
        status: "NON-BILLABLE",
        amount: amountValue,
        expenseType: form.expenseType,
        sac: form.sac,
        gstTreatment: form.gstTreatment || "Registered Business - Regular",
        sourceOfSupply: form.sourceOfSupply || "Karnataka",
        destinationOfSupply: form.destinationOfSupply,
        reverseCharge: form.reverseCharge,
        taxLabel: form.taxLabel || "GST18",
        taxPercent,
        taxAmount,
        amountIs: form.amountIs,
        invoiceNumber: form.invoiceNumber,
        notes: form.notes,
        reportingTags: [],
        receipts,
        createdBy: user?.name || "",
        createdById: user?.id || "",
        createdByEmail: user?.email || "",
      };

      const existing = safeReadJson<ExpenseEntry[]>(STORAGE_KEY, []);
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([entry, ...existing]),
      );
      toast({ title: "Expense saved" });

      if (andNew) {
        setForm((c) => ({
          ...c,
          amount: "",
          invoiceNumber: "",
          notes: "",
          referenceNumber: "",
          vendorName: "",
          customerName: "",
        }));
        setReceipts([]);
      } else {
        navigate(`/transactions/purchase/expenses/${entry.id}`, {
          replace: true,
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Sticky toolbar ── */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate("/transactions/purchase/expenses")}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors shrink-0"
            >
              <ArrowLeft size={16} /> Back
            </button>
            <span className="text-gray-300">|</span>
            <h1 className="text-sm font-bold text-gray-900 truncate">
              New Expense
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate("/transactions/purchase/expenses")}
              className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Save &amp; New
            </button>
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              <Save size={14} />
              {saving ? "Saving…" : "Save Expense"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="w-full px-6 py-7">
        {/* Tab switcher */}
        <div className="flex items-center gap-1 mb-6 p-1 bg-white border border-gray-200 rounded-xl w-fit shadow-sm">
          <button
            type="button"
            onClick={() => setExpenseTab("expense")}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${
              expenseTab === "expense"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
            }`}
          >
            Record Expense
          </button>
          <button
            type="button"
            onClick={() => {
              setExpenseTab("mileage");
              toast({ title: "Record Mileage coming soon" });
            }}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${
              expenseTab === "mileage"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
            }`}
          >
            Record Mileage
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-5">
          {/* ── Left column ── */}
          <div>
            {/* Section 1 — Expense Details */}
            <Section title="Expense Details" icon={Receipt}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <FieldLabel required>Date</FieldLabel>
                  <input
                    type="date"
                    className={inp}
                    value={form.date}
                    onChange={(e) => setF("date", e.target.value)}
                  />
                </div>

                <div>
                  <FieldLabel required>Expense Account</FieldLabel>
                  <select
                    className={sel}
                    value={form.expenseAccount}
                    onChange={(e) => setF("expenseAccount", e.target.value)}
                  >
                    <option value="">Select an account</option>
                    <option value="Materials">Materials</option>
                    <option value="Automobile Expense">Automobile Expense</option>
                    <option value="Office Expense">Office Expense</option>
                    <option value="Travel Expense">Travel Expense</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Rent Expense">Rent Expense</option>
                  </select>
                  <button
                    type="button"
                    className="mt-1.5 text-xs text-blue-600 hover:underline"
                    onClick={() => toast({ title: "Itemize panel opened" })}
                  >
                    + Itemize
                  </button>
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
                      value={form.amount}
                      onChange={(e) => setF("amount", e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <FieldLabel required>Paid Through</FieldLabel>
                  <select
                    className={sel}
                    value={form.paidThrough}
                    onChange={(e) => setF("paidThrough", e.target.value)}
                  >
                    <option value="">Select an account</option>
                    <option value="Petty Cash">Petty Cash</option>
                    <option value="GST Payable">GST Payable</option>
                    <option value="ICICI Bank">ICICI Bank</option>
                    <option value="HDFC Bank">HDFC Bank</option>
                    <option value="Corporate Credit Card">
                      Corporate Credit Card
                    </option>
                  </select>
                </div>

                <div>
                  <FieldLabel>Reference #</FieldLabel>
                  <input
                    type="text"
                    className={inp}
                    placeholder="e.g. S14682"
                    value={form.referenceNumber}
                    onChange={(e) => setF("referenceNumber", e.target.value)}
                  />
                </div>

                <div>
                  <FieldLabel>Invoice #</FieldLabel>
                  <input
                    type="text"
                    className={inp}
                    placeholder="Vendor invoice number"
                    value={form.invoiceNumber}
                    onChange={(e) => setF("invoiceNumber", e.target.value)}
                  />
                </div>
              </div>
            </Section>

            {/* Section 2 — Vendor & Customer */}
            <Section title="Vendor & Customer" icon={Tag}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <FieldLabel>Expense Type</FieldLabel>
                  <div className="flex items-center gap-6 mt-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        className="accent-blue-600"
                        checked={form.expenseType === "Goods"}
                        onChange={() => setF("expenseType", "Goods")}
                      />
                      Goods
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        className="accent-blue-600"
                        checked={form.expenseType === "Services"}
                        onChange={() => setF("expenseType", "Services")}
                      />
                      Services
                    </label>
                  </div>
                </div>

                <div>
                  <FieldLabel>SAC / HSN Code</FieldLabel>
                  <input
                    type="text"
                    className={inp}
                    placeholder="e.g. 3921"
                    value={form.sac}
                    onChange={(e) => setF("sac", e.target.value)}
                  />
                </div>

                <div>
                  <FieldLabel>Vendor</FieldLabel>
                  <div className="flex gap-2">
                    <select
                      className={sel}
                      value={form.vendorName}
                      onChange={(e) => setF("vendorName", e.target.value)}
                    >
                      <option value="">Select vendor</option>
                      {vendorNames.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Search size={14} className="text-gray-500" />
                    </button>
                  </div>
                </div>

                <div>
                  <FieldLabel>Customer Name</FieldLabel>
                  <div className="flex gap-2">
                    <select
                      className={sel}
                      value={form.customerName}
                      onChange={(e) => setF("customerName", e.target.value)}
                    >
                      <option value="">Select or add a customer</option>
                      {clientNames.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Search size={14} className="text-gray-500" />
                    </button>
                  </div>
                </div>
              </div>
            </Section>

            {/* Section 3 — GST & Tax */}
            <Section title="GST & Tax" icon={BadgePercent}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <FieldLabel required>GST Treatment</FieldLabel>
                  <select
                    className={sel}
                    value={form.gstTreatment}
                    onChange={(e) => setF("gstTreatment", e.target.value)}
                  >
                    <option value="">Select GST treatment</option>
                    <option value="Registered Business - Regular">
                      Registered Business - Regular
                    </option>
                    <option value="Registered Business - Composition">
                      Registered Business - Composition
                    </option>
                    <option value="Unregistered Business">
                      Unregistered Business
                    </option>
                    <option value="Consumer">Consumer</option>
                    <option value="Overseas">Overseas</option>
                  </select>
                </div>

                <div>
                  <FieldLabel>Tax</FieldLabel>
                  <select
                    className={sel}
                    value={form.taxLabel}
                    onChange={(e) => setF("taxLabel", e.target.value)}
                  >
                    <option value="">Select a tax</option>
                    <option value="GST5">GST 5%</option>
                    <option value="GST12">GST 12%</option>
                    <option value="GST18">GST 18%</option>
                    <option value="GST28">GST 28%</option>
                  </select>
                </div>

                <div>
                  <FieldLabel required>Source of Supply</FieldLabel>
                  <input
                    type="text"
                    className={inp}
                    placeholder="State / Province"
                    value={form.sourceOfSupply}
                    onChange={(e) => setF("sourceOfSupply", e.target.value)}
                  />
                </div>

                <div>
                  <FieldLabel required>Destination of Supply</FieldLabel>
                  <input
                    type="text"
                    className={inp}
                    value={form.destinationOfSupply}
                    onChange={(e) =>
                      setF("destinationOfSupply", e.target.value)
                    }
                  />
                </div>

                <div className="md:col-span-2">
                  <FieldLabel>Amount Is</FieldLabel>
                  <div className="flex items-center gap-6 mt-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        className="accent-blue-600"
                        checked={form.amountIs === "Tax Inclusive"}
                        onChange={() => setF("amountIs", "Tax Inclusive")}
                      />
                      Tax Inclusive
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        className="accent-blue-600"
                        checked={form.amountIs === "Tax Exclusive"}
                        onChange={() => setF("amountIs", "Tax Exclusive")}
                      />
                      Tax Exclusive
                    </label>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="accent-blue-600 w-4 h-4"
                      checked={form.reverseCharge}
                      onChange={(e) =>
                        setF("reverseCharge", e.target.checked)
                      }
                    />
                    This transaction is applicable for reverse charge
                  </label>
                </div>
              </div>

              {/* Tax summary row */}
              {amountValue > 0 && taxPercent > 0 && (
                <div className="mt-5 pt-5 border-t border-gray-100 grid grid-cols-3 gap-4 text-center">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">Base Amount</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {fmtCurrency(baseAmount)}
                    </p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-xs text-blue-500 mb-1">
                      Tax ({taxPercent}%)
                    </p>
                    <p className="text-sm font-semibold text-blue-700">
                      {fmtCurrency(taxAmount)}
                    </p>
                  </div>
                  <div className="bg-rose-50 rounded-lg p-3">
                    <p className="text-xs text-rose-500 mb-1">Total</p>
                    <p className="text-sm font-semibold text-rose-700">
                      {fmtCurrency(
                        form.amountIs === "Tax Inclusive"
                          ? amountValue
                          : amountValue + taxAmount,
                      )}
                    </p>
                  </div>
                </div>
              )}
            </Section>

            {/* Section 4 — Notes & Tags */}
            <Section title="Notes & Tags">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <FieldLabel>Notes</FieldLabel>
                  <textarea
                    className={
                      "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white placeholder-gray-400 transition-colors resize-none"
                    }
                    rows={3}
                    maxLength={500}
                    placeholder="Add a note (max 500 characters)"
                    value={form.notes}
                    onChange={(e) => setF("notes", e.target.value)}
                  />
                  <p className="text-xs text-gray-400 mt-1 text-right">
                    {form.notes.length}/500
                  </p>
                </div>
                <div>
                  <FieldLabel>Reporting Tags</FieldLabel>
                  <button
                    type="button"
                    className="mt-1 text-sm text-blue-600 hover:underline"
                    onClick={() =>
                      toast({ title: "Associate Tags opened" })
                    }
                  >
                    + Associate Tags
                  </button>
                </div>
              </div>
            </Section>
          </div>

          {/* ── Right column — draggable panels ── */}
          <div className="space-y-3">
            {panelOrder.map((panel) => {
              const isReceipts = panel === "receipts";
              return (
                <div
                  key={panel}
                  draggable
                  onDragStart={() => { dragPanelRef.current = panel; }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    const from = dragPanelRef.current;
                    if (!from || from === panel) return;
                    setPanelOrder((prev) => {
                      const next = [...prev];
                      const fromIdx = next.indexOf(from);
                      const toIdx = next.indexOf(panel);
                      next[fromIdx] = panel;
                      next[toIdx] = from;
                      return next;
                    });
                    dragPanelRef.current = null;
                  }}
                  className="bg-white border border-gray-200 rounded-xl overflow-hidden cursor-grab active:cursor-grabbing select-none"
                >
                  {/* Panel header with grip */}
                  <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-100 bg-gray-50/70">
                    <GripVertical size={14} className="text-gray-400 shrink-0" />
                    <div className="w-1 h-4 bg-blue-600 rounded-full shrink-0" />
                    {isReceipts
                      ? <ImageUp size={14} className="text-blue-600 shrink-0" />
                      : null}
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-700">
                      {isReceipts ? "Receipts" : "Summary"}
                    </h3>
                  </div>

                  {/* Panel body */}
                  {isReceipts ? (
                    <div className="p-5 text-center">
                      <div
                        className="border-2 border-dashed border-gray-200 rounded-xl p-6 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
                        onClick={() => uploadRef.current?.click()}
                      >
                        <ImageUp className="mx-auto h-10 w-10 text-gray-400" />
                        <p className="mt-3 text-sm font-medium text-gray-700">
                          Drag or drop receipts
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          Max file size 10 MB
                        </p>
                        <button
                          type="button"
                          className="mt-4 px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            uploadRef.current?.click();
                          }}
                        >
                          Browse Files
                        </button>
                      </div>
                      <input
                        ref={uploadRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleUpload}
                      />
                      {receipts.length > 0 && (
                        <div className="mt-4 space-y-2 text-left">
                          {receipts.map((file) => (
                            <div
                              key={file.name}
                              className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                            >
                              <span className="truncate text-gray-700">{file.name}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  setReceipts((c) => c.filter((v) => v.name !== file.name))
                                }
                                className="text-gray-400 hover:text-red-500 shrink-0"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-5">
                      {amountValue > 0 ? (
                        <div className="space-y-2 text-sm">
                          {form.expenseAccount && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Account</span>
                              <span className="font-medium text-gray-800 text-right max-w-[60%] truncate">
                                {form.expenseAccount}
                              </span>
                            </div>
                          )}
                          {form.paidThrough && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Paid Through</span>
                              <span className="font-medium text-gray-800">
                                {form.paidThrough}
                              </span>
                            </div>
                          )}
                          {taxPercent > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Tax</span>
                              <span className="font-medium text-gray-800">
                                {fmtCurrency(taxAmount)}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between pt-2 border-t border-gray-100">
                            <span className="font-semibold text-gray-700">Total</span>
                            <span className="font-bold text-rose-600 text-base">
                              {fmtCurrency(
                                form.amountIs === "Tax Inclusive"
                                  ? amountValue
                                  : amountValue + taxAmount,
                              )}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 text-center py-2">
                          Enter an amount to see summary
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Bottom action bar ── */}
        <div className="flex items-center gap-3 mt-2 pt-5 border-t border-gray-200">
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={saving}
            className="flex items-center gap-1.5 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? "Saving…" : "Save Expense"}
          </button>
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={saving}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Save &amp; New
          </button>
          <button
            type="button"
            onClick={() => navigate("/transactions/purchase/expenses")}
            className="px-5 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
