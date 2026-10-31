import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { usePageMeta } from "@/contexts/PageMetaContext";
import { toast } from "@/hooks/use-toast";
import { getVendors } from "@/lib/vendorDataStore";
import { getClients } from "@/lib/clientStore";
import { getAllPOs } from "@/lib/purchaseOrderStore";
import { getPrefix } from "@/lib/configService";
import { safeReadJson } from "@/lib/utils";
import { generateBillPdf } from "@/lib/billPdf";
import { useI18n } from "@/i18n/I18nProvider";
import { formatCurrency } from "@/lib/formatters";
import { DIGITAL_PRODUCT_HEADERS, getDocumentProductPresentation, isDigitalDocumentProduct } from "@/lib/productDocumentRules";
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
  Mail,
  Pencil,
  Plus,
  Save,
  Search,
  X,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type BillStatus = "DRAFT" | "OPEN" | "PAID";

interface BillItem {
  id: string;
  itemDetails: string;
  account: string;
  hsnSac: string;
  quantity: number;
  rate: number;
  discount: number;
  taxPercent: number;
  customerName: string;
  productType?: string;
  physicalType?: string;
  fulfillmentType?: string;
  commercialTerms?: {
    productType?: string;
    pricingModel?: string;
    leadTimePrimary?: string;
    leadTimeSecondary?: string;
  };
}

interface BillEntry {
  id: string;
  billNumber: string;
  orderNumber: string;
  sourcePurchaseOrderId?: string;
  referenceNumber: string;
  vendorName: string;
  vendorAddress: string;
  billDate: string;
  dueDate: string;
  paymentTerms: string;
  reverseCharge: boolean;
  status: BillStatus;
  notes: string;
  attachmentType: string;
  paymentMade: number;
  items: BillItem[];
  tdsType: "TDS" | "TCS";
  adjustment: number;
}

