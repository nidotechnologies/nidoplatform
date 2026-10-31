import { useMemo, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { usePageMeta } from "@/contexts/PageMetaContext";
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
import { safeReadJson } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

interface PaymentReceipt {
  id: string;
  paymentNumber: string;
  customerName: string;
  invoiceNumber: string;
  paymentDate: string;
  paymentMode: string;
  amountReceived: number;
  taxDeducted: "no" | "tds";
  status: "draft" | "paid";
}

const STORAGE_KEY = "nido_payment_receipts_v3";
const defaultReceipts: PaymentReceipt[] = [];

export default function PaymentReceiptsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setMeta } = usePageMeta();

  useEffect(() => {
    setMeta({
      title: "Payment Receipt",
      breadcrumbs: [{ label: "Payment Receipt" }],
    });
    return () => setMeta({});
  }, [setMeta]);
  const state = (location.state || {}) as {
    fromInvoiceId?: string;
    customerName?: string;
    invoiceNumber?: string;
    amount?: number;
    email?: string;
  };

  const [receipts, setReceipts] = useState<PaymentReceipt[]>(() =>
    safeReadJson<PaymentReceipt[]>(STORAGE_KEY, defaultReceipts),
  );
  const [open, setOpen] = useState(
    location.pathname.endsWith("/create") || !!state.fromInvoiceId,
  );
  const [attachments, setAttachments] = useState<string[]>([]);
  const [attachmentDraft, setAttachmentDraft] = useState("");

  const [form, setForm] = useState({
    customerName: state.customerName || "",
    placeOfSupply: "[KA] - Karnataka",
    descriptionOfSupply: "",
    amountReceived: String(state.amount ?? ""),
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentNumber: `${Date.now().toString().slice(-5)}`,
    paymentMode: "Cash",
    depositTo: "Petty Cash",
    reference: "",
    invoiceNumber: state.invoiceNumber || "",
    bankCharges: "",
    taxCode: "",
    taxDeducted: "no" as "no" | "tds",
    note: "",
    sendThankYou: true,
    recipients: [state.email || ""].filter(Boolean),
  });

  const persist = (next: PaymentReceipt[]) => {
    setReceipts(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const totalPaid = useMemo(
    () =>
      receipts.reduce(
        (sum, entry) => sum + (Number(entry.amountReceived) || 0),
        0,
      ),
    [receipts],
  );

  const addAttachment = () => {
    const value = attachmentDraft.trim();
    if (!value) return;
    setAttachments((current) => [...current, value]);
    setAttachmentDraft("");
  };

  const removeAttachment = (value: string) => {
    setAttachments((current) => current.filter((entry) => entry !== value));
  };

  const saveReceipt = () => {
    if (!form.customerName.trim()) {
      toast({ title: "Customer is required" });
      return;
    }

    const amount = Number(form.amountReceived) || 0;
    const next: PaymentReceipt = {
      id: `pr-${Date.now()}`,
      paymentNumber: form.paymentNumber,
      customerName: form.customerName,
      invoiceNumber: form.invoiceNumber,
      paymentDate: form.paymentDate,
      paymentMode: form.paymentMode,
      amountReceived: amount,
      taxDeducted: form.taxDeducted,
      status: "paid",
    };

    persist([next, ...receipts]);
    setOpen(false);
    navigate("/sales/payment-receipts", { replace: true });
    toast({ title: "Payment receipt saved" });

    if (form.sendThankYou && form.recipients.length > 0) {
      toast({
        title: "Thank you note queued",
        description: `Will be sent to ${form.recipients.join(", ")}`,
      });
    }
  };

  const amountValue = Number(form.amountReceived) || 0;

  return (
    <div>
            <div className="space-y-4 p-6">
        <Card>
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="text-sm text-muted-foreground">
                Capture payment receipts and maintain a stable customer payment
                trail.
              </p>
              <p className="text-xl font-semibold">
                Total Paid: Rs.{totalPaid.toFixed(2)}
              </p>
            </div>
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> New
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Payment #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{entry.paymentDate}</TableCell>
                    <TableCell>{entry.paymentNumber}</TableCell>
                    <TableCell>{entry.customerName}</TableCell>
                    <TableCell>{entry.invoiceNumber || "-"}</TableCell>
                    <TableCell>{entry.paymentMode}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          entry.status === "paid" ? "default" : "secondary"
                        }
                      >
                        {entry.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      Rs.{entry.amountReceived.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={open}
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen) navigate("/sales/payment-receipts", { replace: true });
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payment Receipt</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="invoice-payment">
            <TabsList>
              <TabsTrigger value="invoice-payment">Invoice Payment</TabsTrigger>
              <TabsTrigger value="customer-advance">
                Customer Advance
              </TabsTrigger>
            </TabsList>

            <TabsContent value="invoice-payment" className="space-y-4 pt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Customer Name*</Label>
                  <Input
                    value={form.customerName}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        customerName: event.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Amount Received*</Label>
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
                    <Checkbox checked={amountValue > 0} />
                    Received full amount (Rs.{amountValue.toFixed(2)})
                  </label>
                </div>
                <div>
                  <Label>Bank Charges (if any)</Label>
                  <Input
                    value={form.bankCharges}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        bankCharges: event.target.value,
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
                  <Label>Deposit To*</Label>
                  <Select
                    value={form.depositTo}
                    onValueChange={(value) =>
                      setForm((current) => ({ ...current, depositTo: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Petty Cash">Petty Cash</SelectItem>
                      <SelectItem value="Main Bank">Main Bank</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Reference#</Label>
                  <Input
                    value={form.reference}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        reference: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Tax deducted?</Label>
                  <div className="mt-2 flex items-center gap-5 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={form.taxDeducted === "no"}
                        onChange={() =>
                          setForm((current) => ({
                            ...current,
                            taxDeducted: "no",
                          }))
                        }
                      />
                      No Tax deducted
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={form.taxDeducted === "tds"}
                        onChange={() =>
                          setForm((current) => ({
                            ...current,
                            taxDeducted: "tds",
                          }))
                        }
                      />
                      Yes, TDS (Income Tax)
                    </label>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border bg-muted/20 p-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <p className="font-medium">Unpaid Invoices</p>
                  <p className="text-xs text-muted-foreground">
                    List contains SENT invoices
                  </p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Invoice Number</TableHead>
                      <TableHead className="text-right">
                        Invoice Amount
                      </TableHead>
                      <TableHead className="text-right">Amount Due</TableHead>
                      <TableHead>Payment Received On</TableHead>
                      <TableHead className="text-right">Payment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>{form.paymentDate}</TableCell>
                      <TableCell>{form.invoiceNumber || "-"}</TableCell>
                      <TableCell className="text-right">
                        {amountValue.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        {amountValue.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Input type="date" value={form.paymentDate} readOnly />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          value={amountValue.toFixed(2)}
                          readOnly
                          className="text-right"
                        />
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="customer-advance" className="space-y-4 pt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Customer Name*</Label>
                  <Input
                    value={form.customerName}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        customerName: event.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Place of Supply*</Label>
                  <Input
                    value={form.placeOfSupply}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        placeOfSupply: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Description of Supply</Label>
                  <Textarea
                    value={form.descriptionOfSupply}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        descriptionOfSupply: event.target.value,
                      }))
                    }
                    className="min-h-20"
                  />
                </div>
                <div>
                  <Label>Amount Received*</Label>
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
                  <Label>Bank Charges (if any)</Label>
                  <Input
                    value={form.bankCharges}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        bankCharges: event.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Tax</Label>
                  <Select
                    value={form.taxCode || "none"}
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        taxCode: value === "none" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a Tax" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select a Tax</SelectItem>
                      <SelectItem value="GST18">GST18 [18%]</SelectItem>
                      <SelectItem value="GST12">GST12 [12%]</SelectItem>
                    </SelectContent>
                  </Select>
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
                  <Label>Deposit To*</Label>
                  <Input
                    value={form.depositTo}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        depositTo: event.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Reference#</Label>
                  <Input
                    value={form.reference}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        reference: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="space-y-4 border-t pt-4">
            <div>
              <Label>Notes (Internal use. Not visible to customer)</Label>
              <Textarea
                value={form.note}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    note: event.target.value,
                  }))
                }
                className="min-h-20"
              />
            </div>

            <div className="space-y-2">
              <Label>Attachments</Label>
              <div className="flex gap-2">
                <Input
                  value={attachmentDraft}
                  onChange={(event) => setAttachmentDraft(event.target.value)}
                  placeholder="Upload File"
                />
                <Button type="button" variant="outline" onClick={addAttachment}>
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {attachments.map((entry) => (
                  <Badge key={entry} variant="secondary" className="gap-2">
                    {entry}
                    <button
                      type="button"
                      className="text-xs text-muted-foreground"
                      onClick={() => removeAttachment(entry)}
                    >
                      x
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="rounded border p-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={form.sendThankYou}
                  onCheckedChange={(checked) =>
                    setForm((current) => ({
                      ...current,
                      sendThankYou: !!checked,
                    }))
                  }
                />
                <p className="text-sm">
                  Send a "Thank you" note for this payment
                </p>
              </div>
              {form.sendThankYou && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {form.recipients.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No recipients selected
                    </p>
                  )}
                  {form.recipients.map((entry) => (
                    <Badge key={entry} variant="outline">
                      {entry}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveReceipt}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
