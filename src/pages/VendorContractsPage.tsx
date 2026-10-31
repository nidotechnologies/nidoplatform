import { useState, useRef, useEffect, type ReactNode } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  FileText, CheckCircle, Clock, IndianRupee, RefreshCcw,
  MoreVertical, Eye, ChevronDown, ChevronLeft, ChevronRight,
  X, Download, Archive, Pencil, Check, ArrowLeft, CalendarDays,
  Mail, MapPin, Phone, ShieldCheck, Database, Bell, Headphones,
  User, AlertTriangle, Plus, Upload, Calendar, Receipt, Scale,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { hasVendorScope, type VendorScope } from "@/lib/vendorScope";
import { getVendorById, getVendors, type StoredVendor } from "@/lib/vendorDataStore";
import VendorContractsList, {
  type VendorContractBasics,
} from "@/pages/VendorContractsList";

/* ─── Types ────────────────────────────────────────────────────────────── */
type ContractStatus = "Active" | "Expired" | "Expiring Soon" | "Archived";
type ContractType = "Supply Agreement" | "SLA" | "NDA" | "AMC" | "Framework";

interface Contract {
  id: string; name: string; type: ContractType;
  startDate: string; endDate: string; value: string; paymentTerms: string;
  status: ContractStatus; autoRenewal: boolean; renewalReminder: string; expiryIn: string | null;
  contacts: { owner: string; vendor: string; vendorPhone: string; procurement: string; procurementPhone: string };
  terms: { priceValidity: string; deliveryTerm: string; warrantyPeriod: string; slaUptime: string; penaltyClause: string; governingLaw: string };
  details?: Record<string, string>;
}

/* ─── Static data ───────────────────────────────────────────────────────── */
const CONTRACTS: Contract[] = [
  { id: "CT-2025-001", name: "IT Hardware Supply Agreement 2025", type: "Supply Agreement", startDate: "Jan 01, 2025", endDate: "Dec 31, 2026", value: "₹8,00,00,000", paymentTerms: "Net 30", status: "Active", autoRenewal: true, renewalReminder: "60 Days Before Expiry", expiryIn: "252 Days", contacts: { owner: "Pavan (System Owner)", vendor: "Rahul Sharma", vendorPhone: "+91 98765 43210", procurement: "Sneha Iyer", procurementPhone: "+91 98740 11122" }, terms: { priceValidity: "Till Dec 31, 2026", deliveryTerm: "FOB - Destination", warrantyPeriod: "3 Years Onsite", slaUptime: "99.5%", penaltyClause: "Applicable", governingLaw: "Karnataka, India" } },
  { id: "CT-2024-001", name: "Service Level Agreement 2024", type: "SLA", startDate: "Mar 01, 2024", endDate: "Feb 28, 2025", value: "₹2,00,00,000", paymentTerms: "Net 30", status: "Active", autoRenewal: false, renewalReminder: "30 Days Before Expiry", expiryIn: null, contacts: { owner: "Pavan (System Owner)", vendor: "Ravi Kumar", vendorPhone: "+91 99887 66554", procurement: "Anita Desai", procurementPhone: "+91 87654 32100" }, terms: { priceValidity: "Till Feb 28, 2025", deliveryTerm: "Ex-Works", warrantyPeriod: "1 Year", slaUptime: "99.0%", penaltyClause: "Applicable", governingLaw: "Maharashtra, India" } },
  { id: "CT-2023-001", name: "NDA Agreement", type: "NDA", startDate: "Feb 10, 2023", endDate: "Feb 09, 2026", value: "₹80,00,000", paymentTerms: "Net 30", status: "Expired", autoRenewal: false, renewalReminder: "30 Days Before Expiry", expiryIn: null, contacts: { owner: "Pavan (System Owner)", vendor: "Meena Pillai", vendorPhone: "+91 91234 56789", procurement: "Kartik Rao", procurementPhone: "+91 90000 12345" }, terms: { priceValidity: "Till Feb 09, 2026", deliveryTerm: "N/A", warrantyPeriod: "N/A", slaUptime: "N/A", penaltyClause: "Not Applicable", governingLaw: "Karnataka, India" } },
];

const ARCHIVED_CONTRACTS: Contract[] = [
  { id: "CT-2022-001", name: "Hardware Maintenance Contract 2022", type: "AMC", startDate: "Jan 15, 2022", endDate: "Jan 14, 2023", value: "₹45,00,000", paymentTerms: "Net 45", status: "Archived", autoRenewal: false, renewalReminder: "30 Days Before Expiry", expiryIn: null, contacts: { owner: "Pavan (System Owner)", vendor: "Suresh Nair", vendorPhone: "+91 98001 23456", procurement: "Divya Menon", procurementPhone: "+91 87001 23456" }, terms: { priceValidity: "Till Jan 14, 2023", deliveryTerm: "Onsite", warrantyPeriod: "1 Year", slaUptime: "98.0%", penaltyClause: "Applicable", governingLaw: "Kerala, India" } },
  { id: "CT-2021-001", name: "Framework Agreement 2021", type: "Framework", startDate: "Apr 01, 2021", endDate: "Mar 31, 2022", value: "₹1,20,00,000", paymentTerms: "Net 60", status: "Archived", autoRenewal: false, renewalReminder: "45 Days Before Expiry", expiryIn: null, contacts: { owner: "Pavan (System Owner)", vendor: "Arjun Das", vendorPhone: "+91 97001 23456", procurement: "Priya Sharma", procurementPhone: "+91 86001 23456" }, terms: { priceValidity: "Till Mar 31, 2022", deliveryTerm: "CIF", warrantyPeriod: "2 Years", slaUptime: "98.5%", penaltyClause: "Applicable", governingLaw: "Delhi, India" } },
];

/* ─── Dropdown options ──────────────────────────────────────────────────── */
const CONTRACT_TYPES = ["Supply Agreement", "Service Agreement", "SLA (Service Level Agreement)", "NDA (Non-Disclosure Agreement)", "Purchase Agreement", "Maintenance Agreement", "Reseller Agreement", "Other"];
const CATEGORIES = ["IT Hardware", "IT Software", "Networking", "Cloud Services", "Peripherals", "Accessories", "Services", "Consulting", "Other"];
const DELIVERY_TERMS = ["FOB - Origin", "FOB - Destination", "CIF", "DDP (Delivered Duty Paid)", "DAP (Delivered at Place)", "EXW (Ex Works)", "Other"];
const WARRANTY_PERIODS = ["No Warranty", "3 Months", "6 Months", "1 Year", "2 Years", "3 Years", "5 Years", "Custom"];
const PENALTY_CLAUSES = ["Standard Penalty", "Liquidated Damages", "Service Credit", "Termination Right", "Custom"];
const GOVERNING_LAWS = ["India", "United States", "United Kingdom", "Singapore", "Germany", "Other"];
const CONFIDENTIALITY = ["Public", "Internal", "Confidential", "Highly Confidential"];
const CURRENCIES = ["INR - Indian Rupee", "USD - US Dollar", "EUR - Euro", "GBP - British Pound", "SGD - Singapore Dollar", "AED - UAE Dirham", "Other"];
const PAYMENT_METHODS = ["Bank Transfer", "Cheque", "NEFT", "RTGS", "UPI", "Credit Card", "Other"];
const TAX_TREATMENTS = ["Taxable (With GST)", "Taxable (Without GST)", "Exempt", "Zero Rated"];
const PAYMENT_TERMS_LIST = ["Net 15", "Net 30", "Net 45", "Net 60", "Advance", "Immediate"];
const RENEWAL_REMINDERS = ["30 Days Before Expiry", "45 Days Before Expiry", "60 Days Before Expiry", "90 Days Before Expiry", "Custom"];
const OWNERS = ["Pavan (System Owner)", "Sneha Iyer", "Amit Kumar", "Neha Kapoor", "Menci Patel", "Vikram Singh", "Other"];
const VENDOR_CONTACTS = ["Rahul Sharma", "Amit Kumar", "Priya Nair", "Neha Kapoor", "Menci Patel", "Other"];
const PROCUREMENT_HEADS = ["Pavan (System Owner)", "Sneha Iyer", "Amit Verma", "Neha Kapoor", "Vikram Singh", "Other"];

/* ─── Style maps ───────────────────────────────────────────────────────── */
const STATUS_STYLES: Record<ContractStatus, string> = {
  Active: "bg-green-100 text-green-700",
  Expired: "bg-red-100 text-red-600",
  "Expiring Soon": "bg-orange-100 text-orange-600",
  Archived: "bg-gray-100 text-gray-500",
};
const TYPE_STYLES: Record<ContractType, string> = {
  "Supply Agreement": "bg-blue-100 text-blue-700",
  SLA: "bg-purple-100 text-purple-700",
  NDA: "bg-cyan-100 text-cyan-700",
  AMC: "bg-yellow-100 text-yellow-700",
  Framework: "bg-indigo-100 text-indigo-700",
};

/* ─── Helper components ─────────────────────────────────────────────────── */
function SelectField({ label, options, value, onChange, placeholder, required }: {
  label: string; options: string[]; value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-600">{label}{required && <span className="text-red-400 ml-0.5">*</span>}</label>
      <div className="relative">
        <select value={value} onChange={e => onChange(e.target.value)}
          className="w-full appearance-none border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white pr-9 h-[40px]">
          {placeholder && <option value="">{placeholder}</option>}
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>
    </div>
  );
}

function InputField({ label, placeholder, value, onChange, required, type = "text", autoGen }: {
  label: string; placeholder?: string; value: string; onChange: (v: string) => void;
  required?: boolean; type?: string; autoGen?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-600">{label}{required && <span className="text-red-400 ml-0.5">*</span>}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={autoGen ? "Auto-generated" : placeholder}
        className={`w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm h-[40px] focus:outline-none focus:ring-2 focus:ring-blue-500 ${autoGen ? "bg-gray-50 text-gray-400 italic" : "bg-white text-gray-700 placeholder:text-gray-400"}`} />
    </div>
  );
}

