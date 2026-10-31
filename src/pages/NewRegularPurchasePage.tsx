import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, ListChecks, Upload, X, Info, Building2, User, Phone, Mail, MapPin } from "lucide-react";
import { toast } from "sonner";
import { addServiceRequest, peekNextId } from "@/lib/serviceRequestsStore";
import { getClients, type StoredClient } from "@/lib/clientStore";
import { getHsnCodes, getSacCodes } from "@/lib/taxEngine";

// ─── Static options ────────────────────────────────────────────────────────────
const PURPOSES   = ["Office Use", "IT Hardware", "Pantry / Consumables", "Cleaning Supplies", "Water Cans", "Stationery", "Project Use", "Other"];
const PRIORITIES = ["Low", "Medium", "High", "Critical"];
const TIME_SLOTS = ["09:00 AM - 11:00 AM", "10:00 AM - 12:00 PM", "11:00 AM - 01:00 PM", "12:00 PM - 02:00 PM", "02:00 PM - 04:00 PM", "03:00 PM - 05:00 PM"];
const UNITS      = ["Nos", "Kg", "Litres", "Pcs", "Sets", "Boxes", "Packs", "Rolls", "Lots"];
const FREQ_TYPES = ["One-Time", "Daily", "Weekly", "Monthly", "Quarterly", "Half-Yearly", "Annually"];

