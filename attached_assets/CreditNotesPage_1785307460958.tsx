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
import { useData } from "@/contexts/DataContext";
import { toast } from "@/hooks/use-toast";
import { safeReadJson } from "@/lib/utils";
import { nextSequentialCode } from "@/lib/documentNumbering";
import {
  FileText,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Plus,
  ReceiptIndianRupee,
  X,
} from "lucide-react";

type Reason =
  | "Sales Return"
  | "Post Sale Discount"
  | "Deficiency in service"
  | "Correction in invoice"
  | "Change in POS"
  | "Finalization of Provisional assessment"
  | "Others";

type CreditStatus = "draft" | "open";

interface CreditItem {
  itemName: string;
  account: string;
  description: string;
  hsnSac: string;
  quantity: number;
  rate: number;
  discount: number;
  taxRate: number;
}

interface CreditNoteEntry {
  id: string;
  creditNoteNumber: string;
  referenceNumber: string;
  customerName: string;
  customerAddress: string;
  customerGstin: string;
  invoiceNumber: string;
  invoiceDate: string;
  issueDate: string;
  reason: Reason;
  placeOfSupply: string;
  status: CreditStatus;
  item: CreditItem;
  shippingCharges: number;
  adjustment: number;
  subtotal: number;
  total: number;
  creditsRemaining: number;
  totalInWords: string;
  notes: string;
  terms: string;
  taxMode: "tds" | "tcs";
}

const STORAGE_KEY = "nido_credit_notes_v3";

const reasons: Reason[] = [
  "Sales Return",
  "Post Sale Discount",
  "Deficiency in service",
  "Correction in invoice",
  "Change in POS",
  "Finalization of Provisional assessment",
  "Others",
];

