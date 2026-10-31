import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { usePageMeta } from "@/contexts/PageMetaContext";
import { downloadPaymentMadePdf } from "@/lib/paymentMadePdf";
import { getVendors } from "@/lib/vendorDataStore";
import { toast } from "@/hooks/use-toast";
import { safeReadJson } from "@/lib/utils";
import { getPrefix } from "@/lib/configService";
import { useI18n } from "@/i18n/I18nProvider";
import { formatCurrency } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Download,
  Ellipsis,
  Mail,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type BillStatus = "DRAFT" | "OPEN" | "PAID";

interface BillItem {
  id: string;
  itemDetails: string;
  account: string;
  quantity: number;
  rate: number;
  discount: number;
  taxPercent: number;
  customerName: string;
}

interface BillEntry {
  id: string;
  billNumber: string;
  referenceNumber: string;
  vendorName: string;
  billDate: string;
  dueDate: string;
  status: BillStatus;
  paymentMade: number;
  adjustment: number;
  items: BillItem[];
}

interface PaymentAllocation {
  billId: string;
  amount: number;
}

interface PaymentEntry {
  id: string;
  date: string;
  paymentNumber: string;
  referenceNumber: string;
  vendorName: string;
  billNumber: string;
  billId?: string;
  mode: string;
  status: "PAID" | "DRAFT";
  amount: number;
  unusedAmount: number;
  paidThrough: string;
  notes: string;
  allocations: PaymentAllocation[];
  type: "Bill Payment" | "Vendor Advance";
}

// ── Constants ─────────────────────────────────────────────────────────────────
const BILLS_STORAGE_KEY = "nido_purchase_bills_v1";
const PAYMENTS_STORAGE_KEY = "nido_purchase_payments_made_v1";

// ── Helpers ───────────────────────────────────────────────────────────────────
const money = (v: number) => formatCurrency(v);

const toNumber = (v: string | number, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const billTotal = (bill: Pick<BillEntry, "items" | "adjustment">) => {
  const sub = bill.items.reduce((s, i) => {
    const base = i.quantity * i.rate;
    return s + base - (base * i.discount) / 100;
  }, 0);
  const tax = bill.items.reduce((s, i) => {
    const base = i.quantity * i.rate;
    const taxable = base - (base * i.discount) / 100;
    return s + (taxable * i.taxPercent) / 100;
  }, 0);
  return sub + tax + (bill.adjustment ?? 0);
};

const nextPaymentNumber = (entries: PaymentEntry[]) => {
  const max = entries.reduce((c, e) => {
    const n = Number(e.paymentNumber.replace(/\D/g, ""));
    return Number.isFinite(n) ? Math.max(c, n) : c;
  }, 0);
  return `${getPrefix("payment") || "PMT-"}${String(max + 1).padStart(5, "0")}`;
};

const STATUS_STYLE: Record<string, string> = {
  PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
  DRAFT: "bg-gray-100 text-gray-600 border-gray-200",
};

// ── Style tokens (matching BillsPage / PurchaseOrdersPage) ────────────────────
const inp = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white placeholder-gray-400 transition-colors";
const sel = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white transition-colors";
const textareaClass = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white placeholder-gray-400 transition-colors resize-none";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl mb-5 overflow-hidden">
      <div className="flex items-center gap-2.5 px-6 py-3.5 border-b border-gray-100 bg-gray-50/70">
        <div className="w-1 h-4 bg-blue-600 rounded-full shrink-0" />
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-700">{title}</h3>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
      {children}{required && <span className="text-red-400 ml-0.5 normal-case">*</span>}
    </label>
  );
}