// ─── Category → Sub-category map ──────────────────────────────────────────────
const SUBCATEGORIES: Record<string, string[]> = {
  "Computers & Laptops":     ["Desktops", "Laptops", "Workstations", "Tablets"],
  "Computer Peripherals":    ["Monitors", "Keyboards", "Mice", "Webcams", "Headsets"],
  "Networking":              ["Switches", "Routers", "Access Points"],
  "Printers & Scanners":     ["Laser Printers", "Inkjet Printers", "Scanners", "Cartridges / Toner"],
  "Storage Devices":         ["Hard Drives", "SSDs", "USB Drives", "Memory Cards"],
  "Electrical Appliances":   ["Air Conditioners", "Fans", "Heaters", "Kettles"],
  "Pantry Items":            ["Tea / Coffee", "Water Cans", "Snacks", "Paper Cups / Plates"],
  "Cleaning Supplies":       ["Floor Cleaner", "Toilet Cleaner", "Sanitizers", "Mops / Brooms"],
  "Stationery":              ["Pens / Pencils", "Notebooks", "Files / Folders", "Paper Reams"],
  "Safety Equipment":        ["Fire Extinguishers", "First Aid", "Safety Gloves", "Helmets"],
  "Furniture":               ["Desks", "Chairs", "Shelves", "Cabinets"],
  "Office Chairs":           ["Executive Chairs", "Task Chairs", "Visitor Chairs"],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function loadCategories(): string[] {
  const hsn = getHsnCodes().filter(c => c.status === "Active").map(c => c.productCategory);
  const sac = getSacCodes().filter(c => c.status === "Active").map(c => c.serviceCategory);
  return Array.from(new Set([...hsn, ...sac])).sort((a, b) => a.localeCompare(b));
}

function repeatUnit(freqType: string): string {
  switch (freqType) {
    case "Daily":       return "Day(s)";
    case "Weekly":      return "Week(s)";
    case "Monthly":     return "Month(s)";
    case "Quarterly":   return "Quarter(s)";
    case "Half-Yearly": return "Half-Year(s)";
    case "Annually":    return "Year(s)";
    default:            return "";
  }
}

function nextOrderDate(requiredBy: string, freqType: string, repeatEvery: number): string {
  if (!requiredBy || freqType === "One-Time" || !repeatEvery) return "";
  const d = new Date(requiredBy);
  switch (freqType) {
    case "Daily":    d.setDate(d.getDate() + repeatEvery); break;
    case "Weekly":   d.setDate(d.getDate() + repeatEvery * 7); break;
    case "Monthly":  d.setMonth(d.getMonth() + repeatEvery); break;
    case "Quarterly":d.setMonth(d.getMonth() + repeatEvery * 3); break;
    case "Half-Yearly": d.setMonth(d.getMonth() + repeatEvery * 6); break;
    case "Annually": d.setFullYear(d.getFullYear() + repeatEvery); break;
  }
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Sub-components ────────────────────────────────────────────────────────────
interface SelectFieldProps {
  label: string; required?: boolean; value: string; onChange: (v: string) => void;
  options: string[]; placeholder?: string; disabled?: boolean;
}
function SelectField({ label, required, value, onChange, options, placeholder, disabled }: SelectFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
          className="w-full appearance-none pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400 cursor-pointer transition-colors hover:border-gray-400">
          <option value="">{placeholder ?? `Select ${label}`}</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <svg className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function NewRegularPurchasePage() {
  const navigate = useNavigate();

  const [clients,    setClients]    = useState<StoredClient[]>(() => getClients());
  const [categories, setCategories] = useState<string[]>(() => loadCategories());

  useEffect(() => {
    const onC = () => setClients(getClients());
    const onT = () => setCategories(loadCategories());
    window.addEventListener("nidoClientsUpdated", onC);
    window.addEventListener("taxEngineUpdated",   onT);
    return () => {
      window.removeEventListener("nidoClientsUpdated", onC);
      window.removeEventListener("taxEngineUpdated",   onT);
    };
  }, []);

  // ── Request Details ──
  const [clientId, setClientId] = useState("");
  const [location, setLocation] = useState("");

  // ── Item Details ──
  const [category,    setCategory]    = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [itemName,    setItemName]    = useState("");
  const [brand,       setBrand]       = useState("");
  const [model,       setModel]       = useState("");
  const [quantity,    setQuantity]    = useState("");
  const [unit,        setUnit]        = useState("Nos");
  const [unitPrice,   setUnitPrice]   = useState("");
  const [vendor,      setVendor]      = useState("");
  const [requiredBy,  setRequiredBy]  = useState("");

  // ── Purchase Frequency ──
  const [freqType,    setFreqType]    = useState("One-Time");
  const [repeatEvery, setRepeatEvery] = useState(1);
  const [endDate,     setEndDate]     = useState("");
  const [hasEndDate,  setHasEndDate]  = useState(false);

  // ── Additional Details ──
  const [purpose,      setPurpose]      = useState("");
  const [priority,     setPriority]     = useState("Medium");
  const [timeSlot,     setTimeSlot]     = useState("");
  const [notes,        setNotes]        = useState("");

  // ── Attachments ──
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const [dragging,    setDragging]    = useState(false);

  const [submitting, setSubmitting] = useState(false);

  // ── Preview Request ID (shown before submission) ──
  const [previewId] = useState(() => peekNextId("PUR"));

  const selectedClient = clients.find(c => c.id === clientId) ?? null;
  const showFreqInfo   = freqType !== "One-Time";
  const nextOrder      = nextOrderDate(requiredBy, freqType, repeatEvery);

  useEffect(() => {
    if (!selectedClient) { setLocation(""); return; }
    const city  = selectedClient.billingCity  || "";
    const state = selectedClient.billingState || "";
    setLocation(city && state ? `${city}, ${state}` : city || state || selectedClient.billingAddress || "");
  }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setSubCategory(""); }, [category]);

  const availableSubCategories = SUBCATEGORIES[category] ?? [];

  function addFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach(f => {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      if (!["jpg","jpeg","png","pdf","doc","docx","xlsx","xls"].includes(ext)) { toast.error(`${f.name}: unsupported format`); return; }
      if (f.size > 10 * 1024 * 1024) { toast.error(`${f.name}: exceeds 10 MB`); return; }
      setAttachments(prev => [...prev, f]);
    });
  }

  const handleSubmit = () => {
    if (!clientId || !location) { toast.error("Please fill in Client and Location."); return; }
    if (!category || !itemName || !quantity) { toast.error("Please fill in required Item Details."); return; }
    if (!requiredBy) { toast.error("Please fill in Required By Date."); return; }
    if (!purpose || !priority) { toast.error("Please fill in Purpose and Priority."); return; }

    setSubmitting(true);
    try {
      addServiceRequest({
        requestType: "Regular Purchase",
        itemAsset: itemName,
        assetTag: "",
        location,
        requestDate: "",
        status: "Scheduled",
        priority: priority as "Low" | "Medium" | "High",
        nextAppointment: requiredBy
          ? new Date(requiredBy).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
          : "-",
        requestedBy: selectedClient?.rep || "—",
        payload: {
          clientId, client: selectedClient?.name ?? clientId,
          location, requestType: "Regular Purchase",
          category, subCategory, itemName, brand, model,
          quantity, unit, unitPrice, vendor, requiredBy,
          freqType, repeatEvery, endDate, hasEndDate,
          purpose, priority, timeSlot, notes,
          attachments: attachments.map(f => f.name),
        },
      }, "PUR");

      toast.success("Regular purchase request submitted successfully!");
      navigate("/my-services");
    } catch {
      toast.error("Failed to submit request. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Regular Purchase</h1>
            <p className="text-sm text-gray-500 mt-0.5">Raise a new regular purchase request</p>
          </div>
          <button onClick={() => navigate("/my-services")}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-gray-700 transition-colors flex-shrink-0">
            <ListChecks className="w-4 h-4" /> View My Purchase Requests
          </button>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">

        {/* ── Request ID ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-bold text-gray-800 mb-5">Request ID</h2>
          <div className="flex items-center gap-4">
            <div className="flex flex-col gap-1 w-64">
              <label className="text-sm font-medium text-gray-700">Request ID</label>
              <input
                type="text"
                value={previewId}
                readOnly
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-mono font-semibold cursor-not-allowed tracking-wide"
              />
            </div>
            <p className="text-xs text-gray-400 mt-5">
              This ID will be assigned to your request upon submission. It cannot be changed.
            </p>
          </div>
        </div>

        {/* ── Request Details ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Client <span className="text-red-500">*</span></label>
              <div className="relative">
                <select value={clientId} onChange={e => setClientId(e.target.value)}
                  className="w-full appearance-none pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer transition-colors hover:border-gray-400">
                  <option value="">Select Client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <svg className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Location <span className="text-red-500">*</span></label>
              <input type="text" value={location} onChange={e => setLocation(e.target.value)}
                placeholder={clientId ? "Location from client" : "Select a client first"}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors hover:border-gray-400" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Request Type <span className="text-red-500">*</span></label>
              <input type="text" value="Regular Purchase" readOnly className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed" />
            </div>
          </div>

          {selectedClient && (
            <div className="mt-5 rounded-xl border border-teal-100 bg-teal-50 px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-teal-600" />
                <span className="text-sm font-semibold text-teal-800">
                  {selectedClient.name}
                  {selectedClient.status && (
                    <span className={`ml-2 text-xs font-medium px-2 py-0.5 rounded-full ${selectedClient.status === "active" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                      {selectedClient.status.charAt(0).toUpperCase() + selectedClient.status.slice(1)}
                    </span>
                  )}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {selectedClient.rep && <div className="flex items-start gap-2"><User className="w-3.5 h-3.5 text-teal-500 mt-0.5 flex-shrink-0" /><div><p className="text-xs text-teal-500 font-medium">Contact</p><p className="text-xs text-teal-800">{selectedClient.rep}</p></div></div>}
                {selectedClient.email && <div className="flex items-start gap-2"><Mail className="w-3.5 h-3.5 text-teal-500 mt-0.5 flex-shrink-0" /><div><p className="text-xs text-teal-500 font-medium">Email</p><p className="text-xs text-teal-800 break-all">{selectedClient.email}</p></div></div>}
                {(selectedClient.phone || selectedClient.mobile) && <div className="flex items-start gap-2"><Phone className="w-3.5 h-3.5 text-teal-500 mt-0.5 flex-shrink-0" /><div><p className="text-xs text-teal-500 font-medium">Phone</p><p className="text-xs text-teal-800">{selectedClient.phone || selectedClient.mobile}</p></div></div>}
                {(selectedClient.billingAddress || selectedClient.billingCity) && <div className="flex items-start gap-2"><MapPin className="w-3.5 h-3.5 text-teal-500 mt-0.5 flex-shrink-0" /><div><p className="text-xs text-teal-500 font-medium">Address</p><p className="text-xs text-teal-800">{[selectedClient.billingAddress, selectedClient.billingCity, selectedClient.billingState].filter(Boolean).join(", ")}</p></div></div>}
              </div>
            </div>
          )}
        </div>

        {/* ── Item Details ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-bold text-gray-800 mb-5">Item Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <SelectField label="Category" required value={category} onChange={setCategory} options={categories} placeholder="Select Category" />
            <SelectField label="Sub Category (Optional)" value={subCategory} onChange={setSubCategory}
              options={availableSubCategories} placeholder="Select Sub Category" disabled={!category || availableSubCategories.length === 0} />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Item / Product Name <span className="text-red-500">*</span></label>
              <input type="text" value={itemName} onChange={e => setItemName(e.target.value)} placeholder="Enter Item / Product Name"
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors hover:border-gray-400" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mt-5">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Brand (Optional)</label>
              <input type="text" value={brand} onChange={e => setBrand(e.target.value)} placeholder="Enter Brand"
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors hover:border-gray-400" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Model (Optional)</label>
              <input type="text" value={model} onChange={e => setModel(e.target.value)} placeholder="Enter Model"
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors hover:border-gray-400" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Quantity <span className="text-red-500">*</span></label>
              <input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Enter Quantity"
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors hover:border-gray-400" />
            </div>
            <SelectField label="Unit" value={unit} onChange={setUnit} options={UNITS} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Estimated Unit Price (Optional)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₹</span>
                <input type="text" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors hover:border-gray-400" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Preferred Vendor (Optional)</label>
              <div className="relative">
                <input type="text" value={vendor} onChange={e => setVendor(e.target.value)} placeholder="Select Vendor"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors hover:border-gray-400" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Required By Date <span className="text-red-500">*</span></label>
              <div className="relative">
                <input type="date" value={requiredBy} onChange={e => setRequiredBy(e.target.value)}
                  className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors hover:border-gray-400" />
                <Calendar className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Purchase Frequency ── */}
        <div className="bg-white rounded-xl border border-blue-200 p-6">
          <div className="flex items-start justify-between gap-4 mb-1">
            <div>
              <h2 className="text-base font-bold text-gray-800">Purchase Frequency <span className="text-red-500">*</span></h2>
              <p className="text-xs text-gray-500 mt-0.5">Select how often you need this item. Orders will be created automatically based on this frequency.</p>
            </div>
            {/* End Date toggle */}
            {freqType !== "One-Time" && (
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer flex-shrink-0">
                <input type="checkbox" checked={hasEndDate} onChange={e => setHasEndDate(e.target.checked)} className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600" />
                End Date (Optional)
                {hasEndDate && (
                  <div className="relative ml-1">
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                      className="pl-2 pr-7 py-1 text-xs border border-gray-300 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    <Calendar className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                )}
              </label>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-5 mt-4">
            <div className="flex flex-col gap-1 min-w-[160px]">
              <label className="text-sm font-medium text-gray-700">Frequency Type <span className="text-red-500">*</span></label>
              <div className="relative">
                <select value={freqType} onChange={e => setFreqType(e.target.value)}
                  className="w-full appearance-none pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer transition-colors hover:border-gray-400">
                  {FREQ_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <svg className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>

            {showFreqInfo && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Repeat Every <span className="text-red-500">*</span></label>
                  <div className="flex items-center gap-2">
                    <input type="number" min="1" value={repeatEvery} onChange={e => setRepeatEvery(Math.max(1, Number(e.target.value)))}
                      className="w-20 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors hover:border-gray-400" />
                    <span className="text-sm text-gray-500">{repeatUnit(freqType)}</span>
                  </div>
                </div>

                {/* How it works info box */}
                <div className="flex-1 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 min-w-[260px]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                    <p className="text-xs font-semibold text-blue-700">How it works</p>
                  </div>
                  <p className="text-xs text-blue-600">
                    A new purchase order will be created automatically every {repeatEvery} {repeatUnit(freqType).toLowerCase()}{hasEndDate && endDate ? " until the end date" : ""}.
                  </p>
                  {nextOrder && (
                    <p className="text-xs text-blue-600 mt-0.5">
                      Next order will be created on:{" "}
                      <span className="font-semibold text-blue-700">{nextOrder}</span>
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Additional Details ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-bold text-gray-800 mb-5">Additional Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <SelectField label="Purpose / Description" required value={purpose} onChange={setPurpose} options={PURPOSES} placeholder="Select Purpose" />
            <SelectField label="Priority" required value={priority} onChange={setPriority} options={PRIORITIES} />
            <SelectField label="Preferred Time Slot" value={timeSlot} onChange={setTimeSlot} options={TIME_SLOTS} placeholder="Select Time Slot" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
            {/* Notes */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Additional Notes (Optional)</label>
              <div className="relative">
                <textarea value={notes} onChange={e => setNotes(e.target.value.slice(0, 1000))}
                  placeholder="Provide any additional information..." rows={5}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-colors hover:border-gray-400" />
                <span className="absolute bottom-2 right-3 text-xs text-gray-400">{notes.length} / 1000</span>
              </div>
            </div>
            {/* Attachments */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Attachments (Optional)</label>
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 cursor-pointer transition-colors ${dragging ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100"}`}
                style={{ minHeight: "130px" }}
              >
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                  <Upload className="w-4 h-4 text-gray-500" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700">Drag and drop files here or click to upload</p>
                  <p className="text-xs text-gray-400 mt-0.5">Supported formats: JPG, PNG, PDF, DOC, XLSX (Max size: 10MB)</p>
                </div>
              </div>
              <input ref={fileInputRef} type="file" multiple accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xlsx,.xls" className="hidden" onChange={e => addFiles(e.target.files)} />
              {attachments.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {attachments.map((f, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-bold text-gray-500 uppercase bg-gray-100 rounded px-1.5 py-0.5">{f.name.split(".").pop()}</span>
                        <p className="text-xs text-gray-700 truncate">{f.name}</p>
                      </div>
                      <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 flex-shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* ── Action Buttons ── */}
        <div className="flex justify-end gap-3 pb-8">
          <button onClick={() => navigate("/services")}
            className="px-6 py-2.5 text-sm font-medium border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-gray-700 transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={submitting}
            className="px-6 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
            {submitting ? "Submitting…" : "Submit Request"}
          </button>
        </div>

      </div>
    </div>
  );
}
