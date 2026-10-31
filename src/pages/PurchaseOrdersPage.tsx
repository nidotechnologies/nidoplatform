import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePageMeta } from "@/contexts/PageMetaContext";
import { toast } from "@/hooks/use-toast";
import { safeReadJson } from "@/lib/utils";
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
import { getAllPOs, getPODisplayStatus, type StoredPO, type POStatus } from "@/lib/purchaseOrderStore";
import { getVendors } from "@/lib/vendorDataStore";
import { getVendorProducts, type VendorProduct } from "@/lib/vendorStore";
import { loadConfig } from "@/lib/configService";
import { useI18n } from "@/i18n/I18nProvider";
import { formatCurrency } from "@/lib/formatters";
import { getEffectiveVendorTaxPct, getHsnCodes, getProductCategoryTaxMap } from "@/lib/taxEngine";
import { DIGITAL_PRODUCT_HEADERS, getDocumentProductPresentation, isDigitalDocumentProduct } from "@/lib/productDocumentRules";
import { generateManualPOPdf, downloadPOPdf } from "@/lib/generatePO";
import { createApprovalRequest, getApprovalRequest } from "@/lib/approvalEngine";
import { getUsers } from "@/lib/nidoUsersStore";
import {
  ArrowLeft,
  Download,
  Ellipsis,
  FileText,
  Link2,
  Mail,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Truck,
  X,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type PurchaseOrderStatus = "DRAFT" | "ISSUED" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "CANCELLED";
type BilledStatus = "YET TO BE BILLED" | "BILLED";
type ReceiveStatus = "YET TO BE RECEIVED" | "RECEIVED";

export interface PurchaseOrderItem {
  id: string;
  itemName: string;
  description: string;
  account: string;
  hsnSac: string;
  quantity: number;
  rate: number;
  taxPercent: number;
  productType?: string;
  physicalType?: string;
  fulfillmentType?: string;
}

export interface PurchaseOrderEntry {
  id: string;
  poNumber: string;
  sourceOrderNumber?: string;
  referenceNumber: string;
  vendorName: string;
  vendorAddress: string;
  deliveryAddressType: "Organization" | "Customer";
  deliveryAddress: string;
  date: string;
  deliveryDate: string;
  paymentTerms: string;
  shipmentPreference: string;
  includeInterStateGst: boolean;
  status: PurchaseOrderStatus;
  approvalRequestId?: string;
  billedStatus: BilledStatus;
  receiveStatus: ReceiveStatus;
  discountPercent: number;
  shippingCharges: number;
  adjustment: number;
  notes: string;
  termsAndConditions: string;
  attachmentType: string;
  items: PurchaseOrderItem[];
}

interface PurchaseOrderForm {
  vendorName: string;
  vendorAddress: string;
  deliveryAddressType: "Organization" | "Customer";
  deliveryAddress: string;
  referenceNumber: string;
  date: string;
  deliveryDate: string;
  paymentTerms: string;
  shipmentPreference: string;
  includeInterStateGst: boolean;
  discountPercent: number;
  shippingCharges: number;
  adjustment: number;
  notes: string;
  termsAndConditions: string;
  attachmentType: string;
  items: PurchaseOrderItem[];
}

// ── Constants ─────────────────────────────────────────────────────────────────
const STORAGE_KEY = "nido_purchase_orders_v1";
const BILLS_STORAGE_KEY = "nido_purchase_bills_v1";

// ── Helpers ───────────────────────────────────────────────────────────────────
const toNumber = (v: unknown, fallback = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };

const money = (v: number) => formatCurrency(v);

const isoToIndian = (v: string) => {
  if (!v) return "";
  const [y, m, d] = v.split("-");
  return y && m && d ? `${d}/${m}/${y}` : v;
};
const indianToIso = (v: string) => {
  const [dd, mm, yyyy] = v.split("/");
  return dd && mm && yyyy ? `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}` : "";
};
const todayIso = () => new Date().toISOString().slice(0, 10);

const fmtDate = (iso: string) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return iso; }
};

const getTotals = (entry: Pick<PurchaseOrderEntry, "items" | "discountPercent" | "shippingCharges" | "adjustment">) => {
  const subtotal = entry.items.reduce((s, i) => s + i.quantity * i.rate, 0);
  const discountAmount = (subtotal * entry.discountPercent) / 100;
  const taxableBase = subtotal - discountAmount;

  // GST slab breakdown grouped by rate
  const slabMap: Record<number, { taxable: number; cgst: number; sgst: number }> = {};
  entry.items.forEach((i) => {
    const itemTaxable = (i.quantity * i.rate) * (1 - entry.discountPercent / 100);
    const rate = i.taxPercent;
    if (!slabMap[rate]) slabMap[rate] = { taxable: 0, cgst: 0, sgst: 0 };
    slabMap[rate].taxable += itemTaxable;
    slabMap[rate].cgst += itemTaxable * (rate / 2) / 100;
    slabMap[rate].sgst += itemTaxable * (rate / 2) / 100;
  });
  const gstSlabs = Object.entries(slabMap)
    .filter(([, v]) => v.taxable > 0)
    .map(([rate, v]) => ({ rate: Number(rate), ...v }))
    .sort((a, b) => a.rate - b.rate);

  const taxAmount = gstSlabs.reduce((s, sl) => s + sl.cgst + sl.sgst, 0);
  const shipping = entry.shippingCharges ?? 0;
  const total = taxableBase + taxAmount + shipping + entry.adjustment;
  return { subtotal, taxAmount, discountAmount, taxableBase, gstSlabs, cgst: taxAmount / 2, sgst: taxAmount / 2, total };
};

const getOverdueDays = (deliveryDate: string) => {
  const [dd, mm, yyyy] = deliveryDate.split("/").map(Number);
  if (!dd || !mm || !yyyy) return 0;
  const diff = Date.now() - new Date(yyyy, mm - 1, dd).getTime();
  const days = Math.floor(diff / 86400000);
  return days > 0 ? days : 0;
};

const getVendorAddress = (vendorName: string) => {
  const vendor = getVendors().find((v) => v.name === vendorName);
  const parts = [vendor?.addressLine1, vendor?.addressLine2, vendor?.city, vendor?.state].filter(Boolean);
  return parts.length ? parts.join(", ") : "No. 6, 4th Main Road\nGKW Layout, Peenya 2nd Stage\nBangalore Karnataka\nIndia";
};

