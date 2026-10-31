import { useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useReactToPrint } from "react-to-print";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";
import { Ellipsis, Mail, Pencil, Plus, Printer, X } from "lucide-react";
import { usePageMeta } from "@/contexts/PageMetaContext";
import { useEffect } from "react";

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

const BILLS_STORAGE_KEY = "nido_purchase_bills_v1";
const PAYMENTS_STORAGE_KEY = "nido_purchase_payments_made_v1";

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

const nextPaymentNumber = (entries: PaymentEntry[]) => {
  const max = entries.reduce((current, entry) => {
    const parsed = Number(entry.paymentNumber.replace(/\D/g, ""));
    return Number.isFinite(parsed) ? Math.max(current, parsed) : current;
  }, 6);
  return String(max + 1);
};

function PaymentVoucher({ entry }: { entry: PaymentEntry }) {
  return (
    <div className="mx-auto max-w-[820px] space-y-6 border bg-white p-6 text-slate-900">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-2xl font-semibold">PAYMENTS MADE</h3>
          <p className="text-sm text-muted-foreground">
            Payment {entry.paymentNumber}
          </p>
        </div>
        <div className="rounded-md bg-emerald-600 px-4 py-3 text-right text-white">
          <p className="text-xs uppercase tracking-wide">Amount Paid</p>
          <p className="text-2xl font-bold">{formatCurrency(entry.amount)}</p>
        </div>
      </div>

      <div className="grid gap-4 text-sm md:grid-cols-2">
        <div>
          <p className="font-semibold">Paid To</p>
          <p>{entry.vendorName}</p>
        </div>
        <div>
          <p className="font-semibold">Payment Date</p>
          <p>{entry.date}</p>
        </div>
        <div>
          <p className="font-semibold">Payment Mode</p>
          <p>{entry.mode}</p>
        </div>
        <div>
          <p className="font-semibold">Paid Through</p>
          <p>{entry.paidThrough}</p>
        </div>
      </div>

      <div>
        <p className="mb-2 font-semibold">Payment for</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bill Number</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Payment Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entry.allocations.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="text-center text-muted-foreground"
                >
                  Advance payment without bill linkage
                </TableCell>
              </TableRow>
            ) : (
              entry.allocations.map((allocation) => (
                <TableRow key={allocation.billId}>
                  <TableCell>{entry.billNumber || "-"}</TableCell>
                  <TableCell>{entry.referenceNumber || "-"}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(allocation.amount)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-sm">
        <p className="font-semibold">Notes</p>
        <p className="text-muted-foreground">{entry.notes || "-"}</p>
      </div>
    </div>
  );
}

export default function PaymentsMadePage() {
  const { setMeta } = usePageMeta();
  useEffect(() => { setMeta({ title: "Payments Made" }); }, []);

  const navigate = useNavigate();
  const location = useLocation();
  const { vendors } = useData();
  const printRef = useRef<HTMLDivElement>(null);

  const routeState = (location.state || {}) as { vendorName?: string };

  const [payments, setPayments] = useState<PaymentEntry[]>(() =>
    safeReadJson<PaymentEntry[]>(PAYMENTS_STORAGE_KEY, []),
  );
  const [open, setOpen] = useState(location.pathname.endsWith("/create"));
  const [selectedId, setSelectedId] = useState(payments[0]?.id || "");
  const [tab, setTab] = useState<"Bill Payment" | "Vendor Advance">(
    "Bill Payment",
  );

  const [form, setForm] = useState({
    vendorName: routeState.vendorName || "",
    paymentNumber: nextPaymentNumber(payments),
    paymentMode: "Cash",
    paidThrough: "Petty Cash",
    paymentDate: new Date().toISOString().slice(0, 10),
    referenceNumber: "",
    descriptionOfSupply: "",
    amountReceived: "",
    notes: "",
    payFullAmount: false,
  });

  const [allocations, setAllocations] = useState<Record<string, string>>({});

  const selected = useMemo(
    () =>
      payments.find((entry) => entry.id === selectedId) || payments[0] || null,
    [payments, selectedId],
  );

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: selected ? `Payment-${selected.paymentNumber}` : "Payment",
  });

  const bills = useMemo(
    () => safeReadJson<BillEntry[]>(BILLS_STORAGE_KEY, []),
    [payments],
  );

  const vendorBills = useMemo(() => {
    if (!form.vendorName) return [] as BillEntry[];
    return bills.filter(
      (entry) =>
        entry.vendorName === form.vendorName && entry.status !== "PAID",
    );
  }, [bills, form.vendorName]);

  const vendorBillStats = useMemo(() => {
    return vendorBills.map((bill) => {
      const total = billTotal(bill);
      const due = Math.max(total - bill.paymentMade, 0);
      return { bill, total, due };
    });
  }, [vendorBills]);

  const totalApplied = useMemo(
    () =>
      Object.values(allocations).reduce(
        (sum, value) => sum + toNumber(value),
        0,
      ),
    [allocations],
  );

  const amountValue = toNumber(form.amountReceived);
  const unusedAmount = Math.max(amountValue - totalApplied, 0);

  const persistPayments = (next: PaymentEntry[]) => {
    setPayments(next);
    localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(next));
  };

  const payInFull = (billId: string, due: number) => {
    setAllocations((current) => ({
      ...current,
      [billId]: String(due.toFixed(2)),
    }));
  };

  const updateBillStorageForPayment = (newPayment: PaymentEntry) => {
    if (newPayment.allocations.length === 0) return;
    const nextBills = bills.map((bill) => {
      const allocation = newPayment.allocations.find(
        (entry) => entry.billId === bill.id,
      );
      if (!allocation) return bill;
      const total = billTotal(bill);
      const nextPaymentMade = bill.paymentMade + allocation.amount;
      return {
        ...bill,
        paymentMade: nextPaymentMade,
        status: nextPaymentMade >= total ? "PAID" : "OPEN",
      };
    });
    localStorage.setItem(BILLS_STORAGE_KEY, JSON.stringify(nextBills));
  };

  const closeDialog = () => {
    setOpen(false);
    navigate("/transactions/purchase/payments-made", { replace: true });
  };

  const savePayment = (status: "PAID" | "DRAFT") => {
    if (!form.vendorName.trim()) {
      toast({ title: "Vendor is required" });
      return;
    }

    const finalAmount = amountValue;
    if (finalAmount <= 0) {
      toast({ title: "Enter payment amount" });
      return;
    }

    const normalizedAllocations = Object.entries(allocations)
      .map(([billId, value]) => ({ billId, amount: toNumber(value) }))
      .filter((entry) => entry.amount > 0);

    const firstLinkedBill = bills.find(
      (entry) => entry.id === normalizedAllocations[0]?.billId,
    );

    const created: PaymentEntry = {
      id: `pm-${Date.now()}`,
      date: form.paymentDate,
      paymentNumber: form.paymentNumber,
      referenceNumber: form.referenceNumber,
      vendorName: form.vendorName,
      billNumber: firstLinkedBill?.billNumber || "-",
      billId: firstLinkedBill?.id,
      mode: form.paymentMode,
      status,
      amount: finalAmount,
      unusedAmount,
      paidThrough: form.paidThrough,
      notes: form.notes,
      allocations: normalizedAllocations,
      type: tab,
    };

    const next = [created, ...payments];
    persistPayments(next);

    if (status === "PAID") updateBillStorageForPayment(created);

    setSelectedId(created.id);
    closeDialog();
    toast({
      title: status === "PAID" ? "Payment recorded" : "Payment saved as draft",
    });
  };

  return (
    <div>
            <div className="space-y-4 p-6">
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
            <h2 className="text-3xl font-semibold">All Payments</h2>
            <div className="flex items-center gap-2">
              <Button onClick={() => setOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> New
              </Button>
              <Button variant="outline" size="icon">
                <Ellipsis className="h-4 w-4" />
              </Button>
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
                  <TableHead>PAYMENT #</TableHead>
                  <TableHead>REFERENCE#</TableHead>
                  <TableHead>VENDOR NAME</TableHead>
                  <TableHead>BILL#</TableHead>
                  <TableHead>MODE</TableHead>
                  <TableHead>STATUS</TableHead>
                  <TableHead className="text-right">AMOUNT</TableHead>
                  <TableHead className="text-right">UNUSED AMOUNT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((entry) => (
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
                      {entry.paymentNumber}
                    </TableCell>
                    <TableCell>{entry.referenceNumber || "-"}</TableCell>
                    <TableCell>{entry.vendorName}</TableCell>
                    <TableCell>{entry.billNumber || "-"}</TableCell>
                    <TableCell>{entry.mode}</TableCell>
                    <TableCell>
                      <span
                        className={
                          entry.status === "PAID"
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
                      {formatCurrency(entry.unusedAmount)}
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
                  {selected.paymentNumber}
                </h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      toast({ title: "Edit flow available in next iteration" })
                    }
                  >
                    <Pencil className="mr-2 h-4 w-4" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => toast({ title: "Email send queued" })}
                  >
                    <Mail className="mr-2 h-4 w-4" /> Send Email
                  </Button>
                  <Button variant="outline" onClick={handlePrint}>
                    <Printer className="mr-2 h-4 w-4" /> PDF/Print
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedId("")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div ref={printRef} className="overflow-x-auto rounded-lg border">
                <PaymentVoucher entry={selected} />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Payment Made</DialogTitle>
          </DialogHeader>

          <Tabs
            value={tab}
            onValueChange={(value) =>
              setTab(value as "Bill Payment" | "Vendor Advance")
            }
          >
            <TabsList>
              <TabsTrigger value="Bill Payment">Bill Payment</TabsTrigger>
              <TabsTrigger value="Vendor Advance">Vendor Advance</TabsTrigger>
            </TabsList>

            <TabsContent value="Bill Payment" className="space-y-4 pt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Vendor Name*</Label>
                  <Select
                    value={form.vendorName}
                    onValueChange={(value) =>
                      setForm((current) => ({ ...current, vendorName: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.map((vendor) => (
                        <SelectItem key={vendor.id} value={vendor.name}>
                          {vendor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Payment #*</Label>
                  <Input
                    value={form.paymentNumber}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        paymentNumber: event.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Payment Made*</Label>
                  <Input
                    value={form.amountReceived}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        amountReceived: event.target.value,
                      }))
                    }
                  />
                  <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <Checkbox
                      checked={form.payFullAmount}
                      onCheckedChange={(checked) =>
                        setForm((current) => ({
                          ...current,
                          payFullAmount: !!checked,
                        }))
                      }
                    />
                    Pay full amount ({formatCurrency(amountValue)})
                  </label>
                </div>
                <div>
                  <Label>Payment Date*</Label>
                  <Input
                    type="date"
                    value={form.paymentDate}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        paymentDate: event.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Payment Mode</Label>
                  <Select
                    value={form.paymentMode}
                    onValueChange={(value) =>
                      setForm((current) => ({ ...current, paymentMode: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Bank Transfer">
                        Bank Transfer
                      </SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Paid Through*</Label>
                  <Input
                    value={form.paidThrough}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        paidThrough: event.target.value,
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
              </div>

              <div className="rounded-lg border">
                <div className="border-b p-3 text-right text-sm text-blue-700">
                  Clear Applied Amount
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Bill#</TableHead>
                      <TableHead className="text-right">Bill Amount</TableHead>
                      <TableHead className="text-right">Amount Due</TableHead>
                      <TableHead>Payment Made on</TableHead>
                      <TableHead className="text-right">Payment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendorBillStats.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-muted-foreground"
                        >
                          No open bills found for this vendor
                        </TableCell>
                      </TableRow>
                    ) : (
                      vendorBillStats.map(({ bill, total, due }) => (
                        <TableRow key={bill.id}>
                          <TableCell>{bill.billDate}</TableCell>
                          <TableCell>{bill.billNumber}</TableCell>
                          <TableCell className="text-right">
                            {total.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            {due.toFixed(2)}
                          </TableCell>
                          <TableCell>{form.paymentDate}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Input
                                className="w-24"
                                value={allocations[bill.id] || ""}
                                onChange={(event) =>
                                  setAllocations((current) => ({
                                    ...current,
                                    [bill.id]: event.target.value,
                                  }))
                                }
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => payInFull(bill.id, due)}
                              >
                                Pay in Full
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <div className="ml-auto w-full max-w-sm space-y-1 border-t bg-amber-50/50 p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span>Amount Paid:</span>
                    <span>{totalApplied.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Amount used for Payments:</span>
                    <span>{totalApplied.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between font-semibold">
                    <span>Unused Amount:</span>
                    <span>{unusedAmount.toFixed(2)}</span>
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
            </TabsContent>

            <TabsContent value="Vendor Advance" className="space-y-4 pt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Vendor Name*</Label>
                  <Select
                    value={form.vendorName}
                    onValueChange={(value) =>
                      setForm((current) => ({ ...current, vendorName: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.map((vendor) => (
                        <SelectItem key={vendor.id} value={vendor.name}>
                          {vendor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Payment #*</Label>
                  <Input
                    value={form.paymentNumber}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        paymentNumber: event.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Payment Made*</Label>
                  <Input
                    value={form.amountReceived}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        amountReceived: event.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Payment Date*</Label>
                  <Input
                    type="date"
                    value={form.paymentDate}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        paymentDate: event.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Payment Mode</Label>
                  <Input
                    value={form.paymentMode}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        paymentMode: event.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Paid Through</Label>
                  <Input
                    value={form.paidThrough}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        paidThrough: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="md:col-span-2">
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
              </div>
              <p className="text-sm text-muted-foreground">
                This payment will be parked as vendor advance and can be applied
                against future bills.
              </p>
            </TabsContent>
          </Tabs>

          <div className="flex items-center gap-2 pt-3">
            <Button variant="outline" onClick={() => savePayment("DRAFT")}>
              Save as Draft
            </Button>
            <Button onClick={() => savePayment("PAID")}>Save as Paid</Button>
            <Button variant="ghost" onClick={closeDialog}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
