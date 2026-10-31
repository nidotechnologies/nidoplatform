import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

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
import { safeReadJson } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { generateExpensePdf } from "@/lib/expensePdf";
import {
  Download,
  Ellipsis,
  FileText,
  Plus,
} from "lucide-react";
import { usePageMeta } from "@/contexts/PageMetaContext";
import type { ReceiptFile } from "./NewExpensePage";
import { useI18n } from "@/i18n/I18nProvider";
import { formatCurrency } from "@/lib/formatters";

// ── Types ─────────────────────────────────────────────────────────────────────
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
  expenseType: "Goods" | "Services";
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
  // receipts can be ReceiptFile objects (new) or legacy strings
  receipts: (ReceiptFile | string)[];
  createdBy?: string;
  createdById?: string;
  createdByEmail?: string;
  submittedBy?: string;
  submittedById?: string;
  submittedByEmail?: string;
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
    receipts: [],
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

const fmtCurrency = (value: number) => formatCurrency(value);

// Normalise a receipt entry to a ReceiptFile (handles legacy string entries)
function toReceiptFile(r: ReceiptFile | string): ReceiptFile {
  if (typeof r === "string") return { name: r, dataUrl: "", type: "" };
  return r;
}

// ── Field row helper ──────────────────────────────────────────────────────────
function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value || "—"}</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ExpensesPage() {
  useI18n();
  const { setMeta } = usePageMeta();
  useEffect(() => { setMeta({ title: "Expenses" }); }, []);

  const navigate = useNavigate();
  const params = useParams();

  const [expenses, setExpenses] = useState<ExpenseEntry[]>(() =>
    safeReadJson<ExpenseEntry[]>(STORAGE_KEY, defaultExpenses),
  );
  const [selectedId, setSelectedId] = useState<string>(
    params.id || expenses[0]?.id || "",
  );
  const [activeTab, setActiveTab] = useState<"all" | "receipts">("all");
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    if (params.id) setSelectedId(params.id);
  }, [params.id]);

  const selected = useMemo(
    () => expenses.find((e) => e.id === selectedId) || expenses[0] || null,
    [expenses, selectedId],
  );

  const persist = (next: ExpenseEntry[]) => {
    setExpenses(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const handleDownloadPdf = async () => {
    if (!selected) return;
    setPdfLoading(true);
    try {
      await generateExpensePdf(selected);
    } catch (err) {
      console.error(err);
      toast({ title: "PDF generation failed", description: String(err) });
    } finally {
      setPdfLoading(false);
    }
  };

  const deleteSelected = () => {
    if (!selected) return;
    const next = expenses.filter((e) => e.id !== selected.id);
    persist(next);
    setSelectedId(next[0]?.id || "");
    toast({ title: "Expense deleted" });
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

  const detailTaxLabel = selected
    ? `${selected.taxLabel} (${selected.taxPercent}%)`
    : "—";

  // Receipts for selected expense, normalised
  const selectedReceipts = (selected?.receipts || []).map(toReceiptFile);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full space-y-5 p-6">

        {/* ── Header card with tabs ── */}
        <Card className="border-gray-200 shadow-sm">
          <CardContent className="px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <button
                  type="button"
                  className={`pb-2 text-sm font-semibold transition-colors ${
                    activeTab === "receipts"
                      ? "border-b-2 border-blue-500 text-gray-900"
                      : "text-gray-400 hover:text-gray-700"
                  }`}
                  onClick={() => setActiveTab("receipts")}
                >
                  Receipts Inbox
                </button>
                <button
                  type="button"
                  className={`pb-2 text-2xl font-bold transition-colors ${
                    activeTab === "all"
                      ? "border-b-2 border-blue-500 text-gray-900"
                      : "text-gray-400 hover:text-gray-700"
                  }`}
                  onClick={() => setActiveTab("all")}
                >
                  All Expenses
                </button>
              </div>
              <div className="flex gap-2">
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => navigate("/transactions/purchase/expenses/create")}
                >
                  <Plus className="mr-2 h-4 w-4" /> New Expense
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon">
                      <Ellipsis className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => toast({ title: "Export started" })}>
                      Export Expenses
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => toast({ title: "Bulk import opened" })}>
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

        {/* ── All Expenses table ── */}
        {activeTab === "all" ? (
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="px-6 py-5">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-200">
                    <TableHead className="w-10 pl-2">
                      <Checkbox checked={false} />
                    </TableHead>
                    <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Date</TableHead>
                    <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Expense Account</TableHead>
                    <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Reference #</TableHead>
                    <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Vendor Name</TableHead>
                    <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Paid Through</TableHead>
                    <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Customer Name</TableHead>
                    <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((entry) => (
                    <TableRow
                      key={entry.id}
                      className={`cursor-pointer border-gray-100 transition-colors ${
                        selected?.id === entry.id
                          ? "bg-blue-50 hover:bg-blue-50"
                          : "hover:bg-gray-50"
                      }`}
                      onClick={() => {
                        setSelectedId(entry.id);
                        navigate(`/transactions/purchase/expenses/${entry.id}`);
                      }}
                    >
                      <TableCell className="pl-2">
                        <Checkbox checked={false} onClick={(e) => e.stopPropagation()} />
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 whitespace-nowrap py-3.5">{entry.date}</TableCell>
                      <TableCell className="py-3.5">
                        <button
                          type="button"
                          className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline text-left"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(entry.id);
                            navigate(`/transactions/purchase/expenses/${entry.id}`);
                          }}
                        >
                          {entry.expenseAccount}
                        </button>
                      </TableCell>
                      <TableCell className="py-3.5">
                        <button
                          type="button"
                          className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(entry.id);
                            navigate(`/transactions/purchase/expenses/${entry.id}`);
                          }}
                        >
                          {entry.referenceNumber}
                        </button>
                      </TableCell>
                      <TableCell className="text-sm text-gray-700 py-3.5 max-w-[180px] truncate">{entry.vendorName}</TableCell>
                      <TableCell className="text-sm text-gray-600 py-3.5">{entry.paidThrough}</TableCell>
                      <TableCell className="text-sm text-gray-600 py-3.5">{entry.customerName}</TableCell>
                      <TableCell className="py-3.5">
                        <Badge
                          className={`text-xs font-semibold ${
                            entry.status === "BILLABLE"
                              ? "bg-green-100 text-green-700 border-green-200"
                              : "bg-purple-100 text-purple-700 border-purple-200"
                          }`}
                          variant="outline"
                        >
                          {entry.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          /* ── Receipts Inbox ── */
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="px-6 py-5">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-200">
                    <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Date</TableHead>
                    <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Expense Account</TableHead>
                    <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Reference #</TableHead>
                    <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide">Receipts</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses
                    .filter((e) => e.receipts.length > 0)
                    .map((entry) => (
                      <TableRow key={entry.id} className="border-gray-100">
                        <TableCell className="text-sm text-gray-600 py-3.5">{entry.date}</TableCell>
                        <TableCell className="text-sm text-gray-700 font-medium py-3.5">{entry.expenseAccount}</TableCell>
                        <TableCell className="text-sm text-gray-600 py-3.5">{entry.referenceNumber}</TableCell>
                        <TableCell className="py-3.5">
                          <div className="flex flex-wrap gap-2">
                            {entry.receipts.map((r, i) => {
                              const file = toReceiptFile(r);
                              return (
                                <Badge key={`${entry.id}-${i}`} variant="secondary" className="text-xs">
                                  {file.name}
                                </Badge>
                              );
                            })}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              {expenses.filter((e) => e.receipts.length > 0).length === 0 && (
                <p className="py-10 text-center text-sm text-gray-400">
                  No receipts uploaded yet. Attach files when creating a new expense.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Selected Expense Detail panel ── */}
        {selected && (
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="px-6 py-6">

              {/* Action toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <h3 className="text-base font-bold text-gray-900">Expense Details</h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-gray-200 text-gray-600 hover:text-gray-900"
                    onClick={() => navigate("/transactions/purchase/expenses/create")}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-gray-200 text-gray-600 hover:text-gray-900"
                    onClick={() => toast({ title: "Recurring rule created" })}
                  >
                    Make Recurring
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pdfLoading}
                    className="h-8 text-xs border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 gap-1.5"
                    onClick={handleDownloadPdf}
                  >
                    <Download size={13} />
                    {pdfLoading ? "Generating…" : "Download PDF"}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="h-8 w-8 border-gray-200">
                        <Ellipsis className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={duplicateSelected}>
                        Duplicate Expense
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => toast({ title: "Marked as billable" })}>
                        Mark as Billable
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={deleteSelected}
                        className="text-red-600 focus:text-red-600"
                      >
                        Delete Expense
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Amount hero */}
              <div className="bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-100 rounded-xl px-6 py-5 mb-6">
                <p className="text-xs font-semibold text-rose-400 uppercase tracking-wide mb-1">Expense Amount</p>
                <p className="text-4xl font-bold text-rose-600 leading-none">
                  {fmtCurrency(selected.amount)}
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <span className="text-sm text-gray-500">on {selected.date}</span>
                  <Badge
                    className={`text-xs font-semibold ${
                      selected.status === "BILLABLE"
                        ? "bg-green-100 text-green-700 border-green-200"
                        : "bg-purple-100 text-purple-700 border-purple-200"
                    }`}
                    variant="outline"
                  >
                    {selected.status}
                  </Badge>
                  <Badge variant="secondary" className="text-xs font-medium">
                    {selected.expenseAccount}
                  </Badge>
                </div>
              </div>

              {/* Details grid + receipts */}
              <div className="grid gap-6 xl:grid-cols-[1fr_260px]">

                {/* Left: field grid */}
                <div className="grid grid-cols-2 gap-x-8 gap-y-5 md:grid-cols-3">
                  <DetailField label="Paid Through" value={selected.paidThrough} />
                  <DetailField label="Tax" value={detailTaxLabel} />
                  <DetailField
                    label="Tax Amount"
                    value={`${fmtCurrency(selected.taxAmount)} (${selected.amountIs})`}
                  />
                  <DetailField label="Ref #" value={selected.referenceNumber} />
                  <DetailField
                    label="Customer"
                    value={
                      <span className="text-blue-600">{selected.customerName}</span>
                    }
                  />
                  <DetailField
                    label="Paid To"
                    value={
                      <span className="text-blue-600">{selected.vendorName}</span>
                    }
                  />
                  <DetailField label="GST Treatment" value={selected.gstTreatment} />
                  <DetailField label="GSTIN / UIN" value="29BAAPR5775A1ZL" />
                  <DetailField label="HSN Code" value={selected.sac || "—"} />
                  <DetailField label="Source of Supply" value={selected.sourceOfSupply} />
                  <DetailField label="Destination of Supply" value={selected.destinationOfSupply} />
                  <DetailField label="Invoice #" value={selected.invoiceNumber} />
                </div>

                {/* Right: receipts panel */}
                <div className="border border-gray-200 rounded-xl p-5 bg-gray-50/60">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText size={15} className="text-blue-600" />
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-600">
                      Attached Receipts
                    </p>
                  </div>

                  {selectedReceipts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <FileText size={32} className="text-gray-300 mb-3" />
                      <p className="text-sm text-gray-400">No receipts attached</p>
                      <p className="text-xs text-gray-300 mt-1">
                        Upload receipts when creating an expense
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedReceipts.map((file, i) => (
                        <div
                          key={`${selected.id}-${i}`}
                          className="flex items-center gap-3 px-3 py-2.5 bg-white border border-gray-200 rounded-lg"
                        >
                          <FileText size={15} className="text-blue-500 shrink-0" />
                          <span className="text-sm text-gray-700 truncate flex-1 min-w-0">
                            {file.name}
                          </span>
                          {file.dataUrl ? (
                            <a
                              href={file.dataUrl}
                              download={file.name}
                              className="shrink-0 p-1 text-gray-400 hover:text-blue-600 transition-colors"
                              title={`Download ${file.name}`}
                            >
                              <Download size={14} />
                            </a>
                          ) : (
                            <span className="shrink-0 text-xs text-gray-300 italic">legacy</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              {selected.notes && (
                <div className="mt-6 pt-5 border-t border-gray-100">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Notes</p>
                  <p className="text-sm text-gray-600 leading-relaxed">{selected.notes}</p>
                </div>
              )}

              {/* Journal */}
              <div className="mt-6 pt-5 border-t border-gray-100">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-bold text-gray-800">Journal</p>
                  <p className="text-xs text-gray-400">Amount in base currency (INR)</p>
                </div>
                <div className="rounded-xl border border-gray-200 overflow-hidden mt-3">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 border-gray-200">
                        <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide pl-4">Account</TableHead>
                        <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide text-right pr-4">Debit</TableHead>
                        <TableHead className="text-xs font-bold text-gray-500 uppercase tracking-wide text-right pr-4">Credit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow className="border-gray-100">
                        <TableCell className="pl-4 py-3 text-sm text-gray-700">{selected.expenseAccount}</TableCell>
                        <TableCell className="text-right pr-4 py-3 text-sm text-gray-800 font-medium">{(selected.amount - selected.taxAmount).toFixed(2)}</TableCell>
                        <TableCell className="text-right pr-4 py-3 text-sm text-gray-400">0.00</TableCell>
                      </TableRow>
                      <TableRow className="border-gray-100">
                        <TableCell className="pl-4 py-3 text-sm text-gray-700">{selected.paidThrough}</TableCell>
                        <TableCell className="text-right pr-4 py-3 text-sm text-gray-400">0.00</TableCell>
                        <TableCell className="text-right pr-4 py-3 text-sm text-gray-800 font-medium">{selected.amount.toFixed(2)}</TableCell>
                      </TableRow>
                      <TableRow className="border-gray-100">
                        <TableCell className="pl-4 py-3 text-sm text-gray-700">Input SGST</TableCell>
                        <TableCell className="text-right pr-4 py-3 text-sm text-gray-800 font-medium">{(selected.taxAmount / 2).toFixed(2)}</TableCell>
                        <TableCell className="text-right pr-4 py-3 text-sm text-gray-400">0.00</TableCell>
                      </TableRow>
                      <TableRow className="border-gray-100">
                        <TableCell className="pl-4 py-3 text-sm text-gray-700">Input CGST</TableCell>
                        <TableCell className="text-right pr-4 py-3 text-sm text-gray-800 font-medium">{(selected.taxAmount / 2).toFixed(2)}</TableCell>
                        <TableCell className="text-right pr-4 py-3 text-sm text-gray-400">0.00</TableCell>
                      </TableRow>
                      <TableRow className="bg-gray-50 border-gray-200">
                        <TableCell className="pl-4 py-3 text-sm font-bold text-gray-900">Total</TableCell>
                        <TableCell className="text-right pr-4 py-3 text-sm font-bold text-gray-900">{selected.amount.toFixed(2)}</TableCell>
                        <TableCell className="text-right pr-4 py-3 text-sm font-bold text-gray-900">{selected.amount.toFixed(2)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