const newItem = (id: string): PurchaseOrderItem => ({ id, itemName: "", description: "", account: "", hsnSac: "", quantity: 1, rate: 0, taxPercent: 18 });

const readStoredManualOrders = (): PurchaseOrderEntry[] => {
  const parsed = safeReadJson<unknown>(STORAGE_KEY, []);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((e): e is PurchaseOrderEntry =>
      !!e && typeof e === "object" &&
      typeof (e as PurchaseOrderEntry).id === "string" &&
      typeof (e as PurchaseOrderEntry).poNumber === "string" &&
      Array.isArray((e as PurchaseOrderEntry).items),
    )
    .map((e) => ({
      ...e,
      shippingCharges: (e as PurchaseOrderEntry).shippingCharges ?? 0,
    }));
};

const nextPoNumber = (entries: PurchaseOrderEntry[]) => {
  const prefix = loadConfig().prefixes.find((p) => p.key === "purchaseOrder")?.value ?? "PO-";
  const max = entries.reduce((c, e) => {
    const n = Number(e.poNumber.replace(/\D/g, ""));
    return Number.isFinite(n) ? Math.max(c, n) : c;
  }, 0);
  return `${prefix}${String(max + 1).padStart(5, "0")}`;
};

const nextBillNumber = (entries: any[]) => {
  const prefix = loadConfig().prefixes.find((p) => p.key === "bill")?.value ?? "BL-";
  const max = entries.reduce((c, e) => {
    const raw = String(e.billNumber ?? "").replace(/\D/g, "");
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.max(c, n) : c;
  }, 0);
  return `${prefix}${String(max + 1).padStart(5, "0")}`;
};

const emptyForm = (): PurchaseOrderForm => ({
  vendorName: "",
  vendorAddress: "",
  deliveryAddressType: "Organization",
  deliveryAddress: "No. 41/1, 2nd Floor, 10th Cross, 11th Main, Wilson Garden, Bangalore 560027",
  referenceNumber: "",
  date: todayIso(),
  deliveryDate: "",
  paymentTerms: "Due on Receipt",
  shipmentPreference: "Any",
  includeInterStateGst: false,
  discountPercent: 0,
  shippingCharges: 0,
  adjustment: 0,
  notes: "",
  termsAndConditions: "1. Payment terms will be released post approval at this PO.\n2. Packaging and Shipping are managed as actual cost.",
  attachmentType: "Upload File",
  items: [newItem(`tmp-${Date.now()}`)],
});

// ── Status styles ─────────────────────────────────────────────────────────────
const MANUAL_STATUS_STYLE: Record<PurchaseOrderStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-600 border-gray-200",
  ISSUED: "bg-blue-100 text-blue-700 border-blue-200",
  PENDING_APPROVAL: "bg-amber-100 text-amber-700 border-amber-200",
  APPROVED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  REJECTED: "bg-red-100 text-red-700 border-red-200",
  CANCELLED: "bg-red-100 text-red-700 border-red-200",
};

const SYS_STATUS_STYLE: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-600 border-gray-200",
  Pending: "bg-gray-100 text-gray-600 border-gray-200",
  Processing: "bg-purple-100 text-purple-700 border-purple-200",
  Confirmed: "bg-amber-100 text-amber-700 border-amber-200",
  Shipped: "bg-blue-100 text-blue-700 border-blue-200",
  Delivered: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Closed: "bg-gray-100 text-gray-600 border-gray-200",
  Cancelled: "bg-red-100 text-red-700 border-red-200",
};

