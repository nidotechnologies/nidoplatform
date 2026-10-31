import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useReactToPrint } from "react-to-print";
import { usePageMeta } from "@/contexts/PageMetaContext";
import { useData } from "@/contexts/DataContext";
import { toast } from "@/hooks/use-toast";
import { safeReadJson } from "@/lib/storage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
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
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Link2,
  Mail,
  Pencil,
  Plus,
  Printer,
  ReceiptText,
  ShieldAlert,
  X,
} from "lucide-react";

type PurchaseOrderStatus = "DRAFT" | "ISSUED" | "CANCELLED";
type BilledStatus = "YET TO BE BILLED" | "BILLED";
type ReceiveStatus = "YET TO BE RECEIVED" | "RECEIVED";

interface PurchaseOrderItem {
  id: string;
  itemName: string;
  description: string;
  account: string;
  hsnSac: string;
  quantity: number;
  rate: number;
  taxPercent: number;
}

interface PurchaseOrderEntry {
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
  billedStatus: BilledStatus;
  receiveStatus: ReceiveStatus;
  discountPercent: number;
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
  adjustment: number;
  notes: string;
  termsAndConditions: string;
  attachmentType: string;
  items: PurchaseOrderItem[];
}

interface VendorLite {
  id: string;
  name: string;
  address?: string;
}

const STORAGE_KEY = "nido_purchase_orders_v1";
const BILLS_STORAGE_KEY = "nido_purchase_bills_v1";

interface BillFromPoItem {
  id: string;
  itemDetails: string;
  account: string;
  quantity: number;
  rate: number;
  discount: number;
  taxPercent: number;
  customerName: string;
}

interface BillFromPo {
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
  status: "DRAFT" | "OPEN" | "PAID";
  notes: string;
  attachmentType: string;
  paymentMade: number;
  items: BillFromPoItem[];
  tdsType: "TDS" | "TCS";
  adjustment: number;
}

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(value);

