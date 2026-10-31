import { useMemo, useRef, useState, useEffect } from "react";
import { useReactToPrint } from "react-to-print";
import { usePageMeta } from "@/contexts/PageMetaContext";
import { useData } from "@/contexts/DataContext";
import { safeReadJson } from "@/lib/storage";
import { toast } from "@/hooks/use-toast";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { Ellipsis, Info, Plus, Printer, X } from "lucide-react";

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
  vendorName: string;
  billDate: string;
  status: BillStatus;
  paymentMade: number;
  adjustment: number;
  items: BillItem[];
}

interface VendorCreditEntry {
  id: string;
  date: string;
  creditNoteNumber: string;
  referenceNumber: string;
  vendorName: string;
  status: "DRAFT" | "OPEN";
  amount: number;
  balance: number;
  notes: string;
  associatedBillId?: string;
  associatedBillNumber?: string;
  itemName: string;
  quantity: number;
  rate: number;
  taxPercent: number;
}

interface CreditNumberPreference {
  mode: "auto" | "manual";
  prefix: string;
  nextNumber: number;
}

const BILLS_STORAGE_KEY = "nido_purchase_bills_v1";
const VENDOR_CREDITS_STORAGE_KEY = "nido_purchase_vendor_credits_v1";
const CREDIT_PREF_STORAGE_KEY = "nido_vendor_credit_pref_v1";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(value);