// ── Style tokens ──────────────────────────────────────────────────────────────
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

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value ?? "—"}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PurchaseOrdersPage() {
  const { user } = useAuth();
  const { currencySymbol } = useI18n();
  const { setMeta } = usePageMeta();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ id?: string }>();

  const createMode = location.pathname.endsWith("/create");
  const editMode = location.pathname.endsWith("/edit") && !!params.id;
  const isFormMode = createMode || editMode;
  const detailId = !isFormMode ? params.id : null;

  const [manualOrders, setManualOrders] = useState<PurchaseOrderEntry[]>(readStoredManualOrders);
  const [systemOrders, setSystemOrders] = useState<StoredPO[]>([]);
  const [form, setForm] = useState<PurchaseOrderForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showPdfView, setShowPdfView] = useState(true);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmConvert, setConfirmConvert] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load system POs
  useEffect(() => {
    const load = () => setSystemOrders(getAllPOs());
    load();
    window.addEventListener("storage", load);
    window.addEventListener("poCreated", load);
    return () => { window.removeEventListener("storage", load); window.removeEventListener("poCreated", load); };
  }, []);

  // Set page meta
  const selectedManual = useMemo(() => manualOrders.find((o) => o.id === detailId) || null, [manualOrders, detailId]);
  const selectedSystem = useMemo(() => systemOrders.find((o) => o.poNumber === detailId) || null, [systemOrders, detailId]);

  useEffect(() => {
    setMeta({ title: selectedManual?.poNumber || selectedSystem?.poNumber || "Purchase Orders" });
    return () => setMeta({});
  }, [selectedManual, selectedSystem]);

  // Populate form on create/edit
  useEffect(() => {
    if (createMode) { setEditingId(null); setForm(emptyForm()); return; }
    if (editMode && params.id) {
      const target = manualOrders.find((o) => o.id === params.id);
      if (!target) return;
      setEditingId(target.id);
      setForm({
        vendorName: target.vendorName,
        vendorAddress: target.vendorAddress,
        deliveryAddressType: target.deliveryAddressType,
        deliveryAddress: target.deliveryAddress,
        referenceNumber: target.referenceNumber,
        date: indianToIso(target.date),
        deliveryDate: indianToIso(target.deliveryDate),
        paymentTerms: target.paymentTerms,
        shipmentPreference: target.shipmentPreference,
        includeInterStateGst: target.includeInterStateGst,
        discountPercent: target.discountPercent,
        adjustment: target.adjustment,
        notes: target.notes,
        termsAndConditions: target.termsAndConditions,
        attachmentType: target.attachmentType,
        items: target.items.map((i) => ({ ...i })),
      });
    }
  }, [createMode, editMode, params.id]);

  // Reset cancel confirm when navigating away
  useEffect(() => { setConfirmCancel(false); setConfirmConvert(false); }, [params.id]);

  useEffect(() => {
    if (!selectedManual?.approvalRequestId) return;
    let active = true;
    getApprovalRequest(selectedManual.approvalRequestId).then((request) => {
      if (!active || !["Approved", "Rejected"].includes(request.status)) return;
      const nextStatus = request.status === "Approved" ? "APPROVED" : "REJECTED";
      if (selectedManual.status === nextStatus) return;
      persist(manualOrders.map((order) => order.id === selectedManual.id ? { ...order, status: nextStatus } : order));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [selectedManual?.id, selectedManual?.approvalRequestId, selectedManual?.status]);

  const persist = (next: PurchaseOrderEntry[]) => {
    setManualOrders(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const setF = <K extends keyof PurchaseOrderForm>(key: K, value: PurchaseOrderForm[K]) =>
    setForm((c) => ({ ...c, [key]: value }));

  const backToList = () => navigate("/transactions/purchase/purchase-orders", { replace: true });

  const handleAddRow = () => setF("items", [...form.items, newItem(`tmp-${Date.now()}`)]);

  const handleItemChange = (id: string, key: keyof PurchaseOrderItem, value: string) =>
    setF("items", form.items.map((item) => {
      if (item.id !== id) return item;
      if (["quantity", "rate", "taxPercent"].includes(key)) return { ...item, [key]: toNumber(value) };
      return { ...item, [key]: value };
    }));

  const handleRemoveRow = (id: string) => {
    const next = form.items.filter((i) => i.id !== id);
    setF("items", next.length ? next : [newItem(`tmp-${Date.now()}`)]);
  };

  const requestApprovalIfNeeded = async (order: PurchaseOrderEntry, trigger: string) => {
    const approverEmails = getUsers()
      .filter((candidate) => candidate.status === "Active" && candidate.email)
      .map((candidate) => candidate.email);
    const requests = await createApprovalRequest({
      module: "Purchase Order",
      trigger,
      reference: order.poNumber,
      amount: getTotals(order).total,
      context: {
        amount: getTotals(order).total,
        vendor: order.vendorName,
        quantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
      },
      requestedBy: user?.id || "system",
      requestedByName: user?.name || "System",
      requestedByRole: user?.role || "System Admin",
      approverEmails,
      portalUrl: "/configuration/workflows",
    });
    return requests[0] || null;
  };

  const saveOrder = async (send: boolean) => {
    if (!form.vendorName || !form.date || !form.deliveryDate) {
      toast({ title: "Vendor Name, Date and Delivery Date are required" });
      return;
    }
    if (!form.items.some((i) => i.itemName.trim())) {
      toast({ title: "Please add at least one line item" });
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const updated = manualOrders.map((o) => {
          if (o.id !== editingId) return o;
          return {
            ...o,
            vendorName: form.vendorName,
            vendorAddress: form.vendorAddress,
            deliveryAddressType: form.deliveryAddressType,
            deliveryAddress: form.deliveryAddress,
            referenceNumber: form.referenceNumber,
            date: isoToIndian(form.date),
            deliveryDate: isoToIndian(form.deliveryDate),
            paymentTerms: form.paymentTerms,
            shipmentPreference: form.shipmentPreference,
            includeInterStateGst: form.includeInterStateGst,
            discountPercent: form.discountPercent,
            shippingCharges: form.shippingCharges,
            adjustment: form.adjustment,
            notes: form.notes,
            termsAndConditions: form.termsAndConditions,
            attachmentType: form.attachmentType,
            items: form.items,
            status: send ? "ISSUED" as const : o.status,
          };
        });
        const updatedOrder = updated.find((order) => order.id === editingId);
        if (send && updatedOrder) {
          const approval = await requestApprovalIfNeeded(updatedOrder, "PO modification");
          if (approval) {
            updatedOrder.status = "PENDING_APPROVAL";
            updatedOrder.approvalRequestId = approval.id;
          }
        }
        persist(updated);
        toast({ title: send ? (updatedOrder?.status === "PENDING_APPROVAL" ? "Purchase order submitted for approval" : "Purchase order updated and issued") : "Purchase order updated" });
        navigate(`/transactions/purchase/purchase-orders/${editingId}`, { replace: true });
      } else {
        const id = `po-${Date.now()}`;
        const created: PurchaseOrderEntry = {
          id,
          poNumber: nextPoNumber(manualOrders),
          referenceNumber: form.referenceNumber,
          vendorName: form.vendorName,
          vendorAddress: form.vendorAddress,
          deliveryAddressType: form.deliveryAddressType,
          deliveryAddress: form.deliveryAddress,
          date: isoToIndian(form.date),
          deliveryDate: isoToIndian(form.deliveryDate),
          paymentTerms: form.paymentTerms,
          shipmentPreference: form.shipmentPreference,
          includeInterStateGst: form.includeInterStateGst,
          status: send ? "ISSUED" : "DRAFT",
          billedStatus: "YET TO BE BILLED",
          receiveStatus: "YET TO BE RECEIVED",
          discountPercent: form.discountPercent,
          shippingCharges: form.shippingCharges,
          adjustment: form.adjustment,
          notes: form.notes,
          termsAndConditions: form.termsAndConditions,
          attachmentType: form.attachmentType,
          items: form.items,
        };
        if (send) {
          const approval = await requestApprovalIfNeeded(created, "PO created");
          if (approval) {
            created.status = "PENDING_APPROVAL";
            created.approvalRequestId = approval.id;
          }
        }
        persist([created, ...manualOrders]);
        toast({ title: send ? (created.status === "PENDING_APPROVAL" ? "Purchase order submitted for approval" : "Purchase order issued") : "Draft saved" });
        navigate(`/transactions/purchase/purchase-orders/${id}`, { replace: true });
      }
    } catch (error: any) {
      toast({ title: "Purchase order was not submitted", description: error?.message || "Approval service unavailable." });
    } finally {
      setSaving(false);
    }
  };

  const convertToBill = () => {
    if (!selectedManual) return;
    if (selectedManual.status === "CANCELLED") {
      toast({ title: "Cannot convert", description: "Cancelled POs cannot be converted to bills." });
      return;
    }
    if (selectedManual.status === "PENDING_APPROVAL") {
      toast({ title: "Approval required", description: "This purchase order must be approved before it can be converted to a bill." });
      return;
    }
    const existingBills = safeReadJson<any[]>(BILLS_STORAGE_KEY, []);
    const already = existingBills.find((b) => b.sourcePurchaseOrderId === selectedManual.id);
    if (already) {
      persist(manualOrders.map((o) => o.id === selectedManual.id ? { ...o, billedStatus: "BILLED" as const } : o));
      toast({ title: "Bill already exists. Opening linked bill." });
      navigate(`/transactions/purchase/bills/${already.id}`);
      return;
    }
    const created = {
      id: `bill-${Date.now()}`,
      billNumber: nextBillNumber(existingBills),
      orderNumber: selectedManual.poNumber,
      sourcePurchaseOrderId: selectedManual.id,
      referenceNumber: selectedManual.referenceNumber,
      vendorName: selectedManual.vendorName,
      vendorAddress: selectedManual.vendorAddress,
      billDate: selectedManual.date,
      dueDate: selectedManual.deliveryDate || selectedManual.date,
      paymentTerms: selectedManual.paymentTerms,
      reverseCharge: false,
      status: "OPEN",
      notes: selectedManual.notes,
      attachmentType: selectedManual.attachmentType,
      paymentMade: 0,
      items: selectedManual.items.map((item) => ({
        id: `bill-item-${item.id}`,
        itemDetails: `${item.itemName}${item.description ? `\n${item.description}` : ""}`,
        account: item.account,
        quantity: item.quantity,
        rate: item.rate,
        discount: selectedManual.discountPercent,
        taxPercent: item.taxPercent / 2,
        customerName: "",
      })),
      tdsType: "TDS",
      adjustment: selectedManual.adjustment,
    };
    localStorage.setItem(BILLS_STORAGE_KEY, JSON.stringify([created, ...existingBills]));
    persist(manualOrders.map((o) => o.id === selectedManual.id ? { ...o, billedStatus: "BILLED" as const } : o));
    toast({ title: "Converted to bill" });
    navigate(`/transactions/purchase/bills/${created.id}`);
  };

  const cancelOrder = () => {
    if (!selectedManual) return;
    persist(manualOrders.map((o) => o.id === selectedManual.id ? { ...o, status: "CANCELLED" as const, receiveStatus: "YET TO BE RECEIVED" } : o));
    toast({ title: "Purchase order cancelled" });
    setConfirmCancel(false);
  };

  const handleDownloadPdf = async () => {
    if (!selectedManual) return;
    setPdfLoading(true);
    try {
      await generateManualPOPdf(selectedManual);
    } catch (err) {
      console.error(err);
      toast({ title: "PDF generation failed", description: String(err) });
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDownloadSystemPdf = async (po: StoredPO) => {
    try {
      await downloadPOPdf(po);
    } catch (err) {
      toast({ title: "PDF generation failed", description: String(err) });
    }
  };

  const vendorNames = useMemo(() => getVendors().filter((v) => !v.archived).map((v) => v.name), []);

  // Products belonging to the currently-selected vendor
  const vendorProducts = useMemo<VendorProduct[]>(() => {
    if (!form.vendorName) return [];
    const vendor = getVendors().find((v) => v.name === form.vendorName);
    if (!vendor) return [];
    return getVendorProducts(vendor.id).filter((p) => p.status === "Active");
  }, [form.vendorName]);

  // Build HSN lookup map by category (same logic as CartPage)
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

  const handlePickVendorProduct = (itemId: string, productId: string) => {
    const product = vendorProducts.find((p) => p.id === productId);
    if (!product) return;
    const category = product.category || "";
    const hsnSac = hsnByCategory.get(category.toLowerCase()) || "";
    const taxPercent = getEffectiveVendorTaxPct(category, form.includeInterStateGst);
    setF("items", form.items.map((item) =>
      item.id === itemId
        ? {
            ...item,
            itemName: product.productName,
            description: category,
            hsnSac,
            rate: parseFloat(product.price) || 0,
            quantity: parseFloat(product.moq) || 1,
            taxPercent: taxPercent || 18,
            productType: product.productType,
            physicalType: product.physicalType,
          }
        : item
    ));
  };

  const formTotals = getTotals({ items: form.items, discountPercent: form.discountPercent, shippingCharges: form.shippingCharges, adjustment: form.adjustment });

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
                {editingId ? `Edit ${manualOrders.find((o) => o.id === editingId)?.poNumber || "Purchase Order"}` : "New Purchase Order"}
              </h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={backToList} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={() => saveOrder(false)} disabled={saving} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
                Save as Draft
              </button>
              <button type="button" onClick={() => saveOrder(true)} disabled={saving} className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
                <Save size={14} />
                {saving ? "Saving…" : "Save & Issue"}
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="w-full px-6 py-7">
          {/* Section 1 — Vendor & Header */}
          <Section title="Vendor & Order Header" icon={Truck}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <FieldLabel required>Vendor Name</FieldLabel>
                <div className="flex gap-2">
                  <select
                    className={sel}
                    value={form.vendorName}
                    onChange={(e) => {
                      const v = e.target.value;
                      setF("vendorName", v);
                      setF("vendorAddress", getVendorAddress(v));
                    }}
                  >
                    <option value="">Select a Vendor</option>
                    {vendorNames.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <button type="button" className="px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors" onClick={() => toast({ title: "Search vendor" })}>
                    <Link2 size={14} className="text-gray-500" />
                  </button>
                </div>
              </div>
              <div>
                <FieldLabel>Purchase Order #</FieldLabel>
                <input type="text" className={inp} value={editingId ? (manualOrders.find((o) => o.id === editingId)?.poNumber ?? "") : "Auto Generated on Save"} disabled />
              </div>
              <div>
                <FieldLabel>Vendor Address</FieldLabel>
                <textarea className={textareaClass} rows={4} value={form.vendorAddress} onChange={(e) => setF("vendorAddress", e.target.value)} placeholder="Vendor address" />
              </div>
              <div>
                <FieldLabel>Delivery Address</FieldLabel>
                <div className="flex items-center gap-6 mb-2">
                  {(["Organization", "Customer"] as const).map((t) => (
                    <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" className="accent-blue-600" checked={form.deliveryAddressType === t} onChange={() => setF("deliveryAddressType", t)} />
                      {t}
                    </label>
                  ))}
                </div>
                <textarea className={textareaClass} rows={4} value={form.deliveryAddress} onChange={(e) => setF("deliveryAddress", e.target.value)} />
              </div>
              <div>
                <FieldLabel>Reference #</FieldLabel>
                <input type="text" className={inp} value={form.referenceNumber} onChange={(e) => setF("referenceNumber", e.target.value)} placeholder="e.g. REF-001" />
              </div>
              <div>
                <FieldLabel required>Date</FieldLabel>
                <input type="date" className={inp} value={form.date} onChange={(e) => setF("date", e.target.value)} />
              </div>
              <div>
                <FieldLabel required>Delivery Date</FieldLabel>
                <input type="date" className={inp} value={form.deliveryDate} onChange={(e) => setF("deliveryDate", e.target.value)} />
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
              <div>
                <FieldLabel>Shipment Preference</FieldLabel>
                <input type="text" className={inp} value={form.shipmentPreference} onChange={(e) => setF("shipmentPreference", e.target.value)} placeholder="e.g. Any, FedEx, etc." />
                <label className="mt-2 flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input type="checkbox" className="accent-blue-600 w-4 h-4" checked={form.includeInterStateGst} onChange={(e) => setF("includeInterStateGst", e.target.checked)} />
                  This tax rate is applicable for intra-state usage
                </label>
              </div>
            </div>
          </Section>

          {/* Section 2 — Line Items */}
          <Section title="Line Items" icon={FileText}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border border-gray-200 rounded-lg">
                    <th className="text-left px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Item & Description</th>
                    <th className="text-left px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide w-36">Account</th>
                    <th className="text-right px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide w-24">Qty</th>
                    <th className="text-right px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide w-28">Rate</th>
                    <th className="text-right px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide w-20">Tax %</th>
                    <th className="text-right px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide w-28">Amount</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((item) => {
                    const amount = item.quantity * item.rate;
                    return (
                      <tr key={item.id} className="border-b border-gray-100">
                        <td className="px-2 py-2">
                          {vendorProducts.length > 0 && (
                            <select
                              className={`${sel} mb-1 text-xs text-blue-700 border-blue-200 bg-blue-50`}
                              value={item.itemName && vendorProducts.some(p => p.productName === item.itemName) ? vendorProducts.find(p => p.productName === item.itemName)?.id ?? "" : ""}
                              onChange={(e) => e.target.value && handlePickVendorProduct(item.id, e.target.value)}
                            >
                              <option value="">— Pick from vendor catalog —</option>
                              {vendorProducts.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.productName}{p.price ? ` · ${currencySymbol}${p.price}` : ""}
                                </option>
                              ))}
                            </select>
                          )}
                          <input className={inp + " mb-1"} value={item.itemName} onChange={(e) => handleItemChange(item.id, "itemName", e.target.value)} placeholder="Item name" />
                          <input className={inp} value={item.description} onChange={(e) => handleItemChange(item.id, "description", e.target.value)} placeholder="Description" />
                        </td>
                        <td className="px-2 py-2"><input className={inp} value={item.account} onChange={(e) => handleItemChange(item.id, "account", e.target.value)} placeholder="Account" /></td>
                        <td className="px-2 py-2"><input className={inp + " text-right"} value={String(item.quantity)} onChange={(e) => handleItemChange(item.id, "quantity", e.target.value)} /></td>
                        <td className="px-2 py-2"><input className={inp + " text-right"} value={String(item.rate)} onChange={(e) => handleItemChange(item.id, "rate", e.target.value)} /></td>
                        <td className="px-2 py-2">
                          <select className={sel} value={String(item.taxPercent)} onChange={(e) => handleItemChange(item.id, "taxPercent", e.target.value)}>
                            {[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-2 text-right font-medium text-gray-800">{amount.toFixed(2)}</td>
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
              <button type="button" onClick={() => toast({ title: "Bulk add items" })} className="text-sm text-gray-500 hover:text-gray-800">+ Add Items in Bulk</button>
            </div>

            {/* Totals + Notes */}
            <div className="mt-5 grid grid-cols-1 md:grid-cols-[1fr_300px] gap-5">
              <div>
                <FieldLabel>Notes to Vendor</FieldLabel>
                <textarea className={textareaClass} rows={4} value={form.notes} onChange={(e) => setF("notes", e.target.value)} placeholder="Add note to vendor" />
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden text-sm">
                <table className="w-full">
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-2.5 text-gray-600">Gross Subtotal</td>
                      <td className="px-4 py-2.5 text-right text-gray-900">{money(formTotals.subtotal)}</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-2.5 font-semibold text-gray-900">
                        Item Level Discounts (−)
                        <span className="ml-2 text-xs font-normal text-gray-400">
                          <input type="number" min={0} max={100} className="w-12 px-1.5 py-0.5 text-right text-xs border border-gray-200 rounded focus:outline-none focus:border-blue-400 bg-white" value={form.discountPercent} onChange={(e) => setF("discountPercent", toNumber(e.target.value))} />%
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-900">− {money(formTotals.discountAmount)}</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-2.5 font-semibold text-gray-900">Total Taxable Value</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{money(formTotals.taxableBase)}</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-2.5 text-gray-600">
                        Total GST{formTotals.gstSlabs.length > 0 ? ` (${formTotals.gstSlabs.map(s => `${s.rate}%`).join(", ")})` : ""}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-900">{money(formTotals.taxAmount)}</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-2.5 text-gray-600">Shipping &amp; Handling Charges</td>
                      <td className="px-4 py-2 text-right">
                        <input type="number" min={0} className="w-28 px-2 py-1 text-right text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-400 bg-white" value={form.shippingCharges} onChange={(e) => setF("shippingCharges", toNumber(e.target.value))} />
                      </td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-2.5 text-gray-600">Round Off Adjustment</td>
                      <td className="px-4 py-2 text-right">
                        <input type="number" className="w-28 px-2 py-1 text-right text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-400 bg-white" placeholder="e.g. -0.50" value={form.adjustment} onChange={(e) => setF("adjustment", toNumber(e.target.value))} />
                      </td>
                    </tr>
                    <tr className="bg-blue-50">
                      <td className="px-4 py-3 font-bold text-gray-900">Total Payable</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">{money(formTotals.total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </Section>

          {/* Section 3 — Terms */}
          <Section title="Terms & Conditions">
            <div>
              <FieldLabel>Terms & Conditions</FieldLabel>
              <textarea className={textareaClass} rows={5} value={form.termsAndConditions} onChange={(e) => setF("termsAndConditions", e.target.value)} />
            </div>
          </Section>

          {/* Bottom action bar */}
          <div className="flex items-center gap-3 mt-2 pt-5 border-t border-gray-200">
            <button type="button" onClick={() => saveOrder(true)} disabled={saving} className="flex items-center gap-1.5 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
              <Save size={14} />{saving ? "Saving…" : "Save & Issue"}
            </button>
            <button type="button" onClick={() => saveOrder(false)} disabled={saving} className="px-5 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
              Save as Draft
            </button>
            <button type="button" onClick={backToList} className="px-5 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors">Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  // ── DETAIL PAGE (manual PO) ────────────────────────────────────────────────
  if (detailId && selectedManual) {
    const totals = getTotals(selectedManual);
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="w-full space-y-5 p-6">
          {/* Convert to Bill confirmation banner */}
          {confirmConvert && (
            <div className="bg-gradient-to-r from-blue-50 to-emerald-50 border border-blue-200 rounded-xl p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shrink-0">
                  <ReceiptText className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">Convert {selectedManual.poNumber} to a Bill?</p>
                  <p className="text-xs text-gray-500 mt-0.5">A new bill will be created from this purchase order and you'll be taken to it immediately.</p>
                  <div className="flex gap-3 mt-4">
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => { setConfirmConvert(false); convertToBill(); }}>Yes, Convert to Bill</Button>
                    <Button variant="outline" size="sm" onClick={() => setConfirmConvert(false)}>Cancel</Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Cancel confirmation banner */}
          {confirmCancel && (
            <div className="bg-gradient-to-r from-rose-50 to-orange-50 border border-rose-200 rounded-xl p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600 text-white shrink-0">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">Cancel {selectedManual.poNumber}?</p>
                  <p className="text-xs text-gray-500 mt-0.5">This will stop further billing actions. The record is preserved in history.</p>
                  <div className="flex gap-3 mt-4">
                    <Button variant="destructive" size="sm" onClick={cancelOrder}>Confirm Cancel</Button>
                    <Button variant="outline" size="sm" onClick={() => setConfirmCancel(false)}>Keep Purchase Order</Button>
                  </div>
                </div>
              </div>
            </div>
          )}

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
                        <Download size={13} className="mr-2" />{pdfLoading ? "Generating…" : "Download PDF"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setConfirmConvert(true)} disabled={selectedManual.status === "CANCELLED"}>
                        <ReceiptText size={13} className="mr-2" /> Convert to Bill
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setConfirmCancel(true)} disabled={selectedManual.status === "CANCELLED"} className="text-red-600 focus:text-red-600">
                        Cancel Purchase Order
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <button onClick={backToList} className="text-gray-400 hover:text-gray-700 transition-colors"><X className="h-4 w-4" /></button>
              </div>
            </CardContent>
          </Card>

          {/* "What's next" prompt */}
          {!["CANCELLED", "PENDING_APPROVAL", "REJECTED"].includes(selectedManual.status) && selectedManual.billedStatus === "YET TO BE BILLED" && (
            <div className="flex items-center justify-between gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3.5">
              <p className="text-sm font-medium text-emerald-800">WHAT'S NEXT? Convert this to a bill to complete your purchase.</p>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8" onClick={convertToBill}>Convert to Bill</Button>
            </div>
          )}

          {/* Status bar + view toggle */}
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-500">Receive Status: <span className="text-gray-800 font-medium">{selectedManual.receiveStatus}</span></span>
                  <span className="text-gray-300">|</span>
                  <span className="text-gray-500">Bill Status: <span className="text-gray-800 font-medium">{selectedManual.billedStatus}</span></span>
                  <Badge className={`text-xs font-semibold ${MANUAL_STATUS_STYLE[selectedManual.status]}`} variant="outline">{selectedManual.status.replace("_", " ")}</Badge>
                  {selectedManual.approvalRequestId && (
                    <Button size="sm" variant="outline" onClick={() => navigate(`/configuration/workflows?request=${selectedManual.approvalRequestId}`)}>
                      View Approval
                    </Button>
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
                <PurchaseOrderPdfView order={selectedManual} />
              ) : (
                <div className="grid gap-4 md:grid-cols-4">
                  {[
                    { label: "Subtotal", value: money(totals.subtotal), color: "text-gray-900" },
                    { label: "Tax", value: money(totals.taxAmount), color: "text-gray-900" },
                    { label: "Adjustment", value: money(selectedManual.adjustment), color: "text-gray-900" },
                    { label: "Total", value: money(totals.total), color: "text-blue-700" },
                  ].map((item) => (
                    <div key={item.label} className="bg-gradient-to-br from-gray-50 to-blue-50/30 border border-gray-200 rounded-xl p-4">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{item.label}</p>
                      <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── LIST PAGE ──────────────────────────────────────────────────────────────
  // Merge manual + system POs into a unified display list
  type UnifiedPO = {
    key: string;
    source: "manual" | "system";
    date: string;
    poNumber: string;
    sourceOrderNumber: string;
    referenceNumber: string;
    vendorName: string;
    statusLabel: string;
    statusClass: string;
    billedStatus: string;
    amount: number;
    deliveryDate: string;
    overdueDays: number;
    onClick: () => void;
    onDownload?: () => void;
  };

  const unifiedList: UnifiedPO[] = [
    ...manualOrders.map((o): UnifiedPO => {
      const totals = getTotals(o);
      return {
        key: o.id,
        source: "manual",
        date: o.date,
        poNumber: o.poNumber,
        sourceOrderNumber: o.sourceOrderNumber || "—",
        referenceNumber: o.referenceNumber || "—",
        vendorName: o.vendorName,
        statusLabel: o.status,
        statusClass: MANUAL_STATUS_STYLE[o.status],
        billedStatus: o.billedStatus,
        amount: totals.total,
        deliveryDate: o.deliveryDate || "—",
        overdueDays: getOverdueDays(o.deliveryDate),
        onClick: () => navigate(`/transactions/purchase/purchase-orders/${o.id}`),
        onDownload: async () => { try { await generateManualPOPdf(o); } catch (e) { toast({ title: "PDF failed" }); } },
      };
    }),
    ...systemOrders.map((o): UnifiedPO => ({
      key: o.poNumber,
      source: "system",
      date: fmtDate(o.createdOn),
      poNumber: o.poNumber,
      sourceOrderNumber: o.orderId || "—",
      referenceNumber: o.referenceNumber || o.subOrderId || "—",
      vendorName: o.vendorName,
      statusLabel: getPODisplayStatus(o.status),
      statusClass: SYS_STATUS_STYLE[getPODisplayStatus(o.status)] || SYS_STATUS_STYLE.Pending,
      billedStatus: o.status === "Delivered" || o.status === "Closed" ? "BILLED" : o.status === "Cancelled" ? "VOID" : "YET TO BE BILLED",
      amount: o.grandTotal,
      deliveryDate: o.requestedDelivery ? fmtDate(o.requestedDelivery) : "—",
      overdueDays: 0,
      onClick: () => navigate(`/orders/${o.orderId}`),
      onDownload: o.documents?.some((d) => d.ext === "pdf" && d.dataUrl)
        ? async () => { try { await handleDownloadSystemPdf(o); } catch { toast({ title: "PDF failed" }); } }
        : undefined,
    })),
  ];

  const filteredList = unifiedList.filter((o) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return o.poNumber.toLowerCase().includes(q) || o.vendorName.toLowerCase().includes(q) || o.referenceNumber.toLowerCase().includes(q) || o.sourceOrderNumber.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full space-y-5 p-6">
        {/* Header */}
        <Card className="border-gray-200 shadow-sm">
          <CardContent className="px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">All Purchase Orders</h2>
                {unifiedList.length > 0 && <p className="text-sm text-gray-400 mt-0.5">{unifiedList.length} purchase order{unifiedList.length !== 1 ? "s" : ""}</p>}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search PO, vendor…" className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400 bg-white w-52" />
                </div>
                <Button variant="outline" size="sm" onClick={() => setSystemOrders(getAllPOs())} title="Refresh"><RefreshCw className="h-4 w-4" /></Button>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => navigate("/transactions/purchase/purchase-orders/create")}>
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
                  <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Purchase Order #</TableHead>
                  <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Source Order #</TableHead>
                  <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Reference #</TableHead>
                  <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Vendor Name</TableHead>
                  <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Status</TableHead>
                  <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Billed Status</TableHead>
                  <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide text-right">Amount</TableHead>
                  <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Delivery Date</TableHead>
                  <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide text-center w-14">PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="py-14 text-center">
                      <div className="flex flex-col items-center gap-3 text-gray-400">
                        <FileText size={36} className="text-gray-300" />
                        <p className="text-sm font-medium">{search.trim() ? "No purchase orders match your search" : "No purchase orders yet"}</p>
                        {!search.trim() && (
                          <p className="text-xs text-gray-300">Create one manually or raise a PO from an order.</p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredList.map((o) => (
                    <TableRow key={o.key} className="border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors" onClick={o.onClick}>
                      <TableCell className="pl-2" onClick={(e) => e.stopPropagation()}><Checkbox checked={false} /></TableCell>
                      <TableCell className="text-sm text-gray-600 whitespace-nowrap py-3.5">{o.date}</TableCell>
                      <TableCell className="py-3.5">
                        <span className="text-sm font-semibold text-blue-600 hover:underline cursor-pointer">{o.poNumber}</span>
                        {o.source === "system" && <span className="ml-1.5 text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full">Order</span>}
                      </TableCell>
                      <TableCell className="text-sm text-blue-600 py-3.5 hover:underline cursor-pointer">{o.sourceOrderNumber}</TableCell>
                      <TableCell className="text-sm text-gray-600 py-3.5">{o.referenceNumber}</TableCell>
                      <TableCell className="py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 bg-blue-600">
                            {(o.vendorName?.[0] ?? "V").toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-gray-800">{o.vendorName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3.5">
                        <Badge className={`text-xs font-semibold ${o.statusClass}`} variant="outline">{o.statusLabel.replace("_", " ")}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 py-3.5">{o.billedStatus}</TableCell>
                      <TableCell className="text-sm font-semibold text-gray-800 py-3.5 text-right whitespace-nowrap">{money(o.amount)}</TableCell>
                      <TableCell className="py-3.5">
                        <p className="text-sm text-gray-600">{o.deliveryDate}</p>
                        {o.overdueDays > 0 && <p className="text-xs text-red-500">Overdue by {o.overdueDays}d</p>}
                      </TableCell>
                      <TableCell className="py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        {o.onDownload ? (
                          <button onClick={o.onDownload} title="Download PDF" className="inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-red-50 text-red-500 hover:text-red-700 transition-colors">
                            <Download size={14} />
                          </button>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </TableCell>
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

// ── Inline PDF view component ─────────────────────────────────────────────────
function PurchaseOrderPdfView({ order }: { order: PurchaseOrderEntry }) {
  const totals = getTotals(order);
  const org = loadConfig().organization;
  const isDigitalPOItem = (item: PurchaseOrderItem) => isDigitalDocumentProduct({
    productType: item.productType,
    physicalType: item.physicalType,
    fulfillmentType: item.fulfillmentType,
    itemName: item.itemName,
  });
  const physicalItems = order.items.filter((item) => !isDigitalPOItem(item));
  const digitalItems = order.items.filter(isDigitalPOItem);

  return (
    <div className="mx-auto max-w-[900px] border border-gray-200 bg-white rounded-xl p-8 shadow-sm text-gray-900">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-xl bg-blue-600 flex items-center justify-center text-white text-2xl font-bold">N</div>
          <div>
            <p className="text-xs uppercase text-gray-400 tracking-wider">{order.status}</p>
            <p className="text-sm font-semibold text-blue-700">Purchase Order</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-bold text-gray-900">{org.companyName || "Nido Tech Pvt. Ltd."}</p>
          <p className="text-xs text-gray-500 mt-1 whitespace-pre-line">{org.registeredAddress || org.billingAddress || ""}</p>
          {org.gstNumber && <p className="text-xs text-gray-500 mt-1">GSTIN: {org.gstNumber}</p>}
        </div>
      </div>

      <h2 className="text-center text-2xl font-serif tracking-widest text-gray-800 mb-6 border-y border-gray-100 py-3">PURCHASE ORDER</h2>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Vendor</p>
          <p className="text-sm font-semibold text-blue-700">{order.vendorName}</p>
          <p className="text-xs text-gray-600 whitespace-pre-line mt-1">{order.vendorAddress}</p>
        </div>
        <div className="space-y-1">
          {[["Purchase Order #", order.poNumber], ["Date", order.date], ["Delivery Date", order.deliveryDate || "—"], ["Payment Terms", order.paymentTerms]].map(([l, v]) => (
            <div key={l} className="flex text-sm border-b border-gray-50">
              <span className="w-40 bg-gray-50 px-3 py-1.5 text-gray-500 text-xs font-medium">{l}</span>
              <span className="px-3 py-1.5 text-gray-800 text-xs">{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Deliver To</p>
        <p className="text-sm text-gray-600 whitespace-pre-line">{order.deliveryAddress}</p>
      </div>

      {/* Keep physical and digital rows under their own commercial headers. */}
      {[
        { label: "Physical Products", items: physicalItems, digital: false },
        { label: "Digital Products", items: digitalItems, digital: true },
      ].filter((group) => group.items.length > 0).map((group) => (
        <table key={group.label} className="w-full text-sm mb-4">
          <thead>
            <tr className="bg-gray-50 border border-gray-200">
              <th className="text-left px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">#</th>
              <th className="text-left px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Item & Description</th>
              <th className="text-left px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">HSN/SAC</th>
              <th className="text-right px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">{group.digital ? DIGITAL_PRODUCT_HEADERS.quantity : "Qty"}</th>
              {group.digital ? (
                <>
                  <th className="text-right px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">{DIGITAL_PRODUCT_HEADERS.tenure}</th>
                  <th className="text-right px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">{DIGITAL_PRODUCT_HEADERS.provisioning}</th>
                </>
              ) : (
                <th className="text-right px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Rate</th>
              )}
              <th className="text-right px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Amount</th>
            </tr>
          </thead>
          <tbody>
            {group.items.map((item, i) => {
              const presentation = getDocumentProductPresentation(item, { quantity: item.quantity });
              return (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="px-3 py-2.5 text-gray-500">{i + 1}</td>
                  <td className="px-3 py-2.5"><p className="font-medium">{item.itemName || "—"}</p><p className="text-xs text-gray-400">{item.description}</p></td>
                  <td className="px-3 py-2.5 text-gray-500">{item.hsnSac || "—"}</td>
                  <td className="px-3 py-2.5 text-right">{item.quantity.toFixed(2)}</td>
                  {group.digital ? (
                    <>
                      <td className="px-3 py-2.5 text-right">{presentation.tenureBilling}</td>
                      <td className="px-3 py-2.5 text-right">{presentation.provisioningTime}</td>
                    </>
                  ) : (
                    <td className="px-3 py-2.5 text-right">{item.rate.toFixed(2)}</td>
                  )}
                  <td className="px-3 py-2.5 text-right font-medium">{(item.quantity * item.rate).toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ))}

      {/* Totals — invoice PDF format */}
      <div className="flex justify-end mb-6">
        <div className="w-80 border border-gray-200 rounded-lg overflow-hidden text-sm">
          <table className="w-full">
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="px-4 py-2 text-gray-600">Gross Subtotal</td>
                <td className="px-4 py-2 text-right text-gray-900">{money(totals.subtotal)}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="px-4 py-2 font-semibold text-gray-900">Item Level Discounts (−)</td>
                <td className="px-4 py-2 text-right font-semibold text-gray-900">− {money(totals.discountAmount)}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="px-4 py-2 font-semibold text-gray-900">Total Taxable Value</td>
                <td className="px-4 py-2 text-right font-semibold text-gray-900">{money(totals.taxableBase)}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="px-4 py-2 text-gray-600">
                  Total GST{totals.gstSlabs.length > 0 ? ` (${totals.gstSlabs.map(s => `${s.rate}%`).join(", ")})` : ""}
                </td>
                <td className="px-4 py-2 text-right text-gray-900">{money(totals.taxAmount)}</td>
              </tr>
              {(order.shippingCharges ?? 0) > 0 && (
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-600">Shipping &amp; Handling Charges</td>
                  <td className="px-4 py-2 text-right text-gray-900">{money(order.shippingCharges ?? 0)}</td>
                </tr>
              )}
              {order.adjustment !== 0 && (
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-600">Round Off Adjustment</td>
                  <td className="px-4 py-2 text-right text-gray-900">{order.adjustment < 0 ? "−" : ""}{money(Math.abs(order.adjustment))}</td>
                </tr>
              )}
              <tr className="bg-blue-50">
                <td className="px-4 py-3 font-bold text-gray-900">Total Payable</td>
                <td className="px-4 py-3 text-right font-bold text-gray-900">{money(totals.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {order.notes && (
        <div className="mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Notes</p>
          <p className="text-sm text-gray-600 whitespace-pre-line">{order.notes}</p>
        </div>
      )}

      {order.termsAndConditions && (
        <div className="mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Terms & Conditions</p>
          <p className="text-sm text-gray-600 whitespace-pre-line">{order.termsAndConditions}</p>
        </div>
      )}

      <div className="mt-8 text-sm text-gray-500 border-t border-gray-100 pt-4">
        <p>Authorized Signature ___________________________</p>
      </div>
    </div>
  );
}