const parseIndianDate = (value: string) => {
  const [dd, mm, yyyy] = value.split("/").map((chunk) => Number(chunk));
  if (!dd || !mm || !yyyy) return null;
  const parsed = new Date(yyyy, mm - 1, dd);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isoToIndian = (value: string) => {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

const indianToIso = (value: string) => {
  const [dd, mm, yyyy] = value.split("/");
  if (!dd || !mm || !yyyy) return "";
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const getTotals = (
  entry: Pick<PurchaseOrderEntry, "items" | "discountPercent" | "adjustment">,
) => {
  const subtotal = entry.items.reduce(
    (sum, item) => sum + item.quantity * item.rate,
    0,
  );
  const taxAmount = entry.items.reduce(
    (sum, item) => sum + (item.quantity * item.rate * item.taxPercent) / 100,
    0,
  );
  const discountAmount = (subtotal * entry.discountPercent) / 100;
  const cgst = taxAmount / 2;
  const sgst = taxAmount / 2;
  const total = subtotal - discountAmount + taxAmount + entry.adjustment;
  return {
    subtotal,
    taxAmount,
    discountAmount,
    cgst,
    sgst,
    total,
  };
};

const getOverdueDays = (deliveryDate: string) => {
  const parsed = parseIndianDate(deliveryDate);
  if (!parsed) return 0;
  const diffMs = Date.now() - parsed.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return days > 0 ? days : 0;
};

const getVendorAddress = (vendorName: string, vendors: VendorLite[]) => {
  const vendor = vendors.find((entry) => entry.name === vendorName);
  const address = vendor?.address;
  return typeof address === "string" && address.trim()
    ? address
    : "No. 6, 4th Main Road\nGKW Layout, Peenya 2nd Stage\nBangalore Karnataka\nIndia";
};

const newItem = (id: string): PurchaseOrderItem => ({
  id,
  itemName: "",
  description: "",
  account: "",
  hsnSac: "",
  quantity: 1,
  rate: 0,
  taxPercent: 18,
});

const DEFAULT_ORDERS: PurchaseOrderEntry[] = [];

const readStoredOrders = () => {
  const parsed = safeReadJson<unknown>(STORAGE_KEY, DEFAULT_ORDERS);
  if (!Array.isArray(parsed)) return [];
  const valid = parsed.filter(
    (entry): entry is PurchaseOrderEntry =>
      !!entry &&
      typeof entry === "object" &&
      typeof (entry as PurchaseOrderEntry).id === "string" &&
      typeof (entry as PurchaseOrderEntry).poNumber === "string" &&
      Array.isArray((entry as PurchaseOrderEntry).items),
  );
  return valid;
};

const nextPoNumber = (entries: PurchaseOrderEntry[]) => {
  const max = entries.reduce((current, entry) => {
    const parsed = Number(entry.poNumber.replace(/\D/g, ""));
    return Number.isFinite(parsed) ? Math.max(current, parsed) : current;
  }, 0);
  const next = String(max + 1).padStart(5, "0");
  return `PO-${next}`;
};

const nextBillNumber = (entries: BillFromPo[]) => {
  const max = entries.reduce((current, entry) => {
    const parsed = Number(entry.billNumber.replace(/\D/g, ""));
    return Number.isFinite(parsed) ? Math.max(current, parsed) : current;
  }, 103);
  return String(max + 1);
};

const emptyForm = (): PurchaseOrderForm => ({
  vendorName: "",
  vendorAddress: "",
  deliveryAddressType: "Organization",
  deliveryAddress:
    "No. 41/1, 2nd Floor, 10th Cross, 11th Main, Wilson Garden, Bangalore 560027",
  referenceNumber: "",
  date: todayIso(),
  deliveryDate: "",
  paymentTerms: "Due on Receipt",
  shipmentPreference: "Any",
  includeInterStateGst: false,
  discountPercent: 0,
  adjustment: 0,
  notes: "",
  termsAndConditions:
    "1. Payment terms will be released post approval at this PO.\n2. Packaging and Shipping are managed as actual cost.",
  attachmentType: "Upload File",
  items: [newItem(`tmp-${Date.now()}`)],
});

function PurchaseOrderPdfView({
  order,
  companyName,
  companyAddress,
  companyGst,
}: {
  order: PurchaseOrderEntry;
  companyName: string;
  companyAddress: string;
  companyGst: string;
}) {
  const totals = getTotals(order);

  return (
    <div className="mx-auto max-w-[980px] border bg-white p-6 text-slate-900 shadow-sm">
      <div className="mb-5 flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="grid h-24 w-24 place-items-center rounded-md border bg-slate-100 text-3xl font-bold text-sky-700">
            NT
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">Issued</p>
            <p className="text-sm font-semibold text-blue-700">
              Purchase Order
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-semibold">{companyName}</p>
          <p className="whitespace-pre-wrap text-sm text-slate-600">
            {companyAddress}
          </p>
          <p className="mt-2 text-sm">GSTIN {companyGst}</p>
        </div>
      </div>

      <h2 className="mb-4 text-center text-3xl font-serif tracking-wide">
        PURCHASE ORDER
      </h2>

      <div className="mb-5 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-sm text-slate-500">Vendor Address</p>
          <p className="mt-1 text-sm font-semibold text-blue-700">
            {order.vendorName}
          </p>
          <p className="whitespace-pre-wrap text-sm text-slate-700">
            {order.vendorAddress}
          </p>
        </div>
        <div>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="w-44 bg-slate-100 font-medium">
                  Purchase Order#
                </TableCell>
                <TableCell>{order.poNumber}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="bg-slate-100 font-medium">Date</TableCell>
                <TableCell>{order.date}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="bg-slate-100 font-medium">
                  Delivery Date
                </TableCell>
                <TableCell>{order.deliveryDate || "-"}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="mb-5">
        <p className="text-sm text-slate-500">Deliver To</p>
        <p className="whitespace-pre-wrap text-sm">{order.deliveryAddress}</p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Item & Description</TableHead>
            <TableHead>HSN/SAC</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Rate</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {order.items.map((item, index) => {
            const amount = item.quantity * item.rate;
            return (
              <TableRow key={item.id}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>
                  <p className="font-medium">{item.itemName || "-"}</p>
                  <p className="whitespace-pre-wrap text-xs text-slate-500">
                    {item.description || "-"}
                  </p>
                </TableCell>
                <TableCell>{item.hsnSac || "-"}</TableCell>
                <TableCell className="text-right">
                  {item.quantity.toFixed(2)}
                </TableCell>
                <TableCell className="text-right">
                  {item.rate.toFixed(2)}
                </TableCell>
                <TableCell className="text-right">
                  {amount.toFixed(2)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_320px]">
        <div>
          <p className="whitespace-pre-wrap text-sm text-slate-700">
            {order.notes || "-"}
          </p>
        </div>
        <div>
          <div className="flex items-center justify-between py-1 text-sm">
            <span>Sub Total</span>
            <span>{totals.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between py-1 text-sm">
            <span>SGST (9%)</span>
            <span>{totals.sgst.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between py-1 text-sm">
            <span>CGST (9%)</span>
            <span>{totals.cgst.toFixed(2)}</span>
          </div>
          <Separator className="my-2" />
          <div className="flex items-center justify-between py-1 text-base font-semibold">
            <span>Total</span>
            <span>{money(totals.total)}</span>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-2 font-semibold">Terms & Conditions</p>
        <p className="whitespace-pre-wrap text-sm text-slate-700">
          {order.termsAndConditions || "-"}
        </p>
      </div>

      <div className="mt-8 text-sm">
        <p>Authorized Signature ___________________________</p>
      </div>
    </div>
  );
}

export default function PurchaseOrdersPage() {
  const { setMeta } = usePageMeta();

  useEffect(() => {
    setMeta({
      title: selectedOrder ? selectedOrder.poNumber : "Purchase Orders",
      breadcrumbs: [{ label: "Procure Orders" }],
    });
    return () => setMeta({});
  }, [selectedOrder, setMeta]);
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { vendors, generalSettings } = useData();

  const [orders, setOrders] = useState<PurchaseOrderEntry[]>(readStoredOrders);
  const [showPdfView, setShowPdfView] = useState(true);
  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PurchaseOrderForm>(emptyForm);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);
  const createMode = location.pathname.endsWith("/create");
  const editMode = location.pathname.endsWith("/edit") && !!params.id;
  const detailId = editMode ? null : params.id;

  const selectedOrder = useMemo(() => {
    if (!params.id) return null;
    return orders.find((entry) => entry.id === params.id) || null;
  }, [orders, params.id]);

  const companySettings = useMemo(() => {
    const first = Object.values(generalSettings)[0];
    return {
      companyName: first?.companyName || "Nido Technologies",
      companyAddress:
        first?.address ||
        "No. 41/1, 2nd Floor, 10th Cross,\n11th Main, Wilson Garden,\nBangalore Karnataka 560027",
      companyGst: first?.gstNumber || "29BPAPP1867G1ZN",
    };
  }, [generalSettings]);

  const persist = (next: PurchaseOrderEntry[]) => {
    setOrders(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  useEffect(() => {
    if (!createMode && !editMode) {
      setOpenForm(false);
      setEditingId(null);
      return;
    }

    if (createMode) {
      setEditingId(null);
      setForm(emptyForm());
      setOpenForm(true);
      return;
    }

    if (editMode && selectedOrder) {
      setEditingId(selectedOrder.id);
      setForm({
        vendorName: selectedOrder.vendorName,
        vendorAddress: selectedOrder.vendorAddress,
        deliveryAddressType: selectedOrder.deliveryAddressType,
        deliveryAddress: selectedOrder.deliveryAddress,
        referenceNumber: selectedOrder.referenceNumber,
        date: indianToIso(selectedOrder.date),
        deliveryDate: indianToIso(selectedOrder.deliveryDate),
        paymentTerms: selectedOrder.paymentTerms,
        shipmentPreference: selectedOrder.shipmentPreference,
        includeInterStateGst: selectedOrder.includeInterStateGst,
        discountPercent: selectedOrder.discountPercent,
        adjustment: selectedOrder.adjustment,
        notes: selectedOrder.notes,
        termsAndConditions: selectedOrder.termsAndConditions,
        attachmentType: selectedOrder.attachmentType,
        items: selectedOrder.items.map((item) => ({ ...item })),
      });
      setOpenForm(true);
    }
  }, [createMode, editMode, selectedOrder]);

  const handleCloseDialog = () => {
    setOpenForm(false);
    if (editingId) {
      navigate(`/transactions/purchase/purchase-orders/${editingId}`, {
        replace: true,
      });
    } else {
      navigate("/transactions/purchase/purchase-orders", { replace: true });
    }
    setEditingId(null);
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: selectedOrder?.poNumber || "Purchase-Order",
    pageStyle:
      "@page { size: A4; margin: 8mm; } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }",
  });

  const handleAddRow = () => {
    setForm((current) => ({
      ...current,
      items: [...current.items, newItem(`tmp-${Date.now()}`)],
    }));
  };

  const handleItemChange = (
    id: string,
    key: keyof PurchaseOrderItem,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.id !== id) return item;
        if (["quantity", "rate", "taxPercent"].includes(key)) {
          return { ...item, [key]: toNumber(value) };
        }
        return { ...item, [key]: value };
      }),
    }));
  };

  const handleRemoveRow = (id: string) => {
    setForm((current) => {
      const next = current.items.filter((item) => item.id !== id);
      return {
        ...current,
        items: next.length ? next : [newItem(`tmp-${Date.now()}`)],
      };
    });
  };

  const saveOrder = (send: boolean) => {
    if (!form.vendorName || !form.date || !form.deliveryDate) {
      toast({ title: "Vendor Name, Date and Delivery Date are required" });
      return;
    }

    if (!form.items.some((item) => item.itemName.trim())) {
      toast({ title: "Please add at least one line item" });
      return;
    }

    if (editingId) {
      const updated = orders.map((entry) => {
        if (entry.id !== editingId) return entry;
        return {
          ...entry,
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
          adjustment: form.adjustment,
          notes: form.notes,
          termsAndConditions: form.termsAndConditions,
          attachmentType: form.attachmentType,
          items: form.items,
          status: send ? "ISSUED" : entry.status,
        } satisfies PurchaseOrderEntry;
      });
      persist(updated);
      toast({
        title: send
          ? "Purchase order updated and sent"
          : "Purchase order updated",
      });
      navigate(`/transactions/purchase/purchase-orders/${editingId}`, {
        replace: true,
      });
      setOpenForm(false);
      return;
    }

    const id = `po-${Date.now()}`;
    const created: PurchaseOrderEntry = {
      id,
      poNumber: nextPoNumber(orders),
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
      adjustment: form.adjustment,
      notes: form.notes,
      termsAndConditions: form.termsAndConditions,
      attachmentType: form.attachmentType,
      items: form.items,
    };

    persist([created, ...orders]);
    toast({ title: send ? "Purchase order saved and sent" : "Draft saved" });
    setOpenForm(false);
    navigate(`/transactions/purchase/purchase-orders/${id}`, { replace: true });
  };

  const convertToBill = () => {
    if (!selectedOrder) return;

    if (selectedOrder.status === "CANCELLED") {
      toast({
        title: "Cancelled purchase order",
        description: "Cancelled purchase orders cannot be converted to bills.",
      });
      return;
    }

    const existingBills = safeReadJson<BillFromPo[]>(BILLS_STORAGE_KEY, []);
    const existing = existingBills.find(
      (entry) => entry.sourcePurchaseOrderId === selectedOrder.id,
    );

    if (existing) {
      persist(
        orders.map((entry) =>
          entry.id === selectedOrder.id
            ? { ...entry, billedStatus: "BILLED" as const }
            : entry,
        ),
      );
      toast({ title: "Bill already exists. Opening linked bill." });
      navigate(`/transactions/purchase/bills/${existing.id}`);
      return;
    }

    const created: BillFromPo = {
      id: `bill-${Date.now()}`,
      billNumber: nextBillNumber(existingBills),
      orderNumber: selectedOrder.poNumber,
      sourcePurchaseOrderId: selectedOrder.id,
      referenceNumber: selectedOrder.referenceNumber,
      vendorName: selectedOrder.vendorName,
      vendorAddress: selectedOrder.vendorAddress,
      billDate: selectedOrder.date,
      dueDate: selectedOrder.deliveryDate || selectedOrder.date,
      paymentTerms: selectedOrder.paymentTerms,
      reverseCharge: false,
      status: "OPEN",
      notes: selectedOrder.notes,
      attachmentType: selectedOrder.attachmentType,
      paymentMade: 0,
      items: selectedOrder.items.map((item) => ({
        id: `bill-item-${item.id}`,
        itemDetails: `${item.itemName}${item.description ? `\n${item.description}` : ""}`,
        account: item.account,
        quantity: item.quantity,
        rate: item.rate,
        discount: selectedOrder.discountPercent,
        taxPercent: item.taxPercent / 2,
        customerName: "",
      })),
      tdsType: "TDS",
      adjustment: selectedOrder.adjustment,
    };

    localStorage.setItem(
      BILLS_STORAGE_KEY,
      JSON.stringify([created, ...existingBills]),
    );

    persist(
      orders.map((entry) =>
        entry.id === selectedOrder.id
          ? { ...entry, billedStatus: "BILLED" as const }
          : entry,
      ),
    );
    toast({ title: "Purchase order converted to bill" });
    navigate(`/transactions/purchase/bills/${created.id}`);
  };

  const cancelOrder = () => {
    if (!selectedOrder) return;

    if (selectedOrder.status === "CANCELLED") {
      toast({ title: "Purchase order is already cancelled" });
      return;
    }

    persist(
      orders.map((entry) =>
        entry.id === selectedOrder.id
          ? {
              ...entry,
              status: "CANCELLED" as const,
              receiveStatus: "YET TO BE RECEIVED",
            }
          : entry,
      ),
    );
    toast({ title: "Purchase order cancelled" });
    setShowCancelDialog(false);
  };

  if (detailId && selectedOrder) {
    const totals = getTotals(selectedOrder);

    return (
      <div>
                <div className="space-y-4 p-6">
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      navigate(
                        `/transactions/purchase/purchase-orders/${selectedOrder.id}/edit`,
                      )
                    }
                  >
                    <Pencil className="mr-2 h-4 w-4" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => toast({ title: "Email sent to vendor" })}
                  >
                    <Mail className="mr-2 h-4 w-4" /> Send Email
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline">
                        <Printer className="mr-2 h-4 w-4" /> PDF/Print
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem
                        onSelect={(event) => {
                          event.preventDefault();
                          handlePrint();
                        }}
                      >
                        Print Purchase Order
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => toast({ title: "PDF exported" })}
                      >
                        Download PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    onClick={convertToBill}
                    disabled={selectedOrder.status === "CANCELLED"}
                  >
                    <ReceiptText className="mr-2 h-4 w-4" /> Convert to Bill
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setShowCancelDialog(true)}
                    disabled={selectedOrder.status === "CANCELLED"}
                  >
                    Cancel Purchase Order
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    navigate("/transactions/purchase/purchase-orders", {
                      replace: true,
                    })
                  }
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-emerald-50/60 p-3">
                <p className="text-sm font-medium">
                  WHAT&apos;S NEXT? Convert this to a bill to complete your
                  purchase.
                </p>
                <Button size="sm" onClick={convertToBill}>
                  Convert to Bill
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm">
                  Receive Status :
                  <span className="ml-1 text-slate-600">
                    {selectedOrder.receiveStatus}
                  </span>
                  <span className="mx-2">|</span>
                  Bill Status :
                  <span className="ml-1 text-slate-600">
                    {selectedOrder.billedStatus}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span>Show PDF View</span>
                  <Switch
                    checked={showPdfView}
                    onCheckedChange={setShowPdfView}
                  />
                </div>
              </div>

              {showPdfView ? (
                <>
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      onClick={() =>
                        toast({ title: "Customize options opened" })
                      }
                    >
                      Customize
                    </Button>
                  </div>
                  <div ref={printRef}>
                    <PurchaseOrderPdfView
                      order={selectedOrder}
                      companyName={companySettings.companyName}
                      companyAddress={companySettings.companyAddress}
                      companyGst={companySettings.companyGst}
                    />
                  </div>
                  <p className="text-right text-sm text-muted-foreground">
                    PDF Template : Simple{" "}
                    <span className="text-blue-600">Change</span>
                  </p>
                </>
              ) : (
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="rounded-lg border p-4">
                    <p className="text-xs text-muted-foreground">Subtotal</p>
                    <p className="text-xl font-semibold">
                      {money(totals.subtotal)}
                    </p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-xs text-muted-foreground">Tax</p>
                    <p className="text-xl font-semibold">
                      {money(totals.taxAmount)}
                    </p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-xs text-muted-foreground">Adjustment</p>
                    <p className="text-xl font-semibold">
                      {money(selectedOrder.adjustment)}
                    </p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-xl font-semibold">
                      {money(totals.total)}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Dialog
          open={openForm}
          onOpenChange={(open) =>
            !open ? handleCloseDialog() : setOpenForm(open)
          }
        >
          <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Purchase Order</DialogTitle>
            </DialogHeader>
            <PurchaseOrderFormSection
              form={form}
              setForm={setForm}
              vendors={vendors}
              editingPo={selectedOrder.poNumber}
              onAddRow={handleAddRow}
              onChangeItem={handleItemChange}
              onRemoveItem={handleRemoveRow}
              onSaveDraft={() => saveOrder(false)}
              onSaveAndSend={() => saveOrder(true)}
              onCancel={handleCloseDialog}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <DialogContent className="max-w-xl overflow-hidden border-rose-200 bg-gradient-to-br from-white via-rose-50 to-orange-50 p-0 shadow-2xl">
            <div className="relative overflow-hidden p-6 md:p-7">
              <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-rose-500/10 blur-3xl" />
              <div className="absolute left-0 bottom-0 h-28 w-28 rounded-full bg-orange-400/10 blur-3xl" />

              <DialogHeader className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-lg shadow-rose-600/30">
                    <ShieldAlert className="h-6 w-6" />
                  </div>
                  <div>
                    <DialogTitle className="text-2xl">
                      Cancel purchase order?
                    </DialogTitle>
                    <DialogDescription className="text-sm text-slate-600">
                      {selectedOrder?.poNumber} will be marked as cancelled and
                      preserved in history for audit and traceability.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                {[
                  {
                    label: "PO",
                    value: selectedOrder?.poNumber || "-",
                  },
                  {
                    label: "Vendor",
                    value: selectedOrder?.vendorName || "-",
                  },
                  {
                    label: "Current status",
                    value: selectedOrder?.status || "-",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm backdrop-blur"
                  >
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                      {item.label}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-rose-200 bg-white/80 p-4 text-sm text-slate-700">
                Cancelling this PO will stop further billing actions, keep the
                record in your procurement history, and make the status visibly
                clear across vendor and internal views.
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowCancelDialog(false)}
                >
                  Keep Purchase Order
                </Button>
                <Button variant="destructive" onClick={cancelOrder}>
                  Confirm Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div>
            <div className="space-y-4 p-6">
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-5">
            <h2 className="text-3xl font-semibold">All Purchase Orders</h2>
            <Button
              onClick={() =>
                navigate("/transactions/purchase/purchase-orders/create")
              }
            >
              <Plus className="mr-2 h-4 w-4" /> New
            </Button>
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
                  <TableHead>DATE</TableHead>
                  <TableHead>PURCHASE ORDER#</TableHead>
                  <TableHead>SOURCE ORDER#</TableHead>
                  <TableHead>REFERENCE#</TableHead>
                  <TableHead>VENDOR NAME</TableHead>
                  <TableHead>STATUS</TableHead>
                  <TableHead>BILLED STATUS</TableHead>
                  <TableHead className="text-right">AMOUNT</TableHead>
                  <TableHead>DELIVERY DATE</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((entry) => {
                  const totals = getTotals(entry);
                  const overdue = getOverdueDays(entry.deliveryDate);
                  return (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <Checkbox checked={false} />
                      </TableCell>
                      <TableCell>{entry.date}</TableCell>
                      <TableCell>
                        <button
                          type="button"
                          className="font-medium text-blue-600 hover:underline"
                          onClick={() =>
                            navigate(
                              `/transactions/purchase/purchase-orders/${entry.id}`,
                            )
                          }
                        >
                          {entry.poNumber}
                        </button>
                      </TableCell>
                      <TableCell>{entry.sourceOrderNumber || "-"}</TableCell>
                      <TableCell>{entry.referenceNumber || "-"}</TableCell>
                      <TableCell>{entry.vendorName}</TableCell>
                      <TableCell>
                        <span
                          className={
                            entry.status === "ISSUED"
                              ? "text-blue-600"
                              : entry.status === "CANCELLED"
                                ? "text-rose-600"
                                : "text-slate-500"
                          }
                        >
                          {entry.status}
                        </span>
                      </TableCell>
                      <TableCell>{entry.billedStatus}</TableCell>
                      <TableCell className="text-right">
                        {money(totals.total)}
                      </TableCell>
                      <TableCell>
                        <p>{entry.deliveryDate || "-"}</p>
                        {overdue > 0 && (
                          <p className="text-xs text-rose-500">
                            Overdue by {overdue.toLocaleString("en-IN")}
                          </p>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={openForm}
        onOpenChange={(open) =>
          !open ? handleCloseDialog() : setOpenForm(open)
        }
      >
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Purchase Order</DialogTitle>
          </DialogHeader>
          <PurchaseOrderFormSection
            form={form}
            setForm={setForm}
            vendors={vendors}
            editingPo={editingId ? selectedOrder?.poNumber : undefined}
            onAddRow={handleAddRow}
            onChangeItem={handleItemChange}
            onRemoveItem={handleRemoveRow}
            onSaveDraft={() => saveOrder(false)}
            onSaveAndSend={() => saveOrder(true)}
            onCancel={handleCloseDialog}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PurchaseOrderFormSection({
  form,
  setForm,
  vendors,
  editingPo,
  onAddRow,
  onChangeItem,
  onRemoveItem,
  onSaveDraft,
  onSaveAndSend,
  onCancel,
}: {
  form: PurchaseOrderForm;
  setForm: React.Dispatch<React.SetStateAction<PurchaseOrderForm>>;
  vendors: VendorLite[];
  editingPo?: string;
  onAddRow: () => void;
  onChangeItem: (
    id: string,
    key: keyof PurchaseOrderItem,
    value: string,
  ) => void;
  onRemoveItem: (id: string) => void;
  onSaveDraft: () => void;
  onSaveAndSend: () => void;
  onCancel: () => void;
}) {
  const previewOrder: PurchaseOrderEntry = {
    id: "preview",
    poNumber: editingPo || "(Auto-generated)",
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
    status: "DRAFT",
    billedStatus: "YET TO BE BILLED",
    receiveStatus: "YET TO BE RECEIVED",
    discountPercent: form.discountPercent,
    adjustment: form.adjustment,
    notes: form.notes,
    termsAndConditions: form.termsAndConditions,
    attachmentType: form.attachmentType,
    items: form.items,
  };

  const totals = getTotals(previewOrder);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>Vendor Name*</Label>
          <div className="mt-1 flex gap-2">
            <Select
              value={form.vendorName || "none"}
              onValueChange={(value) => {
                const selected = value === "none" ? "" : value;
                setForm((current) => ({
                  ...current,
                  vendorName: selected,
                  vendorAddress: getVendorAddress(selected, vendors),
                }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a Vendor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select a Vendor</SelectItem>
                {vendors.map((vendor) => {
                  const id = vendor.id;
                  const name = vendor.name;
                  return (
                    <SelectItem key={id} value={name}>
                      {name}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => toast({ title: "Search vendor" })}
            >
              <Link2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div>
          <Label>Purchase Order#</Label>
          <Input value={editingPo || "Auto Generated on Save"} disabled />
        </div>

        <div>
          <Label>Delivery Address</Label>
          <div className="mt-2 flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={form.deliveryAddressType === "Organization"}
                onChange={() =>
                  setForm((current) => ({
                    ...current,
                    deliveryAddressType: "Organization",
                  }))
                }
              />
              Organization
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={form.deliveryAddressType === "Customer"}
                onChange={() =>
                  setForm((current) => ({
                    ...current,
                    deliveryAddressType: "Customer",
                  }))
                }
              />
              Customer
            </label>
          </div>
          <Textarea
            className="mt-2"
            rows={4}
            value={form.deliveryAddress}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                deliveryAddress: event.target.value,
              }))
            }
          />
        </div>

        <div>
          <Label>Vendor Address</Label>
          <Textarea
            className="mt-1"
            rows={4}
            value={form.vendorAddress}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                vendorAddress: event.target.value,
              }))
            }
          />
        </div>

        <div>
          <Label>Reference#</Label>
          <Input
            value={form.referenceNumber}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                referenceNumber: event.target.value,
              }))
            }
          />
        </div>

        <div>
          <Label>Date</Label>
          <Input
            type="date"
            value={form.date}
            onChange={(event) =>
              setForm((current) => ({ ...current, date: event.target.value }))
            }
          />
        </div>

        <div>
          <Label>Delivery Date</Label>
          <Input
            type="date"
            value={form.deliveryDate}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                deliveryDate: event.target.value,
              }))
            }
          />
        </div>

        <div>
          <Label>Payment Terms</Label>
          <Select
            value={form.paymentTerms}
            onValueChange={(value) =>
              setForm((current) => ({ ...current, paymentTerms: value }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
              <SelectItem value="Net 15">Net 15</SelectItem>
              <SelectItem value="Net 30">Net 30</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Shipment Preference</Label>
          <Input
            value={form.shipmentPreference}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                shipmentPreference: event.target.value,
              }))
            }
            placeholder="Choose shipment preference"
          />
          <label className="mt-2 flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.includeInterStateGst}
              onCheckedChange={(checked) =>
                setForm((current) => ({
                  ...current,
                  includeInterStateGst: !!checked,
                }))
              }
            />
            This tax rate is applicable for intra-state usage
          </label>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-medium">Item Table</p>
            <button
              type="button"
              className="text-sm text-blue-600 hover:underline"
              onClick={() => toast({ title: "Bulk actions opened" })}
            >
              Bulk Actions
            </button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ITEM DETAILS</TableHead>
                <TableHead>ACCOUNT</TableHead>
                <TableHead className="text-right">QUANTITY</TableHead>
                <TableHead className="text-right">RATE</TableHead>
                <TableHead className="text-right">TAX %</TableHead>
                <TableHead className="text-right">AMOUNT</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {form.items.map((item) => {
                const amount = item.quantity * item.rate;
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Input
                        className="mb-1"
                        value={item.itemName}
                        onChange={(event) =>
                          onChangeItem(item.id, "itemName", event.target.value)
                        }
                        placeholder="Type or click to select an item"
                      />
                      <Input
                        value={item.description}
                        onChange={(event) =>
                          onChangeItem(
                            item.id,
                            "description",
                            event.target.value,
                          )
                        }
                        placeholder="Description"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={item.account}
                        onChange={(event) =>
                          onChangeItem(item.id, "account", event.target.value)
                        }
                        placeholder="Select an account"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="text-right"
                        value={String(item.quantity)}
                        onChange={(event) =>
                          onChangeItem(item.id, "quantity", event.target.value)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="text-right"
                        value={String(item.rate)}
                        onChange={(event) =>
                          onChangeItem(item.id, "rate", event.target.value)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="text-right"
                        value={String(item.taxPercent)}
                        onChange={(event) =>
                          onChangeItem(
                            item.id,
                            "taxPercent",
                            event.target.value,
                          )
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className="text-rose-500 hover:underline"
                        onClick={() => onRemoveItem(item.id)}
                      >
                        X
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" onClick={onAddRow}>
              + Add New Row
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast({ title: "Add items in bulk opened" })}
            >
              + Add Items in Bulk
            </Button>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_320px]">
            <div>
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                placeholder="Add note to vendor"
              />
            </div>

            <div className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between text-sm">
                <span>Sub Total</span>
                <span>{totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Discount</span>
                <div className="flex items-center gap-2">
                  <Input
                    className="h-8 w-16 text-right"
                    value={String(form.discountPercent)}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        discountPercent: toNumber(event.target.value),
                      }))
                    }
                  />
                  <span>%</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked readOnly />
                  TDS
                </label>
                <Select defaultValue="none">
                  <SelectTrigger className="h-8 w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select a Tax</SelectItem>
                    <SelectItem value="tds10">TDS 10%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Adjustment</span>
                <Input
                  className="h-8 w-24 text-right"
                  value={String(form.adjustment)}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      adjustment: toNumber(event.target.value),
                    }))
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>Total</span>
                <span>{totals.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>Terms & Conditions</Label>
          <Textarea
            rows={5}
            value={form.termsAndConditions}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                termsAndConditions: event.target.value,
              }))
            }
          />
        </div>
        <div>
          <Label>Attach Files to Purchase Order</Label>
          <Select
            value={form.attachmentType}
            onValueChange={(value) =>
              setForm((current) => ({ ...current, attachmentType: value }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Upload File">Upload File</SelectItem>
              <SelectItem value="Attach from Drive">
                Attach from Drive
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="mt-2 text-xs text-muted-foreground">
            You can upload files up to 5 MB in size.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t pt-3">
        <Button variant="outline" onClick={onSaveDraft}>
          Save as Draft
        </Button>
        <Button onClick={onSaveAndSend}>Save and Send</Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
