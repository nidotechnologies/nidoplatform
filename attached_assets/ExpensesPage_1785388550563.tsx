import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useReactToPrint } from "react-to-print";

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
import { safeReadJson } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useData } from "@/contexts/DataContext";
import { Ellipsis, ImageUp, Plus, Search } from "lucide-react";
import { usePageMeta } from "@/contexts/PageMetaContext";
import { useEffect } from "react";

type ExpenseType = "Goods" | "Services";
type BillableStatus = "BILLABLE" | "NON-BILLABLE";

interface ExpenseEntry {
  id: string;
  date: string;
  expenseAccount: string;
  referenceNumber: string;
  vendorName: string;
  paidThrough: string;
  customerName: string;
  status: BillableStatus;
  amount: number;
  expenseType: ExpenseType;
  sac: string;
  gstTreatment: string;
  sourceOfSupply: string;
  destinationOfSupply: string;
  reverseCharge: boolean;
  taxLabel: string;
  taxPercent: number;
  taxAmount: number;
  amountIs: "Tax Inclusive" | "Tax Exclusive";
  invoiceNumber: string;
  notes: string;
  reportingTags: string[];
  receipts: string[];
}

const STORAGE_KEY = "nido_expenses_v1";

const defaultExpenses: ExpenseEntry[] = [
  {
    id: "ex-1",
    date: "2020-08-28",
    expenseAccount: "Automobile Expense",
    referenceNumber: "S14682",
    vendorName: "WICKED RIDE ADVENTURE SERVICES PVT LTD",
    paidThrough: "GST Payable",
    customerName: "-",
    status: "NON-BILLABLE",
    amount: 44835,
    expenseType: "Services",
    sac: "3921",
    gstTreatment: "Registered Business - Regular",
    sourceOfSupply: "Karnataka",
    destinationOfSupply: "Karnataka",
    reverseCharge: false,
    taxLabel: "GST18",
    taxPercent: 18,
    taxAmount: 6839.24,
    amountIs: "Tax Inclusive",
    invoiceNumber: "160",
    notes: "Auto expense paid for operations.",
    reportingTags: ["Materials"],
    receipts: [],
  },
  {
    id: "ex-2",
    date: "2020-06-26",
    expenseAccount: "Materials",
    referenceNumber: "160",
    vendorName: "Monish Glass Plywood & Hardware",
    paidThrough: "Petty Cash",
    customerName: "Mr. Workshaala Spaces",
    status: "NON-BILLABLE",
    amount: 44835,
    expenseType: "Goods",
    sac: "3921",
    gstTreatment: "Registered Business - Regular",
    sourceOfSupply: "Karnataka",
    destinationOfSupply: "Karnataka",
    reverseCharge: false,
    taxLabel: "GST18",
    taxPercent: 18,
    taxAmount: 6839.24,
    amountIs: "Tax Inclusive",
    invoiceNumber: "160",
    notes: "1. Clarification will be made post quality check mutually.",
    reportingTags: ["Materials"],
    receipts: ["bill-materials-june.pdf"],
  },
  {
    id: "ex-3",
    date: "2020-06-13",
    expenseAccount: "Materials",
    referenceNumber: "132",
    vendorName: "Monish Glass Plywood & Hardware",
    paidThrough: "Petty Cash",
    customerName: "Mr. Workshaala Spaces",
    status: "NON-BILLABLE",
    amount: 22100,
    expenseType: "Goods",
    sac: "3921",
    gstTreatment: "Registered Business - Regular",
    sourceOfSupply: "Karnataka",
    destinationOfSupply: "Karnataka",
    reverseCharge: false,
    taxLabel: "GST18",
    taxPercent: 18,
    taxAmount: 3371.18,
    amountIs: "Tax Inclusive",
    invoiceNumber: "132",
    notes: "Consumables for workshop.",
    reportingTags: ["Materials"],
    receipts: [],
  },
];

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const fmtCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(value);

const today = () => new Date().toISOString().slice(0, 10);