const today = () => new Date().toISOString().slice(0, 10);

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const numberToWords = (value: number) => {
  const units = [
    "Zero",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  const convert = (num: number): string => {
    if (num < 20) return units[num];
    if (num < 100)
      return `${tens[Math.floor(num / 10)]}${num % 10 ? ` ${units[num % 10]}` : ""}`;
    if (num < 1000) {
      const rem = num % 100;
      return `${units[Math.floor(num / 100)]} Hundred${rem ? ` ${convert(rem)}` : ""}`;
    }
    if (num < 100000) {
      const rem = num % 1000;
      return `${convert(Math.floor(num / 1000))} Thousand${rem ? ` ${convert(rem)}` : ""}`;
    }
    return String(num);
  };

  return `Indian Rupee ${convert(Math.max(0, Math.round(value)))} Only`;
};

const computeTotals = (
  item: CreditItem,
  shippingCharges: number,
  adjustment: number,
) => {
  const base = Math.max(0, item.quantity * item.rate - item.discount);
  const total = Math.round((base + shippingCharges + adjustment) * 100) / 100;
  return {
    subtotal: Math.round(base * 100) / 100,
    total,
    creditsRemaining: total,
    totalInWords: numberToWords(total),
  };
};

const defaultNotes: CreditNoteEntry[] = [
  {
    id: "cn-1",
    creditNoteNumber: "CN-God-00002",
    referenceNumber: "142012681",
    customerName: "Godrej & Boyce",
    customerAddress:
      "Godrej & Boyce Mfg. Co. Ltd.\nMADKAI\nD6 MADKAI INDUSTRIAL ESTATE\nPonda\n403404 Goa\nIndia",
    customerGstin: "30AAACG1395D1Z7",
    invoiceNumber: "18/GB/050715",
    invoiceDate: "2018-12-02",
    issueDate: "2019-11-07",
    reason: "Sales Return",
    placeOfSupply: "Goa (30)",
    status: "draft",
    item: {
      itemName: "MRT-113-24-G1",
      account: "Sales",
      description: "Gauge Manufacturing & Inspection",
      hsnSac: "90173021",
      quantity: 1,
      rate: 3380,
      discount: 0,
      taxRate: 0,
    },
    shippingCharges: 0,
    adjustment: 0,
    subtotal: 3380,
    total: 3380,
    creditsRemaining: 3380,
    totalInWords: "Indian Rupee Three Thousand Three Hundred Eighty Only",
    notes: "1. Clarification will be made on the post quality check mutually.",
    terms:
      "1. As per the debit note, credit note raised for the correction of the product.\n2. Quality check will be made as on F2F on the dated supply, post confirmation by mutual understanding.\n3. Price mentioned are excluding Taxes.",
    taxMode: "tds",
  },
  {
    id: "cn-2",
    creditNoteNumber: "CN-God-00006",
    referenceNumber: "142012684",
    customerName: "Godrej & Boyce",
    customerAddress:
      "Godrej & Boyce Mfg. Co. Ltd.\nMADKAI\nD6 MADKAI INDUSTRIAL ESTATE\nPonda\n403404 Goa\nIndia",
    customerGstin: "30AAACG1395D1Z7",
    invoiceNumber: "INV-18/GB/050761",
    invoiceDate: "2019-11-07",
    issueDate: "2019-11-07",
    reason: "Sales Return",
    placeOfSupply: "Goa (30)",
    status: "draft",
    item: {
      itemName: "MRT-113-24-G1",
      account: "Sales",
      description: "Gauge Manufacturing & Inspection",
      hsnSac: "90173021",
      quantity: 1,
      rate: 3380,
      discount: 0,
      taxRate: 0,
    },
    shippingCharges: 0,
    adjustment: 0,
    subtotal: 3380,
    total: 3380,
    creditsRemaining: 3380,
    totalInWords: "Indian Rupee Three Thousand Three Hundred Eighty Only",
    notes: "1. Clarification will be made on the post quality check mutually.",
    terms:
      "1. As per the debit note, credit note raised for the correction of the product.\n2. Quality check will be made as on F2F on the dated supply, post confirmation by mutual understanding.\n3. Price mentioned are excluding Taxes.",
    taxMode: "tds",
  },
];

const normalize = (entry: Partial<CreditNoteEntry>): CreditNoteEntry => {
  const item: CreditItem = {
    itemName: entry.item?.itemName || "",
    account: entry.item?.account || "Sales",
    description: entry.item?.description || "",
    hsnSac: entry.item?.hsnSac || "",
    quantity: toNumber(entry.item?.quantity, 1),
    rate: toNumber(entry.item?.rate, 0),
    discount: toNumber(entry.item?.discount, 0),
    taxRate: toNumber(entry.item?.taxRate, 0),
  };
  const shippingCharges = toNumber(entry.shippingCharges, 0);
  const adjustment = toNumber(entry.adjustment, 0);
  const computed = computeTotals(item, shippingCharges, adjustment);

  return {
    ...defaultNotes[0],
    ...entry,
    item,
    shippingCharges,
    adjustment,
    subtotal: toNumber(entry.subtotal, computed.subtotal),
    total: toNumber(entry.total, computed.total),
    creditsRemaining: toNumber(
      entry.creditsRemaining,
      computed.creditsRemaining,
    ),
    totalInWords: entry.totalInWords || computed.totalInWords,
    status: entry.status === "open" ? "open" : "draft",
    taxMode: entry.taxMode === "tcs" ? "tcs" : "tds",
  };
};

function CreditNoteDocument({
  note,
  companyLogoUrl,
}: {
  note: CreditNoteEntry;
  companyLogoUrl?: string;
}) {
  return (
    <div className="relative mx-auto w-[794px] border border-slate-200 bg-white px-8 py-8 text-slate-900">
      {note.status === "draft" && (
        <div className="pointer-events-none absolute left-0 top-0 z-10 -translate-x-8 translate-y-5 -rotate-45 bg-slate-400 px-10 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-white">
          Draft
        </div>
      )}

      <div className="flex items-start justify-between gap-8">
        <div>
          {companyLogoUrl ? (
            <div className="flex h-24 w-40 items-center justify-center overflow-hidden">
              <img
                src={companyLogoUrl}
                alt="Nido Technologies logo"
                className="h-full w-full object-contain"
              />
            </div>
          ) : (
            <div className="flex h-24 w-40 items-center justify-center rounded border border-slate-200 bg-white">
              <span className="text-xs font-semibold tracking-[0.35em]">
                NT
              </span>
            </div>
          )}
          <div className="mt-3 text-[11px] leading-5 text-slate-700">
            <p className="font-semibold text-slate-900">Nido Technologies</p>
            <p>No. 41/1, 2nd Floor, 10th Cross,</p>
            <p>11th Main, Wilsongarden,</p>
            <p>Bangalore Karnataka 560027</p>
            <p>India</p>
            <p>GSTIN 29BPAPP1867G1ZN</p>
          </div>
        </div>

        <div className="text-right">
          <h2 className="text-5xl font-serif leading-none">Credit Note</h2>
          <p className="mt-2 text-sm font-semibold">
            # {note.creditNoteNumber}
          </p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Credits Remaining
          </p>
          <p className="text-2xl font-semibold">
            Rs.{note.creditsRemaining.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-[1fr_240px] text-[12px]">
        <div>
          <p className="font-semibold">Bill To</p>
          <p className="mt-1 font-semibold text-blue-700">
            {note.customerName}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-slate-700">
            {note.customerAddress}
          </p>
          <p className="mt-1 text-slate-700">GSTIN {note.customerGstin}</p>
          <p className="mt-3 text-slate-700">
            Place Of Supply: {note.placeOfSupply}
          </p>
        </div>

        <div className="space-y-2 text-slate-700">
          <p>
            <span className="font-semibold">Credit Date :</span>{" "}
            {note.issueDate}
          </p>
          <p>
            <span className="font-semibold">Ref# :</span> {note.referenceNumber}
          </p>
          <p>
            <span className="font-semibold">Invoice# :</span>{" "}
            {note.invoiceNumber || "-"}
          </p>
          <p>
            <span className="font-semibold">Invoice Date :</span>{" "}
            {note.invoiceDate || "-"}
          </p>
        </div>
      </div>

      <div className="mt-6 overflow-hidden border border-slate-300">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-800 hover:bg-slate-800">
              <TableHead className="w-10 text-white">#</TableHead>
              <TableHead className="text-white">Item & Description</TableHead>
              <TableHead className="w-20 text-white">HSN/SAC</TableHead>
              <TableHead className="w-16 text-white text-right">Qty</TableHead>
              <TableHead className="w-20 text-white text-right">Rate</TableHead>
              <TableHead className="w-24 text-white text-right">
                Amount
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>1</TableCell>
              <TableCell>
                <p className="font-medium">{note.item.itemName}</p>
                <p className="text-xs text-slate-500">
                  {note.item.description}
                </p>
              </TableCell>
              <TableCell>{note.item.hsnSac || "-"}</TableCell>
              <TableCell className="text-right">
                {note.item.quantity.toFixed(2)}
              </TableCell>
              <TableCell className="text-right">
                {note.item.rate.toFixed(2)}
              </TableCell>
              <TableCell className="text-right">
                {note.subtotal.toFixed(2)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div className="mt-5 ml-auto w-full max-w-[290px] space-y-2 text-[12px]">
        <div className="flex items-center justify-between">
          <span>Sub Total</span>
          <span>{note.subtotal.toFixed(2)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between bg-slate-100 px-3 py-2 font-semibold">
          <span>Total</span>
          <span>Rs.{note.total.toFixed(2)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between bg-slate-100 px-3 py-2 font-semibold">
          <span>Credits Remaining</span>
          <span>Rs.{note.creditsRemaining.toFixed(2)}</span>
        </div>
      </div>

      <div className="mt-3 flex justify-end text-[12px]">
        <span className="mr-2">Total In Words:</span>
        <span className="font-semibold italic">{note.totalInWords}</span>
      </div>

      <div className="mt-8 text-[12px]">
        <p className="font-semibold">Notes</p>
        <p className="mt-1 whitespace-pre-wrap text-slate-700">{note.notes}</p>
      </div>

      <div className="mt-6 text-[12px]">
        <p className="font-semibold">Terms & Conditions</p>
        <p className="mt-1 whitespace-pre-wrap text-slate-700">{note.terms}</p>
      </div>

      <div className="mt-8 text-[12px]">
        Authorized Signature
        <div className="mt-1 h-px w-[340px] bg-slate-700" />
      </div>
    </div>
  );
}

export default function CreditNotesPage() {
  const { setMeta } = usePageMeta();
  useEffect(() => { setMeta({ title: "Credit Notes" }); }, []);

  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { clients, generalSettings } = useData();

  const createMode = location.pathname.endsWith("/create");
  const editMode = location.pathname.endsWith("/edit") && !!params.id;

  const [notes, setNotes] = useState<CreditNoteEntry[]>(() => {
    const stored = safeReadJson<CreditNoteEntry[]>(STORAGE_KEY, defaultNotes);
    const list = Array.isArray(stored) && stored.length ? stored : defaultNotes;
    return list.map((entry) => normalize(entry));
  });
  const [selectedId, setSelectedId] = useState(params.id || notes[0]?.id || "");
  const [open, setOpen] = useState(createMode);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreditNoteEntry>(() =>
    normalize(defaultNotes[0]),
  );
  const printRef = useRef<HTMLDivElement>(null);

  const companyLogoUrl = Object.values(generalSettings).find(
    (setting) => setting.companyLogo,
  )?.companyLogo;
  const creditNotePrefix =
    Object.values(generalSettings)[0]?.creditNotePrefix?.trim() || "CN";

  const persist = (next: CreditNoteEntry[]) => {
    setNotes(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  useEffect(() => {
    if (createMode) {
      setEditingId(null);
      const seed = normalize({
        ...defaultNotes[0],
        id: `cn-${Date.now()}`,
        issueDate: today(),
        creditNoteNumber: nextSequentialCode(
          creditNotePrefix,
          notes.map((entry) => entry.creditNoteNumber),
          5,
        ),
      });
      setForm(seed);
      setOpen(true);
    }
  }, [createMode, creditNotePrefix, notes]);

  useEffect(() => {
    if (!editMode) return;
    const target = notes.find((entry) => entry.id === params.id);
    if (!target) return;
    setEditingId(target.id);
    setForm(target);
    setOpen(true);
  }, [editMode, params.id, notes]);

  useEffect(() => {
    if (params.id) setSelectedId(params.id);
  }, [params.id]);

  const selected = useMemo(
    () => notes.find((entry) => entry.id === selectedId) || notes[0] || null,
    [notes, selectedId],
  );

  const computed = useMemo(
    () => computeTotals(form.item, form.shippingCharges, form.adjustment),
    [form.item, form.shippingCharges, form.adjustment],
  );

  const reactToPrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "Credit-Note",
    pageStyle:
      "@page { size: A4; margin: 12mm; } @media print { html, body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; } body * { visibility: hidden; } #cn-print-area, #cn-print-area * { visibility: visible; } #cn-print-area { position: absolute; top: 0; left: 0; width: 100%; background: white; } }",
  });

  const closeDialog = () => {
    setOpen(false);
    setEditingId(null);
    navigate("/sales/credit-notes", { replace: true });
  };

  const save = (status: CreditStatus) => {
    if (!form.customerName.trim()) {
      toast({ title: "Customer Name is required" });
      return;
    }

    const payload = normalize({
      ...form,
      status,
      subtotal: computed.subtotal,
      total: computed.total,
      creditsRemaining: computed.creditsRemaining,
      totalInWords: computed.totalInWords,
    });

    if (editingId) {
      persist(
        notes.map((entry) =>
          entry.id === editingId ? { ...payload, id: editingId } : entry,
        ),
      );
      setSelectedId(editingId);
      toast({ title: "Credit note updated" });
      closeDialog();
      return;
    }

    const created = { ...payload, id: `cn-${Date.now()}` };
    persist([created, ...notes]);
    setSelectedId(created.id);
    toast({ title: "Credit note created" });
    closeDialog();
  };

  const convertToOpen = () => {
    if (!selected) return;
    persist(
      notes.map((entry) =>
        entry.id === selected.id ? { ...entry, status: "open" } : entry,
      ),
    );
    toast({ title: "Credit note converted to open" });
  };

  const bindCustomer = (name: string) => {
    const match = clients.find((entry) => entry.name === name);
    setForm((current) =>
      normalize({
        ...current,
        customerName: name,
        customerAddress:
          match?.locationDetails?.address ||
          match?.address ||
          current.customerAddress,
        customerGstin: match?.gst || current.customerGstin,
        placeOfSupply: match?.locationDetails?.state || current.placeOfSupply,
      }),
    );
  };

  return (
    <div>
            <div className="space-y-4 p-6">
        <Card>
          <CardContent className="flex items-center justify-between pt-6">
            <h2 className="text-lg font-semibold">All Credit Notes</h2>
            <div className="flex items-center gap-2">
              <Button onClick={() => navigate("/sales/credit-notes/create")}>
                <Plus className="mr-2 h-4 w-4" /> New
              </Button>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="h-4 w-4" />
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
                  <TableHead>Date</TableHead>
                  <TableHead>Credit Note#</TableHead>
                  <TableHead>Reference Number</TableHead>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Invoice#</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notes.map((note) => (
                  <TableRow
                    key={note.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setSelectedId(note.id);
                      navigate(`/sales/credit-notes/${note.id}`);
                    }}
                  >
                    <TableCell>
                      <Checkbox checked={false} />
                    </TableCell>
                    <TableCell>{note.issueDate}</TableCell>
                    <TableCell className="font-medium text-primary">
                      {note.creditNoteNumber}
                    </TableCell>
                    <TableCell>{note.referenceNumber}</TableCell>
                    <TableCell>{note.customerName}</TableCell>
                    <TableCell>{note.invoiceNumber || "-"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          note.status === "open" ? "default" : "secondary"
                        }
                      >
                        {note.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      Rs.{note.total.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {selected && (
          <Card>
            <CardContent className="pt-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-2xl font-semibold">
                  {selected.creditNoteNumber}
                </h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      navigate(`/sales/credit-notes/${selected.id}/edit`)
                    }
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => toast({ title: "Email flow queued" })}
                  >
                    <Mail className="mr-2 h-4 w-4" /> Email
                  </Button>
                  <Button variant="outline" onClick={reactToPrint}>
                    <FileText className="mr-2 h-4 w-4" /> PDF/Print
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => toast({ title: "Refund flow is available" })}
                  >
                    <ReceiptIndianRupee className="mr-2 h-4 w-4" /> Refund
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={convertToOpen}>
                        Convert to Open
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      navigate("/sales/credit-notes", { replace: true })
                    }
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              <div className="mb-4 rounded-lg border bg-muted/20 p-3 text-sm">
                <p className="font-semibold">WHAT'S NEXT?</p>
                <p className="text-muted-foreground">
                  Go ahead and email this credit note to your customer or simply
                  convert it to open.
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => toast({ title: "Credit note send queued" })}
                  >
                    Send Credit Note
                  </Button>
                  <Button size="sm" variant="outline" onClick={convertToOpen}>
                    Convert to Open
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border bg-white p-2">
                <CreditNoteDocument
                  note={selected}
                  companyLogoUrl={companyLogoUrl}
                />
              </div>

              <div className="mt-5 text-sm">
                <p className="font-semibold">More Information</p>
                <p className="mt-1 text-muted-foreground">
                  Associated Invoice : {selected.invoiceNumber || "-"}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog
        open={open}
        onOpenChange={(isOpen) => (!isOpen ? closeDialog() : setOpen(isOpen))}
      >
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Credit Note</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Customer Name*</Label>
                <Select value={form.customerName} onValueChange={bindCustomer}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select or add a customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.name}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Reason</Label>
                <Select
                  value={form.reason}
                  onValueChange={(value: Reason) =>
                    setForm((current) => ({ ...current, reason: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {reasons.map((reason) => (
                      <SelectItem key={reason} value={reason}>
                        {reason}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Credit Note#*</Label>
                <Input
                  value={form.creditNoteNumber}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      creditNoteNumber: event.target.value,
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
                <Label>Credit Note Date*</Label>
                <Input
                  type="date"
                  value={form.issueDate}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      issueDate: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="rounded-xl border bg-white">
              <div className="border-b px-4 py-3">
                <p className="font-semibold">Item Table</p>
              </div>
              <div className="grid gap-4 p-4 lg:grid-cols-[1fr_360px]">
                <div>
                  <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr]">
                    <Input
                      placeholder="Type or click to select an item"
                      value={form.item.itemName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          item: {
                            ...current.item,
                            itemName: event.target.value,
                          },
                        }))
                      }
                    />
                    <Input
                      placeholder="Account"
                      value={form.item.account}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          item: {
                            ...current.item,
                            account: event.target.value,
                          },
                        }))
                      }
                    />
                    <Input
                      type="number"
                      value={form.item.quantity}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          item: {
                            ...current.item,
                            quantity: toNumber(event.target.value, 1),
                          },
                        }))
                      }
                    />
                    <Input
                      type="number"
                      value={form.item.rate}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          item: {
                            ...current.item,
                            rate: toNumber(event.target.value),
                          },
                        }))
                      }
                    />
                    <Input
                      type="number"
                      value={form.item.discount}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          item: {
                            ...current.item,
                            discount: toNumber(event.target.value),
                          },
                        }))
                      }
                    />
                    <Input
                      type="number"
                      value={form.item.taxRate}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          item: {
                            ...current.item,
                            taxRate: toNumber(event.target.value),
                          },
                        }))
                      }
                    />
                    <Input
                      readOnly
                      value={computed.total.toFixed(2)}
                      className="text-right"
                    />
                  </div>
                  <Input
                    className="mt-3"
                    placeholder="Description"
                    value={form.item.description}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        item: {
                          ...current.item,
                          description: event.target.value,
                        },
                      }))
                    }
                  />
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toast({ title: "Row added" })}
                    >
                      + Add New Row
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        toast({ title: "Bulk item import opened" })
                      }
                    >
                      + Add Items in Bulk
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/20 p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span>Sub Total</span>
                    <span>{computed.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span>Shipping Charges</span>
                    <Input
                      className="w-28 text-right"
                      type="number"
                      value={form.shippingCharges}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          shippingCharges: toNumber(event.target.value),
                        }))
                      }
                    />
                  </div>
                  <div className="mt-2 flex items-center gap-5">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={form.taxMode === "tds"}
                        onChange={() =>
                          setForm((current) => ({ ...current, taxMode: "tds" }))
                        }
                      />
                      TDS
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={form.taxMode === "tcs"}
                        onChange={() =>
                          setForm((current) => ({ ...current, taxMode: "tcs" }))
                        }
                      />
                      TCS
                    </label>
                    <Input className="w-32" placeholder="Select a Tax" />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span>Adjustment</span>
                    <Input
                      className="w-28 text-right"
                      type="number"
                      value={form.adjustment}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          adjustment: toNumber(event.target.value),
                        }))
                      }
                    />
                  </div>
                  <div className="mt-4 border-t pt-3 text-base font-semibold">
                    <div className="flex items-center justify-between">
                      <span>Total (Rs)</span>
                      <span>{computed.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <Label>Customer Notes</Label>
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

            <div>
              <Label>Terms & Conditions</Label>
              <Textarea
                value={form.terms}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    terms: event.target.value,
                  }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                PDF Template: Spreadsheet Template
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => save("draft")}>
                  Save as Draft
                </Button>
                <Button onClick={() => save("open")}>Save as Open</Button>
                <Button variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="fixed left-[-10000px] top-0 w-[794px] bg-white">
        <div ref={printRef} id="cn-print-area">
          {selected ? (
            <CreditNoteDocument
              note={selected}
              companyLogoUrl={companyLogoUrl}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