function SectionHeader({ num, title }: { num: number; title: string }) {
  return (
    <div className="flex items-center gap-3 pb-3 mb-4 border-b border-gray-100">
      <span className="w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center flex-shrink-0 shadow-sm">{num}</span>
      <h3 className="text-base font-semibold text-gray-800">{title}</h3>
    </div>
  );
}

/* ─── Add / Edit Contract full page ────────────────────────────────────── */
function AddContractPage({ onCancel, contract, onSave, vendor }: {
  onCancel: () => void;
  contract?: Contract;
  onSave: (c: Contract) => void;
  vendor?: StoredVendor;
}) {
  const isEdit = !!contract;
  const displayedVendorName = vendor?.name || contract?.contacts.vendor || "Vendor";

  const [form, setForm] = useState({
    contractName: contract?.name ?? "",
    contractId: contract?.id ?? "",
    contractType: contract?.type ?? "",
    category: "",
    startDate: contract?.startDate ?? "",
    endDate: contract?.endDate ?? "",
    contractValue: contract?.value ? contract.value.replace(/[₹,]/g, "") : "",
    paymentTerms: contract?.paymentTerms ?? "",
    renewal: contract?.autoRenewal ?? false,
    renewalReminder: contract?.renewalReminder ?? "",
    daysBeforeExpiry: "60",
    slaUptime: contract?.terms.slaUptime ? contract.terms.slaUptime.replace("%", "") : "99.5",
    deliveryTerm: contract?.terms.deliveryTerm ?? "",
    warrantyPeriod: contract?.terms.warrantyPeriod ?? "",
    penaltyClause: contract?.terms.penaltyClause ?? "",
    governingLaw: contract?.terms.governingLaw ?? "",
    confidentiality: "",
    currency: "INR - Indian Rupee",
    paymentMethod: "",
    taxTreatment: "",
    creditLimit: "0.00",
    availableCredit: "0.00",
    contractScope: "",
    exclusions: "",
    internalNotes: "",
    contractOwner: contract?.contacts.owner ?? "",
    vendorContact: contract?.contacts.vendor ?? vendor?.primaryContact ?? "",
    procurementHead: contract?.contacts.procurement ?? "",
    documents: [] as string[],
  });
  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    const updated: Contract = {
      id: form.contractId || contract?.id || `CT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999)).padStart(3, "0")}`,
      name: form.contractName || "Untitled Contract",
      type: (form.contractType as ContractType) || contract?.type || "Supply Agreement",
      startDate: form.startDate || contract?.startDate || "",
      endDate: form.endDate || contract?.endDate || "",
      value: form.contractValue ? `₹${Number(form.contractValue.replace(/,/g, "")).toLocaleString("en-IN")}` : contract?.value || "₹0",
      paymentTerms: form.paymentTerms || contract?.paymentTerms || "Net 30",
      status: contract?.status || "Active",
      autoRenewal: form.renewal,
      renewalReminder: form.renewalReminder || contract?.renewalReminder || "30 Days Before Expiry",
      expiryIn: contract?.expiryIn ?? null,
      contacts: {
        owner: form.contractOwner || contract?.contacts.owner || "",
        vendor: form.vendorContact || contract?.contacts.vendor || "",
        vendorPhone: contract?.contacts.vendorPhone || "",
        procurement: form.procurementHead || contract?.contacts.procurement || "",
        procurementPhone: contract?.contacts.procurementPhone || "",
      },
      terms: {
        priceValidity: contract?.terms.priceValidity || `Till ${form.endDate}`,
        deliveryTerm: form.deliveryTerm || contract?.terms.deliveryTerm || "",
        warrantyPeriod: form.warrantyPeriod || contract?.terms.warrantyPeriod || "",
        slaUptime: form.slaUptime ? `${form.slaUptime}%` : contract?.terms.slaUptime || "99.5%",
        penaltyClause: form.penaltyClause || contract?.terms.penaltyClause || "",
        governingLaw: form.governingLaw || contract?.terms.governingLaw || "",
      },
      details: { ...(contract?.details || {}) },
    };
    onSave(updated);
  };

  // Derived summary
  const summary = [
    { label: "Contract Type", value: form.contractType || "-" },
    { label: "Start Date", value: form.startDate || "-" },
    { label: "End Date", value: form.endDate || "-" },
    { label: "Contract Value", value: form.contractValue ? `₹${form.contractValue}` : "-" },
    { label: "Payment Terms", value: form.paymentTerms || "-" },
    { label: "Auto Renewal", value: form.renewal ? "Yes" : "-" },
    { label: "Status", value: isEdit ? (contract?.status ?? "Active") : "Draft", badge: true },
  ];

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Page header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 sm:px-6">
        <h1 className="text-xl font-bold text-gray-900">{isEdit ? "Edit Contract" : "Add Contract"}</h1>
        <p className="mt-0.5 text-sm text-gray-400">{isEdit ? `Editing ${contract?.id} — ${displayedVendorName}` : `Create a new contract for ${displayedVendorName}`}</p>
      </div>

      <div className="mx-auto w-full max-w-[1600px] space-y-5 px-4 py-4 sm:px-6">
        {/* Vendor card */}
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold text-white">{getVendorInitials(displayedVendorName)}</div>
            <div className="flex-1 flex items-start gap-2 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900">{displayedVendorName}</span>
                  {vendor?.status && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${vendor.status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{vendor.status}</span>}
                </div>
              </div>
              {[
                ["Vendor ID", vendor?.id || "—"],
                ["Category", vendor?.category || "—"],
                ["Primary Contact", vendor?.primaryContact || "—"],
              ].map(([l, v]) => (
                <div key={l}>
                  <p className="text-xs text-gray-400">{l}</p>
                  <p className="text-sm font-semibold text-gray-700">{v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Two-column: left = vertical sections, right = sidebar ── */}
        <div className="flex gap-2 items-start">

          {/* ── LEFT: all form sections stacked vertically ── */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* ① Contract Information */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <SectionHeader num={1} title="Contract Information" />
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <div className="col-span-2">
                  <InputField label="Contract Name" placeholder="Enter contract name" value={form.contractName} onChange={v => set("contractName", v)} required />
                </div>
                <InputField label="Contract ID" value={form.contractId} onChange={v => set("contractId", v)} required autoGen />
                <SelectField label="Contract Type" options={CONTRACT_TYPES} value={form.contractType} onChange={v => set("contractType", v)} placeholder="Select contract type" required />
                <SelectField label="Category" options={CATEGORIES} value={form.category} onChange={v => set("category", v)} placeholder="Select category" required />
                <div className="col-span-1" />
                <InputField label="Start Date" type="date" value={form.startDate} onChange={v => set("startDate", v)} required />
                <InputField label="End Date" type="date" value={form.endDate} onChange={v => set("endDate", v)} required />
                {/* Contract Value */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-600">Contract Value<span className="text-red-400 ml-0.5">*</span></label>
                  <div className="flex h-[40px]">
                    <div className="relative flex-shrink-0">
                      <select defaultValue="INR" className="appearance-none border border-gray-200 border-r-0 rounded-l-lg px-2 text-sm text-gray-600 bg-gray-50 pr-7 h-full focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option>INR</option><option>USD</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    </div>
                    <input value={form.contractValue} onChange={e => set("contractValue", e.target.value)} placeholder="0.00" className="flex-1 border border-gray-200 rounded-r-lg px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0" />
                  </div>
                </div>
                <SelectField label="Payment Terms" options={PAYMENT_TERMS_LIST} value={form.paymentTerms} onChange={v => set("paymentTerms", v)} placeholder="Select payment terms" required />
                {/* Renewal toggle */}
                <div className="flex items-center gap-3 pt-2">
                  <button type="button" onClick={() => set("renewal", !form.renewal)} className={`relative w-10 h-[22px] rounded-full transition-colors flex-shrink-0 ${form.renewal ? "bg-blue-600" : "bg-gray-200"}`}>
                    <span className={`absolute top-[3px] w-4 h-4 bg-white rounded-full shadow transition-transform ${form.renewal ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                  <span className="text-sm font-medium text-gray-700">Auto Renewal</span>
                </div>
                <div className="col-span-1" />
                <SelectField label="Renewal Reminder" options={RENEWAL_REMINDERS} value={form.renewalReminder} onChange={v => set("renewalReminder", v)} placeholder="Select reminder" />
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-600">Days Before Expiry</label>
                  <div className="flex items-center gap-2 h-[40px]">
                    <input value={form.daysBeforeExpiry} onChange={e => set("daysBeforeExpiry", e.target.value)} className="flex-1 border border-gray-200 rounded-lg px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-full" />
                    <span className="text-sm text-gray-400 whitespace-nowrap">days</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ② Terms & Conditions */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <SectionHeader num={2} title="Terms & Conditions" />
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-600">SLA Uptime (%)</label>
                  <div className="flex items-center gap-2 h-[40px]">
                    <input value={form.slaUptime} onChange={e => set("slaUptime", e.target.value)} className="flex-1 border border-gray-200 rounded-lg px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-full" />
                    <span className="text-sm font-medium text-gray-500">%</span>
                  </div>
                </div>
                <SelectField label="Delivery Term" options={DELIVERY_TERMS} value={form.deliveryTerm} onChange={v => set("deliveryTerm", v)} placeholder="Select delivery term" required />
                <SelectField label="Warranty Period" options={WARRANTY_PERIODS} value={form.warrantyPeriod} onChange={v => set("warrantyPeriod", v)} placeholder="Select warranty period" />
                <SelectField label="Penalty Clause" options={PENALTY_CLAUSES} value={form.penaltyClause} onChange={v => set("penaltyClause", v)} placeholder="Select penalty clause" />
                <SelectField label="Governing Law" options={GOVERNING_LAWS} value={form.governingLaw} onChange={v => set("governingLaw", v)} placeholder="Select governing law" />
                <SelectField label="Confidentiality" options={CONFIDENTIALITY} value={form.confidentiality} onChange={v => set("confidentiality", v)} placeholder="Select confidentiality level" />
              </div>
            </div>

            {/* ③ Financial Details */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <SectionHeader num={3} title="Financial Details" />
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <SelectField label="Currency" options={CURRENCIES} value={form.currency} onChange={v => set("currency", v)} required />
                <SelectField label="Payment Method" options={PAYMENT_METHODS} value={form.paymentMethod} onChange={v => set("paymentMethod", v)} placeholder="Select payment method" />
                <SelectField label="Tax Treatment" options={TAX_TREATMENTS} value={form.taxTreatment} onChange={v => set("taxTreatment", v)} placeholder="Select tax treatment" />
                <div className="col-span-1" />
                {/* Credit Limit */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-600">Credit Limit <span className="text-gray-400 font-normal text-xs">(Optional)</span></label>
                  <div className="flex h-[40px]">
                    <div className="relative flex-shrink-0">
                      <select defaultValue="INR" className="appearance-none border border-gray-200 border-r-0 rounded-l-lg px-2 text-sm text-gray-600 bg-gray-50 pr-7 h-full focus:outline-none">
                        <option>INR</option><option>USD</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    </div>
                    <input value={form.creditLimit} onChange={e => set("creditLimit", e.target.value)} className="flex-1 border border-gray-200 rounded-r-lg px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0" />
                  </div>
                </div>
                {/* Available Credit */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-600">Available Credit <span className="text-gray-400 font-normal text-xs">(Optional)</span></label>
                  <div className="flex h-[40px]">
                    <div className="relative flex-shrink-0">
                      <select defaultValue="INR" className="appearance-none border border-gray-200 border-r-0 rounded-l-lg px-2 text-sm text-gray-600 bg-gray-50 pr-7 h-full focus:outline-none">
                        <option>INR</option><option>USD</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    </div>
                    <input value={form.availableCredit} onChange={e => set("availableCredit", e.target.value)} className="flex-1 border border-gray-200 rounded-r-lg px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0" />
                  </div>
                </div>
                <div className="col-span-2 bg-blue-50 border border-blue-100 rounded-lg p-2 flex items-start gap-2">
                  <span className="text-blue-500 flex-shrink-0 text-sm mt-0.5">ℹ</span>
                  <span className="text-sm text-blue-700">Credit limit will be validated against vendor's approved credit.</span>
                </div>
              </div>
            </div>

            {/* ④ Scope of Work */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <SectionHeader num={4} title="Scope of Work" />
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-600">Contract Scope<span className="text-red-400 ml-0.5">*</span></label>
                  <textarea rows={5} value={form.contractScope} onChange={e => set("contractScope", e.target.value)} placeholder="Enter scope of work and deliverables" className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-600">Exclusions <span className="text-gray-400 font-normal text-xs">(Optional)</span></label>
                  <textarea rows={5} value={form.exclusions} onChange={e => set("exclusions", e.target.value)} placeholder="Enter exclusions or out-of-scope items" className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>
              </div>
            </div>

            {/* ⑥ Internal Notes */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <SectionHeader num={6} title="Internal Notes" />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-600">Notes <span className="text-gray-400 font-normal text-xs">(Visible internally only)</span></label>
                <textarea rows={4} value={form.internalNotes} onChange={e => set("internalNotes", e.target.value)} placeholder="Add any internal notes or comments about this contract" className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                <p className="text-xs text-gray-300 text-right mt-1">{form.internalNotes.length}/1000 characters</p>
              </div>
            </div>
          </div>

          {/* ── RIGHT: sidebar panels ── */}
          <div className="w-[310px] flex-shrink-0 space-y-5">

            {/* Contract Summary */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-base font-semibold text-gray-800 pb-3 mb-4 border-b border-gray-100">Contract Summary</h3>
              <div className="space-y-3">
                {summary.map(s => (
                  <div key={s.label} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-gray-400">{s.label}</span>
                    {s.badge
                      ? <span className="text-xs bg-gray-100 text-gray-600 font-semibold px-2.5 py-1 rounded-md">{s.value}</span>
                      : <span className="text-sm font-semibold text-gray-700 text-right">{s.value}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Key Contacts */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-base font-semibold text-gray-800 pb-3 mb-4 border-b border-gray-100">Key Contacts</h3>
              <div className="space-y-4">
                <SelectField label="Contract Owner" options={OWNERS} value={form.contractOwner} onChange={v => set("contractOwner", v)} placeholder="Select owner" required />
                <SelectField label="Vendor Contact" options={VENDOR_CONTACTS} value={form.vendorContact} onChange={v => set("vendorContact", v)} placeholder="Select vendor contact" required />
                <SelectField label="Procurement Head" options={PROCUREMENT_HEADS} value={form.procurementHead} onChange={v => set("procurementHead", v)} placeholder="Select head" />
              </div>
            </div>

            {/* Documents */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-base font-semibold text-gray-800 pb-3 mb-4 border-b border-gray-100">Documents</h3>
              <div className="border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center py-7 gap-2.5 cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors">
                <div className="w-11 h-11 bg-gray-100 rounded-xl flex items-center justify-center">
                  <FileText className="w-5 h-5 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-600 text-center leading-snug">Drag and drop files here<br /><span className="text-gray-400 font-normal">or click to upload</span></p>
                <p className="text-xs text-gray-400 text-center leading-snug">PDF, DOC, DOCX, XLS, XLSX · Max 10MB</p>
              </div>
              <button className="mt-3 w-full flex items-center justify-center gap-1.5 text-sm text-blue-600 font-medium hover:underline py-1.5">
                <Plus className="w-4 h-4" /> Add Document
              </button>
            </div>

            {/* ⑤ Attachments */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-base font-semibold text-gray-800 pb-3 mb-4 border-b border-gray-100 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">5</span>
                Attachments
              </h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-2 py-2.5 text-gray-500 font-semibold w-7">#</th>
                      <th className="text-left px-2 py-2.5 text-gray-500 font-semibold">Name</th>
                      <th className="text-left px-2 py-2.5 text-gray-500 font-semibold">Type</th>
                      <th className="text-left px-2 py-2.5 text-gray-500 font-semibold">Req.</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center">
                            <FileText className="w-5 h-5 text-gray-300" />
                          </div>
                          <p className="text-sm text-gray-400 font-medium">No attachments yet</p>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <button className="mt-3 flex items-center gap-1.5 text-sm text-blue-600 font-medium hover:underline py-1">
                <Plus className="w-4 h-4" /> Add Attachment
              </button>
            </div>
          </div>
        </div>

        {/* ── Bottom action bar ── */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm px-2 py-2 flex items-center justify-end gap-3">
          <button onClick={onCancel} className="px-6 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm">
            {isEdit ? "Save Changes" : "Save Contract"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Contract detail side panel ────────────────────────────────────────── */
function ContractPanel({ contract, onClose, readOnly = false }: { contract: Contract; onClose: () => void; readOnly?: boolean }) {
  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200 w-[380px] flex-shrink-0">
      <div className="px-5 pt-4 pb-0 border-b border-gray-100">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-900 text-base">{contract.id}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLES[contract.status]}`}>{contract.status}</span>
            {readOnly && <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-500">Read Only</span>}
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-gray-500 mb-3">{contract.name}</p>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-5">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-800">Contract Information</h3>
                {!readOnly && <button className="text-xs text-blue-600 border border-blue-200 px-2 py-0.5 rounded hover:bg-blue-50">Edit</button>}
              </div>
              <div className="space-y-2.5">
                {[{ label: "Contract Type", value: contract.type }, { label: "Start Date", value: contract.startDate }, { label: "End Date", value: contract.endDate }, { label: "Contract Value", value: contract.value }, { label: "Payment Terms", value: contract.paymentTerms }, { label: "Auto Renewal", value: contract.autoRenewal ? "Enabled" : "Disabled", green: contract.autoRenewal }, { label: "Renewal Reminder", value: contract.renewalReminder }, ...(contract.expiryIn ? [{ label: "Expiry In", value: contract.expiryIn, blue: true }] : [])].map(row => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{row.label}</span>
                    <span className={`text-xs font-semibold ${'green' in row && row.green ? "text-green-600" : 'blue' in row && row.blue ? "text-blue-600" : "text-gray-800"}`}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-gray-100" />
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-800">Key Contacts</h3>
                {!readOnly && <button className="text-xs text-blue-600 border border-blue-200 px-2 py-0.5 rounded hover:bg-blue-50">Edit</button>}
              </div>
              <div className="space-y-3">
                {[{ label: "Contract Owner", name: contract.contacts.owner, phone: "", bg: "bg-blue-100", ic: "text-blue-600" }, { label: "Vendor Contact", name: contract.contacts.vendor, phone: contract.contacts.vendorPhone, bg: "bg-green-100", ic: "text-green-600" }, { label: "Procurement Head", name: contract.contacts.procurement, phone: contract.contacts.procurementPhone, bg: "bg-purple-100", ic: "text-purple-600" }].map(c => (
                  <div key={c.label}>
                    <p className="text-xs text-gray-400 mb-1">{c.label}</p>
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full ${c.bg} flex items-center justify-center flex-shrink-0`}><User className={`w-3.5 h-3.5 ${c.ic}`} /></div>
                      <div><p className="text-xs font-semibold text-gray-700">{c.name}</p>{c.phone && <p className="text-xs text-gray-400">{c.phone}</p>}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-gray-100" />
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-800">Contract Terms (Summary)</h3>
                <button className="text-xs text-blue-600 hover:underline">View All</button>
              </div>
              <div className="space-y-2">
                {[{ label: "Price Validity", value: contract.terms.priceValidity }, { label: "Delivery Term", value: contract.terms.deliveryTerm }, { label: "Warranty Period", value: contract.terms.warrantyPeriod }, { label: "SLA Uptime", value: contract.terms.slaUptime }, { label: "Penalty Clause", value: contract.terms.penaltyClause }, { label: "Governing Law", value: contract.terms.governingLaw }].map(row => (
                  <div key={row.label} className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    <span className="text-xs text-gray-500 flex-1">{row.label}</span>
                    <span className="text-xs font-semibold text-gray-700">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
            {!readOnly && <button className="w-full flex items-center justify-center gap-2 py-2 border border-blue-200 rounded-lg text-blue-600 text-sm font-medium hover:bg-blue-50 transition-colors"><FileText className="w-4 h-4" /> View Full Contract</button>}
      </div>
    </div>
  );
}

/* ─── Archived modal ────────────────────────────────────────────────────── */
function ArchivedContractsModal({ onClose, contracts = ARCHIVED_CONTRACTS }: { onClose: () => void; contracts?: Contract[] }) {
  const [selected, setSelected] = useState<Contract | null>(null);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="mx-4 flex max-h-[85vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between px-2 py-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-gray-500" />
            <div><h2 className="text-base font-bold text-gray-900">Archived Contracts</h2><p className="text-xs text-gray-500">Read-only view of archived contracts</p></div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50/90 border-b border-gray-100">
                <tr>{["Contract ID", "Contract Name", "Type", "Start Date", "End Date", "Value", "Status"].map(h => <th key={h} className="text-left px-2 py-2 text-xs font-bold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {contracts.map(c => (
                  <tr key={c.id} onClick={() => setSelected(c)} className="hover:bg-gray-50 cursor-pointer transition-colors">
                    <td className="px-4 py-2 whitespace-nowrap"><span className="text-blue-600 font-semibold text-sm">{c.id}</span></td>
                    <td className="px-4 py-2 text-gray-700 text-sm">{c.name}</td>
                    <td className="px-4 py-2 whitespace-nowrap"><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${TYPE_STYLES[c.type]}`}>{c.type}</span></td>
                    <td className="px-4 py-2 whitespace-nowrap text-gray-500 text-sm">{c.startDate}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-gray-500 text-sm">{c.endDate}</td>
                    <td className="px-4 py-2 whitespace-nowrap font-semibold text-gray-700 text-sm">{c.value}</td>
                    <td className="px-4 py-2 whitespace-nowrap"><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLES[c.status]}`}>{c.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selected && (
            <div className="w-[360px] flex-shrink-0 border-l border-gray-200 overflow-hidden flex flex-col">
              <ContractPanel contract={selected} onClose={() => setSelected(null)} readOnly />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Dropdown hook ─────────────────────────────────────────────────────── */
function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);
  return { open, setOpen, ref };
}

function VendorContractSection({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-4 py-2">
        <h2 className="text-xs font-bold text-gray-800">{title}</h2>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${title}`}
            data-testid={`edit-${title.replace(/\s+/g, "-").toLowerCase()}`}
            className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

type VendorContractEditField = {
  key: string;
  label: string;
  type?: "text" | "textarea" | "select";
  options?: string[];
};

type VendorContractEditConfig = {
  title: string;
  fields: VendorContractEditField[];
  values: Record<string, string>;
  save: (values: Record<string, string>) => void;
};

function VendorContractEditModal({
  config,
  onClose,
}: {
  config: VendorContractEditConfig;
  onClose: () => void;
}) {
  const [values, setValues] = useState(config.values);

  const update = (key: string, value: string) => {
    setValues(current => ({ ...current, [key]: value }));
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="vendor-contract-edit-title"
        className="my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h2 id="vendor-contract-edit-title" className="text-base font-semibold text-gray-900">{config.title}</h2>
          <button type="button" onClick={onClose} aria-label="Close edit dialog" className="text-gray-400 transition-colors hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {config.fields.map(field => (
            <div key={field.key} className="space-y-1">
              <label htmlFor={`vendor-contract-${field.key}`} className="block text-xs font-medium text-gray-700">{field.label}</label>
              {field.type === "textarea" ? (
                <textarea
                  id={`vendor-contract-${field.key}`}
                  rows={3}
                  value={values[field.key] ?? ""}
                  onChange={event => update(field.key, event.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : field.type === "select" ? (
                <select
                  id={`vendor-contract-${field.key}`}
                  value={values[field.key] ?? ""}
                  onChange={event => update(field.key, event.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {(field.options ?? []).map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              ) : (
                <input
                  id={`vendor-contract-${field.key}`}
                  type="text"
                  value={values[field.key] ?? ""}
                  onChange={event => update(field.key, event.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button type="button" onClick={() => { config.save(values); onClose(); }} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Save Changes</button>
        </div>
      </div>
    </div>
  );
}

function VendorContractMetaCell({ icon, label, value }: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 border-r border-gray-200 px-2 py-2 last:border-0">
      <div className="mt-0.5 shrink-0 text-gray-400">{icon}</div>
      <div>
        <p className="text-[10px] leading-tight text-gray-400">{label}</p>
        <div className="mt-0.5 text-xs font-semibold text-gray-800">{value}</div>
      </div>
    </div>
  );
}

function VendorContractInfoRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-2 last:border-0 last:pb-0">
      <span className="shrink-0 text-[11px] text-gray-500">{label}</span>
      <span className="text-right text-[11px] font-medium text-gray-800">{value ?? ""}</span>
    </div>
  );
}

function parseContractRows(value: string | undefined, columns: number): string[][] {
  return String(value || "")
    .split("\n")
    .map(line => line.split("|").map(part => part.trim()))
    .filter(parts => parts.some(Boolean))
    .map(parts => Array.from({ length: columns }, (_, index) => parts[index] || "—"));
}

function getVendorInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase() || "V";
}

function VendorContractDetailPage({
  contract,
  vendorName,
  vendor,
  onBack,
  onUpdate,
  blankView = false,
  readOnly = false,
  editOnOpen = false,
}: {
  contract: Contract;
  vendorName: string;
  vendor?: StoredVendor;
  onBack: () => void;
  onUpdate: (contract: Contract) => void;
  blankView?: boolean;
  readOnly?: boolean;
  editOnOpen?: boolean;
}) {
  const contractMenu = useDropdown();
  const navigate = useNavigate();
  const [editingSection, setEditingSection] = useState<VendorContractEditConfig | null>(null);
  const autoEditOpened = useRef(false);
  const editOverviewRef = useRef<() => void>(() => undefined);
  const actualVendorName = vendor?.name || vendorName || contract.contacts.vendor || "Vendor";
  const vendorAddress = blankView ? "" : [
    vendor?.addressLine1,
    vendor?.addressLine2,
    vendor?.city,
    vendor?.state,
    vendor?.zipCode,
    vendor?.country,
  ].filter(Boolean).join(", ") || vendor?.address || "—";
  const details = contract.details || {};
  const detail = (key: string, fallback = "") => blankView ? "" : details[key] || fallback;
  const editAction = (action: () => void) => readOnly ? undefined : action;
  const daysRemaining = !blankView && contract.endDate
    ? Math.max(0, Math.ceil((new Date(contract.endDate).getTime() - Date.now()) / 86400000))
    : null;
  const meta = [
    { icon: <CalendarDays className="h-3.5 w-3.5" />, label: "Contract Start Date", value: blankView ? "" : contract.startDate || "—" },
    { icon: <CalendarDays className="h-3.5 w-3.5" />, label: "Contract End Date", value: blankView ? "" : contract.endDate || "—" },
    { icon: <IndianRupee className="h-3.5 w-3.5" />, label: "Currency", value: detail("currency", "INR") },
    { icon: <Receipt className="h-3.5 w-3.5" />, label: "Billing Model", value: detail("billingModel", "—") },
    { icon: <FileText className="h-3.5 w-3.5" />, label: "Payment Terms", value: blankView ? "" : contract.paymentTerms || "—" },
    { icon: <CheckCircle className="h-3.5 w-3.5" />, label: "Vendor Status", value: blankView ? "" : vendor?.status || contract.status },
    { icon: <RefreshCcw className="h-3.5 w-3.5" />, label: "Auto Renewal", value: blankView ? "" : contract.autoRenewal ? "Enabled" : "Disabled" },
    { icon: <Bell className="h-3.5 w-3.5" />, label: "Notice Period", value: detail("noticePeriod", contract.renewalReminder || "—") },
    { icon: <Scale className="h-3.5 w-3.5" />, label: "Governing Law", value: blankView ? "" : contract.terms.governingLaw || "—" },
    { icon: <Pencil className="h-3.5 w-3.5" />, label: "Signed On", value: detail("signedOn", "—") },
  ];

  const downloadContract = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 42;
    const generatedOn = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text("NIDO-TECH | VENDOR CONTRACT", margin, 28);
    doc.setDrawColor(229, 231, 235);
    doc.line(margin, 34, pageWidth - margin, 34);

    doc.setFontSize(20);
    doc.setTextColor(31, 41, 55);
    doc.text(contract.name || "Vendor Contract", margin, 66);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(`Contract ID: ${contract.id}  |  Vendor: ${actualVendorName}  |  Generated: ${generatedOn}`, margin, 84);

    const rows: Array<[string, string]> = [
      ["Contract Type", contract.type],
      ["Start Date", contract.startDate],
      ["End Date", contract.endDate],
      ["Contract Value", contract.value],
      ["Payment Terms", contract.paymentTerms],
      ["Status", contract.status],
      ["Auto Renewal", contract.autoRenewal ? "Enabled" : "Disabled"],
      ["Renewal Reminder", contract.renewalReminder],
      ["Contract Owner", contract.contacts.owner],
      ["Vendor Contact", contract.contacts.vendor || vendor?.primaryContact || ""],
      ["Vendor Phone", contract.contacts.vendorPhone || vendor?.phone || ""],
      ["Procurement Head", contract.contacts.procurement],
      ["Price Validity", contract.terms.priceValidity],
      ["Delivery Term", contract.terms.deliveryTerm],
      ["Warranty Period", contract.terms.warrantyPeriod],
      ["SLA Uptime", contract.terms.slaUptime],
      ["Penalty Clause", contract.terms.penaltyClause],
      ["Governing Law", contract.terms.governingLaw],
      ["Vendor Email", vendor?.email || ""],
      ["Vendor Address", vendorAddress],
      ["Vendor Tax ID", vendor?.taxId || ""],
    ];
    autoTable(doc, {
      startY: 104,
      margin: { left: margin, right: margin },
      head: [["Contract Detail", "Value"]],
      body: rows.map(([label, value]) => [label, value || "—"]),
      theme: "grid",
      styles: { font: "helvetica", fontSize: 9, cellPadding: 6, textColor: [31, 41, 55] },
      headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 150, fontStyle: "bold" } },
      alternateRowStyles: { fillColor: [249, 250, 251] },
    });

    const safeName = (contract.name || "Vendor-Contract").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
    doc.save(`${safeName || "Vendor-Contract"}.pdf`);
    contractMenu.setOpen(false);
  };

  const openSectionEditor = (
    title: string,
    fields: VendorContractEditField[],
    values: Record<string, string>,
    save: (values: Record<string, string>) => Contract,
  ) => {
    setEditingSection({
      title,
      fields,
      values,
      save: nextValues => onUpdate(save(nextValues)),
    });
  };

  const editDetails = (title: string, fields: VendorContractEditField[]) => {
    openSectionEditor(
      title,
      fields,
      Object.fromEntries(fields.map(field => [field.key, details[field.key] || ""])),
      values => ({ ...contract, details: { ...details, ...values } }),
    );
  };

  const editOverview = () => openSectionEditor(
    "Edit Contract Overview",
    [
      { key: "id", label: "Contract ID" },
      { key: "name", label: "Contract Name" },
      { key: "type", label: "Contract Type", type: "select", options: Object.keys(TYPE_STYLES) },
      { key: "startDate", label: "Start Date" },
      { key: "endDate", label: "End Date" },
      { key: "signedOn", label: "Signed On" },
      { key: "value", label: "Contract Value" },
      { key: "paymentTerms", label: "Payment Terms", type: "select", options: PAYMENT_TERMS_LIST },
      { key: "status", label: "Status", type: "select", options: ["Active", "Expired", "Expiring Soon", "Archived"] },
      { key: "purpose", label: "Contract Purpose" },
      { key: "scope", label: "Scope of Work", type: "textarea" },
      { key: "deployment", label: "Deployment Model" },
      { key: "currency", label: "Currency" },
      { key: "taxation", label: "Taxation" },
      { key: "jurisdiction", label: "Jurisdiction" },
      { key: "confidentiality", label: "Confidentiality" },
    ],
    { id: contract.id, name: contract.name, type: contract.type, startDate: contract.startDate, endDate: contract.endDate, value: contract.value, paymentTerms: contract.paymentTerms, status: contract.status, ...details },
    values => ({
      ...contract,
      id: values.id,
      name: values.name,
      type: values.type as ContractType,
      startDate: values.startDate,
      endDate: values.endDate,
      value: values.value,
      paymentTerms: values.paymentTerms,
      status: values.status as ContractStatus,
      details: { ...details, ...Object.fromEntries(["signedOn", "purpose", "scope", "deployment", "currency", "taxation", "jurisdiction", "confidentiality"].map(key => [key, values[key] || ""])) },
    }),
  );

  editOverviewRef.current = editOverview;
  useEffect(() => {
    if (!editOnOpen || readOnly || autoEditOpened.current) return;
    autoEditOpened.current = true;
    editOverviewRef.current();
  }, [editOnOpen, readOnly]);

  const editContacts = () => openSectionEditor(
    "Edit Key Contacts",
    [
      { key: "owner", label: "Contract Owner" },
      { key: "vendor", label: "Vendor Contact" },
      { key: "vendorPhone", label: "Vendor Phone" },
      { key: "procurement", label: "Procurement Head" },
      { key: "procurementPhone", label: "Procurement Phone" },
    ],
    { ...contract.contacts },
    values => ({ ...contract, contacts: { ...contract.contacts, ...values } }),
  );

  const editCommercialTerms = () => openSectionEditor(
    "Edit Commercial Terms",
    [
      { key: "priceValidity", label: "Price Validity" },
      { key: "deliveryTerm", label: "Delivery Term", type: "select", options: DELIVERY_TERMS },
      { key: "governingLaw", label: "Governing Law", type: "select", options: GOVERNING_LAWS },
      { key: "contractDuration", label: "Contract Duration" },
      { key: "billingModel", label: "Billing Model" },
      { key: "latePaymentPenalty", label: "Late Payment Penalty" },
      { key: "extras", label: "Extras" },
      { key: "priceRevision", label: "Price Revision" },
      { key: "forceMajeure", label: "Force Majeure" },
      { key: "disputeResolution", label: "Dispute Resolution" },
    ],
    { priceValidity: contract.terms.priceValidity, deliveryTerm: contract.terms.deliveryTerm, governingLaw: contract.terms.governingLaw, ...details },
    values => ({
      ...contract,
      terms: { ...contract.terms, priceValidity: values.priceValidity, deliveryTerm: values.deliveryTerm, governingLaw: values.governingLaw },
      details: { ...details, ...Object.fromEntries(["contractDuration", "billingModel", "latePaymentPenalty", "extras", "priceRevision", "forceMajeure", "disputeResolution"].map(key => [key, values[key] || ""])) },
    }),
  );

  const editServiceTerms = () => openSectionEditor(
    "Edit Service Level & Warranty",
    [
      { key: "warrantyPeriod", label: "Warranty Period", type: "select", options: WARRANTY_PERIODS },
      { key: "slaUptime", label: "SLA Uptime" },
      { key: "penaltyClause", label: "Penalty Clause", type: "select", options: PENALTY_CLAUSES },
    ],
    { warrantyPeriod: contract.terms.warrantyPeriod, slaUptime: contract.terms.slaUptime, penaltyClause: contract.terms.penaltyClause },
    values => ({ ...contract, terms: { ...contract.terms, warrantyPeriod: values.warrantyPeriod, slaUptime: values.slaUptime, penaltyClause: values.penaltyClause } }),
  );

  const editRenewal = () => openSectionEditor(
    "Edit Renewal Information",
    [
      { key: "autoRenewal", label: "Auto Renewal", type: "select", options: ["Enabled", "Disabled"] },
      { key: "renewalReminder", label: "Renewal Reminder", type: "select", options: RENEWAL_REMINDERS },
      { key: "noticePeriod", label: "Notice Period" },
      { key: "expiryIn", label: "Expiry In" },
    ],
    { autoRenewal: contract.autoRenewal ? "Enabled" : "Disabled", renewalReminder: contract.renewalReminder, noticePeriod: details.noticePeriod || "", expiryIn: contract.expiryIn ?? "" },
    values => ({
      ...contract,
      autoRenewal: values.autoRenewal === "Enabled",
      renewalReminder: values.renewalReminder,
      expiryIn: values.expiryIn || null,
      details: { ...details, noticePeriod: values.noticePeriod || "" },
    }),
  );

  const editGovernance = () => openSectionEditor(
    "Edit Contract Governance",
    [
      { key: "id", label: "Contract ID" },
      { key: "governingLaw", label: "Governing Law", type: "select", options: GOVERNING_LAWS },
    ],
    { id: contract.id, governingLaw: contract.terms.governingLaw },
    values => ({ ...contract, id: values.id, terms: { ...contract.terms, governingLaw: values.governingLaw } }),
  );

  return (
    <div className="flex min-h-full flex-col bg-gray-50">
      {editingSection && !readOnly && (
        <VendorContractEditModal config={editingSection} onClose={() => setEditingSection(null)} />
      )}
      <header className="relative border-b border-gray-100 bg-white">
        {!blankView && <div className="absolute right-4 top-4 z-20" ref={contractMenu.ref}>
          <button
            type="button"
            onClick={() => contractMenu.setOpen(open => !open)}
            aria-label="Contract actions"
            data-testid="contract-menu"
            className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
          >
            <MoreVertical size={18} />
          </button>
          {contractMenu.open && (
            <div className="absolute right-0 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              <button
                type="button"
                onClick={downloadContract}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
              >
                <Download size={14} className="text-gray-400" />
                Download Contract
              </button>
            </div>
          )}
        </div>}
        <div className="px-4 pb-4 pt-5 sm:px-6">
          <button
            type="button"
            onClick={onBack}
            className="mb-4 inline-flex items-center gap-1.5 text-xs text-gray-500 transition-colors hover:text-blue-600"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Contracts
          </button>

          <div className="flex flex-col gap-5 min-[900px]:flex-row min-[900px]:items-start min-[900px]:justify-between min-[900px]:gap-6">
            <div className="w-full min-[900px]:w-64 min-[900px]:shrink-0">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600">
                  <span className="text-sm font-black text-white">N</span>
                </div>
                <div>
                  <p className="text-sm font-bold leading-tight text-gray-900">Nido-Tech</p>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">Service Provider (We)</span>
                </div>
              </div>
              <div className="space-y-0.5 pl-11 text-[11px] text-gray-500">
                <p className="text-[10px] font-medium text-gray-400">GSTIN</p>
                <p className="font-mono">{blankView ? "" : "—"}</p>
                <p className="mt-1 text-[10px] font-medium text-gray-400">Registered Address</p>
                <p>{blankView ? "" : "—"}</p>
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col items-center text-center">
              <span className="mb-2 rounded border border-blue-300 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold tracking-widest text-blue-600">CONTRACT</span>
              <h1 className="mb-3 text-lg font-bold text-gray-900">{blankView ? "" : contract.name || "Vendor Contract"}</h1>
              {readOnly && (
                <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                  <Archive size={13} />
                  Archived · Read only
                </span>
              )}
              <p className="mb-2 text-[11px] text-gray-400">Between</p>
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded border border-yellow-200 bg-yellow-50 px-2 py-1 text-[11px] font-medium text-yellow-800">
                  Nido-Tech<br /><span className="text-[10px] text-yellow-600">(Service Provider)</span>
                </div>
                <div className="flex items-center gap-0.5 text-gray-300">
                  <div className="h-px w-8 bg-gray-300" />
                  <ChevronRight className="h-3 w-3 text-gray-400" />
                </div>
                <div className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-800">
                  {actualVendorName}<br /><span className="text-[10px] text-blue-600">(Vendor)</span>
                </div>
              </div>
              <div className="flex gap-2 text-center">
                <div>
                  <p className="text-[10px] text-gray-400">Contract No.</p>
                  <p className="text-xs font-semibold text-gray-800">{blankView ? "" : contract.id || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400">Contract Type</p>
                  <p className="text-xs font-semibold text-gray-800">{blankView ? "" : contract.type || "—"}</p>
                </div>
              </div>
            </div>

            <div className="w-full text-left min-[900px]:w-64 min-[900px]:shrink-0 min-[900px]:pr-6 min-[900px]:text-right">
              <div className="mb-2 flex items-center justify-start gap-2 min-[900px]:justify-end">
                <div>
                  <p className="text-sm font-bold leading-tight text-gray-900">{actualVendorName}</p>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">Vendor</span>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-800">
                  <span className="text-[10px] font-black text-white">{getVendorInitials(actualVendorName)}</span>
                </div>
              </div>
              <div className="space-y-0.5 pl-11 text-[11px] text-gray-500 min-[900px]:pl-0 min-[900px]:pr-11">
                <p className="text-[10px] font-medium text-gray-400">GSTIN</p>
                <p className="font-mono">{blankView ? "" : vendor?.taxId || "—"}</p>
                <p className="mt-1 text-[10px] font-medium text-gray-400">Registered Address</p>
                <p>{blankView ? "" : vendorAddress}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto border-b border-gray-200 bg-gray-50">
          <div className="flex min-w-max">
            {meta.map(item => (
              <VendorContractMetaCell key={item.label} icon={item.icon} label={item.label} value={item.value} />
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto bg-[#f8fafc] p-2">
        <div className="mx-auto grid max-w-[1600px] grid-cols-1 items-start gap-2 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <VendorContractSection title="Contract Overview" onEdit={editAction(editOverview)}>
              <div className="space-y-2">
                {[
                  ["Contract Purpose", detail("purpose")],
                  ["Scope of Work", detail("scope")],
                  ["Deployment Model", detail("deployment")],
                  ["Currency", detail("currency", "INR")],
                  ["Taxation", detail("taxation")],
                  ["Jurisdiction", detail("jurisdiction", contract.terms.governingLaw)],
                  ["Confidentiality", detail("confidentiality")],
                ].map(([label, value]) => <VendorContractInfoRow key={label} label={label} value={value} />)}
              </div>
              <div className="mt-3 border-t border-gray-100 pt-3">
                <p className="mb-2 text-[10px] font-medium uppercase text-gray-500">Relationship Owner (Nido-Tech)</p>
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">{getVendorInitials(contract.contacts.owner || "N")}</span>
                  <span className="text-xs font-semibold text-gray-800">{blankView ? "" : contract.contacts.owner || "—"}</span>
                </div>
              </div>
              <div className="mt-3 border-t border-gray-100 pt-3">
                <p className="mb-2 text-[10px] font-medium uppercase text-gray-500">Relationship Owner (Vendor)</p>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-700">{blankView ? "" : getVendorInitials(contract.contacts.vendor || vendor?.primaryContact || actualVendorName)}</span>
                    <div className="min-w-0"><p className="truncate text-xs font-semibold text-gray-800">{blankView ? "" : contract.contacts.vendor || vendor?.primaryContact || actualVendorName}</p><p className="truncate text-[10px] text-gray-500">{blankView ? "" : vendor?.email || "—"}</p></div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {!blankView && vendor?.email && <a href={`mailto:${vendor.email}`} aria-label="Email vendor contact" className="rounded-full border border-gray-200 p-1.5 text-gray-500 hover:text-blue-600"><Mail size={12} /></a>}
                    {!blankView && vendor?.phone && <a href={`tel:${vendor.phone}`} aria-label="Call vendor contact" className="rounded-full border border-gray-200 p-1.5 text-gray-500 hover:text-blue-600"><Phone size={12} /></a>}
                  </div>
                </div>
              </div>
            </VendorContractSection>

            <VendorContractSection title="2. Response & Resolution Targets" onEdit={editAction(() => editDetails("Edit Response & Resolution Targets", [{ key: "responseTargets", label: "Priority | Response | Resolution (one row per line)", type: "textarea" }]))}>
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-[10px] text-gray-500"><tr>{["Priority", "Response", "Resolution"].map(item => <th key={item} className="px-2 py-2">{item}</th>)}</tr></thead>
                  <tbody className="divide-y divide-gray-100 text-[11px]">
                    {(parseContractRows(detail("responseTargets"), 3).length ? parseContractRows(detail("responseTargets"), 3) : [["", "", ""]]).map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className="px-2 py-2 text-gray-700">{cell}</td>)}</tr>)}
                  </tbody>
                </table>
              </div>
            </VendorContractSection>
          </div>

          <div className="space-y-4">
            <VendorContractSection title="1. Commercial Terms" onEdit={editAction(editCommercialTerms)}>
              <div className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
                {[
                  ["Agreement Type", contract.type],
                  ["Billing Model", detail("billingModel")],
                  ["Contract Duration", detail("contractDuration")],
                  ["Payment Terms", contract.paymentTerms],
                  ["Late Payment Penalty", detail("latePaymentPenalty", contract.terms.penaltyClause)],
                  ["Extras", detail("extras")],
                  ["Price Revision", detail("priceRevision", contract.terms.priceValidity)],
                  ["Force Majeure", detail("forceMajeure")],
                  ["Dispute Resolution", detail("disputeResolution")],
                ].map(([label, value]) => <VendorContractInfoRow key={label} label={label} value={value} />)}
              </div>
            </VendorContractSection>

            <VendorContractSection title="3. Services Covered" onEdit={editAction(() => editDetails("Edit Services Covered", [{ key: "servicesCovered", label: "Service | In Scope (one row per line)", type: "textarea" }]))}>
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-[10px] text-gray-500"><tr><th className="px-3 py-2">Service</th><th className="px-3 py-2 text-right">In Scope</th></tr></thead>
                  <tbody className="divide-y divide-gray-100 text-[11px]">
                    {(parseContractRows(detail("servicesCovered"), 2).length ? parseContractRows(detail("servicesCovered"), 2) : [["", ""]]).map((row, index) => <tr key={index}><td className="px-3 py-2 font-medium text-gray-800">{row[0]}</td><td className="px-3 py-2 text-right text-gray-600">{row[1]}</td></tr>)}
                  </tbody>
                </table>
              </div>
            </VendorContractSection>

            <VendorContractSection title="5. Data Security & Compliance" onEdit={editAction(() => editDetails("Edit Data Security & Compliance", [{ key: "securityControls", label: "Controls (one per line)", type: "textarea" }]))}>
              {blankView ? <div className="h-8" /> : detail("securityControls") ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {detail("securityControls").split("\n").filter(Boolean).map((control, index) => <div key={`${control}-${index}`} className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3 text-center"><Database className="h-5 w-5 text-indigo-500" /><span className="text-[10px] font-medium text-gray-700">{control}</span><CheckCircle className="h-3 w-3 text-emerald-500" /></div>)}
                </div>
              ) : <p className="rounded-lg bg-gray-50 p-4 text-xs text-gray-400">No security controls recorded.</p>}
            </VendorContractSection>

            <VendorContractSection title="6. Confidentiality Clause" onEdit={editAction(() => editDetails("Edit Confidentiality Clause", [
              { key: "confidentialityText", label: "Clause", type: "textarea" },
              { key: "confidentialityEffective", label: "Effective Until" },
              { key: "confidentialityStatus", label: "Status" },
            ]))}>
              <div className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50"><ShieldCheck size={18} className="text-blue-500" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] leading-relaxed text-gray-600">{detail("confidentialityText", "No confidentiality clause details recorded.")}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-2 text-[10px] text-gray-600"><span>Effective Until: {detail("confidentialityEffective", contract.endDate || "—")}</span><span>Status: <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">{detail("confidentialityStatus", contract.status)}</span></span></div>
                </div>
              </div>
            </VendorContractSection>

            <VendorContractSection title="7. Support & Escalation Matrix" onEdit={editAction(() => editDetails("Edit Support & Escalation Matrix", [{ key: "supportMatrix", label: "Level | Contact / Team | Email | Availability (one row per line)", type: "textarea" }]))}>
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-left text-[10px]">
                  <thead className="bg-gray-50 text-gray-500"><tr>{["Level", "Contact / Team", "Email", "Availability"].map(item => <th key={item} className="px-2 py-2">{item}</th>)}</tr></thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {(parseContractRows(detail("supportMatrix"), 4).length ? parseContractRows(detail("supportMatrix"), 4) : [["", "", "", ""]]).map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className="max-w-36 truncate px-2 py-2">{cell}</td>)}</tr>)}
                  </tbody>
                </table>
              </div>
            </VendorContractSection>

            <VendorContractSection title="8. Renewal & Termination" onEdit={editAction(() => editDetails("Edit Renewal & Termination", [{ key: "renewalTermination", label: "Renewal / termination terms", type: "textarea" }]))}>
              <div className="space-y-2">
                {blankView ? <div className="h-8" /> : detail("renewalTermination") ? detail("renewalTermination").split("\n").filter(Boolean).map((line, index) => <div key={index} className="rounded-lg bg-gray-50 p-2.5 text-[11px] text-gray-700"><Database size={13} className="mr-2 inline text-emerald-500" />{line}</div>) : <>
                  <VendorContractInfoRow label="Renewal" value={contract.autoRenewal ? "Automatic" : "Manual"} />
                  <VendorContractInfoRow label="Renewal Notice" value={contract.renewalReminder} />
                  <VendorContractInfoRow label="Termination / End Date" value={contract.endDate} />
                </>}
              </div>
            </VendorContractSection>
          </div>

          <div className="space-y-4">
            <VendorContractSection title="2. Subscription & Licensing" onEdit={editAction(() => editDetails("Edit Subscription & Licensing", [
              { key: "userLicensing", label: "User Licensing" }, { key: "licensedUsers", label: "Licensed Users" },
              { key: "concurrentUsers", label: "Concurrent Users" }, { key: "additionalUserCost", label: "Additional User Cost" },
              { key: "licenseTransfer", label: "License Transfer" }, { key: "minimumCommitment", label: "Minimum Commitment" },
            ]))}>
              <div className="space-y-2">{[
                ["User Licensing", detail("userLicensing")], ["Licensed Users", detail("licensedUsers")],
                ["Concurrent Users", detail("concurrentUsers")], ["Additional User Cost", detail("additionalUserCost")],
                ["License Transfer", detail("licenseTransfer")], ["Minimum Commitment", detail("minimumCommitment")],
              ].map(([label, value]) => <VendorContractInfoRow key={label} label={label} value={value} />)}</div>
            </VendorContractSection>

            <VendorContractSection title="4. SLA Commitments" onEdit={editAction(() => editDetails("Edit SLA Commitments", [{ key: "slaCommitments", label: "Commitment | Target (one row per line)", type: "textarea" }]))}>
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-left text-[10px]">
                  <thead className="bg-gray-50 text-gray-500"><tr><th className="px-2 py-2">Commitment</th><th className="px-2 py-2 text-right">Target</th></tr></thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {(parseContractRows(detail("slaCommitments"), 2).length ? parseContractRows(detail("slaCommitments"), 2) : [["", ""]]).map((row, index) => <tr key={index}><td className="px-2 py-2">{row[0]}</td><td className="px-2 py-2 text-right font-medium">{row[1]}</td></tr>)}
                  </tbody>
                </table>
              </div>
            </VendorContractSection>

            <VendorContractSection title="Renewal Information" onEdit={editAction(editRenewal)}>
              <div className="space-y-2">
                <VendorContractInfoRow label="Contract Renewal" value={blankView ? "" : contract.endDate || "—"} />
                <VendorContractInfoRow label="Auto Renewal" value={blankView ? "" : contract.autoRenewal ? "Enabled" : "Disabled"} />
                <VendorContractInfoRow label="Days Remaining" value={blankView ? "" : daysRemaining == null ? "—" : `${daysRemaining} days`} />
              </div>
            </VendorContractSection>

            <VendorContractSection title="Support Information" onEdit={editAction(() => editDetails("Edit Support Information", [
              { key: "supportPlan", label: "Support Plan" }, { key: "supportHours", label: "Support Hours" }, { key: "responseSLA", label: "Response SLA" },
            ]))}>
              <div className="space-y-2">
                <VendorContractInfoRow label="Support Plan" value={detail("supportPlan", contract.type === "SLA" || contract.type === "AMC" ? contract.type : "")} />
                <VendorContractInfoRow label="Support Hours" value={detail("supportHours")} />
                <VendorContractInfoRow label="Response SLA" value={detail("responseSLA", contract.terms.slaUptime)} />
                {!readOnly && <button type="button" onClick={() => navigate("/support/create", { state: { vendorId: vendor?.id, vendorName: actualVendorName, contractId: contract.id } })} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-blue-500 px-3 py-2 text-[11px] font-medium text-blue-600 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                  <Headphones size={13} /> Create Support Ticket
                </button>}
              </div>
            </VendorContractSection>

            <VendorContractSection title="Key Contacts" onEdit={editAction(editContacts)}>
              <div className="space-y-3">
                {[
                  { label: "Vendor", name: blankView ? "" : contract.contacts.vendor || vendor?.primaryContact || actualVendorName, email: blankView ? "" : vendor?.email || "", phone: blankView ? "" : contract.contacts.vendorPhone || vendor?.phone || "" },
                  { label: "Nido-Tech", name: blankView ? "" : contract.contacts.owner, email: "", phone: "" },
                  { label: "Procurement", name: blankView ? "" : contract.contacts.procurement, email: "", phone: blankView ? "" : contract.contacts.procurementPhone },
                ].map(contact => <div key={contact.label} className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                  <div className="flex min-w-0 items-center gap-2"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[9px] font-bold text-gray-700">{blankView ? "" : getVendorInitials(contact.name || contact.label)}</span><div className="min-w-0"><p className="text-[9px] font-medium uppercase text-gray-400">{contact.label}</p><p className="truncate text-[10px] font-semibold text-gray-800">{blankView ? "" : contact.name || "—"}</p></div></div>
                  <div className="flex shrink-0 gap-1">{contact.email && <a href={`mailto:${contact.email}`} aria-label={`Email ${contact.label}`} className="rounded-full border border-gray-200 p-1.5 text-gray-500 hover:text-blue-600"><Mail size={11} /></a>}{contact.phone && <a href={`tel:${contact.phone}`} aria-label={`Call ${contact.label}`} className="rounded-full border border-gray-200 p-1.5 text-gray-500 hover:text-blue-600"><Phone size={11} /></a>}</div>
                </div>)}
              </div>
            </VendorContractSection>

            <VendorContractSection title="Reminders" onEdit={editAction(() => editDetails("Edit Reminders", [{ key: "reminders", label: "Reminder | Date (one per line)", type: "textarea" }]))}>
              {blankView ? <div className="h-8" /> : detail("reminders") ? <div className="space-y-2">{parseContractRows(detail("reminders"), 2).map((row, index) => <div key={index} className="flex items-center gap-2 text-[10px] text-gray-600"><Calendar size={12} className="text-gray-400" /><span>{row[0]}</span><span className="ml-auto font-medium">{row[1]}</span></div>)}</div> : <div className="space-y-2 text-[10px] text-gray-600"><div className="flex items-center gap-2"><Calendar size={12} className="text-gray-400" /><span>{contract.renewalReminder || "Renewal reminder"}</span></div><div className="flex items-center gap-2"><Clock size={12} className="text-gray-400" /><span>{contract.endDate || "No due date set"}</span></div></div>}
               {!blankView && !readOnly && <button type="button" onClick={() => editDetails("Edit Reminders", [{ key: "reminders", label: "Reminder | Date (one per line)", type: "textarea" }])} className="mt-4 w-full text-center text-[10px] font-medium text-blue-600 hover:underline">View All Reminders</button>}
            </VendorContractSection>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ���── Main export ─────────────────────────────────────────────────���─────── */
function readContracts(scope: VendorScope): Contract[] {
  if (!hasVendorScope(scope)) return CONTRACTS;
  try {
    const raw = localStorage.getItem(`nido_vendor_contracts_${scope.vendorId}`);
    const records = raw ? JSON.parse(raw) : [];
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
}

function persistContracts(scope: VendorScope, contracts: Contract[]) {
  if (!scope.vendorId) return;
  localStorage.setItem(`nido_vendor_contracts_${scope.vendorId}`, JSON.stringify(contracts));
  window.dispatchEvent(new Event("vendorContractsUpdated"));
}

function createBlankVendorContract(): Contract {
  return {
    id: "",
    name: "",
    type: "" as ContractType,
    startDate: "",
    endDate: "",
    value: "",
    paymentTerms: "",
    status: "" as ContractStatus,
    autoRenewal: false,
    renewalReminder: "",
    expiryIn: null,
    contacts: {
      owner: "",
      vendor: "",
      vendorPhone: "",
      procurement: "",
      procurementPhone: "",
    },
    terms: {
      priceValidity: "",
      deliveryTerm: "",
      warrantyPeriod: "",
      slaUptime: "",
      penaltyClause: "",
      governingLaw: "",
    },
    details: {},
  };
}

function nextVendorContractId(contracts: Contract[]): string {
  const year = new Date().getFullYear();
  const prefix = `CT-${year}-`;
  const highestNumber = contracts.reduce((highest, contract) => {
    if (!contract.id.startsWith(prefix)) return highest;
    const number = Number(contract.id.slice(prefix.length));
    return Number.isFinite(number) ? Math.max(highest, number) : highest;
  }, 0);
  return `${prefix}${String(highestNumber + 1).padStart(3, "0")}`;
}

export default function VendorContractsPage(scope: VendorScope = {}) {
  const scoped = hasVendorScope(scope);
  const vendorRecord = (scope.vendorId ? getVendorById(scope.vendorId) : undefined) ||
    getVendors().find(vendor => scope.vendorName && vendor.name.toLowerCase() === scope.vendorName.toLowerCase());
  const [initialContracts] = useState(() => readContracts(scope));
  const [contracts, setContracts] = useState(initialContracts);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(
    () => scoped ? null : initialContracts.find(contract => contract.status !== "Archived") ?? null
  );
  const [blankDetailView, setBlankDetailView] = useState(false);
  const [showScopedContractList, setShowScopedContractList] = useState(scoped);
  const [openRowMenu, setOpenRowMenu] = useState<string | null>(null);
  const [showAddContract, setShowAddContract] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [editOnOpenContractId, setEditOnOpenContractId] = useState<string | null>(null);
  const topMenu = useDropdown();

  useEffect(() => {
    const refresh = () => setContracts(readContracts(scope));
    const scopedContracts = readContracts(scope);
    setContracts(scopedContracts);
    setSelectedContract(scoped ? null : scopedContracts.find(contract => contract.status !== "Archived") ?? null);
    setBlankDetailView(false);
    setShowScopedContractList(scoped);
    setShowArchived(false);
    setEditOnOpenContractId(null);
    window.addEventListener("vendorContractsUpdated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("vendorContractsUpdated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [scope.vendorId, scope.vendorName, scoped]);

  const handleSaveContract = (updated: Contract) => {
    if (editingContract) {
      setContracts(prev => {
        const next = prev.map(c => c.id === updated.id ? updated : c);
        persistContracts(scope, next);
        return next;
      });
      if (selectedContract?.id === updated.id) setSelectedContract(updated);
      setEditingContract(null);
    } else {
      setContracts(prev => {
        const next = [updated, ...prev];
        persistContracts(scope, next);
        return next;
      });
      setShowAddContract(false);
    }
  };

  const handleCreateScopedContract = (basics: VendorContractBasics) => {
    const created: Contract = {
      ...createBlankVendorContract(),
      id: basics.id,
      name: basics.name,
      startDate: basics.startDate,
      endDate: basics.endDate,
      status: "Active",
    };
    setContracts(prev => {
      const next = [created, ...prev];
      persistContracts(scope, next);
      return next;
    });
    setSelectedContract(created);
    setBlankDetailView(false);
    setShowScopedContractList(false);
    setShowArchived(false);
    setEditOnOpenContractId(null);
  };

  const handleArchiveScopedContract = (contractId: string) => {
    setContracts(prev => {
      const next = prev.map(contract =>
        contract.id === contractId
          ? { ...contract, status: "Archived" as ContractStatus }
          : contract
      );
      persistContracts(scope, next);
      return next;
    });
  };

  const openScopedContract = (contractId: string, edit = false) => {
    const contract = contracts.find(item => item.id === contractId);
    if (!contract) return;
    setSelectedContract(contract);
    setBlankDetailView(false);
    setShowScopedContractList(false);
    setEditOnOpenContractId(edit ? contractId : null);
  };

  const handleUpdateContract = (updated: Contract) => {
    const originalId = selectedContract?.id;
    const requestedId = updated.id?.trim();
    const idTaken = requestedId && contracts.some(contract =>
      contract.id === requestedId && contract.id !== originalId
    );
    const record: Contract = {
      ...updated,
      id: idTaken ? originalId || nextVendorContractId(contracts) : requestedId || originalId || nextVendorContractId(contracts),
      name: updated.name?.trim() || "Untitled Contract",
      type: updated.type || "Supply Agreement",
      status: updated.status || "Active",
    };
    setContracts(prev => {
      const exists = originalId && prev.some(contract => contract.id === originalId);
      const next = exists
        ? prev.map(contract => contract.id === originalId ? record : contract)
        : [record, ...prev];
      persistContracts(scope, next);
      return next;
    });
    setSelectedContract(record);
    setBlankDetailView(false);
    setShowScopedContractList(false);
    setEditOnOpenContractId(null);
  };

  const activeContracts = contracts.filter(c => c.status !== "Archived");
  const archivedContracts = contracts.filter(c => c.status === "Archived");
  const totalValue = activeContracts.reduce((sum, contract) => {
    const value = Number(contract.value.replace(/[^\d.-]/g, ""));
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
  const stats = [
    { icon: <FileText className="w-5 h-5 text-blue-500" />, bg: "bg-blue-50", label: "Total Contracts", value: String(activeContracts.length), sub: "All Time" },
    { icon: <CheckCircle className="w-5 h-5 text-green-500" />, bg: "bg-green-50", label: "Active Contracts", value: String(activeContracts.filter(c => c.status === "Active").length), sub: "Currently Active" },
    { icon: <Clock className="w-5 h-5 text-orange-400" />, bg: "bg-orange-50", label: "Expiring in 30 Days", value: String(activeContracts.filter(c => c.expiryIn && !c.expiryIn.includes("Days") || c.expiryIn === "30 Days").length), sub: "Current records" },
    { icon: <IndianRupee className="w-5 h-5 text-purple-500" />, bg: "bg-purple-50", label: "Contract Value", value: totalValue ? `₹${totalValue.toLocaleString("en-IN")}` : "₹0", sub: "Total Value" },
    { icon: <RefreshCcw className="w-5 h-5 text-blue-400" />, bg: "bg-blue-50", label: "Renewal Rate", value: activeContracts.length ? `${Math.round(activeContracts.filter(c => c.autoRenewal).length / activeContracts.length * 100)}%` : "0%", sub: "Current records" },
  ];

  if (showAddContract) {
    return <AddContractPage onCancel={() => setShowAddContract(false)} onSave={handleSaveContract} vendor={vendorRecord} />;
  }
  if (editingContract) {
    return <AddContractPage onCancel={() => setEditingContract(null)} contract={editingContract} onSave={handleSaveContract} vendor={vendorRecord} />;
  }
  if (scoped && showScopedContractList) {
    return (
      <div className="min-h-full bg-[#f8fafc] p-4 sm:p-5">
        <VendorContractsList
          vendorName={scope.vendorName || vendorRecord?.name || "Vendor"}
          contracts={contracts}
          showArchived={showArchived}
          onCreate={handleCreateScopedContract}
          onOpen={contractId => openScopedContract(contractId)}
          onEdit={contractId => openScopedContract(contractId, true)}
          onArchive={handleArchiveScopedContract}
          onToggleArchived={() => setShowArchived(current => !current)}
        />
      </div>
    );
  }
  if (selectedContract || (scoped && !showScopedContractList)) {
    return (
      <VendorContractDetailPage
        key={`${scope.vendorId || "vendor"}-${selectedContract?.id || "blank"}`}
        contract={selectedContract ?? createBlankVendorContract()}
        vendorName={scope.vendorName || vendorRecord?.name || selectedContract?.contacts.vendor || ""}
        vendor={vendorRecord}
        onBack={() => {
          setSelectedContract(null);
          setShowScopedContractList(true);
          setEditOnOpenContractId(null);
        }}
        onUpdate={handleUpdateContract}
        blankView={blankDetailView}
        readOnly={selectedContract?.status === "Archived"}
        editOnOpen={selectedContract?.id === editOnOpenContractId}
      />
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans" onClick={() => setOpenRowMenu(null)}>
      <div className="flex min-h-screen">
        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1600px] space-y-4 px-4 py-4 sm:px-6">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {stats.map(stat => (
                <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-2 shadow-sm hover:shadow-md transition-shadow">
                  <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center mb-2`}>{stat.icon}</div>
                  <p className="text-xs text-gray-500 font-medium mb-1 leading-tight">{stat.label}</p>
                  <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{stat.sub}</p>
                </div>
              ))}
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-2 flex items-center justify-between border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-800">All Contracts</h3>
                <div className="relative" ref={topMenu.ref}>
                  <button onClick={() => topMenu.setOpen(o => !o)} className="p-2 border border-gray-200 rounded-md text-gray-500 hover:bg-gray-50 transition-colors">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {topMenu.open && (
                    <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
                      <button className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left" onClick={() => { topMenu.setOpen(false); setShowAddContract(true); }}>
                        <Plus className="w-4 h-4 text-gray-400" /> Add Contract
                      </button>
                      <button className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left" onClick={() => { topMenu.setOpen(false); setShowArchived(true); }}>
                        <Archive className="w-4 h-4 text-gray-400" /> Archived Contracts
                      </button>
                      <div className="my-1 border-t border-gray-100" />
                      <button className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left" onClick={() => topMenu.setOpen(false)}>
                        <Download className="w-4 h-4 text-gray-400" /> Export All
                      </button>
                      <button className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left" onClick={() => topMenu.setOpen(false)}>
                        <AlertTriangle className="w-4 h-4 text-gray-400" /> Expiry Alerts
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex overflow-hidden" style={{ minHeight: 400 }}>
                <div className="flex-1 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/60">
                        {["Contract ID", "Contract Name", "Type", "Start Date", "End Date", "Value", "Payment Terms", "Status", "Actions"].map(h => (
                          <th key={h} className="text-left px-2 py-2 text-xs font-bold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {contracts.map(c => (
                        <tr key={c.id} onClick={() => setSelectedContract(selectedContract?.id === c.id ? null : c)} className={`hover:bg-gray-50 cursor-pointer transition-colors ${selectedContract?.id === c.id ? "bg-blue-50/40" : ""}`}>
                          <td className="px-4 py-3.5 whitespace-nowrap"><span className="text-blue-600 font-semibold text-sm">{c.id}</span></td>
                          <td className="px-4 py-3.5 max-w-[200px]"><p className="text-sm font-medium text-gray-800 truncate">{c.name}</p></td>
                          <td className="px-4 py-3.5 whitespace-nowrap"><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${TYPE_STYLES[c.type]}`}>{c.type}</span></td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-gray-500 text-sm">{c.startDate}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-gray-500 text-sm">{c.endDate}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap font-semibold text-gray-800 text-sm">{c.value}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-gray-600 text-sm">{c.paymentTerms}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLES[c.status]}`}>{c.status}</span>
                              {c.expiryIn && <span className="text-xs text-blue-600 font-medium">{c.expiryIn}</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                              <button className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" onClick={() => setSelectedContract(c)}><Eye className="w-4 h-4" /></button>
                              <div className="relative">
                                <button onClick={e => { e.stopPropagation(); setOpenRowMenu(openRowMenu === c.id ? null : c.id); }} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                                  <MoreVertical className="w-4 h-4" />
                                </button>
                                {openRowMenu === c.id && (
                                  <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
                                    <button className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left" onClick={() => { setOpenRowMenu(null); setEditingContract(c); }}><Pencil className="w-4 h-4 text-gray-400" /> Edit</button>
                                    <button className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left" onClick={() => setOpenRowMenu(null)}><Archive className="w-4 h-4 text-gray-400" /> Archive</button>
                                    <button className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left" onClick={() => setOpenRowMenu(null)}><Download className="w-4 h-4 text-gray-400" /> Download</button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showArchived && <ArchivedContractsModal onClose={() => setShowArchived(false)} contracts={scoped ? archivedContracts : ARCHIVED_CONTRACTS} />}
    </div>
  );
}