const calcTax = (amount: number, taxPercent: number, inclusive: boolean) => {
  if (taxPercent <= 0) return 0;
  if (inclusive)
    return Math.round((amount - amount / (1 + taxPercent / 100)) * 100) / 100;
  return Math.round(((amount * taxPercent) / 100) * 100) / 100;
};

function ExpensePrintSheet({ entry }: { entry: ExpenseEntry }) {
  return (
    <div className="mx-auto w-[794px] border border-slate-200 bg-white px-8 py-8 text-slate-900">
      <h1 className="text-2xl font-semibold">Expense Detail</h1>
      <div className="mt-4 flex items-start justify-between gap-6">
        <div>
          <p className="text-xs text-muted-foreground">Expense Amount</p>
          <p className="text-4xl font-semibold text-rose-500">
            {fmtCurrency(entry.amount)}
          </p>
          <p className="text-xs text-muted-foreground">on {entry.date}</p>
          <p className="mt-1 text-xs font-medium">{entry.status}</p>
          <Badge className="mt-2" variant="secondary">
            {entry.expenseAccount}
          </Badge>
        </div>
        <div className="w-[220px] rounded-xl border border-dashed p-4 text-center">
          <ImageUp className="mx-auto h-10 w-10 text-slate-500" />
          <p className="mt-3 text-sm font-medium">Receipt</p>
          <p className="text-xs text-muted-foreground">Attached in app</p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 text-sm md:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground">Paid Through</p>
          <p>{entry.paidThrough}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Tax</p>
          <p>
            {entry.taxLabel} ({entry.taxPercent}%)
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Tax Amount</p>
          <p>
            {fmtCurrency(entry.taxAmount)} ({entry.amountIs})
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Ref #</p>
          <p>{entry.referenceNumber}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Customer</p>
          <p>{entry.customerName}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Paid To</p>
          <p>{entry.vendorName}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">GST Treatment</p>
          <p>{entry.gstTreatment}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">HSN Code</p>
          <p>{entry.sac || "-"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Source of Supply</p>
          <p>{entry.sourceOfSupply}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Destination of Supply</p>
          <p>{entry.destinationOfSupply}</p>
        </div>
      </div>

      <div className="mt-8 border-t pt-4">
        <p className="text-sm font-semibold">Journal</p>
        <Table className="mt-3">
          <TableHeader>
            <TableRow>
              <TableHead>ACCOUNT</TableHead>
              <TableHead className="text-right">DEBIT</TableHead>
              <TableHead className="text-right">CREDIT</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>{entry.expenseAccount}</TableCell>
              <TableCell className="text-right">
                {(entry.amount - entry.taxAmount).toFixed(2)}
              </TableCell>
              <TableCell className="text-right">0.00</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>{entry.paidThrough}</TableCell>
              <TableCell className="text-right">0.00</TableCell>
              <TableCell className="text-right">
                {entry.amount.toFixed(2)}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Input SGST</TableCell>
              <TableCell className="text-right">
                {(entry.taxAmount / 2).toFixed(2)}
              </TableCell>
              <TableCell className="text-right">0.00</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Input CGST</TableCell>
              <TableCell className="text-right">
                {(entry.taxAmount / 2).toFixed(2)}
              </TableCell>
              <TableCell className="text-right">0.00</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-semibold">Total</TableCell>
              <TableCell className="text-right font-semibold">
                {entry.amount.toFixed(2)}
              </TableCell>
              <TableCell className="text-right font-semibold">
                {entry.amount.toFixed(2)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function ExpensesPage() {
  const { setMeta } = usePageMeta();
  useEffect(() => { setMeta({ title: "Expenses" }); }, []);

  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { vendors, clients } = useData();

  const createMode = location.pathname.endsWith("/create");
  const detailId = params.id;

  const [expenses, setExpenses] = useState<ExpenseEntry[]>(() =>
    safeReadJson<ExpenseEntry[]>(STORAGE_KEY, defaultExpenses),
  );
  const [selectedId, setSelectedId] = useState<string>(
    detailId || expenses[0]?.id || "",
  );
  const [open, setOpen] = useState(createMode);
  const [activeTab, setActiveTab] = useState<"receipts" | "all">("all");
  const [draftReceipts, setDraftReceipts] = useState<string[]>([]);
  const createUploadInputRef = useRef<HTMLInputElement>(null);
  const detailUploadInputRef = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    date: today(),
    expenseAccount: "",
    amount: "",
    paidThrough: "",
    expenseType: "Services" as ExpenseType,
    sac: "",
    vendorName: "",
    gstTreatment: "",
    sourceOfSupply: "",
    destinationOfSupply: "[KA] - Karnataka",
    reverseCharge: false,
    taxLabel: "",
    amountIs: "Tax Inclusive" as "Tax Inclusive" | "Tax Exclusive",
    invoiceNumber: "",
    notes: "",
    customerName: "",
    referenceNumber: "",
  });

  const persist = (next: ExpenseEntry[]) => {
    setExpenses(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  useEffect(() => {
    if (createMode) {
      setForm((current) => ({
        ...current,
        date: today(),
      }));
      setDraftReceipts([]);
      setOpen(true);
    }
  }, [createMode]);

  useEffect(() => {
    if (detailId) setSelectedId(detailId);
  }, [detailId]);

  const selected = useMemo(
    () =>
      expenses.find((entry) => entry.id === selectedId) || expenses[0] || null,
    [expenses, selectedId],
  );

  const taxPercent = Number(form.taxLabel.replace(/\D/g, "")) || 0;
  const amountValue = toNumber(form.amount, 0);
  const taxAmount = calcTax(
    amountValue,
    taxPercent,
    form.amountIs === "Tax Inclusive",
  );

  const saveExpense = (andNew = false) => {
    if (!form.expenseAccount || !form.amount || !form.paidThrough) {
      toast({
        title: "Date, Expense Account, Amount, and Paid Through are required",
      });
      return;
    }

    const entry: ExpenseEntry = {
      id: `ex-${Date.now()}`,
      date: form.date,
      expenseAccount: form.expenseAccount,
      referenceNumber:
        form.referenceNumber || `R${Date.now().toString().slice(-5)}`,
      vendorName: form.vendorName || "-",
      paidThrough: form.paidThrough,
      customerName: form.customerName || "-",
      status: "NON-BILLABLE",
      amount: amountValue,
      expenseType: form.expenseType,
      sac: form.sac,
      gstTreatment: form.gstTreatment || "Registered Business - Regular",
      sourceOfSupply: form.sourceOfSupply || "Karnataka",
      destinationOfSupply: form.destinationOfSupply,
      reverseCharge: form.reverseCharge,
      taxLabel: form.taxLabel || "GST18",
      taxPercent,
      taxAmount,
      amountIs: form.amountIs,
      invoiceNumber: form.invoiceNumber,
      notes: form.notes,
      reportingTags: ["Materials"],
      receipts: draftReceipts,
    };

    const next = [entry, ...expenses];
    persist(next);
    setSelectedId(entry.id);
    toast({ title: "Expense saved" });

    if (andNew) {
      setForm((current) => ({
        ...current,
        amount: "",
        invoiceNumber: "",
        notes: "",
        referenceNumber: "",
      }));
      setDraftReceipts([]);
      return;
    }

    setOpen(false);
    navigate(`/transactions/purchase/expenses/${entry.id}`, { replace: true });
  };

  const detailTaxLabel = selected
    ? `${selected.taxLabel} (${selected.taxPercent}%)`
    : "-";

  const reactToPrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "Expense-Detail",
    pageStyle:
      "@page { size: A4; margin: 12mm; } @media print { html, body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; } body * { visibility: hidden; } #expense-print-area, #expense-print-area * { visibility: visible; } #expense-print-area { position: absolute; top: 0; left: 0; width: 100%; background: white; } }",
  });

  const deleteSelected = () => {
    if (!selected) return;
    const next = expenses.filter((entry) => entry.id !== selected.id);
    persist(next);
    setSelectedId(next[0]?.id || "");
    toast({ title: "Expense deleted" });
  };

  const onCreateUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    const names = files.map((file) => file.name);
    setDraftReceipts((current) => [...current, ...names]);
    toast({ title: `${files.length} receipt(s) uploaded` });
    event.target.value = "";
  };

  const onDetailUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!selected) return;
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    const names = files.map((file) => file.name);
    const next = expenses.map((entry) =>
      entry.id === selected.id
        ? { ...entry, receipts: [...entry.receipts, ...names] }
        : entry,
    );
    persist(next);
    toast({ title: `${files.length} receipt(s) attached to expense` });
    event.target.value = "";
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const clone = {
      ...selected,
      id: `ex-${Date.now()}`,
      referenceNumber: `${selected.referenceNumber}-COPY`,
    };
    persist([clone, ...expenses]);
    setSelectedId(clone.id);
    toast({ title: "Expense duplicated" });
  };

  return (
    <div>
            <div className="space-y-4 p-6">
        <Card>
          <CardContent className="pt-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-5">
                <button
                  type="button"
                  className={`pb-2 text-lg font-medium ${
                    activeTab === "receipts"
                      ? "border-b-2 border-blue-500 text-slate-900"
                      : "text-muted-foreground"
                  }`}
                  onClick={() => setActiveTab("receipts")}
                >
                  Receipts Inbox
                </button>
                <button
                  type="button"
                  className={`pb-2 text-3xl font-semibold leading-none ${
                    activeTab === "all"
                      ? "border-b-2 border-blue-500 text-slate-900"
                      : "text-muted-foreground"
                  }`}
                  onClick={() => setActiveTab("all")}
                >
                  All Expenses
                </button>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() =>
                    navigate("/transactions/purchase/expenses/create")
                  }
                >
                  <Plus className="mr-2 h-4 w-4" /> New
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon">
                      <Ellipsis className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={() => toast({ title: "Export started" })}
                    >
                      Export Expenses
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => toast({ title: "Bulk import opened" })}
                    >
                      Import Expenses
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setActiveTab("receipts")}>
                      Open Receipts Inbox
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>

        {activeTab === "all" ? (
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">
                      <Checkbox checked={false} />
                    </TableHead>
                    <TableHead>DATE</TableHead>
                    <TableHead>EXPENSE ACCOUNT</TableHead>
                    <TableHead>REFERENCE#</TableHead>
                    <TableHead>VENDOR NAME</TableHead>
                    <TableHead>PAID THROUGH</TableHead>
                    <TableHead>CUSTOMER NAME</TableHead>
                    <TableHead>STATUS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((entry) => (
                    <TableRow
                      key={entry.id}
                      className="cursor-pointer"
                      onClick={() => {
                        setSelectedId(entry.id);
                        navigate(`/transactions/purchase/expenses/${entry.id}`);
                      }}
                    >
                      <TableCell>
                        <Checkbox checked={false} />
                      </TableCell>
                      <TableCell>{entry.date}</TableCell>
                      <TableCell>
                        <button
                          type="button"
                          className="text-left font-medium text-blue-600 hover:underline"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedId(entry.id);
                            navigate(
                              `/transactions/purchase/expenses/${entry.id}`,
                            );
                          }}
                        >
                          {entry.expenseAccount}
                        </button>
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          className="text-blue-600 hover:underline"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedId(entry.id);
                            navigate(
                              `/transactions/purchase/expenses/${entry.id}`,
                            );
                          }}
                        >
                          {entry.referenceNumber}
                        </button>
                      </TableCell>
                      <TableCell>{entry.vendorName}</TableCell>
                      <TableCell>{entry.paidThrough}</TableCell>
                      <TableCell>{entry.customerName}</TableCell>
                      <TableCell>{entry.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>DATE</TableHead>
                    <TableHead>EXPENSE ACCOUNT</TableHead>
                    <TableHead>REFERENCE#</TableHead>
                    <TableHead>RECEIPTS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses
                    .filter((entry) => entry.receipts.length > 0)
                    .map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.date}</TableCell>
                        <TableCell>{entry.expenseAccount}</TableCell>
                        <TableCell>{entry.referenceNumber}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {entry.receipts.map((name) => (
                              <Badge
                                key={`${entry.id}-${name}`}
                                variant="secondary"
                              >
                                {name}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              {expenses.filter((entry) => entry.receipts.length > 0).length ===
                0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No uploaded receipts yet. Upload files from New Expense or
                  Expense Detail.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {selected && (
          <Card>
            <CardContent className="pt-5">
              <h3 className="text-lg font-semibold">Expense Details</h3>
              <div className="mt-3 flex flex-wrap items-center gap-2 border-b pb-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    navigate("/transactions/purchase/expenses/create")
                  }
                >
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toast({ title: "Recurring rule created" })}
                >
                  Make Recurring
                </Button>
                <Button variant="outline" size="sm" onClick={reactToPrint}>
                  Print
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon">
                      <Ellipsis className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={duplicateSelected}>
                      Duplicate Expense
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => toast({ title: "Marked as billable" })}
                    >
                      Mark as Billable
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={deleteSelected}>
                      Delete Expense
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="mt-4 grid gap-5 xl:grid-cols-[1fr_220px]">
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Expense Amount
                    </p>
                    <p className="text-3xl font-semibold text-rose-500">
                      {fmtCurrency(selected.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      on {selected.date}
                    </p>
                    <p className="mt-1 text-xs font-medium">
                      {selected.status}
                    </p>
                    <Badge className="mt-2" variant="secondary">
                      {selected.expenseAccount}
                    </Badge>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Paid Through
                      </p>
                      <p>{selected.paidThrough}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Tax</p>
                      <p>{detailTaxLabel}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Tax Amount
                      </p>
                      <p>
                        {fmtCurrency(selected.taxAmount)} ({selected.amountIs})
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Ref #</p>
                      <p>{selected.referenceNumber}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Customer</p>
                      <p className="text-blue-600">{selected.customerName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Paid To</p>
                      <p className="text-blue-600">{selected.vendorName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        GST Treatment
                      </p>
                      <p>{selected.gstTreatment}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        GSTIN / UIN
                      </p>
                      <p>29BAAPR5775A1ZL</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">HSN Code</p>
                      <p>{selected.sac || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Source of Supply
                      </p>
                      <p>{selected.sourceOfSupply}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Destination of Supply
                      </p>
                      <p>{selected.destinationOfSupply}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-dashed p-4 text-center">
                  <ImageUp className="mx-auto h-10 w-10 text-slate-500" />
                  <p className="mt-3 text-sm font-medium">
                    Drag or Drop your Receipts
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Maximum file size allowed is 10 MB
                  </p>
                  <Button
                    className="mt-4"
                    variant="outline"
                    size="sm"
                    onClick={() => detailUploadInputRef.current?.click()}
                  >
                    Upload your Files
                  </Button>
                  <input
                    ref={detailUploadInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={onDetailUpload}
                  />
                  {selected.receipts.length > 0 && (
                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                      {selected.receipts.map((name) => (
                        <Badge
                          key={`${selected.id}-${name}`}
                          variant="secondary"
                          className="gap-2"
                        >
                          {name}
                          <button
                            type="button"
                            onClick={() =>
                              persist(
                                expenses.map((entry) =>
                                  entry.id === selected.id
                                    ? {
                                        ...entry,
                                        receipts: entry.receipts.filter(
                                          (value) => value !== name,
                                        ),
                                      }
                                    : entry,
                                ),
                              )
                            }
                          >
                            x
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 border-t pt-4">
                <p className="text-sm font-semibold">Journal</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Amount is displayed in your base currency
                </p>
                <Table className="mt-3">
                  <TableHeader>
                    <TableRow>
                      <TableHead>ACCOUNT</TableHead>
                      <TableHead className="text-right">DEBIT</TableHead>
                      <TableHead className="text-right">CREDIT</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>{selected.expenseAccount}</TableCell>
                      <TableCell className="text-right">
                        {(selected.amount - selected.taxAmount).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">0.00</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>{selected.paidThrough}</TableCell>
                      <TableCell className="text-right">0.00</TableCell>
                      <TableCell className="text-right">
                        {selected.amount.toFixed(2)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Input SGST</TableCell>
                      <TableCell className="text-right">
                        {(selected.taxAmount / 2).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">0.00</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Input CGST</TableCell>
                      <TableCell className="text-right">
                        {(selected.taxAmount / 2).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">0.00</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-semibold">Total</TableCell>
                      <TableCell className="text-right font-semibold">
                        {selected.amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {selected.amount.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog
        open={open}
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen)
            navigate("/transactions/purchase/expenses", { replace: true });
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Expense</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="flex gap-4 border-b pb-2 text-sm">
              <button
                type="button"
                className="border-b-2 border-blue-500 pb-2 font-medium"
              >
                Record Expense
              </button>
              <button
                type="button"
                className="pb-2 text-muted-foreground"
                onClick={() =>
                  toast({ title: "Record Mileage form coming next" })
                }
              >
                Record Mileage
              </button>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Date*</Label>
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
                  <div>
                    <Label>Expense Account*</Label>
                    <Select
                      value={form.expenseAccount || "none"}
                      onValueChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          expenseAccount: value === "none" ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select an account" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select an account</SelectItem>
                        <SelectItem value="Materials">Materials</SelectItem>
                        <SelectItem value="Automobile Expense">
                          Automobile Expense
                        </SelectItem>
                        <SelectItem value="Office Expense">
                          Office Expense
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <button
                      type="button"
                      className="mt-1 text-xs text-blue-600"
                      onClick={() => toast({ title: "Itemize panel opened" })}
                    >
                      Itemize
                    </button>
                  </div>
                  <div>
                    <Label>Amount*</Label>
                    <div className="flex gap-2">
                      <Select defaultValue="INR">
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="INR">INR</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        value={form.amount}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            amount: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Paid Through*</Label>
                    <Select
                      value={form.paidThrough || "none"}
                      onValueChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          paidThrough: value === "none" ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select an account" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select an account</SelectItem>
                        <SelectItem value="Petty Cash">Petty Cash</SelectItem>
                        <SelectItem value="GST Payable">GST Payable</SelectItem>
                        <SelectItem value="ICICI Bank">ICICI Bank</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Expense Type*</Label>
                    <div className="mt-2 flex items-center gap-4 text-sm">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={form.expenseType === "Goods"}
                          onChange={() =>
                            setForm((current) => ({
                              ...current,
                              expenseType: "Goods",
                            }))
                          }
                        />
                        Goods
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={form.expenseType === "Services"}
                          onChange={() =>
                            setForm((current) => ({
                              ...current,
                              expenseType: "Services",
                            }))
                          }
                        />
                        Services
                      </label>
                    </div>
                  </div>
                  <div>
                    <Label>SAC</Label>
                    <Input
                      value={form.sac}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          sac: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Vendor</Label>
                    <div className="flex gap-2">
                      <Select
                        value={form.vendorName || "none"}
                        onValueChange={(value) =>
                          setForm((current) => ({
                            ...current,
                            vendorName: value === "none" ? "" : value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select vendor" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Select vendor</SelectItem>
                          {vendors.map((vendor) => (
                            <SelectItem key={vendor.id} value={vendor.name}>
                              {vendor.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="icon">
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label>GST Treatment*</Label>
                    <Select
                      value={form.gstTreatment || "none"}
                      onValueChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          gstTreatment: value === "none" ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select GST treatment" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          Select GST treatment
                        </SelectItem>
                        <SelectItem value="Registered Business - Regular">
                          Registered Business - Regular
                        </SelectItem>
                        <SelectItem value="Unregistered Business">
                          Unregistered Business
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Source of Supply*</Label>
                    <Input
                      value={form.sourceOfSupply}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          sourceOfSupply: event.target.value,
                        }))
                      }
                      placeholder="State/Province"
                    />
                  </div>
                  <div>
                    <Label>Destination of Supply*</Label>
                    <Input
                      value={form.destinationOfSupply}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          destinationOfSupply: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.reverseCharge}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          reverseCharge: event.target.checked,
                        }))
                      }
                    />
                    This transaction is applicable for reverse charge
                  </label>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label>Tax</Label>
                      <Select
                        value={form.taxLabel || "none"}
                        onValueChange={(value) =>
                          setForm((current) => ({
                            ...current,
                            taxLabel: value === "none" ? "" : value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a Tax" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Select a Tax</SelectItem>
                          <SelectItem value="GST18">GST18</SelectItem>
                          <SelectItem value="GST12">GST12</SelectItem>
                          <SelectItem value="GST5">GST5</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Amount Is</Label>
                      <div className="mt-2 flex items-center gap-4 text-sm">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={form.amountIs === "Tax Inclusive"}
                            onChange={() =>
                              setForm((current) => ({
                                ...current,
                                amountIs: "Tax Inclusive",
                              }))
                            }
                          />
                          Tax Inclusive
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={form.amountIs === "Tax Exclusive"}
                            onChange={() =>
                              setForm((current) => ({
                                ...current,
                                amountIs: "Tax Exclusive",
                              }))
                            }
                          />
                          Tax Exclusive
                        </label>
                      </div>
                    </div>
                    <div>
                      <Label>Invoice#</Label>
                      <Input
                        value={form.invoiceNumber}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            invoiceNumber: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label>Notes</Label>
                      <Textarea
                        maxLength={500}
                        value={form.notes}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            notes: event.target.value,
                          }))
                        }
                        placeholder="Max. 500 characters"
                      />
                    </div>
                    <div>
                      <Label>Customer Name</Label>
                      <div className="flex gap-2">
                        <Select
                          value={form.customerName || "none"}
                          onValueChange={(value) =>
                            setForm((current) => ({
                              ...current,
                              customerName: value === "none" ? "" : value,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select or add a customer" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              Select or add a customer
                            </SelectItem>
                            {clients.map((client) => (
                              <SelectItem key={client.id} value={client.name}>
                                {client.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="outline" size="icon">
                          <Search className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label>Reporting Tags</Label>
                      <button
                        type="button"
                        className="mt-2 text-sm text-blue-600 hover:underline"
                        onClick={() =>
                          toast({ title: "Associate Tags opened" })
                        }
                      >
                        Associate Tags
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-dashed p-4 text-center">
                <ImageUp className="mx-auto h-12 w-12 text-slate-500" />
                <p className="mt-3 text-sm font-medium">
                  Drag or Drop your Receipts
                </p>
                <p className="text-xs text-muted-foreground">
                  Maximum file size allowed is 10 MB
                </p>
                <Button
                  className="mt-4"
                  variant="outline"
                  size="sm"
                  onClick={() => createUploadInputRef.current?.click()}
                >
                  Upload your Files
                </Button>
                <input
                  ref={createUploadInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={onCreateUpload}
                />
                {draftReceipts.length > 0 && (
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    {draftReceipts.map((name) => (
                      <Badge key={name} variant="secondary" className="gap-2">
                        {name}
                        <button
                          type="button"
                          onClick={() =>
                            setDraftReceipts((current) =>
                              current.filter((value) => value !== name),
                            )
                          }
                        >
                          x
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 border-t pt-3">
              <Button onClick={() => saveExpense(false)}>Save (Alt+S)</Button>
              <Button variant="secondary" onClick={() => saveExpense(true)}>
                Save and New (Alt+N)
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="fixed left-[-10000px] top-0 w-[794px] bg-white">
        <div ref={printRef} id="expense-print-area">
          {selected ? <ExpensePrintSheet entry={selected} /> : null}
        </div>
      </div>
    </div>
  );
}
