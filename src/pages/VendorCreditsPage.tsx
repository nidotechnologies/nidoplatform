import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { usePageMeta } from "@/contexts/PageMetaContext";
import { toast } from "@/hooks/use-toast";
import { safeReadJson } from "@/lib/utils";
import { getPrefix } from "@/lib/configService";
import { getVendors } from "@/lib/vendorDataStore";
import { getVendorProducts } from "@/lib/vendorStore";
import { getEffectiveVendorTaxPct, getHsnCodes, getProductCategoryTaxMap } from "@/lib/taxEngine";
import { generateVendorCreditPdf } from "@/lib/vendorCreditPdf";
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
import {
  ArrowLeft,
  Download,
  Ellipsis,
  FileText,
  Info,
  Mail,
  Plus,
  Save,
  Search,
  X,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type CreditStatus = "DRAFT" | "OPEN" | "APPLIED";

interface CreditItem {
  id: string;
  itemDetails: string;
  account: string;
  hsnSac: string;
  quantity: number;
  rate: number;
  discount: number;
  taxPercent: number;
}

interface VendorCreditEntry {
  id: string;
  creditNoteNumber: string;
  referenceNumber: string;
  vendorName: string;
  vendorAddress: string;
  creditDate: string;
  status: CreditStatus;
  notes: string;
  items: CreditItem[];
  adjustment: number;
  associatedBillId?: string;
  associatedBillNumber?: string;
}

interface CreditForm {
  vendorName: string;
  vendorAddress: string;
  creditNoteNumber: string;
  referenceNumber: string;
  creditDate: string;
  notes: string;
  items: CreditItem[];
  adjustment: number;
  associatedBillId: string;
}

interface CreditNumberPref {
  mode: "auto" | "manual";
  prefix: string;
  nextNumber: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const CREDITS_KEY = "nido_purchase_vendor_credits_v1";
const PREF_KEY = "nido_vendor_credit_pref_v1";
const BILLS_KEY = "nido_purchase_bills_v1";

const STATUS_STYLE: Record<CreditStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-600 border-gray-200",
  OPEN: "bg-blue-100 text-blue-700 border-blue-200",
  APPLIED: "bg-green-100 text-green-700 border-green-200",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const toNumber = (v: unknown, fallback = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };

const money = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(v);

const todayIso = () => new Date().toISOString().slice(0, 10);

const toIndianDate = (v: string | undefined): string => {
  if (!v) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return v;
  const [y, m, d] = v.split("-");
  if (y && m && d && y.length === 4) return `${d}/${m}/${y}`;
  return v;
};

const toIsoDate = (v: string | undefined): string => {
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const [dd, mm, yyyy] = v.split("/");
  if (dd && mm && yyyy && yyyy.length === 4) return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  return "";
};

const buildCreditNumber = (prefix: string, next: number) =>
  `${prefix}${String(next).padStart(5, "0")}`;

const readCreditNumberPref = (): CreditNumberPref => {
  const saved = safeReadJson<CreditNumberPref>(PREF_KEY, {
    mode: "auto",
    prefix: getPrefix("vendorCredit") || "VC-",
    nextNumber: 1,
  });
  return {
    ...saved,
    // The General Settings prefix is the source of truth for new documents.
    // Keep the saved mode and sequence for backwards compatibility, but do not
    // let the old page-local prefix override the centralized configuration.
    prefix: getPrefix("vendorCredit") || "VC-",
  };
};

const getCreditTotals = (entry: Pick<VendorCreditEntry, "items" | "adjustment">) => {
  const grossSubtotal = entry.items.reduce((s, i) => s + i.quantity * i.rate, 0);
  const totalDiscount = entry.items.reduce((s, i) => {
    const base = i.quantity * i.rate;
    return s + (base * i.discount) / 100;
  }, 0);
  const subtotal = grossSubtotal - totalDiscount;
  const totalTax = entry.items.reduce((s, i) => {
    const base = i.quantity * i.rate;
    const disc = (base * i.discount) / 100;
    return s + ((base - disc) * i.taxPercent) / 100;
  }, 0);
  const total = subtotal + totalTax + entry.adjustment;
  return { grossSubtotal, totalDiscount, subtotal, totalTax, cgst: totalTax / 2, sgst: totalTax / 2, total };
};

const newItem = (id: string): CreditItem => ({
  id,
  itemDetails: "",
  account: "",
  hsnSac: "",
  quantity: 1,
  rate: 0,
  discount: 0,
  taxPercent: 18,
});

const normalizeCredit = (raw: Record<string, unknown>): VendorCreditEntry => {
  const VALID: CreditStatus[] = ["DRAFT", "OPEN", "APPLIED"];
  const st = String(raw.status ?? "OPEN").toUpperCase();
  const status: CreditStatus = VALID.includes(st as CreditStatus) ? (st as CreditStatus) : "OPEN";
  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  const items: CreditItem[] = rawItems.map((it: unknown, idx: number): CreditItem => {
    const item = (it && typeof it === "object" ? it : {}) as Record<string, unknown>;
    return {
      id: String(item.id ?? `ci-${Date.now()}-${idx}`),
      itemDetails: String(item.itemDetails ?? item.itemName ?? ""),
      account: String(item.account ?? ""),
      hsnSac: String(item.hsnSac ?? ""),
      quantity: toNumber(item.quantity, 1),
      rate: toNumber(item.rate, 0),
      discount: toNumber(item.discount, 0),
      taxPercent: toNumber(item.taxPercent, 18),
    };
  });
  return {
    id: String(raw.id ?? `vc-${Date.now()}`),
    creditNoteNumber: String(raw.creditNoteNumber ?? ""),
    referenceNumber: String(raw.referenceNumber ?? ""),
    vendorName: String(raw.vendorName ?? ""),
    vendorAddress: String(raw.vendorAddress ?? ""),
    creditDate: toIndianDate(String(raw.creditDate ?? raw.date ?? "")),
    status,
    notes: String(raw.notes ?? ""),
    items: items.length ? items : [newItem(`ci-${Date.now()}`)],
    adjustment: toNumber(raw.adjustment, 0),
    associatedBillId: raw.associatedBillId ? String(raw.associatedBillId) : undefined,
    associatedBillNumber: raw.associatedBillNumber ? String(raw.associatedBillNumber) : undefined,
  };
};

interface BillEntry { id: string; billNumber: string; billDate: string; vendorName: string; }

const readCredits = (): VendorCreditEntry[] => {
  const parsed = safeReadJson<unknown>(CREDITS_KEY, []);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((e) => !!e && typeof e === "object")
    .map((e) => normalizeCredit(e as Record<string, unknown>))
    .filter((e) => e.id && e.creditNoteNumber);
};

const readBills = (): BillEntry[] => {
  const parsed = safeReadJson<unknown>(BILLS_KEY, []);
  if (!Array.isArray(parsed)) return [];
  return (parsed as Record<string, unknown>[]).map((b) => ({
    id: String(b.id ?? ""),
    billNumber: String(b.billNumber ?? ""),
    billDate: String(b.billDate ?? ""),
    vendorName: String(b.vendorName ?? ""),
  }));
};

const blankForm = (pref: CreditNumberPref): CreditForm => ({
  vendorName: "",
  vendorAddress: "",
  creditNoteNumber: pref.mode === "auto" ? buildCreditNumber(pref.prefix, pref.nextNumber) : "",
  referenceNumber: "",
  creditDate: todayIso(),
  notes: "",
  items: [newItem(`tmp-${Date.now()}`)],
  adjustment: 0,
  associatedBillId: "",
});

// ── Style tokens (matches BillsPage) ─────────────────────────────────────────
const inp = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white placeholder-gray-400 transition-colors";
const sel = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white transition-colors";
const textareaClass = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white placeholder-gray-400 transition-colors resize-none";

function Section({ title, icon: Icon, children }: { title: string; icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl mb-5 overflow-hidden">
      <div className="flex items-center gap-2.5 px-6 py-3.5 border-b border-gray-100 bg-gray-50/70">
        <div className="w-1 h-4 bg-blue-600 rounded-full shrink-0" />
        {Icon && <Icon size={14} className="text-blue-600 shrink-0" />}
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

// ── Inline PDF preview view ───────────────────────────────────────────────────
function CreditPdfView({ credit }: { credit: VendorCreditEntry }) {
  const totals = getCreditTotals(credit);
  return (
    <div className="mx-auto max-w-[900px] border border-gray-200 bg-white rounded-xl p-8 shadow-sm text-gray-900">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-xl bg-blue-600 flex items-center justify-center text-white text-2xl font-bold">N</div>
          <div>
            <p className="text-xs uppercase text-gray-400 tracking-wider">Vendor Credit</p>
            <p className="text-sm font-semibold text-blue-700">{credit.creditNoteNumber}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-serif tracking-widest text-gray-800">VENDOR CREDIT</p>
          <div className="mt-2 bg-blue-50 rounded-lg px-4 py-2">
            <p className="text-xs text-gray-500">Total Credit</p>
            <p className="text-lg font-bold text-gray-900">{money(totals.total)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Vendor</p>
          <p className="text-sm font-semibold text-blue-700">{credit.vendorName}</p>
          <p className="text-xs text-gray-600 whitespace-pre-line mt-1">{credit.vendorAddress}</p>
        </div>
        <div className="space-y-1">
          {([
            ["Credit Note #", credit.creditNoteNumber],
            ["Credit Date", credit.creditDate],
            ...(credit.referenceNumber ? [["Reference #", credit.referenceNumber]] : []),
            ...(credit.associatedBillNumber ? [["Against Bill", credit.associatedBillNumber]] : []),
            ["Status", credit.status],
          ] as [string, string][]).map(([l, v]) => (
            <div key={l} className="flex text-sm border-b border-gray-50">
              <span className="w-36 bg-gray-50 px-3 py-1.5 text-gray-500 text-xs font-medium">{l}</span>
              <span className="px-3 py-1.5 text-gray-800 text-xs">{v}</span>
            </div>
          ))}
        </div>
      </div>

      <table className="w-full text-sm mb-4">
        <thead>
          <tr className="bg-gray-50 border border-gray-200">
            {["#", "Item & Description", "Account", "Qty", "Rate", "Disc %", "Taxable", "GST Rate", "Amount"].map((h) => (
              <th key={h} className="text-left px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {credit.items.map((item, i) => {
            const base = item.quantity * item.rate;
            const disc = (base * item.discount) / 100;
            const taxable = base - disc;
            const gst = (taxable * item.taxPercent) / 100;
            return (
              <tr key={item.id} className="border-b border-gray-100">
                <td className="px-3 py-2.5 text-gray-500">{i + 1}</td>
                <td className="px-3 py-2.5"><p className="font-medium">{item.itemDetails || "—"}</p></td>
                <td className="px-3 py-2.5 text-gray-500">{item.account || "—"}</td>
                <td className="px-3 py-2.5 text-right">{item.quantity.toFixed(2)}</td>
                <td className="px-3 py-2.5 text-right">{item.rate.toFixed(2)}</td>
                <td className="px-3 py-2.5 text-center text-gray-500">{item.discount > 0 ? `${item.discount}%` : "—"}</td>
                <td className="px-3 py-2.5 text-right">{taxable.toFixed(2)}</td>
                <td className="px-3 py-2.5 text-center">{item.taxPercent}%</td>
                <td className="px-3 py-2.5 text-right font-medium">{(taxable + gst).toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="flex justify-end mb-6">
        <div className="w-72 space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-600"><span>Gross Subtotal</span><span>{money(totals.grossSubtotal)}</span></div>
          <div className="flex justify-between text-gray-600"><span>Discounts (−)</span><span>{money(totals.totalDiscount)}</span></div>
          <div className="flex justify-between font-semibold text-gray-800"><span>Taxable Value</span><span>{money(totals.subtotal)}</span></div>
          <div className="flex justify-between text-gray-600"><span>SGST</span><span>{money(totals.sgst)}</span></div>
          <div className="flex justify-between text-gray-600"><span>CGST</span><span>{money(totals.cgst)}</span></div>
          {credit.adjustment !== 0 && <div className="flex justify-between text-gray-600"><span>Adjustment</span><span>{credit.adjustment.toFixed(2)}</span></div>}
          <div className="flex justify-between pt-2 border-t border-gray-200 font-bold text-gray-900 text-base"><span>Total Credit</span><span>{money(totals.total)}</span></div>
        </div>
      </div>

      {credit.notes && (
        <div className="mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Notes</p>
          <p className="text-sm text-gray-600 whitespace-pre-line">{credit.notes}</p>
        </div>
      )}

      <div className="mt-8 text-sm text-gray-500 border-t border-gray-100 pt-4">
        <p>Authorized Signature ___________________________</p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function VendorCreditsPage() {
  const { setMeta } = usePageMeta();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ id?: string }>();

  const vendors = useMemo(() => getVendors().filter((v) => !v.archived), []);
  const bills = useMemo(() => readBills(), []);

  const [credits, setCredits] = useState<VendorCreditEntry[]>(readCredits);
  const [pref, setPref] = useState<CreditNumberPref>(readCreditNumberPref);
  const [form, setForm] = useState<CreditForm>(() => blankForm(readCreditNumberPref()));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPdfView, setShowPdfView] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "items" | "journal">("overview");
  const [search, setSearch] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  const createMode = location.pathname.endsWith("/create");
  const editMode = location.pathname.endsWith("/edit") && !!params.id;
  const isFormMode = createMode || editMode;
  const detailId = !isFormMode ? params.id : null;

  const selectedCredit = useMemo(
    () => (params.id ? credits.find((c) => c.id === params.id) || null : null),
    [credits, params.id],
  );

  useEffect(() => {
    setMeta({ title: selectedCredit?.creditNoteNumber || "Vendor Credits" });
    return () => setMeta({});
  }, [selectedCredit]);

  useEffect(() => {
    if (createMode) {
      setEditingId(null);
      setForm(blankForm(pref));
      return;
    }
    if (editMode && selectedCredit) {
      setEditingId(selectedCredit.id);
      setForm({
        vendorName: selectedCredit.vendorName,
        vendorAddress: selectedCredit.vendorAddress,
        creditNoteNumber: selectedCredit.creditNoteNumber,
        referenceNumber: selectedCredit.referenceNumber,
        creditDate: toIsoDate(selectedCredit.creditDate),
        notes: selectedCredit.notes,
        items: selectedCredit.items.map((i) => ({ ...i })),
        adjustment: selectedCredit.adjustment,
        associatedBillId: selectedCredit.associatedBillId ?? "",
      });
    }
  }, [createMode, editMode, params.id]);

  const persist = (next: VendorCreditEntry[]) => {
    setCredits(next);
    localStorage.setItem(CREDITS_KEY, JSON.stringify(next));
  };

  const persistPref = (next: CreditNumberPref) => {
    setPref(next);
    localStorage.setItem(PREF_KEY, JSON.stringify(next));
  };

  const backToList = () => navigate("/transactions/purchase/vendor-credits", { replace: true });

  const setF = <K extends keyof CreditForm>(key: K, value: CreditForm[K]) =>
    setForm((c) => ({ ...c, [key]: value }));

  const handleAddRow = () => setF("items", [...form.items, newItem(`tmp-${Date.now()}`)]);

  const handleItemChange = (id: string, key: keyof CreditItem, value: string) =>
    setF("items", form.items.map((item) => {
      if (item.id !== id) return item;
      if (["quantity", "rate", "discount", "taxPercent"].includes(key)) return { ...item, [key]: toNumber(value) };
      return { ...item, [key]: value };
    }));

  const handleRemoveRow = (id: string) => {
    const next = form.items.filter((i) => i.id !== id);
    setF("items", next.length ? next : [newItem(`tmp-${Date.now()}`)]);
  };

  const saveCredit = (status: CreditStatus) => {
    if (!form.vendorName || !form.creditNoteNumber.trim()) {
      toast({ title: "Vendor and Credit Note number are required" });
      return;
    }
    setSaving(true);
    try {
      const assocBill = bills.find((b) => b.id === form.associatedBillId);
      if (editingId) {
        const updated = credits.map((c) =>
          c.id === editingId
            ? {
                ...c,
                vendorName: form.vendorName,
                vendorAddress: form.vendorAddress,
                creditNoteNumber: form.creditNoteNumber,
                referenceNumber: form.referenceNumber,
                creditDate: toIndianDate(form.creditDate),
                notes: form.notes,
                items: form.items,
                adjustment: form.adjustment,
                status,
                associatedBillId: assocBill?.id,
                associatedBillNumber: assocBill?.billNumber,
              }
            : c,
        );
        persist(updated);
        toast({ title: "Vendor credit updated" });
        navigate(`/transactions/purchase/vendor-credits/${editingId}`, { replace: true });
      } else {
        const id = `vc-${Date.now()}`;
        const created: VendorCreditEntry = {
          id,
          creditNoteNumber: form.creditNoteNumber,
          referenceNumber: form.referenceNumber,
          vendorName: form.vendorName,
          vendorAddress: form.vendorAddress,
          creditDate: toIndianDate(form.creditDate),
          status,
          notes: form.notes,
          items: form.items,
          adjustment: form.adjustment,
          associatedBillId: assocBill?.id,
          associatedBillNumber: assocBill?.billNumber,
        };
        persist([created, ...credits]);
        if (pref.mode === "auto") {
          persistPref({ ...pref, nextNumber: pref.nextNumber + 1 });
        }
        toast({ title: status === "DRAFT" ? "Vendor credit saved as draft" : "Vendor credit created as open" });
        navigate(`/transactions/purchase/vendor-credits/${id}`, { replace: true });
      }
    } finally {
      setSaving(false);
    }
  };

  const convertToOpen = () => {
    if (!selectedCredit) return;
    persist(credits.map((c) => c.id === selectedCredit.id ? { ...c, status: "OPEN" } : c));
    toast({ title: "Vendor credit converted to open" });
  };

  const applyToBill = () => {
    if (!selectedCredit) return;
    if (selectedCredit.status === "APPLIED") {
      toast({ title: "This credit has already been applied", description: "It cannot be applied again." });
      return;
    }
    if (!selectedCredit.associatedBillId) {
      toast({
        title: "No bill linked",
        description: "Edit this credit and select an associated bill first, then apply.",
      });
      return;
    }
    const storedBills = safeReadJson<Record<string, unknown>[]>(BILLS_KEY, []);
    const creditTotals = getCreditTotals(selectedCredit);
    const updatedBills = storedBills.map((bill) => {
      if (String(bill.id) !== selectedCredit.associatedBillId) return bill;
      const newPaymentMade = toNumber(bill.paymentMade) + creditTotals.total;
      // Compute bill's own total by summing its items
      const billItems: { quantity?: unknown; rate?: unknown; taxPercent?: unknown }[] =
        Array.isArray(bill.items) ? (bill.items as []) : [];
      const billGross = billItems.reduce((sum, it) => {
        const qty = toNumber(it.quantity, 1);
        const rate = toNumber(it.rate, 0);
        const tax = toNumber(it.taxPercent, 0);
        return sum + qty * rate * (1 + tax / 100);
      }, 0);
      const billTotal = billGross + toNumber(bill.adjustment);
      const isFullyPaid = newPaymentMade >= billTotal - 0.01;
      return {
        ...bill,
        paymentMade: newPaymentMade,
        ...(isFullyPaid ? { status: "PAID" } : {}),
      };
    });
    localStorage.setItem(BILLS_KEY, JSON.stringify(updatedBills));
    // Mark the credit as APPLIED
    persist(credits.map((c) => c.id === selectedCredit.id ? { ...c, status: "APPLIED" as CreditStatus } : c));
    toast({ title: "Vendor credit applied to bill", description: `₹${creditTotals.total.toFixed(2)} credited against Bill #${selectedCredit.associatedBillNumber}` });
  };

  const deleteCredit = () => {
    if (!selectedCredit) return;
    persist(credits.filter((c) => c.id !== selectedCredit.id));
    backToList();
    toast({ title: "Vendor credit deleted" });
  };

  const handleDownloadPdf = async () => {
    if (!selectedCredit) return;
    setPdfLoading(true);
    try {
      await generateVendorCreditPdf({
        creditNoteNumber: selectedCredit.creditNoteNumber,
        referenceNumber: selectedCredit.referenceNumber,
        vendorName: selectedCredit.vendorName,
        vendorAddress: selectedCredit.vendorAddress,
        creditDate: selectedCredit.creditDate,
        associatedBillNumber: selectedCredit.associatedBillNumber,
        status: selectedCredit.status,
        notes: selectedCredit.notes,
        items: selectedCredit.items,
        adjustment: selectedCredit.adjustment,
      });
    } catch (err) {
      console.error(err);
      toast({ title: "PDF generation failed", description: String(err) });
    } finally {
      setPdfLoading(false);
    }
  };

  const handlePickVendorProduct = (itemId: string, productId: string) => {
    const product = vendorProducts.find((p) => p.id === productId);
    if (!product) return;
    const category = product.category || "";
    const hsnSac = hsnByCategory.get(category.toLowerCase()) || "";
    const taxPercent = getEffectiveVendorTaxPct(category) || 18;
    setF(
      "items",
      form.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              itemDetails: product.productName,
              account: category,
              hsnSac,
              rate: parseFloat(product.price) || 0,
              quantity: parseFloat(product.moq) || 1,
              taxPercent,
            }
          : item,
      ),
    );
  };

  const formTotals = getCreditTotals({ items: form.items, adjustment: form.adjustment });
  const vendorBills = useMemo(
    () => bills.filter((b) => b.vendorName === form.vendorName),
    [bills, form.vendorName],
  );

  // Products for the selected vendor (same pattern as PurchaseOrdersPage)
  const vendorProducts = useMemo(() => {
    if (!form.vendorName) return [];
    const vendor = vendors.find((v) => v.name === form.vendorName);
    if (!vendor) return [];
    return getVendorProducts(vendor.id).filter((p) => p.status === "Active");
  }, [form.vendorName, vendors]);

  // HSN lookup by category (same as PurchaseOrdersPage)
  const hsnByCategory = useMemo(() => {
    const map = new Map<string, string>();
    getHsnCodes().forEach((h) => {
      if (h.status === "Active" && h.productCategory)
        map.set(h.productCategory.toLowerCase(), h.code);
    });
    getProductCategoryTaxMap().forEach((m) => {
      if (m.defaultHsnCode && m.productCategory)
        map.set(m.productCategory.toLowerCase(), m.defaultHsnCode);
    });
    return map;
  }, []);

  const filteredCredits = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return credits;
    return credits.filter(
      (c) =>
        c.creditNoteNumber.toLowerCase().includes(q) ||
        c.vendorName.toLowerCase().includes(q) ||
        c.referenceNumber.toLowerCase().includes(q),
    );
  }, [credits, search]);

  // ── FORM PAGE ──────────────────────────────────────────────────────────────
  if (isFormMode) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Sticky toolbar */}
        <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
          <div className="px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={backToList} className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors shrink-0">
                <ArrowLeft size={16} /> Back
              </button>
              <span className="text-gray-300">|</span>
              <h1 className="text-sm font-bold text-gray-900 truncate">
                {editingId ? `Edit Vendor Credit ${credits.find((c) => c.id === editingId)?.creditNoteNumber || ""}` : "New Vendor Credit"}
              </h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={backToList} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={() => saveCredit("DRAFT")} disabled={saving} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
                Save as Draft
              </button>
              <button type="button" onClick={() => saveCredit("OPEN")} disabled={saving} className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
                <Save size={14} />
                {saving ? "Saving…" : "Save as Open"}
              </button>
            </div>
          </div>
        </div>

        <div className="w-full px-6 py-7">
          {/* Section 1 — Vendor & Header */}
          <Section title="Vendor & Credit Header" icon={FileText}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <FieldLabel required>Vendor Name</FieldLabel>
                <select
                  className={sel}
                  value={form.vendorName}
                  onChange={(e) => {
                    const v = e.target.value;
                    const vendor = vendors.find((vd) => vd.name === v);
                    setF("vendorName", v);
                    setF("vendorAddress", vendor?.address || "");
                    setF("associatedBillId", "");
                  }}
                >
                  <option value="">Select a Vendor</option>
                  {vendors.map((v) => <option key={v.id} value={v.name}>{v.name}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel required>Credit Note #</FieldLabel>
                <input
                  type="text"
                  className={pref.mode === "auto" ? inp + " bg-gray-50 text-gray-500 cursor-not-allowed" : inp}
                  value={form.creditNoteNumber}
                  readOnly={pref.mode === "auto"}
                  tabIndex={pref.mode === "auto" ? -1 : undefined}
                  onChange={(e) => setF("creditNoteNumber", e.target.value)}
                />
              </div>
              <div>
                <FieldLabel>Vendor Address</FieldLabel>
                <textarea className={textareaClass} rows={4} value={form.vendorAddress} onChange={(e) => setF("vendorAddress", e.target.value)} placeholder="Vendor address" />
              </div>
              <div className="space-y-4">
                <div>
                  <FieldLabel required>Credit Date</FieldLabel>
                  <input type="date" className={inp} value={form.creditDate} onChange={(e) => setF("creditDate", e.target.value)} />
                </div>
                <div>
                  <FieldLabel>Reference Number</FieldLabel>
                  <input type="text" className={inp} value={form.referenceNumber} onChange={(e) => setF("referenceNumber", e.target.value)} placeholder="e.g. REF-001" />
                </div>
              </div>
              <div className="md:col-span-2">
                <FieldLabel>Associated Bill</FieldLabel>
                <select
                  className={sel}
                  value={form.associatedBillId}
                  onChange={(e) => setF("associatedBillId", e.target.value)}
                >
                  <option value="">Select bill for adjustment (optional)</option>
                  {vendorBills.map((b) => (
                    <option key={b.id} value={b.id}>{b.billNumber} ({b.billDate})</option>
                  ))}
                </select>
              </div>
            </div>
          </Section>

          {/* Section 2 — Line Items */}
          <Section title="Line Items" icon={FileText}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="bg-gray-50 border border-gray-200">
                    <th className="text-center px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide w-10">#</th>
                    <th className="text-left px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Item / Specification</th>
                    <th className="text-center px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide w-28">Account</th>
                    <th className="text-center px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide w-28">HSN/SAC</th>
                    <th className="text-center px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide w-20">Qty</th>
                    <th className="text-right px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide w-28">Rate</th>
                    <th className="text-right px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide w-24">Disc %</th>
                    <th className="text-right px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide w-28">Taxable</th>
                    <th className="text-center px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide w-24">GST Rate</th>
                    <th className="text-right px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide w-28">Amount</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((item, rowIdx) => {
                    const base = item.quantity * item.rate;
                    const discountAmount = (base * item.discount) / 100;
                    const taxable = base - discountAmount;
                    const gst = (taxable * item.taxPercent) / 100;
                    const netAmount = taxable + gst;
                    return (
                      <tr key={item.id} className="border-b border-gray-100">
                        <td className="px-2 py-2 text-center text-gray-400 text-xs">{rowIdx + 1}</td>
                        <td className="px-2 py-2">
                          {vendorProducts.length > 0 && (
                            <select
                              className={`${sel} mb-1 text-xs text-blue-700 border-blue-200 bg-blue-50`}
                              value={item.itemDetails && vendorProducts.some((p) => p.productName === item.itemDetails) ? (vendorProducts.find((p) => p.productName === item.itemDetails)?.id ?? "") : ""}
                              onChange={(e) => e.target.value && handlePickVendorProduct(item.id, e.target.value)}
                            >
                              <option value="">— Pick from vendor catalog —</option>
                              {vendorProducts.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.productName}{p.price ? ` · ₹${p.price}` : ""}
                                </option>
                              ))}
                            </select>
                          )}
                          <input className={inp} value={item.itemDetails} onChange={(e) => handleItemChange(item.id, "itemDetails", e.target.value)} placeholder="Item name / specification" />
                        </td>
                        <td className="px-2 py-2">
                          <input className={inp} value={item.account} onChange={(e) => handleItemChange(item.id, "account", e.target.value)} placeholder="Account" />
                        </td>
                        <td className="px-2 py-2">
                          <input className={inp + " text-center"} value={item.hsnSac} onChange={(e) => handleItemChange(item.id, "hsnSac", e.target.value)} placeholder="HSN/SAC" />
                        </td>
                        <td className="px-2 py-2">
                          <input className={inp + " text-center"} type="number" value={String(item.quantity)} onChange={(e) => handleItemChange(item.id, "quantity", e.target.value)} />
                        </td>
                        <td className="px-2 py-2">
                          <input className={inp + " text-right"} type="number" value={String(item.rate)} onChange={(e) => handleItemChange(item.id, "rate", e.target.value)} />
                        </td>
                        <td className="px-2 py-2">
                          <input className={inp + " text-right"} type="number" value={String(item.discount)} onChange={(e) => handleItemChange(item.id, "discount", e.target.value)} placeholder="0" />
                        </td>
                        <td className="px-2 py-2 text-right text-gray-700 font-medium">{taxable.toFixed(2)}</td>
                        <td className="px-2 py-2">
                          <select className={sel + " text-center"} value={String(item.taxPercent)} onChange={(e) => handleItemChange(item.id, "taxPercent", e.target.value)}>
                            {[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-2 text-right font-semibold text-gray-900">{netAmount.toFixed(2)}</td>
                        <td className="px-2 py-2 text-center">
                          <button type="button" onClick={() => handleRemoveRow(item.id)} className="text-gray-300 hover:text-red-500 transition-colors"><X size={14} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex gap-3">
              <button type="button" onClick={handleAddRow} className="text-sm text-blue-600 hover:underline font-medium">+ Add New Row</button>
            </div>

            {/* Totals + Notes */}
            <div className="mt-5 grid grid-cols-1 md:grid-cols-[1fr_300px] gap-5">
              <div>
                <FieldLabel>Notes to Vendor</FieldLabel>
                <textarea className={textareaClass} rows={4} value={form.notes} onChange={(e) => setF("notes", e.target.value)} placeholder="Add notes" />
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden text-sm">
                <table className="w-full">
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-2.5 text-gray-600">Gross Subtotal</td>
                      <td className="px-4 py-2.5 text-right text-gray-900">₹{formTotals.grossSubtotal.toFixed(2)}</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-2.5 font-semibold text-gray-900">Discounts (−)</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-900">₹ − {formTotals.totalDiscount.toFixed(2)}</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-2.5 font-semibold text-gray-900">Total Taxable Value</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-900">₹{formTotals.subtotal.toFixed(2)}</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-2.5 text-gray-600">Total GST</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">₹{formTotals.totalTax.toFixed(2)}</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-2 text-gray-600">Adjustment</td>
                      <td className="px-4 py-2 text-right">
                        <input type="number" className="w-24 px-2 py-1 text-right text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-400 bg-white" value={form.adjustment} onChange={(e) => setF("adjustment", toNumber(e.target.value))} />
                      </td>
                    </tr>
                    <tr className="border-t-2 border-gray-300 bg-blue-50/40">
                      <td className="px-4 py-3 font-bold text-gray-900">Total Credit</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">₹{formTotals.total.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </Section>

          {/* Bottom action bar */}
          <div className="flex items-center gap-3 mt-2 pt-5 border-t border-gray-200">
            <button type="button" onClick={() => saveCredit("OPEN")} disabled={saving} className="flex items-center gap-1.5 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
              <Save size={14} />{saving ? "Saving…" : "Save as Open"}
            </button>
            <button type="button" onClick={() => saveCredit("DRAFT")} disabled={saving} className="px-5 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
              Save as Draft
            </button>
            <button type="button" onClick={backToList} className="px-5 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors">Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  // ── DETAIL PAGE ────────────────────────────────────────────────────────────
  if (detailId && selectedCredit) {
    const totals = getCreditTotals(selectedCredit);
    const tabs = [
      ["overview", "Overview"],
      ["items", `Line Items (${selectedCredit.items.length})`],
      ["journal", "Journal"],
    ] as const;

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="w-full space-y-5 p-6">
          {/* Action toolbar */}
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={backToList} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mr-1">
                    <ArrowLeft size={15} /> Back
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="h-8 w-8"><Ellipsis className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={handleDownloadPdf} disabled={pdfLoading}>
                        <Download className="mr-2 h-4 w-4" />
                        {pdfLoading ? "Generating…" : "Download PDF"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => toast({ title: "Email sent to vendor" })}>
                        <Mail className="mr-2 h-4 w-4" /> Send Email
                      </DropdownMenuItem>
                      {selectedCredit.status === "DRAFT" && (
                        <DropdownMenuItem onSelect={convertToOpen}>
                          Convert to Open
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onSelect={applyToBill} disabled={selectedCredit.status === "APPLIED"}>
                        Apply to Bill
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={deleteCredit} className="text-red-600 focus:text-red-600">
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <button onClick={backToList} className="text-gray-400 hover:text-gray-700 transition-colors"><X className="h-4 w-4" /></button>
              </div>
            </CardContent>
          </Card>

          {/* Status bar + view toggle */}
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-gray-900">{selectedCredit.creditNoteNumber}</h2>
                    <Badge className={`text-xs font-semibold ${STATUS_STYLE[selectedCredit.status]}`} variant="outline">{selectedCredit.status}</Badge>
                  </div>
                  <span className="text-gray-300">|</span>
                  <span className="text-gray-500">Total Credit: <span className="font-semibold text-gray-900">{money(totals.total)}</span></span>
                  {selectedCredit.associatedBillNumber && (
                    <>
                      <span className="text-gray-300">|</span>
                      <span className="text-gray-500">Against Bill: <span className="font-medium text-gray-800">{selectedCredit.associatedBillNumber}</span></span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">Show PDF View</span>
                  <button
                    type="button"
                    onClick={() => setShowPdfView((v) => !v)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${showPdfView ? "bg-blue-600" : "bg-gray-300"}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm ${showPdfView ? "translate-x-4" : "translate-x-1"}`} />
                  </button>
                </div>
              </div>

              {showPdfView ? (
                <CreditPdfView credit={selectedCredit} />
              ) : (
                <div className="grid gap-4 md:grid-cols-4">
                  {[
                    { label: "Subtotal", value: money(totals.subtotal) },
                    { label: "Tax", value: money(totals.totalTax) },
                    { label: "Adjustment", value: money(selectedCredit.adjustment) },
                    { label: "Total Credit", value: money(totals.total), highlight: true },
                  ].map((item) => (
                    <div key={item.label} className={`rounded-xl p-4 border ${item.highlight ? "bg-gradient-to-br from-blue-50 to-emerald-50/30 border-blue-200" : "bg-gradient-to-br from-gray-50 to-blue-50/30 border-gray-200"}`}>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{item.label}</p>
                      <p className={`text-xl font-bold ${item.highlight ? "text-blue-700" : "text-gray-900"}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabs */}
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="px-6 py-0">
              <div className="flex gap-5 border-b border-gray-200 overflow-x-auto">
                {tabs.map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setActiveTab(value as typeof activeTab)}
                    className={`pb-3 pt-4 px-1 font-medium text-sm whitespace-nowrap ${activeTab === value ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-600 hover:text-gray-900"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <p className="text-xs uppercase text-gray-400 tracking-wide font-semibold mb-3">CREDIT DETAILS</p>
                <div className="space-y-2">
                  {[
                    ["Vendor", selectedCredit.vendorName],
                    ["Credit Date", selectedCredit.creditDate],
                    selectedCredit.referenceNumber ? ["Reference #", selectedCredit.referenceNumber] : null,
                    selectedCredit.associatedBillNumber ? ["Against Bill", selectedCredit.associatedBillNumber] : null,
                    ["Status", selectedCredit.status],
                  ].filter(Boolean).map(([label, value]) => (
                    <div key={label} className="flex items-start gap-3 text-sm">
                      <span className="w-32 text-gray-400 shrink-0">{label}</span>
                      <span className="text-gray-800 font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <p className="text-xs uppercase text-gray-400 tracking-wide font-semibold mb-3">VENDOR ADDRESS</p>
                <p className="text-sm font-bold text-gray-900 mb-1">{selectedCredit.vendorName}</p>
                <p className="text-sm text-gray-600 whitespace-pre-line">{selectedCredit.vendorAddress || "—"}</p>
                {selectedCredit.notes && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs uppercase text-gray-400 tracking-wide font-semibold mb-2">NOTES</p>
                    <p className="text-sm text-gray-600 whitespace-pre-line">{selectedCredit.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Line Items Tab */}
          {activeTab === "items" && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {["#", "ITEM / DESCRIPTION", "ACCOUNT", "QTY", "RATE (₹)", "DISC %", "TAXABLE (₹)", "GST RATE", "GST (₹)", "AMOUNT (₹)"].map((h) => (
                        <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCredit.items.map((item, index) => {
                      const base = item.quantity * item.rate;
                      const discountAmount = (base * item.discount) / 100;
                      const taxable = base - discountAmount;
                      const gst = (taxable * item.taxPercent) / 100;
                      return (
                        <tr key={item.id} className="border-b border-gray-100">
                          <td className="px-3 py-3 text-gray-400 text-center">{index + 1}</td>
                          <td className="px-3 py-3"><p className="font-semibold text-gray-900">{item.itemDetails || "—"}</p></td>
                          <td className="px-3 py-3 text-gray-600">{item.account || "—"}</td>
                          <td className="px-3 py-3 text-center">{item.quantity}</td>
                          <td className="px-3 py-3 text-right">{item.rate.toFixed(2)}</td>
                          <td className="px-3 py-3 text-center text-gray-500">{item.discount > 0 ? `${item.discount}%` : "—"}</td>
                          <td className="px-3 py-3 text-right">{taxable.toFixed(2)}</td>
                          <td className="px-3 py-3 text-center">{item.taxPercent}%</td>
                          <td className="px-3 py-3 text-right">{gst.toFixed(2)}</td>
                          <td className="px-3 py-3 text-right font-semibold text-gray-900">{(taxable + gst).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end p-4">
                <div className="w-80 text-sm">
                  <table className="w-full">
                    <tbody>
                      {[
                        ["Gross Subtotal", money(totals.grossSubtotal)],
                        ["Discounts (−)", money(totals.totalDiscount)],
                        ["Taxable Value", money(totals.subtotal)],
                        ["SGST", money(totals.sgst)],
                        ["CGST", money(totals.cgst)],
                        ...(selectedCredit.adjustment !== 0 ? [["Adjustment", selectedCredit.adjustment.toFixed(2)]] : []),
                      ].map(([label, value]) => (
                        <tr key={label} className="border-b border-gray-100">
                          <td className="py-2 text-gray-600">{label}</td>
                          <td className="py-2 text-right text-gray-800">{value}</td>
                        </tr>
                      ))}
                      <tr className="bg-blue-50">
                        <td className="py-2.5 px-2 font-bold text-gray-900">Total Credit</td>
                        <td className="py-2.5 px-2 text-right font-bold text-blue-700">{money(totals.total)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Journal Tab */}
          {activeTab === "journal" && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="p-6 text-center text-gray-400 text-sm">
                <p>Journal entries will be generated when the credit is applied to a bill.</p>
                {selectedCredit.associatedBillNumber && (
                  <p className="mt-2 font-medium text-gray-600">Associated with Bill #{selectedCredit.associatedBillNumber}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── LIST PAGE ──────────────────────────────────────────────────────────────
  const allChecked = filteredCredits.length > 0 && filteredCredits.every((c) => selectedRows.has(c.id));
  const toggleAll = () => {
    if (allChecked) setSelectedRows(new Set());
    else setSelectedRows(new Set(filteredCredits.map((c) => c.id)));
  };
  const toggleRow = (id: string) => {
    const next = new Set(selectedRows);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedRows(next);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full space-y-4 p-6">
        {/* Header card */}
        <Card className="border-gray-200 shadow-sm">
          <CardContent className="px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-2xl font-bold text-gray-900">All Vendor Credits</h1>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search credits…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white w-52"
                  />
                </div>
                <Button
                  className="h-9 rounded-lg bg-blue-600 px-4 hover:bg-blue-700 text-white"
                  onClick={() => navigate("/transactions/purchase/vendor-credits/create")}
                >
                  <Plus className="mr-1.5 h-4 w-4" /> New
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg border-gray-200">
                      <Ellipsis className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => {
                      setPref({ mode: pref.mode === "auto" ? "manual" : "auto", prefix: pref.prefix, nextNumber: pref.nextNumber });
                      toast({ title: `Numbering switched to ${pref.mode === "auto" ? "manual" : "auto"}` });
                    }}>
                      Configure number preferences
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => {
                      if (selectedRows.size === 0) { toast({ title: "No credits selected" }); return; }
                      persist(credits.filter((c) => !selectedRows.has(c.id)));
                      setSelectedRows(new Set());
                      toast({ title: `${selectedRows.size} credit(s) deleted` });
                    }} className="text-red-600 focus:text-red-600">
                      Delete Selected
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="border-gray-200 shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-10 pl-4">
                    <Checkbox checked={allChecked} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-500">DATE</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-500">CREDIT NOTE #</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-500">REFERENCE NUMBER</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-500">VENDOR NAME</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-500">STATUS</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">AMOUNT</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">BALANCE</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCredits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-16 text-gray-400">
                      <div className="flex flex-col items-center gap-2">
                        <FileText className="h-10 w-10 text-gray-200" />
                        <p className="text-sm font-medium">No vendor credits yet</p>
                        <button
                          onClick={() => navigate("/transactions/purchase/vendor-credits/create")}
                          className="mt-1 text-sm text-blue-600 hover:underline font-medium"
                        >
                          + Create your first vendor credit
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCredits.map((credit) => {
                    const totals = getCreditTotals(credit);
                    return (
                      <TableRow
                        key={credit.id}
                        className="cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => navigate(`/transactions/purchase/vendor-credits/${credit.id}`)}
                      >
                        <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={selectedRows.has(credit.id)} onCheckedChange={() => toggleRow(credit.id)} />
                        </TableCell>
                        <TableCell className="text-sm text-gray-700">{credit.creditDate}</TableCell>
                        <TableCell className="font-medium text-blue-700 text-sm">{credit.creditNoteNumber}</TableCell>
                        <TableCell className="text-sm text-gray-600">{credit.referenceNumber || "—"}</TableCell>
                        <TableCell className="text-sm text-gray-800">{credit.vendorName}</TableCell>
                        <TableCell>
                          <Badge className={`text-xs font-semibold ${STATUS_STYLE[credit.status]}`} variant="outline">
                            {credit.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium text-gray-900">{money(totals.total)}</TableCell>
                        <TableCell className="text-right text-sm font-medium text-gray-900">{money(totals.total)}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