// ── Payment Voucher (printable detail view) ───────────────────────────────────
function PaymentVoucher({ entry }: { entry: PaymentEntry }) {
  return (
    <div className="mx-auto max-w-[820px] space-y-6 bg-white p-8 text-gray-900 font-sans">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-2xl font-bold tracking-tight">PAYMENTS MADE</h3>
          <p className="text-sm text-gray-500 mt-0.5">Payment #{entry.paymentNumber}</p>
        </div>
        <div className="rounded-lg bg-emerald-600 px-5 py-3 text-right text-white">
          <p className="text-xs uppercase tracking-wider font-medium opacity-80">Amount Paid</p>
          <p className="text-2xl font-bold mt-0.5">{money(entry.amount)}</p>
        </div>
      </div>

      <div className="h-px bg-gray-100" />

      <div className="grid gap-4 text-sm md:grid-cols-2">
        {[
          ["Paid To", entry.vendorName],
          ["Payment Date", entry.date],
          ["Payment Mode", entry.mode],
          ["Paid Through", entry.paidThrough],
          ...(entry.referenceNumber ? [["Reference #", entry.referenceNumber]] : []),
          ["Type", entry.type],
        ].map(([label, val]) => (
          <div key={label}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
            <p className="font-medium text-gray-800">{val || "—"}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Payment For</p>
        <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Bill #</th>
              <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Reference</th>
              <th className="text-right px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Amount</th>
            </tr>
          </thead>
          <tbody>
            {entry.allocations.length === 0 ? (
              <tr><td colSpan={3} className="text-center py-4 text-gray-400 text-sm">Advance payment — no bill linked</td></tr>
            ) : (
              entry.allocations.map((a) => (
                <tr key={a.billId} className="border-t border-gray-100">
                  <td className="px-4 py-2.5 text-gray-700">{entry.billNumber || "—"}</td>
                  <td className="px-4 py-2.5 text-gray-700">{entry.referenceNumber || "—"}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{money(a.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <div className="w-64 border border-gray-200 rounded-lg overflow-hidden text-sm">
          <table className="w-full">
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="px-4 py-2.5 text-gray-600">Amount Paid</td>
                <td className="px-4 py-2.5 text-right">{money(entry.amount)}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="px-4 py-2.5 text-gray-600">Used for Payments</td>
                <td className="px-4 py-2.5 text-right">{money(entry.allocations.reduce((s, a) => s + a.amount, 0))}</td>
              </tr>
              <tr className="bg-blue-50">
                <td className="px-4 py-3 font-bold text-gray-900">Unused Amount</td>
                <td className="px-4 py-3 text-right font-bold">{money(entry.unusedAmount)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {entry.notes && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Notes</p>
          <p className="text-sm text-gray-600">{entry.notes}</p>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function PaymentsMadePage() {
  useI18n();
  const { setMeta } = usePageMeta();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ id?: string }>();
  const vendors = useMemo(() => getVendors().filter((v) => !v.archived), []);
  const routeState = (location.state || {}) as { vendorName?: string };
  const isCreateMode = location.pathname.endsWith("/create");
  const detailId = !isCreateMode ? params.id : undefined;

  const [payments, setPayments] = useState<PaymentEntry[]>(() =>
    safeReadJson<PaymentEntry[]>(PAYMENTS_STORAGE_KEY, [])
  );
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [tab, setTab] = useState<"Bill Payment" | "Vendor Advance">("Bill Payment");

  const [form, setForm] = useState({
    vendorName: routeState.vendorName || "",
    paymentNumber: "",
    paymentMode: "Cash",
    paidThrough: "Petty Cash",
    paymentDate: new Date().toISOString().slice(0, 10),
    referenceNumber: "",
    notes: "",
    amountReceived: "",
  });
  const [allocations, setAllocations] = useState<Record<string, string>>({});

  // Reset form when entering create mode
  useEffect(() => {
    if (isCreateMode) {
      const stored = safeReadJson<PaymentEntry[]>(PAYMENTS_STORAGE_KEY, []);
      setForm({
        vendorName: routeState.vendorName || "",
        paymentNumber: nextPaymentNumber(stored),
        paymentMode: "Cash",
        paidThrough: "Petty Cash",
        paymentDate: new Date().toISOString().slice(0, 10),
        referenceNumber: "",
        notes: "",
        amountReceived: "",
      });
      setAllocations({});
      setTab("Bill Payment");
    }
  }, [isCreateMode]);

  useEffect(() => {
    const title = isCreateMode
      ? "New Payment"
      : detailId
      ? payments.find((p) => p.id === detailId)?.paymentNumber || "Payment"
      : "Payments Made";
    setMeta({ title });
  }, [isCreateMode, detailId, payments]);

  const selectedPayment = useMemo(
    () => (detailId ? payments.find((p) => p.id === detailId) || null : null),
    [payments, detailId]
  );

  const bills = useMemo(
    () => safeReadJson<BillEntry[]>(BILLS_STORAGE_KEY, []),
    [isCreateMode, form.vendorName]
  );

  const vendorBillStats = useMemo(() => {
    if (!form.vendorName) return [];
    return bills
      .filter((b) => b.vendorName === form.vendorName && b.status !== "PAID")
      .map((bill) => {
        const total = billTotal(bill);
        const due = Math.max(total - bill.paymentMade, 0);
        return { bill, total, due };
      });
  }, [bills, form.vendorName]);

  const totalApplied = useMemo(
    () => Object.values(allocations).reduce((s, v) => s + toNumber(v), 0),
    [allocations]
  );

  const amountValue = toNumber(form.amountReceived);
  const unusedAmount = Math.max(amountValue - totalApplied, 0);

  const filteredPayments = useMemo(() => {
    if (!search.trim()) return payments;
    const q = search.toLowerCase();
    return payments.filter(
      (p) =>
        p.paymentNumber.toLowerCase().includes(q) ||
        p.vendorName.toLowerCase().includes(q) ||
        p.billNumber.toLowerCase().includes(q) ||
        p.referenceNumber.toLowerCase().includes(q)
    );
  }, [payments, search]);

  const handleDownloadPdf = async () => {
    if (!selectedPayment) return;
    setPdfLoading(true);
    try {
      await downloadPaymentMadePdf(selectedPayment);
    } finally {
      setPdfLoading(false);
    }
  };

  const persist = (next: PaymentEntry[]) => {
    setPayments(next);
    localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("nidoPurchasePaymentsUpdated"));
  };

  const updateBillsForPayment = (payment: PaymentEntry) => {
    if (!payment.allocations.length) return;
    const latestBills = safeReadJson<BillEntry[]>(BILLS_STORAGE_KEY, []);
    const updated = latestBills.map((bill) => {
      const alloc = payment.allocations.find((a) => a.billId === bill.id);
      if (!alloc) return bill;
      const total = billTotal(bill);
      const nextMade = bill.paymentMade + alloc.amount;
      return { ...bill, paymentMade: nextMade, status: (nextMade >= total ? "PAID" : "OPEN") as BillStatus };
    });
    localStorage.setItem(BILLS_STORAGE_KEY, JSON.stringify(updated));
  };

  const setF = <K extends keyof typeof form>(key: K, val: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const savePayment = (status: "PAID" | "DRAFT") => {
    if (!form.vendorName.trim()) { toast({ title: "Vendor is required" }); return; }
    if (amountValue <= 0) { toast({ title: "Enter a payment amount" }); return; }

    setSaving(true);
    try {
      const normalizedAllocs = Object.entries(allocations)
        .map(([billId, val]) => ({ billId, amount: toNumber(val) }))
        .filter((a) => a.amount > 0);

      const firstBill = bills.find((b) => b.id === normalizedAllocs[0]?.billId);

      const created: PaymentEntry = {
        id: `pm-${Date.now()}`,
        date: form.paymentDate,
        paymentNumber: form.paymentNumber || nextPaymentNumber(payments),
        referenceNumber: form.referenceNumber,
        vendorName: form.vendorName,
        billNumber: firstBill?.billNumber || "—",
        billId: firstBill?.id,
        mode: form.paymentMode,
        status,
        amount: amountValue,
        unusedAmount,
        paidThrough: form.paidThrough,
        notes: form.notes,
        allocations: normalizedAllocs,
        type: tab,
      };

      const next = [created, ...payments];
      persist(next);
      if (status === "PAID") updateBillsForPayment(created);

      toast({ title: status === "PAID" ? "Payment recorded" : "Draft saved" });
      navigate(`/transactions/purchase/payments-made/${created.id}`, { replace: true });
    } finally {
      setSaving(false);
    }
  };

  const deletePayment = (id: string) => {
    persist(payments.filter((p) => p.id !== id));
    toast({ title: "Payment deleted" });
    navigate("/transactions/purchase/payments-made", { replace: true });
  };

  const payInFull = (billId: string, due: number) =>
    setAllocations((c) => ({ ...c, [billId]: String(due.toFixed(2)) }));

  // ── CREATE (full-screen form) ─────────────────────────────────────────────
  if (isCreateMode) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Sticky toolbar */}
        <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
          <div className="px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => navigate("/transactions/purchase/payments-made")}
                className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors shrink-0"
              >
                <ArrowLeft size={16} /> Back
              </button>
              <span className="text-gray-300">|</span>
              <h1 className="text-sm font-bold text-gray-900 truncate">New Payment Made</h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => navigate("/transactions/purchase/payments-made")}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => savePayment("DRAFT")}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Save as Draft
              </button>
              <button
                type="button"
                onClick={() => savePayment("PAID")}
                disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                <Save size={14} />
                {saving ? "Saving…" : "Save as Paid"}
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="w-full px-6 py-7">
          {/* Payment Type Tabs */}
          <div className="mb-5">
            <Tabs value={tab} onValueChange={(v) => { setTab(v as typeof tab); setAllocations({}); }}>
              <TabsList className="mb-0">
                <TabsTrigger value="Bill Payment">Bill Payment</TabsTrigger>
                <TabsTrigger value="Vendor Advance">Vendor Advance</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Section 1 — Payment Header */}
          <Section title="Payment Details">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Vendor */}
              <div>
                <FieldLabel required>Vendor Name</FieldLabel>
                <select
                  className={sel}
                  value={form.vendorName}
                  onChange={(e) => { setF("vendorName", e.target.value); setAllocations({}); }}
                >
                  <option value="">Select a Vendor</option>
                  {vendors.filter((v: any) => !v.archived).map((v: any) => (
                    <option key={v.id} value={v.name}>{v.name}</option>
                  ))}
                </select>
              </div>

              {/* Payment # */}
              <div>
                <FieldLabel required>Payment #</FieldLabel>
                <input
                  className={`${inp} bg-gray-50 text-gray-500 cursor-not-allowed`}
                  value={form.paymentNumber}
                  readOnly
                  placeholder="PAY-00001"
                />
              </div>

              {/* Date */}
              <div>
                <FieldLabel required>Payment Date</FieldLabel>
                <input
                  type="date"
                  className={inp}
                  value={form.paymentDate}
                  onChange={(e) => setF("paymentDate", e.target.value)}
                />
              </div>

              {/* Mode */}
              <div>
                <FieldLabel>Payment Mode</FieldLabel>
                <select
                  className={sel}
                  value={form.paymentMode}
                  onChange={(e) => setF("paymentMode", e.target.value)}
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="UPI">UPI</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>

              {/* Paid Through */}
              <div>
                <FieldLabel required>Paid Through</FieldLabel>
                <input
                  className={inp}
                  value={form.paidThrough}
                  onChange={(e) => setF("paidThrough", e.target.value)}
                  placeholder="e.g. Petty Cash, HDFC Bank"
                />
              </div>

              {/* Reference */}
              <div>
                <FieldLabel>Reference #</FieldLabel>
                <input
                  className={inp}
                  value={form.referenceNumber}
                  onChange={(e) => setF("referenceNumber", e.target.value)}
                  placeholder="Optional"
                />
              </div>

              {/* Amount */}
              <div>
                <FieldLabel required>Amount (₹)</FieldLabel>
                <input
                  type="number"
                  min={0}
                  className={inp}
                  value={form.amountReceived}
                  onChange={(e) => setF("amountReceived", e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
          </Section>

          {/* Section 2 — Bill Allocation (Bill Payment only) */}
          {tab === "Bill Payment" && (
            <Section title="Outstanding Bills">
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Table header bar */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50/70 border-b border-gray-100">
                  <p className="text-xs text-gray-500">
                    {form.vendorName
                      ? `Open bills for ${form.vendorName}`
                      : "Select a vendor above to see open bills"}
                  </p>
                  {Object.keys(allocations).length > 0 && (
                    <button
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() => setAllocations({})}
                    >
                      Clear Applied Amount
                    </button>
                  )}
                </div>

                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-100 bg-white">
                      <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Date</TableHead>
                      <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Bill #</TableHead>
                      <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide text-right">Bill Amount</TableHead>
                      <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide text-right">Amount Due</TableHead>
                      <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Payment Date</TableHead>
                      <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide text-right">Payment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendorBillStats.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-gray-400 text-sm">
                          {form.vendorName ? "No open bills for this vendor" : "Select a vendor to load bills"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      vendorBillStats.map(({ bill, total, due }) => (
                        <TableRow key={bill.id} className="border-gray-100">
                          <TableCell className="text-sm text-gray-600 py-3">{bill.billDate}</TableCell>
                          <TableCell className="text-sm font-medium text-blue-600 py-3">{bill.billNumber}</TableCell>
                          <TableCell className="text-sm text-gray-600 py-3 text-right">{total.toFixed(2)}</TableCell>
                          <TableCell className="text-sm font-semibold text-gray-800 py-3 text-right">{due.toFixed(2)}</TableCell>
                          <TableCell className="text-sm text-gray-600 py-3">{form.paymentDate}</TableCell>
                          <TableCell className="py-3">
                            <div className="flex items-center justify-end gap-2">
                              <input
                                className="w-24 px-2 py-1 text-right text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 bg-white"
                                placeholder="0.00"
                                value={allocations[bill.id] || ""}
                                onChange={(e) =>
                                  setAllocations((c) => ({ ...c, [bill.id]: e.target.value }))
                                }
                              />
                              <button
                                className="text-xs text-blue-600 hover:underline whitespace-nowrap font-medium"
                                onClick={() => payInFull(bill.id, due)}
                              >
                                Pay in Full
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>

                {/* Summary strip */}
                <div className="border-t border-gray-100 bg-amber-50/40 px-4 py-3">
                  <div className="ml-auto max-w-xs space-y-1.5 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>Amount Entered</span>
                      <span className="font-medium">{money(amountValue)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Used for Payments</span>
                      <span className="font-medium">{money(totalApplied)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-gray-900 pt-1.5 border-t border-amber-200">
                      <span>Unused Amount</span>
                      <span>{money(unusedAmount)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Section>
          )}

          {/* Vendor Advance notice */}
          {tab === "Vendor Advance" && (
            <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50/50 px-5 py-4 text-sm text-blue-700">
              This payment will be parked as a vendor advance and can be applied against future bills.
            </div>
          )}

          {/* Section 3 — Notes */}
          <Section title="Notes">
            <textarea
              className={textareaClass}
              rows={3}
              value={form.notes}
              onChange={(e) => setF("notes", e.target.value)}
              placeholder="Add a note to this payment…"
            />
          </Section>

          {/* Bottom action bar */}
          <div className="flex items-center gap-3 pt-2 pb-8">
            <button
              type="button"
              onClick={() => savePayment("PAID")}
              disabled={saving}
              className="flex items-center gap-1.5 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              <Save size={14} />
              {saving ? "Saving…" : "Save as Paid"}
            </button>
            <button
              type="button"
              onClick={() => savePayment("DRAFT")}
              disabled={saving}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Save as Draft
            </button>
            <button
              type="button"
              onClick={() => navigate("/transactions/purchase/payments-made")}
              className="px-5 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── DETAIL VIEW ─────────────────────────────────────────────────────────────
  if (detailId && selectedPayment) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="w-full space-y-5 p-6">
          {/* Toolbar */}
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => navigate("/transactions/purchase/payments-made")}
                    className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mr-1"
                  >
                    <ArrowLeft size={15} /> Back
                  </button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-sm"
                    onClick={handleDownloadPdf}
                    disabled={pdfLoading}
                  >
                    <Download className="h-4 w-4" />
                    {pdfLoading ? "Generating…" : "Download PDF"}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="h-8 w-8">
                        <Ellipsis className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => toast({ title: "Email sent to vendor" })}>
                        <Mail className="mr-2 h-4 w-4" /> Send Email
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={() => deletePayment(selectedPayment.id)}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <button
                  onClick={() => navigate("/transactions/purchase/payments-made")}
                  className="text-gray-400 hover:text-gray-700 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Meta strip */}
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Payment #</p>
                  <p className="text-xl font-bold text-gray-900">{selectedPayment.paymentNumber}</p>
                </div>
                <div className="flex flex-wrap gap-6 text-sm">
                  {[
                    ["Vendor", selectedPayment.vendorName],
                    ["Date", selectedPayment.date],
                    ["Mode", selectedPayment.mode],
                  ].map(([l, v]) => (
                    <div key={l}>
                      <p className="text-xs text-gray-400 mb-0.5">{l}</p>
                      <p className="font-medium text-gray-800">{v}</p>
                    </div>
                  ))}
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Status</p>
                    <Badge variant="outline" className={`text-xs font-semibold ${STATUS_STYLE[selectedPayment.status]}`}>
                      {selectedPayment.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Amount</p>
                    <p className="font-bold text-emerald-700">{money(selectedPayment.amount)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Voucher */}
          <Card className="border-gray-200 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <PaymentVoucher entry={selectedPayment} />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full space-y-5 p-6">
        {/* Header */}
        <Card className="border-gray-200 shadow-sm">
          <CardContent className="px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Payments Made</h1>
                <p className="text-xs text-gray-400 mt-0.5">
                  {payments.length} payment{payments.length !== 1 ? "s" : ""}
                </p>
              </div>
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white h-9"
                onClick={() => navigate("/transactions/purchase/payments-made/create")}
              >
                <Plus className="mr-2 h-4 w-4" /> New
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
            placeholder="Search by payment #, vendor, bill…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Table */}
        <Card className="border-gray-200 shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-100 bg-gray-50/70">
                  <TableHead className="pl-4 w-8"><Checkbox checked={false} /></TableHead>
                  <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide py-3">Date</TableHead>
                  <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Payment #</TableHead>
                  <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Reference #</TableHead>
                  <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Vendor Name</TableHead>
                  <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Bill #</TableHead>
                  <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Mode</TableHead>
                  <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Status</TableHead>
                  <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide text-right">Amount</TableHead>
                  <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide text-right">Unused Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-16 text-gray-400 text-sm">
                      {payments.length === 0
                        ? "No payments recorded yet. Click New to add one."
                        : "No payments match your search."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPayments.map((entry) => (
                    <TableRow
                      key={entry.id}
                      className="border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => navigate(`/transactions/purchase/payments-made/${entry.id}`)}
                    >
                      <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={false} />
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 py-3.5 whitespace-nowrap">{entry.date}</TableCell>
                      <TableCell className="py-3.5">
                        <span className="text-sm font-semibold text-blue-600 hover:underline">{entry.paymentNumber}</span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 py-3.5">{entry.referenceNumber || "—"}</TableCell>
                      <TableCell className="py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 bg-emerald-600">
                            {(entry.vendorName?.[0] ?? "V").toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-gray-800">{entry.vendorName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 py-3.5">{entry.billNumber || "—"}</TableCell>
                      <TableCell className="text-sm text-gray-600 py-3.5">{entry.mode}</TableCell>
                      <TableCell className="py-3.5">
                        <Badge variant="outline" className={`text-xs font-semibold ${STATUS_STYLE[entry.status]}`}>
                          {entry.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-semibold text-gray-800 py-3.5 text-right whitespace-nowrap">{money(entry.amount)}</TableCell>
                      <TableCell className="text-sm text-gray-600 py-3.5 text-right whitespace-nowrap">{money(entry.unusedAmount)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