const toNumber = (value: string | number, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const billTotal = (bill: Pick<BillEntry, "items" | "adjustment">) => {
  const subtotal = bill.items.reduce((sum, item) => {
    const base = item.quantity * item.rate;
    const discountAmount = (base * item.discount) / 100;
    return sum + (base - discountAmount);
  }, 0);
  const tax = bill.items.reduce((sum, item) => {
    const base = item.quantity * item.rate;
    const discountAmount = (base * item.discount) / 100;
    const taxable = base - discountAmount;
    return sum + (taxable * item.taxPercent) / 100;
  }, 0);
  return subtotal + tax + bill.adjustment;
};

const buildCreditNumber = (prefix: string, nextNumber: number) =>
  `${prefix}${String(nextNumber).padStart(5, "0")}`;

function VendorCreditDocument({ entry }: { entry: VendorCreditEntry }) {
  return (
    <div className="mx-auto max-w-[820px] space-y-5 border bg-white p-6 text-slate-900">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase text-muted-foreground">
            Vendor Credits
          </p>
          <h3 className="text-3xl font-semibold">{entry.creditNoteNumber}</h3>
        </div>
        <Badge>{entry.status}</Badge>
      </div>

      <div className="grid gap-4 text-sm md:grid-cols-2">
        <div>
          <p className="font-semibold">Vendor</p>
          <p>{entry.vendorName}</p>
        </div>
        <div>
          <p className="font-semibold">Credit Date</p>
          <p>{entry.date}</p>
        </div>
        <div>
          <p className="font-semibold">Associated Bill</p>
          <p>{entry.associatedBillNumber || "-"}</p>
        </div>
        <div>
          <p className="font-semibold">Credits Remaining</p>
          <p>{formatCurrency(entry.balance)}</p>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Rate</TableHead>
            <TableHead className="text-right">Tax</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>{entry.itemName}</TableCell>
            <TableCell className="text-right">
              {entry.quantity.toFixed(2)}
            </TableCell>
            <TableCell className="text-right">
              {entry.rate.toFixed(2)}
            </TableCell>
            <TableCell className="text-right">
              {entry.taxPercent.toFixed(2)}%
            </TableCell>
            <TableCell className="text-right">
              {entry.amount.toFixed(2)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <div className="text-sm">
        <p className="font-semibold">Notes</p>
        <p className="text-muted-foreground">{entry.notes || "-"}</p>
      </div>
    </div>
  );
}

export default function VendorCreditsPage() {
  const { setMeta } = usePageMeta();

  useEffect(() => {
    setMeta({
      title: "Vendor Credits",
      breadcrumbs: [{ label: "Vendors" }, { label: "Credits" }],
    });
    return () => setMeta({});
  }, [setMeta]);
  const { vendors } = useData();
  const printRef = useRef<HTMLDivElement>(null);

  const [credits, setCredits] = useState<VendorCreditEntry[]>(() =>
    safeReadJson<VendorCreditEntry[]>(VENDOR_CREDITS_STORAGE_KEY, []),
  );
  const [preference, setPreference] = useState<CreditNumberPreference>(() =>
    safeReadJson<CreditNumberPreference>(CREDIT_PREF_STORAGE_KEY, {
      mode: "auto",
      prefix: "DN-",
      nextNumber: 1,
    }),
  );

  const [selectedId, setSelectedId] = useState(credits[0]?.id || "");
  const [openCreate, setOpenCreate] = useState(false);
  const [openPreference, setOpenPreference] = useState(false);

  const [form, setForm] = useState({
    vendorName: "",
    creditNoteNumber: buildCreditNumber(
      preference.prefix,
      preference.nextNumber,
    ),
    date: new Date().toISOString().slice(0, 10),
    referenceNumber: "",
    associatedBillId: "",
    itemName: "",
    quantity: "1",
    rate: "0",
    taxPercent: "18",
    notes: "",
  });

  const selected = useMemo(
    () =>
      credits.find((entry) => entry.id === selectedId) || credits[0] || null,
    [credits, selectedId],
  );

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: selected
      ? `VendorCredit-${selected.creditNoteNumber}`
      : "VendorCredit",
  });

  const bills = useMemo(
    () => safeReadJson<BillEntry[]>(BILLS_STORAGE_KEY, []),
    [credits],
  );

  const vendorOptions = useMemo(() => {
    const names = [
      ...vendors.map((entry) => entry.name),
      ...bills.map((entry) => entry.vendorName),
      ...credits.map((entry) => entry.vendorName),
    ]
      .map((name) => name.trim())
      .filter(Boolean);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [bills, credits, vendors]);

  const vendorBills = useMemo(() => {
    if (!form.vendorName) return [] as BillEntry[];
    return bills.filter((entry) => entry.vendorName === form.vendorName);
  }, [bills, form.vendorName]);

  const persistCredits = (next: VendorCreditEntry[]) => {
    setCredits(next);
    localStorage.setItem(VENDOR_CREDITS_STORAGE_KEY, JSON.stringify(next));
  };

  const persistPreference = (next: CreditNumberPreference) => {
    setPreference(next);
    localStorage.setItem(CREDIT_PREF_STORAGE_KEY, JSON.stringify(next));
  };

  const openNewCredit = () => {
    setForm({
      vendorName: "",
      creditNoteNumber:
        preference.mode === "auto"
          ? buildCreditNumber(preference.prefix, preference.nextNumber)
          : "",
      date: new Date().toISOString().slice(0, 10),
      referenceNumber: "",
      associatedBillId: "",
      itemName: "",
      quantity: "1",
      rate: "0",
      taxPercent: "18",
      notes: "",
    });
    setOpenCreate(true);
  };

  const savePreference = () => {
    if (preference.mode === "auto") {
      if (!preference.prefix.trim()) {
        toast({ title: "Prefix is required for auto numbering" });
        return;
      }
      if (preference.nextNumber <= 0) {
        toast({ title: "Next number should be greater than zero" });
        return;
      }
    }
    persistPreference(preference);
    setOpenPreference(false);
    toast({ title: "Vendor credit numbering preference saved" });
  };

  const saveCredit = (status: "DRAFT" | "OPEN") => {
    if (!form.vendorName || !form.creditNoteNumber.trim()) {
      toast({ title: "Vendor and Credit Note number are required" });
      return;
    }

    const quantity = toNumber(form.quantity, 1);
    const rate = toNumber(form.rate, 0);
    const taxPercent = toNumber(form.taxPercent, 18);
    const base = quantity * rate;
    const tax = (base * taxPercent) / 100;
    const amount = base + tax;

    const associatedBill = bills.find(
      (entry) => entry.id === form.associatedBillId,
    );

    const created: VendorCreditEntry = {
      id: `vc-${Date.now()}`,
      date: form.date,
      creditNoteNumber: form.creditNoteNumber,
      referenceNumber: form.referenceNumber,
      vendorName: form.vendorName,
      status,
      amount,
      balance: amount,
      notes: form.notes,
      associatedBillId: associatedBill?.id,
      associatedBillNumber: associatedBill?.billNumber,
      itemName: form.itemName || "General vendor adjustment",
      quantity,
      rate,
      taxPercent,
    };

    persistCredits([created, ...credits]);
    setSelectedId(created.id);
    setOpenCreate(false);

    if (preference.mode === "auto") {
      persistPreference({
        ...preference,
        nextNumber: preference.nextNumber + 1,
      });
    }

    toast({
      title:
        status === "OPEN"
          ? "Vendor credit created as open"
          : "Vendor credit saved as draft",
    });
  };

  const convertToOpen = () => {
    if (!selected) return;
    const next: VendorCreditEntry[] = credits.map((entry) =>
      entry.id === selected.id ? { ...entry, status: "OPEN" } : entry,
    );
    persistCredits(next);
    toast({ title: "Vendor credit converted to open" });
  };

  const applyToBill = () => {
    if (!selected) return;
    if (!selected.associatedBillId) {
      toast({ title: "No associated bill found for this credit" });
      return;
    }

    const nextBills = bills.map((bill) => {
      if (bill.id !== selected.associatedBillId) return bill;
      const total = billTotal(bill);
      const nextPayment = bill.paymentMade + selected.balance;
      return {
        ...bill,
        paymentMade: Math.min(nextPayment, total),
        status: Math.min(nextPayment, total) >= total ? "PAID" : "OPEN",
      };
    });

    localStorage.setItem(BILLS_STORAGE_KEY, JSON.stringify(nextBills));

    const nextCredits: VendorCreditEntry[] = credits.map((entry) =>
      entry.id === selected.id
        ? { ...entry, balance: 0, status: "OPEN" }
        : entry,
    );
    persistCredits(nextCredits);

    toast({ title: "Vendor credit applied to bill" });
  };

  return (
    <div>
      <div className="space-y-4 p-6">
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
            <h2 className="text-3xl font-semibold">All Vendor Credits</h2>
            <div className="flex items-center gap-2">
              <Button onClick={openNewCredit}>
                <Plus className="mr-2 h-4 w-4" /> New
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Ellipsis className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setOpenPreference(true)}>
                    Configure number preferences
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
                  <TableHead>DATE</TableHead>
                  <TableHead>CREDIT NOTE#</TableHead>
                  <TableHead>REFERENCE NUMBER</TableHead>
                  <TableHead>VENDOR NAME</TableHead>
                  <TableHead>STATUS</TableHead>
                  <TableHead className="text-right">AMOUNT</TableHead>
                  <TableHead className="text-right">BALANCE</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {credits.map((entry) => (
                  <TableRow
                    key={entry.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedId(entry.id)}
                  >
                    <TableCell>
                      <Checkbox checked={selectedId === entry.id} />
                    </TableCell>
                    <TableCell>{entry.date}</TableCell>
                    <TableCell className="font-medium text-blue-700">
                      {entry.creditNoteNumber}
                    </TableCell>
                    <TableCell>{entry.referenceNumber || "-"}</TableCell>
                    <TableCell>{entry.vendorName}</TableCell>
                    <TableCell>
                      <span
                        className={
                          entry.status === "OPEN"
                            ? "text-emerald-600"
                            : "text-slate-600"
                        }
                      >
                        {entry.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(entry.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(entry.balance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {selected && (
          <Card>
            <CardContent className="space-y-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-3xl font-semibold">
                  {selected.creditNoteNumber}
                </h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      toast({ title: "Edit flow available in next iteration" })
                    }
                  >
                    Edit
                  </Button>
                  <Button variant="outline" onClick={handlePrint}>
                    <Printer className="mr-2 h-4 w-4" /> PDF/Print
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline">Apply to Bills</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={applyToBill}>
                        Apply full credit
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={convertToOpen}>
                        Convert to Open
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedId("")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                <p className="flex items-center gap-2 font-semibold">
                  <Info className="h-4 w-4" /> Numbering control
                </p>
                <p className="text-muted-foreground">
                  Current mode:{" "}
                  {preference.mode === "auto"
                    ? "Auto-generate"
                    : "Manual entry"}
                  . Prefix: {preference.prefix}. Next Number:{" "}
                  {String(preference.nextNumber).padStart(5, "0")}
                </p>
              </div>

              <div ref={printRef} className="overflow-x-auto rounded-lg border">
                <VendorCreditDocument entry={selected} />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={openPreference} onOpenChange={setOpenPreference}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Configure Vendor Credit Number Preferences
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {preference.mode === "manual"
                ? "You have selected manual Vendor Credits numbering. Do you want us to auto-generate it for you?"
                : "Your Vendor Credits numbers are set on auto-generate mode to save your time. Are you sure about changing this setting?"}
            </p>

            <RadioGroup
              value={preference.mode}
              onValueChange={(value: "auto" | "manual") =>
                setPreference((current) => ({ ...current, mode: value }))
              }
            >
              <label className="flex items-center gap-2 rounded-md border p-3">
                <RadioGroupItem value="auto" />
                <span>Continue auto-generating Vendor Credits numbers</span>
              </label>
              {preference.mode === "auto" && (
                <div className="grid gap-4 pl-7 md:grid-cols-2">
                  <div>
                    <Label>Prefix</Label>
                    <Input
                      value={preference.prefix}
                      onChange={(event) =>
                        setPreference((current) => ({
                          ...current,
                          prefix: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Next Number</Label>
                    <Input
                      value={String(preference.nextNumber).padStart(5, "0")}
                      onChange={(event) =>
                        setPreference((current) => ({
                          ...current,
                          nextNumber: toNumber(event.target.value, 1),
                        }))
                      }
                    />
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2 rounded-md border p-3">
                <RadioGroupItem value="manual" />
                <span>Enter Vendor Credits numbers manually</span>
              </label>
            </RadioGroup>

            <div className="flex items-center gap-2 pt-2">
              <Button onClick={savePreference}>Save</Button>
              <Button
                variant="outline"
                onClick={() => setOpenPreference(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Vendor Credits</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Vendor Name*</Label>
                <Input
                  value={form.vendorName}
                  list="vendor-credit-vendor-options"
                  placeholder="Select or type vendor"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      vendorName: event.target.value,
                      associatedBillId: "",
                    }))
                  }
                />
                <datalist id="vendor-credit-vendor-options">
                  {vendorOptions.map((vendorName) => (
                    <option key={vendorName} value={vendorName} />
                  ))}
                </datalist>
              </div>
              <div>
                <Label>Credit Note#*</Label>
                <Input
                  value={form.creditNoteNumber}
                  disabled={preference.mode === "auto"}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      creditNoteNumber: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label>Order/Reference Number</Label>
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
                <Label>Vendor Credit Date</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      date: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="md:col-span-2">
                <Label>Associated Bill</Label>
                <Select
                  value={form.associatedBillId}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      associatedBillId: value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select bill for adjustment" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendorBills.map((bill) => (
                      <SelectItem key={bill.id} value={bill.id}>
                        {bill.billNumber} ({bill.billDate})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-lg border">
              <div className="border-b p-3 font-semibold">Item Table</div>
              <div className="grid gap-4 p-3 md:grid-cols-4">
                <div className="md:col-span-2">
                  <Label>Item Details</Label>
                  <Input
                    value={form.itemName}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        itemName: event.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    value={form.quantity}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        quantity: event.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Rate</Label>
                  <Input
                    type="number"
                    value={form.rate}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        rate: event.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Tax %</Label>
                  <Input
                    type="number"
                    value={form.taxPercent}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        taxPercent: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>

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
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button variant="outline" onClick={() => saveCredit("DRAFT")}>
                Save as Draft
              </Button>
              <Button onClick={() => saveCredit("OPEN")}>Save as Open</Button>
              <Button variant="ghost" onClick={() => setOpenCreate(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