interface BillForm {
  vendorName: string;
  vendorAddress: string;
  billNumber: string;
  orderNumber: string;
  sourcePurchaseOrderId?: string;
  referenceNumber: string;
  billDate: string;
  dueDate: string;
  paymentTerms: string;
  reverseCharge: boolean;
  notes: string;
  attachmentType: string;
  items: BillItem[];
  tdsType: "TDS" | "TCS";
  adjustment: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const BILLS_STORAGE_KEY = "nido_purchase_bills_v1";

const STATUS_STYLE: Record<BillStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-600 border-gray-200",
  OPEN:  "bg-blue-100 text-blue-700 border-blue-200",
  PAID:  "bg-emerald-100 text-emerald-700 border-emerald-200",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const toNumber = (v: unknown, fallback = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };
const normalizeLookup = (v: unknown) => String(v || "").trim().toLowerCase();

const money = (v: number) => formatCurrency(v);

const todayIso = () => new Date().toISOString().slice(0, 10);

/** Convert any date string to dd/mm/yyyy for storage. Accepts ISO (yyyy-mm-dd)
 *  or already-Indian (dd/mm/yyyy) or empty/undefined. */
const toIndianDate = (v: string | undefined): string => {
  if (!v) return "";
  // already dd/mm/yyyy
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return v;
  // ISO yyyy-mm-dd
  const [y, m, d] = v.split("-");
  if (y && m && d && y.length === 4) return `${d}/${m}/${y}`;
  return v; // return as-is rather than lose data
};

/** Convert any stored date to ISO yyyy-mm-dd for <input type="date">.
 *  Handles dd/mm/yyyy, ISO, and empty/undefined. */
const toIsoDate = (v: string | undefined): string => {
  if (!v) return "";
  // already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  // dd/mm/yyyy
  const [dd, mm, yyyy] = v.split("/");
  if (dd && mm && yyyy && yyyy.length === 4)
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  return "";
};

// Keep aliases used internally
const isoToIndian = toIndianDate;
const indianToIso = toIsoDate;

const getBillTotals = (entry: Pick<BillEntry, "items" | "adjustment">) => {
  const grossSubtotal = entry.items.reduce((sum, item) => sum + item.quantity * item.rate, 0);
  const totalDiscount = entry.items.reduce((sum, item) => {
    const base = item.quantity * item.rate;
    return sum + (base * item.discount) / 100;
  }, 0);
  const totalTaxableValue = grossSubtotal - totalDiscount;

  // GST slab breakdown (grouped by rate, same as invoice)
  const slabMap: Record<number, { taxable: number; cgst: number; sgst: number }> = {};
  entry.items.forEach((item) => {
    const base = item.quantity * item.rate;
    const disc = (base * item.discount) / 100;
    const taxable = base - disc;
    const rate = item.taxPercent;
    if (!slabMap[rate]) slabMap[rate] = { taxable: 0, cgst: 0, sgst: 0 };
    slabMap[rate].taxable += taxable;
    slabMap[rate].cgst += taxable * (rate / 2) / 100;
    slabMap[rate].sgst += taxable * (rate / 2) / 100;
  });
  const gstSlabs = Object.entries(slabMap)
    .filter(([, v]) => v.taxable > 0)
    .map(([rate, v]) => ({ rate: Number(rate), ...v }))
    .sort((a, b) => a.rate - b.rate);

  const totalGst = gstSlabs.reduce((s, sl) => s + sl.cgst + sl.sgst, 0);
  const total = totalTaxableValue + totalGst + entry.adjustment;

  return {
    grossSubtotal,
    totalDiscount,
    subtotal: totalTaxableValue,
    tax: totalGst,
    cgst: totalGst / 2,
    sgst: totalGst / 2,
    gstSlabs,
    total,
  };
};

const getBillPrefix = () => {
  const configured = getPrefix("bill");
  // BL- was the legacy built-in default; new bills use the requested
  // human-readable Bill- prefix while still respecting custom settings.
  return configured === "BL-" || configured === "BILL-" || !configured ? "Bill-" : configured;
};

const nextBillNumber = (entries: BillEntry[]) => {
  const prefix = getBillPrefix();
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escapedPrefix}(\\d+)$`, "i");
  const max = entries.reduce((current, entry) => {
    const match = entry.billNumber.trim().match(pattern);
    const parsed = match ? Number(match[1]) : 0;
    return Number.isFinite(parsed) ? Math.max(current, parsed) : current;
  }, 0);
  return `${prefix}${String(max + 1).padStart(5, "0")}`;
};

const newItem = (id: string): BillItem => ({
  id,
  itemDetails: "",
  account: "",
  hsnSac: "",
  quantity: 1,
  rate: 0,
  discount: 0,
  taxPercent: 9,
  customerName: "",
});

const DEFAULT_BILLS: BillEntry[] = [
  {
    id: "bill-104",
    billNumber: "104",
    orderNumber: "PO-00001",
    sourcePurchaseOrderId: "po-1",
    referenceNumber: "",
    vendorName: "Global Supply Co",
    vendorAddress: "456 Supply Ave, Houston, TX",
    billDate: "06/03/2021",
    dueDate: "06/03/2021",
    paymentTerms: "Due on Receipt",
    reverseCharge: false,
    status: "PAID",
    notes: "Ring completed for March - 2021",
    attachmentType: "Upload File",
    paymentMade: 4543,
    tdsType: "TDS",
    adjustment: 0,
    items: [
      { id: "bill-item-1", itemDetails: "Job Work 1\nFor Job Work for Admin", account: "Subcontractor", quantity: 1, rate: 3800, discount: 0, taxPercent: 9, customerName: "" },
    ],
  },
  {
    id: "bill-11",
    billNumber: "11",
    orderNumber: "PO-00005",
    sourcePurchaseOrderId: "po-5",
    referenceNumber: "",
    vendorName: "SecureTech Ltd",
    vendorAddress: "789 Security Blvd, New York, NY",
    billDate: "26/06/2021",
    dueDate: "26/06/2021",
    paymentTerms: "Net 15",
    reverseCharge: false,
    status: "PAID",
    notes: "Closed payment",
    attachmentType: "Upload File",
    paymentMade: 18880,
    tdsType: "TDS",
    adjustment: 0,
    items: [
      { id: "bill-item-2", itemDetails: "Power Unit", account: "Materials", quantity: 2, rate: 8000, discount: 0, taxPercent: 18, customerName: "" },
    ],
  },
];

/** Normalize a raw stored/legacy record into a fully-typed BillEntry.
 *  Any missing or wrong-typed field gets a safe default so downstream code
 *  can assume all fields are present and correctly typed. */
const normalizeBill = (raw: Record<string, unknown>): BillEntry => {
  const VALID_STATUSES: BillStatus[] = ["DRAFT", "OPEN", "PAID"];
  const rawStatus = String(raw.status ?? "OPEN").toUpperCase();
  const status: BillStatus = VALID_STATUSES.includes(rawStatus as BillStatus)
    ? (rawStatus as BillStatus)
    : "OPEN";

  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  const items: BillItem[] = rawItems.map((it: unknown, idx: number): BillItem => {
    const item = (it && typeof it === "object" ? it : {}) as Record<string, unknown>;
    return {
      id: String(item.id ?? `item-${Date.now()}-${idx}`),
      itemDetails: String(item.itemDetails ?? item.description ?? item.itemName ?? ""),
      account: String(item.account ?? ""),
      hsnSac: String(item.hsnSac ?? item.hsn_sac ?? ""),
      quantity: toNumber(item.quantity, 1),
      rate: toNumber(item.rate, 0),
      discount: toNumber(item.discount, 0),
      taxPercent: toNumber(item.taxPercent, 9),
      customerName: String(item.customerName ?? ""),
    };
  });

  return {
    id: String(raw.id ?? `bill-${Date.now()}`),
    billNumber: String(raw.billNumber ?? raw.bill_number ?? ""),
    orderNumber: String(raw.orderNumber ?? raw.order_number ?? ""),
    sourcePurchaseOrderId: raw.sourcePurchaseOrderId != null ? String(raw.sourcePurchaseOrderId) : undefined,
    referenceNumber: String(raw.referenceNumber ?? raw.reference_number ?? ""),
    vendorName: String(raw.vendorName ?? raw.vendor_name ?? ""),
    vendorAddress: String(raw.vendorAddress ?? raw.vendor_address ?? ""),
    billDate: toIndianDate(String(raw.billDate ?? raw.bill_date ?? raw.date ?? "")),
    dueDate: toIndianDate(String(raw.dueDate ?? raw.due_date ?? "")),
    paymentTerms: String(raw.paymentTerms ?? raw.payment_terms ?? "Due on Receipt"),
    reverseCharge: Boolean(raw.reverseCharge ?? raw.reverse_charge ?? false),
    status,
    notes: String(raw.notes ?? ""),
    attachmentType: String(raw.attachmentType ?? raw.attachment_type ?? "Upload File"),
    paymentMade: toNumber(raw.paymentMade ?? raw.payment_made, 0),
    items: items.length ? items : [newItem(`item-${Date.now()}`)],
    tdsType: raw.tdsType === "TCS" ? "TCS" : "TDS",
    adjustment: toNumber(raw.adjustment, 0),
  };
};

const readBills = (): BillEntry[] => {
  const parsed = safeReadJson<unknown>(BILLS_STORAGE_KEY, DEFAULT_BILLS);
  if (!Array.isArray(parsed)) return DEFAULT_BILLS;
  const normalized = parsed
    .filter((entry) => !!entry && typeof entry === "object")
    .map((entry) => normalizeBill(entry as Record<string, unknown>))
    .filter((entry) => entry.id && entry.billNumber !== undefined);
  return normalized.length ? normalized : DEFAULT_BILLS;
};

const blankForm = (): BillForm => ({
  vendorName: "",
  vendorAddress: "",
  billNumber: "",
  orderNumber: "",
  referenceNumber: "",
  billDate: todayIso(),
  dueDate: todayIso(),
  paymentTerms: "Due on Receipt",
  reverseCharge: false,
  notes: "",
  attachmentType: "Upload File",
  tdsType: "TDS",
  adjustment: 0,
  items: [newItem(`tmp-${Date.now()}`)],
});

// ── Style tokens (matches PurchaseOrdersPage) ─────────────────────────────────
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

// ── Inline PDF view (matches PurchaseOrderPdfView style) ──────────────────────
function BillPdfView({ bill }: { bill: BillEntry }) {
  const totals = getBillTotals(bill);
  const balanceDue = Math.max(totals.total - bill.paymentMade, 0);
  const hasDigitalItems = bill.items.some(isDigitalDocumentProduct);
  const hasPhysicalItems = bill.items.some((item) => !isDigitalDocumentProduct(item));

  return (
    <div className="mx-auto max-w-[900px] border border-gray-200 bg-white rounded-xl p-8 shadow-sm text-gray-900">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-xl bg-blue-600 flex items-center justify-center text-white text-2xl font-bold">N</div>
          <div>
            <p className="text-xs uppercase text-gray-400 tracking-wider">{bill.status}</p>
            <p className="text-sm font-semibold text-blue-700">Bill #{bill.billNumber}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-serif tracking-widest text-gray-800">BILL</p>
          <div className="mt-2 bg-blue-50 rounded-lg px-4 py-2">
            <p className="text-xs text-gray-500">Balance Due</p>
            <p className="text-lg font-bold text-gray-900">{money(balanceDue)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Bill From</p>
          <p className="text-sm font-semibold text-blue-700">{bill.vendorName}</p>
          <p className="text-xs text-gray-600 whitespace-pre-line mt-1">{bill.vendorAddress}</p>
        </div>
        <div className="space-y-1">
          {([
            ["Bill #", bill.billNumber],
            ["Bill Date", bill.billDate],
            ["Due Date", bill.dueDate],
            ["Payment Terms", bill.paymentTerms],
            ...(bill.orderNumber ? [["Order #", bill.orderNumber]] : []),
          ] as [string, string][]).map(([l, v]) => (
            <div key={l} className="flex text-sm border-b border-gray-50">
              <span className="w-36 bg-gray-50 px-3 py-1.5 text-gray-500 text-xs font-medium">{l}</span>
              <span className="px-3 py-1.5 text-gray-800 text-xs">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Items table */}
      <table className="w-full text-sm mb-4">
        <thead>
          <tr className="bg-gray-50 border border-gray-200">
            <th className="text-left px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">#</th>
            <th className="text-left px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Item & Description</th>
            <th className="text-left px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Account</th>
            <th className="text-right px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">
              {hasDigitalItems ? hasPhysicalItems ? `QTY / ${DIGITAL_PRODUCT_HEADERS.quantity}` : DIGITAL_PRODUCT_HEADERS.quantity : "Qty"}
            </th>
            {hasPhysicalItems && <th className="text-right px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Rate</th>}
            {hasDigitalItems && (
              <>
                <th className="text-right px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">{DIGITAL_PRODUCT_HEADERS.tenure}</th>
                <th className="text-right px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">{DIGITAL_PRODUCT_HEADERS.provisioning}</th>
              </>
            )}
            <th className="text-right px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Amount</th>
          </tr>
        </thead>
        <tbody>
          {bill.items.map((item, i) => {
            const digital = isDigitalDocumentProduct(item);
            const base = item.quantity * item.rate;
            const discountAmount = (base * item.discount) / 100;
            const taxable = base - discountAmount;
            return (
              <tr key={item.id} className="border-b border-gray-100">
                <td className="px-3 py-2.5 text-gray-500">{i + 1}</td>
                <td className="px-3 py-2.5 whitespace-pre-wrap"><p className="font-medium">{item.itemDetails || "—"}</p></td>
                <td className="px-3 py-2.5 text-gray-500">{item.account || "—"}</td>
                <td className="px-3 py-2.5 text-right">{item.quantity.toFixed(2)}</td>
                {hasPhysicalItems && <td className="px-3 py-2.5 text-right">{digital ? "—" : item.rate.toFixed(2)}</td>}
                {hasDigitalItems && (
                  <>
                    <td className="px-3 py-2.5 text-right">{digital ? getDocumentProductPresentation(item, { quantity: item.quantity }).tenureBilling : "—"}</td>
                    <td className="px-3 py-2.5 text-right">{digital ? getDocumentProductPresentation(item, { quantity: item.quantity }).provisioningTime : "—"}</td>
                  </>
                )}
                <td className="px-3 py-2.5 text-right font-medium">{taxable.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end mb-6">
        <div className="w-72 space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-600"><span>Sub Total</span><span>{totals.subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between text-gray-600"><span>SGST (9%)</span><span>{totals.sgst.toFixed(2)}</span></div>
          <div className="flex justify-between text-gray-600"><span>CGST (9%)</span><span>{totals.cgst.toFixed(2)}</span></div>
          {bill.adjustment !== 0 && <div className="flex justify-between text-gray-600"><span>Adjustment</span><span>{bill.adjustment.toFixed(2)}</span></div>}
          <div className="flex justify-between text-red-600"><span>Payment Made (-)</span><span>{money(bill.paymentMade)}</span></div>
          <div className="flex justify-between pt-2 border-t border-gray-200 font-bold text-gray-900 text-base"><span>Balance Due</span><span>{money(balanceDue)}</span></div>
        </div>
      </div>

      {bill.notes && (
        <div className="mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Notes</p>
          <p className="text-sm text-gray-600 whitespace-pre-line">{bill.notes}</p>
        </div>
      )}

      <div className="mt-8 text-sm text-gray-500 border-t border-gray-100 pt-4">
        <p>Authorized Signature ___________________________</p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function BillsPage() {
  const { currencySymbol } = useI18n();
  const { setMeta } = usePageMeta();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ id?: string }>();
  const vendors = useMemo(() => getVendors().filter((v) => !v.archived) ?? [], []);
  const clients = useMemo(() => getClients() ?? [], []);

  const [bills, setBills] = useState<BillEntry[]>(readBills);
  const [form, setForm] = useState<BillForm>(blankForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPdfView, setShowPdfView] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "items" | "journal">("overview");
  const [search, setSearch] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const createMode = location.pathname.endsWith("/create");
  const editMode = location.pathname.endsWith("/edit") && !!params.id;
  const isFormMode = createMode || editMode;
  const detailId = !isFormMode ? params.id : null;

  const selectedBill = useMemo(
    () => (params.id ? bills.find((b) => b.id === params.id) || null : null),
    [bills, params.id],
  );
  const selectedVendor = useMemo(
    () => vendors.find((vendor) => vendor.name === form.vendorName),
    [vendors, form.vendorName],
  );
  const deliveredPurchaseOrders = useMemo(() => {
    const vendorName = normalizeLookup(form.vendorName);
    const vendorId = selectedVendor?.id;
    return getAllPOs().filter((po) =>
      String(po.status).trim().toLowerCase() === "delivered"
      && (
        (vendorId && po.vendorId === vendorId)
        || normalizeLookup(po.vendorName) === vendorName
      ),
    );
  }, [form.vendorName, selectedVendor?.id]);

  useEffect(() => {
    setMeta({ title: selectedBill?.billNumber || "Bills" });
    return () => setMeta({});
  }, [selectedBill]);

  useEffect(() => {
    if (createMode) { setEditingId(null); setForm({ ...blankForm(), billNumber: nextBillNumber(bills) }); return; }
    if (editMode && selectedBill) {
      setEditingId(selectedBill.id);
      setForm({
        vendorName: selectedBill.vendorName,
        vendorAddress: selectedBill.vendorAddress,
        billNumber: selectedBill.billNumber,
        orderNumber: selectedBill.orderNumber,
        sourcePurchaseOrderId: selectedBill.sourcePurchaseOrderId,
        referenceNumber: selectedBill.referenceNumber,
        billDate: indianToIso(selectedBill.billDate),
        dueDate: indianToIso(selectedBill.dueDate),
        paymentTerms: selectedBill.paymentTerms,
        reverseCharge: selectedBill.reverseCharge,
        notes: selectedBill.notes,
        attachmentType: selectedBill.attachmentType,
        items: selectedBill.items.map((item) => ({ ...item })),
        tdsType: selectedBill.tdsType,
        adjustment: selectedBill.adjustment,
      });
    }
  }, [createMode, editMode, params.id]);

  const persist = (next: BillEntry[]) => {
    setBills(next);
    localStorage.setItem(BILLS_STORAGE_KEY, JSON.stringify(next));
  };

  const backToList = () => navigate("/transactions/purchase/bills", { replace: true });

  // ── Form handlers ────────────────────────────────────────────────────────
  const setF = <K extends keyof BillForm>(key: K, value: BillForm[K]) =>
    setForm((c) => ({ ...c, [key]: value }));

  const handleAddRow = () => setF("items", [...form.items, newItem(`tmp-${Date.now()}`)]);

  const handleItemChange = (id: string, key: keyof BillItem, value: string) =>
    setF("items", form.items.map((item) => {
      if (item.id !== id) return item;
      if (["quantity", "rate", "discount", "taxPercent"].includes(key)) return { ...item, [key]: toNumber(value) };
      return { ...item, [key]: value };
    }));

  const handleRemoveRow = (id: string) => {
    const next = form.items.filter((i) => i.id !== id);
    setF("items", next.length ? next : [newItem(`tmp-${Date.now()}`)]);
  };

  const saveBill = (status: BillStatus) => {
    if (!form.vendorName || !form.billDate || !form.dueDate) {
      toast({ title: "Vendor Name, Bill Date and Due Date are required" });
      return;
    }
    if (!form.items.some((item) => item.itemDetails.trim())) {
      toast({ title: "Please add at least one line item" });
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const updated = bills.map((entry) =>
          entry.id === editingId
            ? {
                ...entry,
                vendorName: form.vendorName, vendorAddress: form.vendorAddress,
                billNumber: form.billNumber, orderNumber: form.orderNumber,
                sourcePurchaseOrderId: form.sourcePurchaseOrderId,
                referenceNumber: form.referenceNumber,
                billDate: isoToIndian(form.billDate), dueDate: isoToIndian(form.dueDate),
                paymentTerms: form.paymentTerms, reverseCharge: form.reverseCharge,
                status, notes: form.notes, attachmentType: form.attachmentType,
                items: form.items, tdsType: form.tdsType, adjustment: form.adjustment,
              }
            : entry,
        );
        persist(updated);
        toast({ title: "Bill updated" });
        navigate(`/transactions/purchase/bills/${editingId}`, { replace: true });
      } else {
        const id = `bill-${Date.now()}`;
        const created: BillEntry = {
          id,
          billNumber: form.billNumber || nextBillNumber(bills),
          orderNumber: form.orderNumber,
          sourcePurchaseOrderId: form.sourcePurchaseOrderId,
          referenceNumber: form.referenceNumber,
          vendorName: form.vendorName,
          vendorAddress: form.vendorAddress,
          billDate: isoToIndian(form.billDate),
          dueDate: isoToIndian(form.dueDate),
          paymentTerms: form.paymentTerms,
          reverseCharge: form.reverseCharge,
          status,
          notes: form.notes,
          attachmentType: form.attachmentType,
          paymentMade: status === "PAID" ? getBillTotals({ items: form.items, adjustment: form.adjustment }).total : 0,
          items: form.items,
          tdsType: form.tdsType,
          adjustment: form.adjustment,
        };
        persist([created, ...bills]);
        toast({ title: status === "DRAFT" ? "Bill saved as draft" : "Bill saved as open" });
        navigate(`/transactions/purchase/bills/${id}`, { replace: true });
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Detail actions ───────────────────────────────────────────────────────
  const markPaid = () => {
    if (!selectedBill) return;
    const totals = getBillTotals(selectedBill);
    persist(bills.map((b) => b.id === selectedBill.id ? { ...b, status: "PAID", paymentMade: totals.total } : b));
    toast({ title: "Bill marked as paid" });
  };

  const duplicateBill = () => {
    if (!selectedBill) return;
    const cloned: BillEntry = {
      ...selectedBill,
      id: `bill-${Date.now()}`,
      billNumber: nextBillNumber(bills),
      status: "DRAFT",
      paymentMade: 0,
      items: selectedBill.items.map((item) => ({ ...item, id: `bill-item-${Date.now()}-${Math.random()}` })),
    };
    persist([cloned, ...bills]);
    navigate(`/transactions/purchase/bills/${cloned.id}`);
    toast({ title: "Bill duplicated" });
  };

  const deleteBill = () => {
    if (!selectedBill) return;
    persist(bills.filter((b) => b.id !== selectedBill.id));
    backToList();
    toast({ title: "Bill deleted" });
  };

  const handleDownloadPdf = async () => {
    if (!selectedBill) return;
    setPdfLoading(true);
    try {
      await generateBillPdf({
        billNumber: selectedBill.billNumber,
        orderNumber: selectedBill.orderNumber,
        referenceNumber: selectedBill.referenceNumber,
        vendorName: selectedBill.vendorName,
        vendorAddress: selectedBill.vendorAddress,
        billDate: selectedBill.billDate,
        dueDate: selectedBill.dueDate,
        paymentTerms: selectedBill.paymentTerms,
        notes: selectedBill.notes,
        paymentMade: selectedBill.paymentMade,
        adjustment: selectedBill.adjustment,
        items: selectedBill.items,
      });
    } catch (err) {
      console.error(err);
      toast({ title: "PDF generation failed", description: String(err) });
    } finally {
      setPdfLoading(false);
    }
  };

  const formTotals = getBillTotals({ items: form.items, adjustment: form.adjustment });
  const hasDigitalFormItems = form.items.some(isDigitalDocumentProduct);
  const hasPhysicalFormItems = form.items.some((item) => !isDigitalDocumentProduct(item));

  // ── FORM PAGE ──────────────────────────────────────────────────────────────
  if (isFormMode) {
    const vendorNames = vendors.filter((v) => !v.archived).map((v) => v.name);
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
                {editingId ? `Edit Bill ${bills.find((b) => b.id === editingId)?.billNumber || ""}` : "New Bill"}
              </h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={backToList} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={() => saveBill("DRAFT")} disabled={saving} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
                Save as Draft
              </button>
              <button type="button" onClick={() => saveBill("OPEN")} disabled={saving} className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
                <Save size={14} />
                {saving ? "Saving…" : "Save as Open"}
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="w-full px-6 py-7">
          {/* Section 1 — Vendor & Header */}
          <Section title="Vendor & Bill Header" icon={FileText}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <FieldLabel required>Vendor Name</FieldLabel>
                <select
                  className={sel}
                  value={form.vendorName}
                  onChange={(e) => {
                    const v = e.target.value;
                    const vendor = vendors.find((vd) => vd.name === v);
                    const address = vendor?.address || "No. 6, 4th Main Road\nGKW Layout, Peenya 2nd Stage\nBangalore Karnataka\nIndia";
                    setForm((current) => ({
                      ...current,
                      vendorName: v,
                      vendorAddress: address,
                      orderNumber: "",
                      sourcePurchaseOrderId: undefined,
                    }));
                  }}
                >
                  <option value="">Select a Vendor</option>
                  {vendorNames.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Bill #</FieldLabel>
                <input type="text" className={inp + " bg-gray-50 text-gray-500 cursor-not-allowed"} value={form.billNumber} readOnly tabIndex={-1} />
              </div>
              <div>
                <FieldLabel>Vendor Address</FieldLabel>
                <textarea className={textareaClass} rows={4} value={form.vendorAddress} onChange={(e) => setF("vendorAddress", e.target.value)} placeholder="Vendor address" />
              </div>
              <div className="space-y-4">
                <div>
                  <FieldLabel required>Bill Date</FieldLabel>
                  <input type="date" className={inp} value={form.billDate} onChange={(e) => setF("billDate", e.target.value)} />
                </div>
                <div>
                  <FieldLabel required>Due Date</FieldLabel>
                  <input type="date" className={inp} value={form.dueDate} onChange={(e) => setF("dueDate", e.target.value)} />
                </div>
              </div>
              <div>
                <FieldLabel>PO Number</FieldLabel>
                <select
                  className={sel}
                  value={form.orderNumber}
                  onChange={(e) => {
                    const po = deliveredPurchaseOrders.find((candidate) => candidate.poNumber === e.target.value);
                    const poItems = po?.items?.map((line) => ({
                      ...newItem(`bill-item-${Date.now()}-${line.subOrderId}`),
                      itemDetails: line.item,
                      account: line.category || "",
                      hsnSac: line.hsnCode || "",
                      quantity: line.qty,
                      rate: line.unitPrice,
                      taxPercent: line.gstPct ?? ((po.sgstPct || 0) + (po.cgstPct || 18)),
                      productType: line.productType,
                      commercialTerms: line.commercialTerms,
                    }));
                    setForm((current) => ({
                      ...current,
                      orderNumber: po?.poNumber || "",
                      sourcePurchaseOrderId: po?.poNumber,
                      items: poItems?.length ? poItems : current.items,
                    }));
                  }}
                  disabled={!form.vendorName}
                >
                  <option value="">
                    {form.vendorName ? "Select a delivered PO" : "Select a vendor first"}
                  </option>
                  {deliveredPurchaseOrders.map((po) => (
                    <option key={po.poNumber} value={po.poNumber}>{po.poNumber}</option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>Reference Number</FieldLabel>
                <input type="text" className={inp} value={form.referenceNumber} onChange={(e) => setF("referenceNumber", e.target.value)} placeholder="e.g. REF-001" />
              </div>
              <div>
                <FieldLabel>Payment Terms</FieldLabel>
                <select className={sel} value={form.paymentTerms} onChange={(e) => setF("paymentTerms", e.target.value)}>
                  <option value="Due on Receipt">Due on Receipt</option>
                  <option value="Net 15">Net 15</option>
                  <option value="Net 30">Net 30</option>
                  <option value="Net 45">Net 45</option>
                  <option value="Net 60">Net 60</option>
                </select>
              </div>
              <div className="flex items-center gap-3 pt-5">
                <input type="checkbox" className="accent-blue-600 w-4 h-4" id="reverseCharge" checked={form.reverseCharge} onChange={(e) => setF("reverseCharge", e.target.checked)} />
                <label htmlFor="reverseCharge" className="text-sm text-gray-600 cursor-pointer">This transaction is applicable for reverse charge</label>
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
                    <th className="text-center px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide w-28">HSN/SAC</th>
                    <th className="text-center px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide w-20">
                      {hasDigitalFormItems ? hasPhysicalFormItems ? `QTY / ${DIGITAL_PRODUCT_HEADERS.quantity}` : DIGITAL_PRODUCT_HEADERS.quantity : "Qty"}
                    </th>
                    {hasPhysicalFormItems && (
                      <>
                        <th className="text-right px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide w-28">Unit Rate</th>
                        <th className="text-right px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide w-24">Disc</th>
                      </>
                    )}
                    {hasDigitalFormItems && (
                      <>
                        <th className="text-center px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">{DIGITAL_PRODUCT_HEADERS.tenure}</th>
                        <th className="text-center px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">{DIGITAL_PRODUCT_HEADERS.provisioning}</th>
                      </>
                    )}
                    <th className="text-right px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide w-28">Taxable</th>
                    <th className="text-center px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide w-24">GST Rate</th>
                    <th className="text-right px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide w-24">GST</th>
                    <th className="text-right px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide w-28">Net Amount</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((item, rowIdx) => {
                    const digital = isDigitalDocumentProduct(item);
                    const base = item.quantity * item.rate;
                    const discountAmount = (base * item.discount) / 100;
                    const taxable = base - discountAmount;
                    const gst = (taxable * item.taxPercent) / 100;
                    const netAmount = taxable + gst;
                    return (
                      <tr key={item.id} className="border-b border-gray-100">
                        <td className="px-2 py-2 text-center text-gray-400 text-xs">{rowIdx + 1}</td>
                        <td className="px-2 py-2">
                          <input className={inp} value={item.itemDetails} onChange={(e) => handleItemChange(item.id, "itemDetails", e.target.value)} placeholder="Item name / specification" />
                        </td>
                        <td className="px-2 py-2">
                          <input className={inp + " text-center"} value={item.hsnSac} onChange={(e) => handleItemChange(item.id, "hsnSac", e.target.value)} placeholder="HSN/SAC" />
                        </td>
                        <td className="px-2 py-2">
                          <input className={inp + " text-center"} value={String(item.quantity)} onChange={(e) => handleItemChange(item.id, "quantity", e.target.value)} />
                        </td>
                        {hasPhysicalFormItems && (digital ? (
                          <>
                            <td className="px-2 py-2 text-center text-gray-400">—</td>
                            <td className="px-2 py-2 text-center text-gray-400">—</td>
                          </>
                        ) : (
                          <>
                            <td className="px-2 py-2">
                              <input className={inp + " text-right"} value={String(item.rate)} onChange={(e) => handleItemChange(item.id, "rate", e.target.value)} />
                            </td>
                            <td className="px-2 py-2">
                              <input className={inp + " text-right"} value={String(item.discount)} onChange={(e) => handleItemChange(item.id, "discount", e.target.value)} placeholder="0" />
                            </td>
                          </>
                        ))}
                        {hasDigitalFormItems && (
                          <>
                            <td className="px-2 py-2 text-center text-xs text-gray-600">
                              {digital ? getDocumentProductPresentation(item, { quantity: item.quantity }).tenureBilling : "—"}
                            </td>
                            <td className="px-2 py-2 text-center text-xs text-gray-600">
                              {digital ? getDocumentProductPresentation(item, { quantity: item.quantity }).provisioningTime : "—"}
                            </td>
                          </>
                        )}
                        <td className="px-2 py-2 text-right text-gray-700 font-medium">{taxable.toFixed(2)}</td>
                        <td className="px-2 py-2">
                          <select className={sel + " text-center"} value={String(item.taxPercent)} onChange={(e) => handleItemChange(item.id, "taxPercent", e.target.value)}>
                            {[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-2 text-right text-gray-700">{gst.toFixed(2)}</td>
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
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={handleAddRow} className="text-sm text-blue-600 hover:underline font-medium">+ Add New Row</button>
              <button type="button" onClick={() => toast({ title: "Bulk actions" })} className="text-sm text-gray-500 hover:text-gray-800">Purchase Discounts</button>
              <button type="button" onClick={() => toast({ title: "Reporting tags" })} className="text-sm text-gray-500 hover:text-gray-800">Reporting Tags</button>
            </div>

            {/* Totals */}
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
                      <td className="px-4 py-2.5 text-right text-gray-900">{money(formTotals.grossSubtotal)}</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-2.5 font-semibold text-gray-900">Item Level Discounts (−)</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-900">− {money(formTotals.totalDiscount)}</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-2.5 font-semibold text-gray-900">Total Taxable Value</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{money(formTotals.subtotal)}</td>
                    </tr>
                    {formTotals.gstSlabs.map((slab) => (
                      <>
                        <tr key={`cgst-${slab.rate}`} className="border-b border-gray-100">
                          <td className="px-4 py-2 text-gray-500 pl-6">CGST @ {slab.rate / 2}%</td>
                          <td className="px-4 py-2 text-right text-gray-700">{money(slab.cgst)}</td>
                        </tr>
                        <tr key={`sgst-${slab.rate}`} className="border-b border-gray-100">
                          <td className="px-4 py-2 text-gray-500 pl-6">SGST @ {slab.rate / 2}%</td>
                          <td className="px-4 py-2 text-right text-gray-700">{money(slab.sgst)}</td>
                        </tr>
                      </>
                    ))}
                    {formTotals.gstSlabs.length === 0 && (
                      <tr className="border-b border-gray-100">
                        <td className="px-4 py-2.5 text-gray-500">Total GST</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{money(0)}</td>
                      </tr>
                    )}
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-2.5 text-gray-600">Adjustment</td>
                      <td className="px-4 py-2 text-right">
                        <input type="number" className="w-24 px-2 py-1 text-right text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-400 bg-white" value={form.adjustment} onChange={(e) => setF("adjustment", toNumber(e.target.value))} />
                      </td>
                    </tr>
                    <tr className="border-t-2 border-gray-300 bg-blue-50/40">
                      <td className="px-4 py-3 font-bold text-gray-900">Total</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">{money(formTotals.total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </Section>

          {/* Bottom action bar */}
          <div className="flex items-center gap-3 mt-2 pt-5 border-t border-gray-200">
            <button type="button" onClick={() => saveBill("OPEN")} disabled={saving} className="flex items-center gap-1.5 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
              <Save size={14} />{saving ? "Saving…" : "Save as Open"}
            </button>
            <button type="button" onClick={() => saveBill("DRAFT")} disabled={saving} className="px-5 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
              Save as Draft
            </button>
            <button type="button" onClick={backToList} className="px-5 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors">Cancel</button>
            <p className="ml-auto text-xs text-gray-400">PDF Template: Standard Template <span className="text-blue-600 cursor-pointer hover:underline">Change</span></p>
          </div>
        </div>
      </div>
    );
  }

  // ── DETAIL PAGE ────────────────────────────────────────────────────────────
  if (detailId && selectedBill) {
    const totals = getBillTotals(selectedBill);
    const balanceDue = Math.max(totals.total - selectedBill.paymentMade, 0);
    const hasDigitalBillItems = selectedBill.items.some(isDigitalDocumentProduct);
    const hasPhysicalBillItems = selectedBill.items.some((item) => !isDigitalDocumentProduct(item));
    const tabs = [
      ["overview", "Overview"],
      ["items", `Line Items (${selectedBill.items.length})`],
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
                      <DropdownMenuItem onSelect={markPaid} disabled={selectedBill.status === "PAID"}>
                        Mark as Paid
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={duplicateBill}>
                        Duplicate Bill
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={deleteBill} className="text-red-600 focus:text-red-600">
                        Delete Bill
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
                    <h2 className="text-xl font-bold text-gray-900">Bill #{selectedBill.billNumber}</h2>
                    <Badge className={`text-xs font-semibold ${STATUS_STYLE[selectedBill.status]}`} variant="outline">{selectedBill.status}</Badge>
                  </div>
                  <span className="text-gray-300">|</span>
                  <span className="text-gray-500">Payments Made: <span className="font-medium text-gray-800">{money(selectedBill.paymentMade)}</span></span>
                  <span className="text-gray-500">Balance Due: <span className="font-semibold text-gray-900">{money(balanceDue)}</span></span>
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
                <BillPdfView bill={selectedBill} />
              ) : (
                <div className="grid gap-4 md:grid-cols-4">
                  {[
                    { label: "Subtotal", value: money(totals.subtotal) },
                    { label: "Tax", value: money(totals.tax) },
                    { label: "Payment Made", value: money(selectedBill.paymentMade) },
                    { label: "Balance Due", value: money(balanceDue), highlight: true },
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
                <p className="text-xs uppercase text-gray-400 tracking-wide font-semibold mb-3">BILL DETAILS</p>
                <div className="space-y-2">
                  {[
                    ["Vendor", selectedBill.vendorName],
                    ["Bill Date", selectedBill.billDate],
                    ["Due Date", selectedBill.dueDate],
                    ["Payment Terms", selectedBill.paymentTerms],
                    selectedBill.orderNumber ? ["Order #", selectedBill.orderNumber] : null,
                    selectedBill.referenceNumber ? ["Reference #", selectedBill.referenceNumber] : null,
                    ["Reverse Charge", selectedBill.reverseCharge ? "Yes" : "No"],
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
                <p className="text-sm font-bold text-gray-900 mb-1">{selectedBill.vendorName}</p>
                <p className="text-sm text-gray-600 whitespace-pre-line">{selectedBill.vendorAddress}</p>
                {selectedBill.notes && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs uppercase text-gray-400 tracking-wide font-semibold mb-2">NOTES</p>
                    <p className="text-sm text-gray-600 whitespace-pre-line">{selectedBill.notes}</p>
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
                      {[
                        "#",
                        "ITEM / DESCRIPTION",
                        "ACCOUNT",
                        hasDigitalBillItems ? hasPhysicalBillItems ? `QTY / ${DIGITAL_PRODUCT_HEADERS.quantity}` : DIGITAL_PRODUCT_HEADERS.quantity : "QTY",
                        ...(hasPhysicalBillItems ? [`RATE (${currencySymbol})`, "DISC %"] : []),
                        ...(hasDigitalBillItems ? [DIGITAL_PRODUCT_HEADERS.tenure, DIGITAL_PRODUCT_HEADERS.provisioning] : []),
                        `TAXABLE (${currencySymbol})`,
                        "GST RATE",
                        `GST (${currencySymbol})`,
                        `AMOUNT (${currencySymbol})`,
                      ].map((h) => (
                        <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedBill.items.map((item, index) => {
                      const digital = isDigitalDocumentProduct(item);
                      const base = item.quantity * item.rate;
                      const discountAmount = (base * item.discount) / 100;
                      const taxable = base - discountAmount;
                      const gst = (taxable * item.taxPercent) / 100;
                      return (
                        <tr key={item.id} className="border-b border-gray-100">
                          <td className="px-3 py-3 text-gray-400 text-center">{index + 1}</td>
                          <td className="px-3 py-3 whitespace-pre-wrap">
                            <p className="font-semibold text-gray-900">{item.itemDetails || "—"}</p>
                          </td>
                          <td className="px-3 py-3 text-gray-600">{item.account || "—"}</td>
                          <td className="px-3 py-3 text-center">{item.quantity}</td>
                          {hasPhysicalBillItems && (digital ? (
                            <>
                              <td className="px-3 py-3 text-center text-gray-400">—</td>
                              <td className="px-3 py-3 text-center text-gray-400">—</td>
                            </>
                          ) : (
                            <>
                              <td className="px-3 py-3 text-right">{item.rate.toFixed(2)}</td>
                              <td className="px-3 py-3 text-center text-gray-500">{item.discount > 0 ? `${item.discount}%` : "—"}</td>
                            </>
                          ))}
                          {hasDigitalBillItems && (
                            <>
                              <td className="px-3 py-3 text-center text-gray-600">
                                {digital ? getDocumentProductPresentation(item, { quantity: item.quantity }).tenureBilling : "—"}
                              </td>
                              <td className="px-3 py-3 text-center text-gray-600">
                                {digital ? getDocumentProductPresentation(item, { quantity: item.quantity }).provisioningTime : "—"}
                              </td>
                            </>
                          )}
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
              {/* Summary */}
              <div className="flex justify-end p-4">
                <div className="w-80 text-sm">
                  <table className="w-full">
                    <tbody>
                      {[
                        ["Sub Total", totals.subtotal.toFixed(2)],
                        ["SGST (9%)", totals.sgst.toFixed(2)],
                        ["CGST (9%)", totals.cgst.toFixed(2)],
                        ...(selectedBill.adjustment !== 0 ? [["Adjustment", selectedBill.adjustment.toFixed(2)]] : []),
                        ["Payment Made (-)", money(selectedBill.paymentMade)],
                      ].map(([label, value]) => (
                        <tr key={label} className="border-b border-gray-100">
                          <td className="py-2 text-gray-600">{label}</td>
                          <td className="py-2 text-right text-gray-800">{value}</td>
                        </tr>
                      ))}
                      <tr className="bg-blue-50">
                        <td className="py-2.5 px-2 font-bold text-gray-900">Balance Due</td>
                        <td className="py-2.5 px-2 text-right font-bold text-blue-700">{money(balanceDue)}</td>
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
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/70">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-700">Journal Entry</p>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-bold uppercase text-gray-500">Account</TableHead>
                      <TableHead className="text-xs font-bold uppercase text-gray-500 text-right">Debit ({currencySymbol})</TableHead>
                      <TableHead className="text-xs font-bold uppercase text-gray-500 text-right">Credit ({currencySymbol})</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Expense/Purchase accounts — one row per unique account */}
                    {(() => {
                      const accountMap = new Map<string, number>();
                      selectedBill.items.forEach((item) => {
                        const base = item.quantity * item.rate;
                        const discountAmount = (base * item.discount) / 100;
                        const taxable = base - discountAmount;
                        const key = item.account || "Purchase Account";
                        accountMap.set(key, (accountMap.get(key) || 0) + taxable);
                      });
                      return Array.from(accountMap.entries()).map(([account, amount]) => (
                        <TableRow key={account}>
                          <TableCell className="text-sm text-gray-800">{account}</TableCell>
                          <TableCell className="text-right text-sm">{amount.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-sm text-gray-400">—</TableCell>
                        </TableRow>
                      ));
                    })()}
                    <TableRow>
                      <TableCell className="text-sm text-gray-800">Input SGST</TableCell>
                      <TableCell className="text-right text-sm">{totals.sgst.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-sm text-gray-400">—</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-sm text-gray-800">Input CGST</TableCell>
                      <TableCell className="text-right text-sm">{totals.cgst.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-sm text-gray-400">—</TableCell>
                    </TableRow>
                    <TableRow className="bg-gray-50">
                      <TableCell className="text-sm font-semibold text-gray-800">Accounts Payable</TableCell>
                      <TableCell className="text-right text-sm text-gray-400">—</TableCell>
                      <TableCell className="text-right text-sm font-semibold">{totals.total.toFixed(2)}</TableCell>
                    </TableRow>
                    <TableRow className="bg-blue-50/50">
                      <TableCell className="text-sm font-bold text-gray-900 py-3">Total</TableCell>
                      <TableCell className="text-right text-sm font-bold py-3">{totals.total.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-sm font-bold py-3">{totals.total.toFixed(2)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── LIST PAGE ──────────────────────────────────────────────────────────────
  const filteredBills = bills.filter((b) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (b.billNumber ?? "").toLowerCase().includes(q) ||
      (b.vendorName ?? "").toLowerCase().includes(q) ||
      (b.referenceNumber ?? "").toLowerCase().includes(q) ||
      (b.orderNumber ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full space-y-5 p-6">
        {/* Header */}
        <Card className="border-gray-200 shadow-sm">
          <CardContent className="px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">All Bills</h2>
                {bills.length > 0 && <p className="text-sm text-gray-400 mt-0.5">{bills.length} bill{bills.length !== 1 ? "s" : ""}</p>}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search bill, vendor…"
                    className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400 bg-white w-52"
                  />
                </div>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => navigate("/transactions/purchase/bills/create")}>
                  <Plus className="mr-2 h-4 w-4" /> New
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="border-gray-200 shadow-sm">
          <CardContent className="px-6 py-5">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-200">
                  <TableHead className="w-10 pl-2"><Checkbox checked={false} /></TableHead>
                  <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Date</TableHead>
                  <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Bill #</TableHead>
                  <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Order #</TableHead>
                  <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Reference #</TableHead>
                  <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Vendor Name</TableHead>
                  <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Status</TableHead>
                  <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Due Date</TableHead>
                  <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide text-right">Amount</TableHead>
                  <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide text-center w-14">PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBills.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-14 text-center">
                      <div className="flex flex-col items-center gap-3 text-gray-400">
                        <FileText size={36} className="text-gray-300" />
                        <p className="text-sm font-medium">{search.trim() ? "No bills match your search" : "No bills yet"}</p>
                        {!search.trim() && <p className="text-xs text-gray-300">Create one manually or convert a purchase order to a bill.</p>}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBills.map((bill) => {
                    const total = getBillTotals(bill).total;
                    return (
                      <TableRow
                        key={bill.id}
                        className="border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => navigate(`/transactions/purchase/bills/${bill.id}`)}
                      >
                        <TableCell className="pl-2" onClick={(e) => e.stopPropagation()}><Checkbox checked={false} /></TableCell>
                        <TableCell className="text-sm text-gray-600 whitespace-nowrap py-3.5">{bill.billDate}</TableCell>
                        <TableCell className="py-3.5">
                          <span className="text-sm font-semibold text-blue-600 hover:underline">{bill.billNumber}</span>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 py-3.5">{bill.orderNumber || "—"}</TableCell>
                        <TableCell className="text-sm text-gray-600 py-3.5">{bill.referenceNumber || "—"}</TableCell>
                        <TableCell className="py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 bg-blue-600">
                              {(bill.vendorName?.[0] ?? "V").toUpperCase()}
                            </div>
                            <span className="text-sm font-medium text-gray-800">{bill.vendorName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3.5">
                          <Badge className={`text-xs font-semibold ${STATUS_STYLE[bill.status]}`} variant="outline">{bill.status}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 py-3.5">{bill.dueDate}</TableCell>
                        <TableCell className="text-sm font-semibold text-gray-800 py-3.5 text-right whitespace-nowrap">{money(total)}</TableCell>
                        <TableCell className="py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={async () => {
                              try {
                                await generateBillPdf({
                                  billNumber: bill.billNumber,
                                  orderNumber: bill.orderNumber,
                                  referenceNumber: bill.referenceNumber,
                                  vendorName: bill.vendorName,
                                  vendorAddress: bill.vendorAddress,
                                  billDate: bill.billDate,
                                  dueDate: bill.dueDate,
                                  paymentTerms: bill.paymentTerms,
                                  notes: bill.notes,
                                  paymentMade: bill.paymentMade,
                                  adjustment: bill.adjustment,
                                  items: bill.items,
                                });
                              } catch { toast({ title: "PDF failed" }); }
                            }}
                            title="Download PDF"
                            className="inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-red-50 text-red-500 hover:text-red-700 transition-colors"
                          >
                            <Download size={14} />
                          </button>
                        </TableCell>
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
