import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, ChevronDown, Plus, Save, Search, Tag, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  getInvoices,
  saveInvoice,
  generateInvoiceNumber,
  type StoredInvoice,
} from "@/lib/invoiceStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { getClients, type StoredClient } from "@/lib/clientStore";
import { getClientCatalog, type ClientCatalogEntry } from "@/lib/clientCatalogStore";
import { getSlabDiscountPct, getClientPriceSlabs, type PriceSlab } from "@/lib/priceEngineStore";
import { getEffectiveTaxPctForCategory } from "@/lib/taxEngine";
import { toast } from "sonner";

// ── types ─────────────────────────────────────────────────────────────────────
type Frequency = "weekly" | "monthly" | "quarterly";
type RecurringStatus = "active" | "stopped";

interface RecurringItem {
  itemName: string;
  description: string;
  hsnSac: string;
  quantity: number;
  rate: number;
  discount: number;
  taxRate: number;
}

interface RecurringLineItem {
  id: string;
  itemName: string;
  description: string;
  hsnSac: string;
  quantity: number;
  rate: number;
  discount: number;
  taxRate: number;
}

interface RecurringInvoiceProfile {
  id: string;
  profileName: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerPan: string;
  customerGstin: string;
  frequency: Frequency;
  startOn: string;
  endsOn: string;
  neverExpires: boolean;
  paymentTerms: string;
  orderNumber: string;
  nextInvoiceDate: string;
  lastInvoiceDate: string;
  placeOfSupply: string;
  billingAddress: string;
  shippingAddress: string;
  item: RecurringItem;
  items: RecurringLineItem[];
  shippingCharges: number;
  adjustment: number;
  tds: number;
  roundOff: number;
  amount: number;
  status: RecurringStatus;
  notes: string;
  termsAndConditions: string;
  createAsDraft: boolean;
  childInvoiceIds: string[];
  recentActivities: { id: string; message: string; by: string; timestamp: string }[];
}

// ── constants ─────────────────────────────────────────────────────────────────
const STORAGE_KEY = "nido_recurring_invoices_v3";
const todayStr = () => new Date().toISOString().slice(0, 10);

