import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getInvoices,
  saveInvoice,
  generateInvoiceNumber,
  type StoredInvoice,
} from "@/lib/invoiceStore";
import { getClients, type StoredClient } from "@/lib/clientStore";
import { toast } from "sonner";
import { MoreHorizontal, Pencil, Plus, X } from "lucide-react";

// ── safeReadJson ──────────────────────────────────────────────────────────────
function safeReadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* ignore */
  }
  return fallback;
}

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

// Multi-line item (used in the form)
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
  item: RecurringItem;           // kept for backward-compat / preview
  items: RecurringLineItem[];    // new multi-row store
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
  recentActivities: {
    id: string;
    message: string;
    by: string;
    timestamp: string;
  }[];
}

// ── constants ─────────────────────────────────────────────────────────────────
const STORAGE_KEY = "nido_recurring_invoices_v3";

const todayStr = () => new Date().toISOString().slice(0, 10);

const addByFrequency = (date: string, frequency: Frequency) => {
  const base = new Date(`${date}T00:00:00`);
  if (frequency === "weekly") base.setDate(base.getDate() + 7);
  if (frequency === "monthly") base.setMonth(base.getMonth() + 1);
  if (frequency === "quarterly") base.setMonth(base.getMonth() + 3);
  return base.toISOString().slice(0, 10);
};

const lineAmount = (item: RecurringItem | RecurringLineItem) =>
  Math.max(0, item.quantity * item.rate - item.discount);

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

// Compute totals from an array of line items
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

  // GST slabs grouped by rate
  const slabMap: Record<number, { taxable: number; cgst: number; sgst: number }> = {};
  for (const it of items) {
    const taxable = Math.max(0, it.quantity * it.rate - it.discount);
    const rate = it.taxRate;
    if (!slabMap[rate]) slabMap[rate] = { taxable: 0, cgst: 0, sgst: 0 };
    slabMap[rate].taxable += taxable;
    slabMap[rate].cgst += taxable * (rate / 2) / 100;
    slabMap[rate].sgst += taxable * (rate / 2) / 100;
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

// Legacy single-item helper kept for profile backward compat
const computeTotals = (
  item: RecurringItem,
  shippingCharges: number,
  adjustment: number,
  tds: number,
  roundOff: number,
) => {
  const subtotal = lineAmount(item);
  const tax = (subtotal * item.taxRate) / 100;
  const total = subtotal + tax + shippingCharges + adjustment - tds + roundOff;
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
};

// ── default / seed data ───────────────────────────────────────────────────────
const defaultProfile: RecurringInvoiceProfile = {
  id: "ri-1",
  profileName: "Design",
  customerName: "Nido Technologies",
  customerEmail: "pavannido@gmail.com",
  customerPhone: "9844440412",
  customerPan: "BPAPP1867G",
  customerGstin: "29BPAPP1867G1ZN",
  frequency: "weekly",
  startOn: "2026-04-02",
  endsOn: "",
  neverExpires: true,
  paymentTerms: "Due on Receipt",
  orderNumber: "",
  placeOfSupply: "Karnataka (29)",
  billingAddress:
    "Nido Technologies\n41/1, 2nd Floor, 10th Cross,\n11th Main, Wilsongarden,\nBangalore\nKarnataka 560027\nIndia\nPhone: 9844440412",
  shippingAddress:
    "Nido Technologies\n41/1, 2nd Floor, 10th Cross,\n11th Main, Wilsongarden,\nBangalore\nKarnataka 560027\nIndia\nPhone: 9844440412",
  item: {
    itemName: "3D Design Model",
    description: "3D Model Mould Designs for Handel.",
    hsnSac: "9983",
    quantity: 1,
    rate: 400,
    discount: 0,
    taxRate: 18,
  },
  items: [
    {
      id: "rli-default-1",
      itemName: "3D Design Model",
      description: "3D Model Mould Designs for Handel.",
      hsnSac: "9983",
      quantity: 1,
      rate: 400,
      discount: 0,
      taxRate: 18,
    },
  ],
  shippingCharges: 0,
  adjustment: 0,
  tds: 0,
  roundOff: 0,
  amount: 472,
  status: "active",
  notes: "Thanks for your business.",
  termsAndConditions:
    "1. The particulars shown in the tax invoice are true and correct.\n2. Any changes/re-work in the manufactured gauge should be intimated before 20 days.",
  createAsDraft: true,
  childInvoiceIds: [],
  recentActivities: [
    {
      id: "ra-1",
      message: "Recurring invoice created for Rs.472.00",
      by: "nidotechnologies",
      timestamp: "2026-04-02T20:07:00.000Z",
    },
  ],
  nextInvoiceDate: "2026-04-09",
  lastInvoiceDate: "2026-04-02",
};

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeProfile = (
  raw: Partial<RecurringInvoiceProfile>,
): RecurringInvoiceProfile => {
  const item: RecurringItem = {
    itemName: raw.item?.itemName || "3D Design Model",
    description: raw.item?.description || "",
    hsnSac: raw.item?.hsnSac || "",
    quantity: toNumber(raw.item?.quantity, 1),
    rate: toNumber(raw.item?.rate, 0),
    discount: toNumber(raw.item?.discount, 0),
    taxRate: toNumber(raw.item?.taxRate, 18),
  };

  // Migrate from old single `item` to `items` array
  let items: RecurringLineItem[];
  if (Array.isArray(raw.items) && raw.items.length > 0) {
    items = raw.items.map((it) => ({
      id: it.id || `rli-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      itemName: it.itemName || "",
      description: it.description || "",
      hsnSac: it.hsnSac || "",
      quantity: toNumber(it.quantity, 1),
      rate: toNumber(it.rate, 0),
      discount: toNumber(it.discount, 0),
      taxRate: toNumber(it.taxRate, 18),
    }));
  } else {
    items = [{
      id: `rli-migrated-${Date.now()}`,
      itemName: item.itemName,
      description: item.description,
      hsnSac: item.hsnSac,
      quantity: item.quantity,
      rate: item.rate,
      discount: item.discount,
      taxRate: item.taxRate,
    }];
  }

  const shippingCharges = toNumber(raw.shippingCharges, 0);
  const adjustment = toNumber(raw.adjustment, 0);
  const tds = toNumber(raw.tds, 0);
  const roundOff = toNumber(raw.roundOff, 0);
  const totals = computeTotals(item, shippingCharges, adjustment, tds, roundOff);

  return {
    ...defaultProfile,
    ...raw,
    item,
    items,
    shippingCharges,
    adjustment,
    tds,
    roundOff,
    amount: toNumber(raw.amount, totals.total),
    childInvoiceIds: Array.isArray(raw.childInvoiceIds) ? raw.childInvoiceIds : [],
    recentActivities: Array.isArray(raw.recentActivities) ? raw.recentActivities : [],
  };
};

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
  item: {
    itemName: "",
    description: "",
    hsnSac: "",
    quantity: 1,
    rate: 0,
    discount: 0,
    taxRate: 18,
  },
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

const frequencyLabel: Record<Frequency, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
};

// ── ConfirmationDialog (inline) ───────────────────────────────────────────────
interface ConfirmState {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone: "default" | "destructive";
  onConfirm: () => void;
}

function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel,
  tone,
  onOpenChange,
  onConfirm,
}: ConfirmState & { onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-confirmation-skip className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{description}</p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={tone === "destructive" ? "destructive" : "default"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Next Invoice Preview ──────────────────────────────────────────────────────
function NextInvoicePreview({ profile }: { profile: RecurringInvoiceProfile }) {
  // Use the multi-item array when available; fall back to the legacy single item
  const activeItems: RecurringLineItem[] =
    Array.isArray(profile.items) && profile.items.length > 0
      ? profile.items
      : [{ ...profile.item, id: "legacy" }];

  const totals = computeTotalsFromItems(
    activeItems,
    toNumber(profile.shippingCharges),
    toNumber(profile.adjustment),
    toNumber(profile.tds),
    toNumber(profile.roundOff),
  );

  return (
    <div className="rounded-xl border bg-white p-6 space-y-6 text-sm">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Tax Invoice (Preview)</p>
          <p className="text-2xl font-bold text-primary">Will be generated automatically</p>
          <p className="text-muted-foreground mt-1">Next Invoice Date: <b>{profile.nextInvoiceDate || "—"}</b></p>
        </div>
        <div className="text-right">
          <p className="font-semibold text-base">Nido Technologies</p>
          <p className="text-muted-foreground text-xs">GSTIN: 29BPAPP1867G1ZN</p>
        </div>
      </div>

      {/* Bill to / Ship to */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-muted/20 p-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Bill To</p>
          <p className="font-medium">{profile.customerName}</p>
          <p className="text-muted-foreground whitespace-pre-wrap">{profile.billingAddress}</p>
          {profile.customerGstin && <p className="text-xs mt-1">GSTIN: {profile.customerGstin}</p>}
        </div>
        <div className="rounded-lg border bg-muted/20 p-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Details</p>
          <p>Payment Terms: <b>{profile.paymentTerms}</b></p>
          <p>Place of Supply: <b>{profile.placeOfSupply || "—"}</b></p>
          <p>Frequency: <b>{frequencyLabel[profile.frequency]}</b></p>
        </div>
      </div>

      {/* Item table */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr>
              <th className="text-left px-3 py-2">#</th>
              <th className="text-left px-3 py-2">Item</th>
              <th className="text-left px-3 py-2">HSN/SAC</th>
              <th className="text-right px-3 py-2">Qty</th>
              <th className="text-right px-3 py-2">Rate</th>
              <th className="text-right px-3 py-2">Discount</th>
              <th className="text-right px-3 py-2">GST %</th>
              <th className="text-right px-3 py-2">Tax (₹)</th>
              <th className="text-right px-3 py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {activeItems.map((it, idx) => {
              const taxable = Math.max(0, it.quantity * it.rate - it.discount);
              const tax = (taxable * it.taxRate) / 100;
              return (
                <tr key={it.id} className="border-t">
                  <td className="px-3 py-3 text-muted-foreground text-center">{idx + 1}</td>
                  <td className="px-3 py-3">
                    <p className="font-medium">{it.itemName}</p>
                    {it.description && (
                      <p className="text-xs text-muted-foreground">{it.description}</p>
                    )}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{it.hsnSac || "—"}</td>
                  <td className="px-3 py-3 text-right">{it.quantity}</td>
                  <td className="px-3 py-3 text-right">Rs.{toNumber(it.rate).toFixed(2)}</td>
                  <td className="px-3 py-3 text-right">Rs.{toNumber(it.discount).toFixed(2)}</td>
                  <td className="px-3 py-3 text-right">{it.taxRate}%</td>
                  <td className="px-3 py-3 text-right">Rs.{tax.toFixed(2)}</td>
                  <td className="px-3 py-3 text-right font-semibold">Rs.{(taxable + tax).toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="flex justify-end">
        <div className="w-64 space-y-1 text-sm">
          <div className="flex justify-between"><span>Gross Subtotal</span><span>Rs.{totals.grossSubtotal.toFixed(2)}</span></div>
          {totals.totalDiscount > 0 && (
            <div className="flex justify-between text-muted-foreground"><span>Discounts (-)</span><span>Rs.{totals.totalDiscount.toFixed(2)}</span></div>
          )}
          <div className="flex justify-between"><span>Taxable Value</span><span>Rs.{totals.subtotal.toFixed(2)}</span></div>
          {totals.gstSlabs.map((sl) => (
            <div key={sl.rate} className="flex justify-between text-muted-foreground">
              <span>GST {sl.rate}% (CGST+SGST)</span>
              <span>Rs.{(sl.cgst + sl.sgst).toFixed(2)}</span>
            </div>
          ))}
          {profile.shippingCharges > 0 && (
            <div className="flex justify-between text-muted-foreground"><span>Shipping</span><span>Rs.{toNumber(profile.shippingCharges).toFixed(2)}</span></div>
          )}
          {profile.tds > 0 && (
            <div className="flex justify-between text-muted-foreground"><span>TDS (-)</span><span>Rs.{toNumber(profile.tds).toFixed(2)}</span></div>
          )}
          {profile.adjustment !== 0 && (
            <div className="flex justify-between text-muted-foreground"><span>Adjustment</span><span>Rs.{toNumber(profile.adjustment).toFixed(2)}</span></div>
          )}
          <div className="flex justify-between font-semibold border-t pt-2 text-base"><span>Total (Rs)</span><span>Rs.{totals.total.toFixed(2)}</span></div>
        </div>
      </div>

      {/* Notes */}
      {profile.notes && (
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Customer Notes</p>
          <p className="text-muted-foreground">{profile.notes}</p>
        </div>
      )}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────
export default function RecurringInvoicesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  const [clients, setClients] = useState<StoredClient[]>([]);
  const [allInvoices, setAllInvoices] = useState<StoredInvoice[]>([]);

  useEffect(() => {
    setClients(getClients());
    setAllInvoices(getInvoices());
    const handler = () => setAllInvoices(getInvoices());
    window.addEventListener("nidoInvoicesUpdated", handler);
    return () => window.removeEventListener("nidoInvoicesUpdated", handler);
  }, []);

  const [profiles, setProfiles] = useState<RecurringInvoiceProfile[]>(() => {
    const stored = safeReadJson<RecurringInvoiceProfile[]>(STORAGE_KEY, [defaultProfile]);
    const list = Array.isArray(stored) && stored.length > 0 ? stored : [defaultProfile];
    return list.map((entry) => normalizeProfile(entry));
  });

  const [selectedId, setSelectedId] = useState<string>(
    params.id || profiles[0]?.id || "",
  );

  const [confirmState, setConfirmState] = useState<ConfirmState>({
    open: false,
    title: "",
    description: "",
    confirmLabel: "Confirm",
    tone: "default",
    onConfirm: () => {},
  });

  const persist = (next: RecurringInvoiceProfile[]) => {
    setProfiles(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  useEffect(() => {
    if (params.id) setSelectedId(params.id);
  }, [params.id]);

  // Reload profiles whenever the pathname changes (e.g. returning from create/edit form)
  // and when a custom event is dispatched by the form page after saving.
  useEffect(() => {
    const reload = () => {
      const stored = safeReadJson<RecurringInvoiceProfile[]>(STORAGE_KEY, [defaultProfile]);
      const list = Array.isArray(stored) && stored.length > 0 ? stored : [defaultProfile];
      setProfiles(list.map((entry) => normalizeProfile(entry)));
    };
    reload();
    window.addEventListener("recurringInvoicesUpdated", reload);
    return () => window.removeEventListener("recurringInvoicesUpdated", reload);
  }, [location.pathname]);

  const selected = profiles.find((entry) => entry.id === selectedId) || profiles[0] || null;

  // child invoices: stored invoices whose poReference is `recurring:<profileId>`
  const profileInvoices = useMemo(() => {
    if (!selected) return [] as StoredInvoice[];
    return allInvoices.filter((entry) => entry.poReference === `recurring:${selected.id}`);
  }, [allInvoices, selected]);

  const upsertActivity = (profileId: string, message: string, nextProfiles: RecurringInvoiceProfile[]) => {
    return nextProfiles.map((entry) =>
      entry.id === profileId
        ? {
            ...entry,
            recentActivities: [
              { id: `ra-${Date.now()}`, message, by: "System", timestamp: new Date().toISOString() },
              ...entry.recentActivities,
            ],
          }
        : entry,
    );
  };

  const openCreate = () => navigate("/sales/recurring-invoices/create");

  const openEdit = () => {
    if (!selected) return;
    navigate(`/sales/recurring-invoices/${selected.id}/edit`);
  };

  const handleCreateChildInvoice = () => {
    if (!selected) return;

    const activeItems = (selected.items && selected.items.length > 0) ? selected.items : [{ ...selected.item, id: "tmp" }];
    const ct = computeTotalsFromItems(activeItems, selected.shippingCharges, selected.adjustment, selected.tds, selected.roundOff);
    const grandTotal = Math.round(ct.total * 100) / 100;

    const now = new Date().toISOString();
    const invNumber = generateInvoiceNumber();
    const invId = `rinv-${Date.now()}`;

    const newInvoice: StoredInvoice = {
      id: invId,
      invoiceNumber: invNumber,
      clientName: selected.customerName,
      contactPerson: selected.customerName,
      clientGstin: selected.customerGstin,
      clientContact: selected.customerEmail,
      billingAddress: selected.billingAddress,
      shippingAddress: selected.shippingAddress,
      invoiceDate: todayStr(),
      dueDate: selected.nextInvoiceDate || todayStr(),
      poReference: `recurring:${selected.id}`,
      placeOfSupply: selected.placeOfSupply,
      status: selected.createAsDraft ? "Draft" : "Sent",
      lineItems: activeItems.map((it, idx) => ({
        id: `rli-${Date.now()}-${idx}`,
        description: it.itemName,
        itemDetails: it.description,
        hsnSac: it.hsnSac,
        quantity: it.quantity,
        rate: it.rate,
        discount: it.discount,
        taxPercent: it.taxRate,
        taxType: "CGST+SGST" as const,
      })),
      grossSubtotal: ct.grossSubtotal,
      totalDiscount: ct.totalDiscount,
      subtotal: ct.subtotal,
      totalTax: ct.totalTax,
      shippingCharges: selected.shippingCharges,
      adjustment: selected.adjustment + selected.roundOff,
      grandTotal,
      notes: selected.notes,
      termsConditions: selected.termsAndConditions,
      payments: [],
      activity: [
        { id: `act-${Date.now()}`, date: todayStr(), title: "Invoice created", description: `Generated from recurring profile: ${selected.profileName}` },
      ],
      createdAt: now,
      updatedAt: now,
    };

    saveInvoice(newInvoice);

    const next = profiles.map((entry) =>
      entry.id === selected.id
        ? {
            ...entry,
            lastInvoiceDate: todayStr(),
            nextInvoiceDate: addByFrequency(todayStr(), entry.frequency),
            childInvoiceIds: [invId, ...entry.childInvoiceIds],
            recentActivities: [
              {
                id: `ra-${Date.now()}`,
                message: `Invoice created - ${invNumber}. Saved as ${selected.createAsDraft ? "draft" : "sent"}`,
                by: "System",
                timestamp: now,
              },
              ...entry.recentActivities,
            ],
          }
        : entry,
    );

    persist(next);
    toast.success("Child invoice generated");
    navigate(`/sales/invoices/${invId}`);
  };

  const handleClone = () => {
    if (!selected) return;
    const cloned: RecurringInvoiceProfile = {
      ...selected,
      id: `ri-${Date.now()}`,
      profileName: `${selected.profileName} Copy`,
      childInvoiceIds: [],
      recentActivities: [
        { id: `ra-${Date.now()}`, message: "Cloned from existing recurring profile", by: "System", timestamp: new Date().toISOString() },
      ],
    };
    persist([cloned, ...profiles]);
    setSelectedId(cloned.id);
    toast.success("Recurring profile cloned");
  };

  const handleStop = () => {
    if (!selected) return;
    const next = profiles.map((entry) =>
      entry.id === selected.id
        ? {
            ...entry,
            status: "stopped" as const,
            recentActivities: [
              { id: `ra-${Date.now()}`, message: "Recurring profile stopped", by: "System", timestamp: new Date().toISOString() },
              ...entry.recentActivities,
            ],
          }
        : entry,
    );
    persist(next);
    toast.success("Recurring profile stopped");
  };

  const handleDelete = () => {
    if (!selected) return;
    const next = profiles.filter((entry) => entry.id !== selected.id);
    persist(next);
    setSelectedId(next[0]?.id || "");
    navigate("/sales/recurring-invoices", { replace: true });
    toast.success("Recurring profile deleted");
  };

  return (
    <>
    <div className="p-6 space-y-4">
      {/* Top card */}
      <div className="rounded-xl border bg-white px-6 py-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">All Recurring Invoices</p>
          <p className="text-2xl font-bold leading-tight">{profiles.length} Profiles</p>
        </div>
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="h-4 w-4" /> New
        </Button>
      </div>

      {/* Profiles table */}
      <div className="rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Customer</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Profile Name</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Frequency</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Last Invoice Date</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Next Invoice Date</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Status</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((profile) => {
              const isActive = profile.id === selectedId;
              return (
                <TableRow
                  key={profile.id}
                  className={`cursor-pointer transition-colors ${isActive ? "bg-blue-50 hover:bg-blue-50" : ""}`}
                  onClick={() => setSelectedId(profile.id)}
                >
                  <TableCell className="text-sm">
                    {isActive && (
                      <span className="inline-block w-1 h-4 rounded-full bg-blue-600 mr-2 align-middle" />
                    )}
                    {profile.customerName}
                  </TableCell>
                  <TableCell className={`text-sm font-medium ${isActive ? "text-blue-700" : "text-blue-600"}`}>{profile.profileName}</TableCell>
                  <TableCell className="text-sm">{frequencyLabel[profile.frequency]}</TableCell>
                  <TableCell className="text-sm">{profile.lastInvoiceDate}</TableCell>
                  <TableCell className="text-sm">{profile.nextInvoiceDate}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        profile.status === "active"
                          ? "bg-blue-600 text-white border-transparent hover:bg-blue-700 text-[11px] px-3 py-0.5 rounded-full font-semibold uppercase tracking-wide"
                          : "bg-gray-100 text-gray-500 border-transparent text-[11px] px-3 py-0.5 rounded-full font-semibold uppercase tracking-wide"
                      }
                    >
                      {profile.status.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-right">Rs.{profile.amount.toFixed(2)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Selected profile detail — borderless, flat */}
      {selected && (
        <div className="rounded-xl border bg-white">
          {/* Header row */}
          <div className="px-6 pt-6 pb-0 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-5xl font-light tracking-tight">{selected.profileName}</h3>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={openEdit}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={handleCreateChildInvoice}>
                Create Invoice
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-1">
                    More <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    data-confirmation-skip
                    onSelect={(event) => {
                      event.preventDefault();
                      setConfirmState({
                        open: true,
                        title: "Stop Recurring Profile",
                        description: "Stop this recurring profile from generating future invoices?",
                        confirmLabel: "Stop",
                        tone: "default",
                        onConfirm: handleStop,
                      });
                    }}
                  >
                    Stop
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={handleClone}>Clone</DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      setConfirmState({
                        open: true,
                        title: "Delete Recurring Profile",
                        description: "Delete this recurring profile? This action cannot be undone.",
                        confirmLabel: "Delete",
                        tone: "destructive",
                        onConfirm: handleDelete,
                      });
                    }}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/sales/recurring-invoices", { replace: true })}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-6 pt-4">
            <Tabs defaultValue="overview">
              <TabsList className="bg-transparent border-0 p-0 h-auto gap-0">
                <TabsTrigger
                  value="overview"
                  className="rounded-none border-b-2 border-transparent px-3 pb-3 pt-1 text-sm font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none bg-transparent"
                >
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="next"
                  className="rounded-none border-b-2 border-transparent px-3 pb-3 pt-1 text-sm font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none bg-transparent"
                >
                  Next Invoice
                </TabsTrigger>
                <TabsTrigger
                  value="activities"
                  className="rounded-none border-b-2 border-transparent px-3 pb-3 pt-1 text-sm font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none bg-transparent"
                >
                  Recent Activities
                </TabsTrigger>
              </TabsList>

              {/* Overview tab */}
              <TabsContent value="overview" className="pt-4 pb-6">
                <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
                  {/* Left sidebar */}
                  <div className="space-y-4 rounded-xl border bg-gray-50 p-4 text-sm">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-2">Details</p>
                      <p>Profile Status: <b>{selected.status === "active" ? "Active" : "Stopped"}</b></p>
                      <p>Start Date: <b>{selected.startOn}</b></p>
                      <p>End Date: <b>{selected.neverExpires ? "Never Expires" : selected.endsOn || "-"}</b></p>
                      <p>Payment Terms: <b>{selected.paymentTerms}</b></p>
                      <p>Manually Created Invoices: <b>{profileInvoices.length}</b></p>
                    </div>
                    <div className="rounded-lg border bg-white p-3 text-sm">
                      <p className="font-medium leading-snug">Recurring Invoice preference has been set to</p>
                      <p className="text-muted-foreground mt-0.5">"{selected.createAsDraft ? "Create Invoices as Drafts" : "Create and Send"}"</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-2">Address</p>
                      <p className="text-xs text-muted-foreground mb-0.5">Billing Address</p>
                      <p className="whitespace-pre-wrap text-xs leading-relaxed">{selected.billingAddress}</p>
                      <p className="text-xs text-muted-foreground mt-3 mb-0.5">Shipping Address</p>
                      <p className="whitespace-pre-wrap text-xs leading-relaxed">{selected.shippingAddress}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-2">Customer Notes</p>
                      <p className="whitespace-pre-wrap text-xs">{selected.notes || "-"}</p>
                    </div>
                  </div>

                  {/* Right section */}
                  <div className="space-y-4">
                    {/* 3 stat cards */}
                    <div className="grid gap-0 rounded-xl border bg-white divide-x md:grid-cols-3 overflow-hidden">
                      <div className="p-5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-1">Invoice Amount</p>
                        <p className="text-3xl font-semibold">Rs.{selected.amount.toFixed(2)}</p>
                      </div>
                      <div className="p-5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-1">Next Invoice Date</p>
                        <p className="text-2xl font-semibold text-blue-600">{selected.nextInvoiceDate}</p>
                      </div>
                      <div className="p-5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-1">Recurring Period</p>
                        <p className="text-2xl font-semibold">{frequencyLabel[selected.frequency]}</p>
                      </div>
                    </div>

                    {/* Child invoices */}
                    <div className="rounded-xl border bg-white p-5">
                      <div className="mb-4 flex items-center justify-between">
                        <p className="text-base font-semibold">All Child Invoices</p>
                        <p className="text-sm text-muted-foreground">
                          Unpaid Invoices: Rs.
                          {profileInvoices
                            .filter((entry) => entry.status !== "Paid")
                            .reduce((sum, entry) => sum + entry.grandTotal, 0)
                            .toFixed(2)}
                        </p>
                      </div>
                      <div className="space-y-3">
                        {profileInvoices.length === 0 && (
                          <p className="text-sm text-muted-foreground">No child invoices created yet.</p>
                        )}
                        {profileInvoices.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                          >
                            <div>
                              <p className="font-medium text-sm">{entry.clientName}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {entry.invoiceNumber} | {entry.invoiceDate}
                              </p>
                              <p className="text-xs text-muted-foreground uppercase tracking-wide mt-0.5">{entry.status}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-semibold">Rs.{entry.grandTotal.toFixed(2)}</p>
                              <Button
                                size="sm"
                                className="mt-2"
                                onClick={() =>
                                  navigate("/sales/payment-receipts/create", {
                                    state: {
                                      fromInvoiceId: entry.id,
                                      customerName: entry.clientName,
                                      invoiceNumber: entry.invoiceNumber,
                                      amount: entry.grandTotal,
                                      email: entry.clientContact || "",
                                    },
                                  })
                                }
                              >
                                Record Payment
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Next Invoice tab */}
              <TabsContent value="next" className="pt-4 pb-6">
                <div className="overflow-x-auto rounded-xl border bg-white p-2">
                  <NextInvoicePreview profile={selected} />
                </div>
              </TabsContent>

              {/* Recent Activities tab */}
              <TabsContent value="activities" className="pt-4 pb-6">
                <div className="space-y-3">
                  {selected.recentActivities.length === 0 && (
                    <p className="text-sm text-muted-foreground">No recent activities.</p>
                  )}
                  {selected.recentActivities.map((entry) => (
                    <div
                      key={entry.id}
                      className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-[160px_minmax(0,1fr)]"
                    >
                      <div className="text-sm text-muted-foreground">
                        {new Date(entry.timestamp).toLocaleDateString()}
                        <br />
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{entry.message}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">by {entry.by}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}
    </div>

      {/* Confirmation dialog */}
      <ConfirmationDialog
        {...confirmState}
        onOpenChange={(open) => setConfirmState((prev) => ({ ...prev, open }))}
        onConfirm={() => {
          confirmState.onConfirm();
          setConfirmState((prev) => ({ ...prev, open: false }));
        }}
      />
    </>
  );
}