const addByFrequency = (date: string, frequency: Frequency) => {
  const base = new Date(`${date}T00:00:00`);
  if (frequency === "weekly")   base.setDate(base.getDate() + 7);
  if (frequency === "monthly")  base.setMonth(base.getMonth() + 1);
  if (frequency === "quarterly") base.setMonth(base.getMonth() + 3);
  return base.toISOString().slice(0, 10);
};

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const blankLineItem = (): RecurringLineItem => ({
  id: `rli-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  itemName: "",
  description: "",
  hsnSac: "",
  quantity: 1,
  rate: 0,
  discount: 0,
  taxRate: 18,
});

const computeTotalsFromItems = (
  items: RecurringLineItem[],
  shippingCharges: number,
  adjustment: number,
  tds: number,
  roundOff: number,
) => {
  const grossSubtotal = items.reduce((s, it) => s + it.quantity * it.rate, 0);
  const totalDiscount = items.reduce((s, it) => s + it.discount, 0);
  const subtotal = Math.max(0, grossSubtotal - totalDiscount);

  const slabMap: Record<number, { taxable: number; cgst: number; sgst: number }> = {};
  for (const it of items) {
    const taxable = Math.max(0, it.quantity * it.rate - it.discount);
    const rate = it.taxRate;
    if (!slabMap[rate]) slabMap[rate] = { taxable: 0, cgst: 0, sgst: 0 };
    slabMap[rate].taxable += taxable;
    slabMap[rate].cgst += (taxable * rate) / 2 / 100;
    slabMap[rate].sgst += (taxable * rate) / 2 / 100;
  }
  const gstSlabs = Object.entries(slabMap)
    .filter(([, v]) => v.taxable > 0)
    .map(([rate, v]) => ({ rate: Number(rate), ...v }))
    .sort((a, b) => a.rate - b.rate);

  const totalTax = gstSlabs.reduce((s, sl) => s + sl.cgst + sl.sgst, 0);
  const total = subtotal + totalTax + shippingCharges + adjustment - tds + roundOff;
  return {
    grossSubtotal: Math.round(grossSubtotal * 100) / 100,
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    subtotal: Math.round(subtotal * 100) / 100,
    gstSlabs,
    totalTax: Math.round(totalTax * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
};

function safeReadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch { /* ignore */ }
  return fallback;
}

const emptyForm = (): Omit<RecurringInvoiceProfile, "id" | "recentActivities" | "childInvoiceIds"> => ({
  profileName: "",
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  customerPan: "",
  customerGstin: "",
  frequency: "weekly",
  startOn: todayStr(),
  endsOn: "",
  neverExpires: true,
  paymentTerms: "Due on Receipt",
  orderNumber: "",
  placeOfSupply: "",
  billingAddress: "",
  shippingAddress: "",
  item: { itemName: "", description: "", hsnSac: "", quantity: 1, rate: 0, discount: 0, taxRate: 18 },
  items: [blankLineItem()],
  shippingCharges: 0,
  adjustment: 0,
  tds: 0,
  roundOff: 0,
  amount: 0,
  status: "active",
  notes: "Thanks for your business.",
  termsAndConditions:
    "1. The particulars shown in the tax invoice are true and correct.\n2. Any changes/re-work in the manufactured gauge should be intimated before 20 days.",
  createAsDraft: true,
  nextInvoiceDate: "",
  lastInvoiceDate: "",
});

// ── Main component ─────────────────────────────────────────────────────────────
export default function RecurringInvoiceFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const [clients, setClients] = useState<StoredClient[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [clientCatalog, setClientCatalog] = useState<ClientCatalogEntry[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});

  // Load clients
  useEffect(() => { setClients(getClients()); }, []);

  // Helper: compute slab discount amount for a line item
  const computeSlabDiscountAmt = (clientId: string, category: string, qty: number, rate: number): number => {
    if (!clientId) return 0;
    const pct = getSlabDiscountPct(clientId, category, qty);
    return Math.round(qty * rate * pct) / 100;
  };

  // Helper: get the active slab info for display
  const getActiveSlab = (clientId: string, category: string, qty: number): PriceSlab | null => {
    if (!clientId) return null;
    const slabs = getClientPriceSlabs(clientId).filter(
      (s) => s.status === "Active" && qty >= s.minQty && qty <= s.maxQty
    );
    if (!slabs.length) return null;
    const catMatch = slabs.find((s) => s.applyTo !== "All Products" && s.applyTo.toLowerCase() === category.toLowerCase());
    return catMatch || slabs.find((s) => s.applyTo === "All Products") || null;
  };

  // If editing, load profile
  useEffect(() => {
    if (!id) return;
    const profiles = safeReadJson<RecurringInvoiceProfile[]>(STORAGE_KEY, []);
    const found = profiles.find((p) => p.id === id);
    if (!found) return;
    const { id: _id, recentActivities: _ra, childInvoiceIds: _ci, ...payload } = found;
    // Ensure items array exists (migrate old single-item profiles)
    if (!payload.items || payload.items.length === 0) {
      payload.items = [{
        id: `rli-migrated-${Date.now()}`,
        itemName: payload.item?.itemName || "",
        description: payload.item?.description || "",
        hsnSac: payload.item?.hsnSac || "",
        quantity: toNumber(payload.item?.quantity, 1),
        rate: toNumber(payload.item?.rate, 0),
        discount: toNumber(payload.item?.discount, 0),
        taxRate: toNumber(payload.item?.taxRate, 18),
      }];
    }
    setForm(payload);

    // Hydrate catalog + slab state so edit mode works the same as create mode
    const allClients = getClients();
    const cl = allClients.find((c) => c.name === payload.customerName);
    if (cl) {
      setSelectedClientId(cl.id);
      setClientCatalog(getClientCatalog(cl.id));
    }
  }, [id]);

  // Computed totals
  const totals = useMemo(() =>
    computeTotalsFromItems(
      form.items?.length > 0 ? form.items : [{ ...form.item, id: "tmp" }],
      toNumber(form.shippingCharges),
      toNumber(form.adjustment),
      toNumber(form.tds),
      toNumber(form.roundOff),
    ),
    [form],
  );

  const handleSave = () => {
    const errors: string[] = [];
    const fe: Record<string, boolean> = {};

    if (!form.customerName.trim()) {
      errors.push("Customer Name is required");
      fe.customerName = true;
    }
    if (!form.profileName.trim()) {
      errors.push("Profile Name is required");
      fe.profileName = true;
    }
    if (!form.startOn) {
      errors.push("Start On date is required");
      fe.startOn = true;
    }

    const activeItems = form.items?.length > 0 ? form.items : [{ ...form.item, id: "tmp" }];
    const emptyItemRows = activeItems.filter((it) => !it.itemName?.trim());
    if (emptyItemRows.length === activeItems.length) {
      errors.push("At least one line item with an Item Name is required");
      fe.items = true;
    }
    const zeroRateRows = activeItems.filter((it) => it.itemName?.trim() && it.rate <= 0);
    if (zeroRateRows.length > 0) {
      errors.push(`Rate must be greater than 0 for: ${zeroRateRows.map((r) => r.itemName).join(", ")}`);
      fe.itemRate = true;
    }

    if (errors.length > 0) {
      setFieldErrors(fe);
      setValidationErrors(errors);
      return;
    }

    setFieldErrors({});
    setValidationErrors([]);

    const computed = computeTotalsFromItems(activeItems, form.shippingCharges, form.adjustment, form.tds, form.roundOff);
    const nextInvoiceDate = addByFrequency(form.startOn, form.frequency);
    const firstItem = activeItems[0];
    const syncedItem: RecurringItem = {
      itemName: firstItem.itemName,
      description: firstItem.description,
      hsnSac: firstItem.hsnSac,
      quantity: firstItem.quantity,
      rate: firstItem.rate,
      discount: firstItem.discount,
      taxRate: firstItem.taxRate,
    };

    const profiles = safeReadJson<RecurringInvoiceProfile[]>(STORAGE_KEY, []);

    if (isEdit && id) {
      const updated = profiles.map((p) =>
        p.id === id
          ? {
              ...p,
              ...form,
              item: syncedItem,
              items: activeItems,
              amount: computed.total,
              nextInvoiceDate,
              recentActivities: [
                { id: `ra-${Date.now()}`, message: "Recurring invoice profile updated", by: "System", timestamp: new Date().toISOString() },
                ...(p.recentActivities || []),
              ],
            }
          : p,
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      toast.success("Recurring profile updated");
    } else {
      const created: RecurringInvoiceProfile = {
        id: `ri-${Date.now()}`,
        ...form,
        item: syncedItem,
        items: activeItems,
        amount: computed.total,
        nextInvoiceDate,
        lastInvoiceDate: form.startOn,
        childInvoiceIds: [],
        recentActivities: [
          {
            id: `ra-${Date.now()}`,
            message: `Recurring invoice created for ₹${computed.total.toFixed(2)}`,
            by: "System",
            timestamp: new Date().toISOString(),
          },
        ],
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify([created, ...profiles]));
      toast.success("Recurring invoice profile created");
    }

    navigate("/sales/recurring-invoices");
  };

  const updateLineItem = <K extends keyof RecurringLineItem>(itemId: string, field: K, value: RecurringLineItem[K]) => {
    setForm((cur) => ({
      ...cur,
      items: (cur.items || []).map((li) => li.id === itemId ? { ...li, [field]: value } : li),
    }));
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Validation error dialog ── */}
      <Dialog open={validationErrors.length > 0} onOpenChange={(open) => { if (!open) setValidationErrors([]); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle size={18} className="shrink-0" />
              Please fill in all required fields
            </DialogTitle>
          </DialogHeader>
          <ul className="mt-2 space-y-2">
            {validationErrors.map((err, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500 mt-1.5" />
                {err}
              </li>
            ))}
          </ul>
          <DialogFooter className="mt-4">
            <Button onClick={() => setValidationErrors([])}>OK, let me fix it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/sales/recurring-invoices")}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Transactions → Sales → Recurring Invoices</p>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">
              {isEdit ? "Edit Recurring Invoice" : "New Recurring Invoice"}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/sales/recurring-invoices")}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="gap-2">
            <Save size={15} />
            {isEdit ? "Update Profile" : "Save Profile"}
          </Button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-screen-xl mx-auto px-6 py-8 space-y-8">

        {/* ── Card 1: Customer & Schedule ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest">Customer &amp; Schedule</h2>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {/* Customer Name */}
            <div className="lg:col-span-2">
              <Label className={`text-sm font-medium mb-1 block ${fieldErrors.customerName ? "text-red-600" : "text-gray-700"}`}>
                Customer Name *
              </Label>
              <Select
                value={form.customerName}
                onValueChange={(value) => {
                  setFieldErrors((fe) => ({ ...fe, customerName: false }));
                  const cl = clients.find((c) => c.name === value);
                  const addr = cl
                    ? [cl.billingAddress, cl.billingCity, cl.billingState, cl.billingPincode].filter(Boolean).join(", ")
                    : "";
                  // Load this client's catalog
                  const catalog = cl ? getClientCatalog(cl.id) : [];
                  setClientCatalog(catalog);
                  setSelectedClientId(cl?.id || "");
                  setForm((cur) => ({
                    ...cur,
                    customerName:   value,
                    customerEmail:  cl?.email                  || cur.customerEmail,
                    customerPhone:  cl?.phone || cl?.mobile    || cur.customerPhone,
                    customerGstin:  cl?.gstin                  || cur.customerGstin,
                    customerPan:    cl?.pan_number             || cur.customerPan,
                    placeOfSupply:  cl?.billingState           || cur.placeOfSupply,
                    billingAddress:  addr || cur.billingAddress,
                    shippingAddress: addr || cur.shippingAddress,
                    // Reset line items so stale prices/discounts from a
                    // previously selected client's catalog are never carried over
                    items: [blankLineItem()],
                  }));
                }}
              >
                <SelectTrigger className={`h-10 ${fieldErrors.customerName ? "border-red-500 ring-1 ring-red-500" : ""}`}>
                  <SelectValue placeholder="Select a customer…" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Profile Name */}
            <div className="lg:col-span-2">
              <Label className={`text-sm font-medium mb-1 block ${fieldErrors.profileName ? "text-red-600" : "text-gray-700"}`}>
                Profile Name *
              </Label>
              <Input
                value={form.profileName}
                onChange={(e) => {
                  setFieldErrors((fe) => ({ ...fe, profileName: false }));
                  setForm((cur) => ({ ...cur, profileName: e.target.value }));
                }}
                placeholder="e.g. Monthly Maintenance"
                className={`h-10 ${fieldErrors.profileName ? "border-red-500 ring-1 ring-red-500 focus-visible:ring-red-500" : ""}`}
              />
            </div>

            {/* Auto-filled customer details */}
            {(form.customerEmail || form.customerPhone || form.customerGstin || form.customerPan) && (
              <div className="lg:col-span-4 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 grid gap-x-8 gap-y-1.5 sm:grid-cols-2 md:grid-cols-4 text-xs">
                {form.customerEmail  && <p><span className="text-gray-500">Email: </span><span className="font-semibold text-gray-800">{form.customerEmail}</span></p>}
                {form.customerPhone  && <p><span className="text-gray-500">Phone: </span><span className="font-semibold text-gray-800">{form.customerPhone}</span></p>}
                {form.customerGstin  && <p><span className="text-gray-500">GSTIN: </span><span className="font-semibold text-gray-800">{form.customerGstin}</span></p>}
                {form.customerPan    && <p><span className="text-gray-500">PAN: </span><span className="font-semibold text-gray-800">{form.customerPan}</span></p>}
              </div>
            )}

            {/* Repeat Every */}
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-1 block">Repeat Every *</Label>
              <Select
                value={form.frequency}
                onValueChange={(v: Frequency) => setForm((cur) => ({ ...cur, frequency: v }))}
              >
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Week</SelectItem>
                  <SelectItem value="monthly">Month</SelectItem>
                  <SelectItem value="quarterly">Quarter</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Start On */}
            <div>
              <Label className={`text-sm font-medium mb-1 block ${fieldErrors.startOn ? "text-red-600" : "text-gray-700"}`}>
                Start On *
              </Label>
              <Input
                type="date"
                value={form.startOn}
                onChange={(e) => {
                  setFieldErrors((fe) => ({ ...fe, startOn: false }));
                  setForm((cur) => ({ ...cur, startOn: e.target.value }));
                }}
                className={`h-10 ${fieldErrors.startOn ? "border-red-500 ring-1 ring-red-500 focus-visible:ring-red-500" : ""}`}
              />
            </div>

            {/* Ends On */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700 block">Ends On</Label>
              <Input
                type="date" className="h-10"
                value={form.endsOn}
                disabled={form.neverExpires}
                onChange={(e) => setForm((cur) => ({ ...cur, endsOn: e.target.value }))}
              />
              <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none">
                <Checkbox
                  checked={form.neverExpires}
                  onCheckedChange={(c) => setForm((cur) => ({ ...cur, neverExpires: !!c }))}
                />
                Never Expires
              </label>
            </div>

            {/* Payment Terms */}
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-1 block">Payment Terms</Label>
              <Select
                value={form.paymentTerms}
                onValueChange={(v) => setForm((cur) => ({ ...cur, paymentTerms: v }))}
              >
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
                  <SelectItem value="Net 15">Net 15</SelectItem>
                  <SelectItem value="Net 30">Net 30</SelectItem>
                  <SelectItem value="Net 45">Net 45</SelectItem>
                  <SelectItem value="Net 60">Net 60</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Place of Supply */}
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-1 block">Place of Supply</Label>
              <Input
                className="h-10"
                value={form.placeOfSupply}
                onChange={(e) => setForm((cur) => ({ ...cur, placeOfSupply: e.target.value }))}
                placeholder="e.g. Karnataka (29)"
              />
            </div>

            {/* Order Number */}
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-1 block">Order / PO Reference</Label>
              <Input
                className="h-10"
                value={form.orderNumber}
                onChange={(e) => setForm((cur) => ({ ...cur, orderNumber: e.target.value }))}
                placeholder="e.g. PO-000123"
              />
            </div>

            {/* Billing Address */}
            <div className="lg:col-span-2">
              <Label className="text-sm font-medium text-gray-700 mb-1 block">Billing Address</Label>
              <Textarea
                rows={3}
                value={form.billingAddress}
                onChange={(e) => setForm((cur) => ({ ...cur, billingAddress: e.target.value }))}
                placeholder="Full billing address"
              />
            </div>

            {/* Shipping Address */}
            <div className="lg:col-span-2">
              <Label className="text-sm font-medium text-gray-700 mb-1 block">Shipping Address</Label>
              <Textarea
                rows={3}
                value={form.shippingAddress}
                onChange={(e) => setForm((cur) => ({ ...cur, shippingAddress: e.target.value }))}
                placeholder="Leave blank to use billing address"
              />
            </div>
          </div>
        </div>

        {/* ── Card 2: Item Table ── */}
        <div className={`bg-white rounded-xl border p-6 space-y-4 ${fieldErrors.items || fieldErrors.itemRate ? "border-red-400 ring-1 ring-red-400" : "border-gray-200"}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest">Item Details</h2>
              {(fieldErrors.items || fieldErrors.itemRate) && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                  <AlertCircle size={11} /> Required
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setForm((cur) => ({ ...cur, items: [...(cur.items || []), blankLineItem()] }))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus size={13} /> Add Item
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm min-w-[960px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {["#", "ITEM / DESCRIPTION", "HSN/SAC", "QTY", "RATE (₹)", "DISC (₹)", "TAXABLE (₹)", "GST %", "GST (₹)", "AMOUNT (₹)", ""].map((h) => (
                    <th key={h} className="px-3 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(form.items || []).map((it, idx) => {
                  const disc    = it.discount ?? 0;
                  const taxable = Math.max(0, it.quantity * it.rate - disc);
                  const gst     = taxable * (it.taxRate / 100);
                  const amt     = taxable + gst;

                  // Catalog entry matched to this row (for slab + price badge)
                  const catalogEntry = clientCatalog.find((c) => c.name === it.itemName);
                  const itemCategory = catalogEntry?.category || "";
                  const activeSlab   = getActiveSlab(selectedClientId, itemCategory, it.quantity);

                  return (
                    <tr key={it.id} className="border-b border-gray-100 hover:bg-gray-50/50 align-top">
                      {/* # */}
                      <td className="px-3 py-3 text-xs text-gray-400 text-center">{idx + 1}</td>

                      {/* Item / Description */}
                      <td className="px-3 py-3 min-w-[260px]">
                        {clientCatalog.length > 0 ? (
                          /* Radix Select portals its content → not clipped by overflow-x-auto */
                          <Select
                            value={it.itemName}
                            onValueChange={(val) => {
                              const entry = clientCatalog.find((c) => c.name === val);
                              if (!entry) return;
                              const baseRate = (entry.priceNum ?? parseFloat(String(entry.price).replace(/[^0-9.]/g, ""))) || 0;
                              const slabDiscAmt = computeSlabDiscountAmt(selectedClientId, entry.category || "", it.quantity, baseRate);
                              const actualTaxRate = getEffectiveTaxPctForCategory(entry.category || "");
                              setForm((cur) => ({
                                ...cur,
                                items: cur.items.map((li) =>
                                  li.id !== it.id ? li : {
                                    ...li,
                                    itemName:    entry.name,
                                    description: entry.description || "",
                                    rate:        baseRate,
                                    discount:    slabDiscAmt,
                                    taxRate:     actualTaxRate,
                                  }
                                ),
                              }));
                            }}
                          >
                            <SelectTrigger className="h-9 w-full text-sm mb-1.5 bg-white border-gray-300">
                              <SelectValue placeholder="Select product from catalog…" />
                            </SelectTrigger>
                            <SelectContent className="z-[9999] max-h-64 overflow-y-auto">
                              {clientCatalog.map((c) => (
                                <SelectItem key={c.productCode} value={c.name}>
                                  <div className="flex flex-col py-0.5">
                                    <span className="font-medium text-sm leading-tight">{c.name}</span>
                                    <span className="text-xs text-gray-400 leading-tight">{c.productCode} · ₹{c.priceNum ?? c.price}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <input
                            value={it.itemName}
                            onChange={(e) => updateLineItem(it.id, "itemName", e.target.value)}
                            placeholder="Item name"
                            className="w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm mb-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        )}
                        <input
                          value={it.description}
                          onChange={(e) => updateLineItem(it.id, "description", e.target.value)}
                          placeholder="Description (optional)"
                          className="w-full rounded border border-gray-200 px-2.5 py-1 text-xs text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                        {/* Price + active slab badges */}
                        {catalogEntry && (
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            <span className="inline-flex items-center rounded bg-blue-50 border border-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700 font-medium">
                              Client Price: ₹{catalogEntry.priceNum ?? catalogEntry.price}
                            </span>
                            {activeSlab && activeSlab.discountPct > 0 && (
                              <span className="inline-flex items-center gap-0.5 rounded bg-green-50 border border-green-200 px-1.5 py-0.5 text-[10px] text-green-700 font-medium">
                                <Tag size={9} />
                                {activeSlab.name} · {activeSlab.discountPct}% off (Qty {activeSlab.minQty}–{activeSlab.maxQty})
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* HSN/SAC */}
                      <td className="px-3 py-3">
                        <input
                          value={it.hsnSac}
                          onChange={(e) => updateLineItem(it.id, "hsnSac", e.target.value)}
                          placeholder="HSN/SAC"
                          className="w-24 rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>

                      {/* Qty — re-applies slab discount on change */}
                      <td className="px-3 py-3">
                        <input
                          type="number" min={1} value={it.quantity}
                          onChange={(e) => {
                            const newQty = Math.max(1, toNumber(e.target.value, 1));
                            const entry  = clientCatalog.find((c) => c.name === it.itemName);
                            const cat    = entry?.category || "";
                            const slabDisc = computeSlabDiscountAmt(selectedClientId, cat, newQty, it.rate);
                            setForm((cur) => ({
                              ...cur,
                              items: cur.items.map((li) =>
                                li.id !== it.id ? li : {
                                  ...li,
                                  quantity: newQty,
                                  discount: entry ? slabDisc : li.discount,
                                }
                              ),
                            }));
                          }}
                          className="w-16 rounded border border-gray-300 px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>

                      {/* Rate */}
                      <td className="px-3 py-3">
                        <input
                          type="number" min={0} value={it.rate}
                          onChange={(e) => updateLineItem(it.id, "rate", toNumber(e.target.value))}
                          className="w-24 rounded border border-gray-300 px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>

                      {/* Discount — auto-filled from slab, still manually editable */}
                      <td className="px-3 py-3">
                        <input
                          type="number" min={0} value={it.discount}
                          onChange={(e) => updateLineItem(it.id, "discount", toNumber(e.target.value))}
                          className="w-20 rounded border border-gray-300 px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {activeSlab && activeSlab.discountPct > 0 && (
                          <div className="text-[10px] text-green-600 font-medium text-center mt-0.5 whitespace-nowrap">
                            {activeSlab.discountPct}% slab
                          </div>
                        )}
                      </td>

                      {/* Taxable */}
                      <td className="px-3 py-3 text-sm text-gray-700 text-right font-medium whitespace-nowrap">
                        {taxable.toFixed(2)}
                      </td>

                      {/* GST % */}
                      <td className="px-3 py-3">
                        <input
                          type="number" min={0} max={100} value={it.taxRate}
                          onChange={(e) => updateLineItem(it.id, "taxRate", toNumber(e.target.value))}
                          className="w-14 rounded border border-gray-300 px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>

                      {/* GST ₹ */}
                      <td className="px-3 py-3 text-sm text-gray-600 text-right whitespace-nowrap">
                        {gst.toFixed(2)}
                      </td>

                      {/* Amount */}
                      <td className="px-3 py-3 text-sm font-bold text-gray-900 text-right whitespace-nowrap">
                        {amt.toFixed(2)}
                      </td>

                      {/* Delete */}
                      <td className="px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            setForm((cur) => ({
                              ...cur,
                              items: cur.items.length === 1 ? cur.items : cur.items.filter((li) => li.id !== it.id),
                            }))
                          }
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Card 3: Totals + Notes ── */}
        <div className="grid gap-6 lg:grid-cols-[1fr_420px]">

          {/* Notes & Preferences */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest">Notes &amp; Preferences</h2>
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-1 block">Customer Notes</Label>
              <Textarea
                rows={4}
                value={form.notes}
                onChange={(e) => setForm((cur) => ({ ...cur, notes: e.target.value }))}
                placeholder="Notes visible on the invoice…"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-1 block">Terms &amp; Conditions</Label>
              <Textarea
                rows={4}
                value={form.termsAndConditions}
                onChange={(e) => setForm((cur) => ({ ...cur, termsAndConditions: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2.5 text-sm text-gray-600 cursor-pointer select-none">
              <Checkbox
                checked={form.createAsDraft}
                onCheckedChange={(c) => setForm((cur) => ({ ...cur, createAsDraft: !!c }))}
              />
              Create generated invoices as Drafts (not auto-sent)
            </label>
          </div>

          {/* Totals */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {/* Gross Subtotal */}
                <tr className="border-b border-gray-200">
                  <td className="px-5 py-3 text-gray-600">Gross Subtotal</td>
                  <td className="px-5 py-3 text-right text-gray-900">₹{totals.grossSubtotal.toFixed(2)}</td>
                </tr>

                {/* Item Level Discounts — always shown */}
                <tr className="border-b border-gray-200">
                  <td className="px-5 py-3 font-semibold text-gray-900">Item Level Discounts (-)</td>
                  <td className="px-5 py-3 text-right font-semibold text-gray-900">₹ - {totals.totalDiscount.toFixed(2)}</td>
                </tr>

                {/* Total Taxable Value */}
                <tr className="border-b border-gray-200">
                  <td className="px-5 py-3 font-semibold text-gray-900">Total Taxable Value</td>
                  <td className="px-5 py-3 text-right font-semibold text-gray-900">₹{totals.subtotal.toFixed(2)}</td>
                </tr>

                {/* Total GST — single combined row */}
                <tr className="border-b border-gray-200">
                  <td className="px-5 py-3 text-gray-600">Total GST</td>
                  <td className="px-5 py-3 text-right text-gray-700">₹{totals.totalTax.toFixed(2)}</td>
                </tr>

                {/* Shipping & Handling — display only */}
                <tr className="border-b border-gray-200">
                  <td className="px-5 py-3 text-gray-600">Shipping &amp; Handling Charges</td>
                  <td className="px-5 py-3 text-right text-gray-700">₹{toNumber(form.shippingCharges).toFixed(2)}</td>
                </tr>

                {/* Round Off Adjustment — display only */}
                <tr className="border-b border-gray-200">
                  <td className="px-5 py-3 text-gray-600">Round Off Adjustment</td>
                  <td className="px-5 py-3 text-right text-gray-700">₹{toNumber(form.roundOff).toFixed(2)}</td>
                </tr>

                {/* Total Payable */}
                <tr>
                  <td className="px-5 py-4 font-bold text-gray-900">Total Payable</td>
                  <td className="px-5 py-4 text-right font-bold text-gray-900">₹{totals.total.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Shipping & Round-off inputs (below summary grid) ── */}
        <div className="flex flex-wrap gap-6">
          <div className="space-y-1">
            <Label className="text-sm font-medium text-gray-700">Shipping &amp; Handling Charges (₹)</Label>
            <Input
              type="number" min={0}
              value={form.shippingCharges}
              onChange={(e) => setForm((cur) => ({ ...cur, shippingCharges: toNumber(e.target.value) }))}
              className="h-10 w-52"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-medium text-gray-700">Round Off Adjustment (₹)</Label>
            <Input
              type="number"
              value={form.roundOff}
              onChange={(e) => setForm((cur) => ({ ...cur, roundOff: toNumber(e.target.value) }))}
              className="h-10 w-52"
            />
          </div>
        </div>

        {/* ── Bottom actions ── */}
        <div className="flex justify-end gap-3 pb-4">
          <Button variant="outline" size="lg" onClick={() => navigate("/sales/recurring-invoices")}>
            Cancel
          </Button>
          <Button size="lg" onClick={handleSave} className="gap-2 px-8">
            <Save size={16} />
            {isEdit ? "Update Profile" : "Save Profile"}
          </Button>
        </div>
      </div>
    </div>
  );
}
