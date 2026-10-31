import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, ListChecks, Upload, X, Building2, User, Phone, Mail, MapPin } from "lucide-react";
import { toast } from "sonner";
import { addServiceRequest, peekNextId } from "@/lib/serviceRequestsStore";
import { getClients, type StoredClient } from "@/lib/clientStore";
import { getHsnCodes, getSacCodes } from "@/lib/taxEngine";
import { sanitizePhoneNumber, isValidPhoneNumber } from "@/lib/phoneValidation";

// ─── Static options ────────────────────────────────────────────────────────────
const CONDITIONS   = ["Working", "Not Working", "Partially Working", "Damaged / Broken", "Unknown"];
const REASONS      = ["End of Life", "Upgrade / Replacement", "Excess / Surplus", "Damaged Beyond Repair", "Compliance / Regulatory", "Other"];
const TIME_SLOTS   = ["09:00 AM - 11:00 AM", "11:00 AM - 01:00 PM", "01:00 PM - 03:00 PM", "03:00 PM - 05:00 PM"];
const UNITS        = ["Nos", "Kg", "Pcs", "Sets", "Lots"];

// ─── Category → Sub-category map ──────────────────────────────────────────────
const SUBCATEGORIES: Record<string, string[]> = {
  "Computers & Laptops":     ["Desktops", "Laptops", "Workstations", "Servers", "Tablets"],
  "Computer Peripherals":    ["Monitors", "Keyboards", "Mice", "Webcams", "Speakers"],
  "Networking":              ["Switches", "Routers", "Access Points", "Firewalls", "Cables"],
  "Printers & Scanners":     ["Laser Printers", "Inkjet Printers", "Scanners", "MFPs"],
  "Storage Devices":         ["Hard Drives", "SSDs", "USB Drives", "External Drives", "Tapes"],
  "CCTV & Security":         ["IP Cameras", "NVRs", "DVRs", "Access Cards", "Biometrics"],
  "UPS & Batteries":         ["UPS Units", "Batteries", "Inverters"],
  "Telecommunication":       ["IP Phones", "PBX Systems", "Headsets"],
  "Audio & Video Equipment": ["Projectors", "Displays", "Audio Systems", "Microphones"],
  "Electrical Equipment":    ["Switchgear", "MCBs", "Wiring Accessories"],
  "Electrical Appliances":   ["Air Conditioners", "Fans", "Heaters"],
  "Furniture":               ["Desks", "Cabinets", "Tables"],
  "Office Chairs":           ["Executive Chairs", "Task Chairs", "Visitor Chairs"],
};

function loadCategories(): string[] {
  const hsn = getHsnCodes().filter(c => c.status === "Active").map(c => c.productCategory);
  const sac = getSacCodes().filter(c => c.status === "Active").map(c => c.serviceCategory);
  return Array.from(new Set([...hsn, ...sac])).sort((a, b) => a.localeCompare(b));
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
        <select
          value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
          className="w-full appearance-none pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400 cursor-pointer transition-colors hover:border-gray-400"
        >
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
export default function NewRecycleDisposalPage() {
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

  // ── Item / Asset Details ──
  const [category,    setCategory]    = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [itemName,    setItemName]    = useState("");
  const [brand,       setBrand]       = useState("");
  const [model,       setModel]       = useState("");
  const [quantity,    setQuantity]    = useState("");
  const [unit,        setUnit]        = useState("Nos");
  const [condition,   setCondition]   = useState("");
  const [reason,      setReason]      = useState("");
  const [purchaseDate,setPurchaseDate]= useState("");
  const [invoiceRef,  setInvoiceRef]  = useState("");

  // ── Collection Details ──
  const [collectionDate,   setCollectionDate]   = useState("");
  const [timeSlot,         setTimeSlot]         = useState("");
  const [contactPerson,    setContactPerson]    = useState("");
  const [contactNumber,    setContactNumber]    = useState("");

  // ── Additional Information ──
  const [notes,       setNotes]       = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging,    setDragging]    = useState(false);

  const [submitting, setSubmitting] = useState(false);

  // ── Preview Request ID (shown before submission) ──
  const [previewId] = useState(() => peekNextId("REC"));

  const selectedClient = clients.find(c => c.id === clientId) ?? null;

  useEffect(() => {
    if (!selectedClient) { setLocation(""); return; }
    const city  = selectedClient.billingCity  || "";
    const state = selectedClient.billingState || "";
    setLocation(city && state ? `${city}, ${state}` : city || state || selectedClient.billingAddress || "");
    if (selectedClient.rep) setContactPerson(selectedClient.rep);
    if (selectedClient.phone || selectedClient.mobile) setContactNumber(selectedClient.phone || selectedClient.mobile || "");
  }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setSubCategory(""); }, [category]);

  const availableSubCategories = SUBCATEGORIES[category] ?? [];

  function addFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach(f => {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      if (!["jpg","jpeg","png","pdf","doc","docx"].includes(ext)) { toast.error(`${f.name}: unsupported format`); return; }
      if (f.size > 10 * 1024 * 1024) { toast.error(`${f.name}: exceeds 10 MB`); return; }
      setAttachments(prev => [...prev, f]);
    });
  }

  const handleSubmit = () => {
    if (!clientId || !location) { toast.error("Please fill in Client and Location."); return; }
    if (!category || !itemName || !quantity) { toast.error("Please fill in required Item / Asset Details."); return; }
    if (!condition || !reason) { toast.error("Please select Condition and Reason for Disposal."); return; }
    if (!collectionDate || !timeSlot || !contactPerson || !contactNumber) {
      toast.error("Please fill in all Collection Details."); return;
    }
    if (!isValidPhoneNumber(contactNumber)) { toast.error("Contact number must contain exactly 10 digits."); return; }

    setSubmitting(true);
    try {
      addServiceRequest({
        requestType: "Recycle / Disposal",
        itemAsset: itemName,
        assetTag: "",
        location,
        requestDate: "",
        status: "Scheduled",
        priority: "Medium",
        nextAppointment: collectionDate
          ? new Date(collectionDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) + `\n${timeSlot}`
          : "-",
        requestedBy: selectedClient?.rep || "—",
        payload: {
          clientId, client: selectedClient?.name ?? clientId,
          location, requestType: "Recycle / Disposal",
          category, subCategory, itemName, brand, model,
          quantity, unit, condition, reason, purchaseDate, invoiceRef,
          collectionDate, timeSlot, contactPerson, contactNumber, notes,
          attachments: attachments.map(f => f.name),
        },
      }, "REC");

      toast.success("Recycle / Disposal request submitted successfully!");
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
            <h1 className="text-2xl font-bold text-gray-900">Recycle / Disposal</h1>
            <p className="text-sm text-gray-500 mt-0.5">Raise a new recycle or disposal request</p>
          </div>
          <button
            onClick={() => navigate("/my-services")}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-gray-700 transition-colors flex-shrink-0"
          >
            <ListChecks className="w-4 h-4" /> View My Requests
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
          <h2 className="text-base font-bold text-gray-800 mb-5">Request Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Client */}
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
            {/* Location */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Location <span className="text-red-500">*</span></label>
              <input type="text" value={location} onChange={e => setLocation(e.target.value)}
                placeholder={clientId ? "Location from client" : "Select a client first"}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors hover:border-gray-400" />
            </div>
            {/* Request Type */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Request Type <span className="text-red-500">*</span></label>
              <input type="text" value="Recycle / Disposal" readOnly
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed" />
            </div>
          </div>

          {/* Client info card */}
          {selectedClient && (
            <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-800">
                  {selectedClient.name}
                  {selectedClient.status && (
                    <span className={`ml-2 text-xs font-medium px-2 py-0.5 rounded-full ${selectedClient.status === "active" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                      {selectedClient.status.charAt(0).toUpperCase() + selectedClient.status.slice(1)}
                    </span>
                  )}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {selectedClient.rep && (
                  <div className="flex items-start gap-2"><User className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" /><div><p className="text-xs text-emerald-500 font-medium">Contact Person</p><p className="text-xs text-emerald-800">{selectedClient.rep}</p></div></div>
                )}
                {selectedClient.email && (
                  <div className="flex items-start gap-2"><Mail className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" /><div><p className="text-xs text-emerald-500 font-medium">Email</p><p className="text-xs text-emerald-800 break-all">{selectedClient.email}</p></div></div>
                )}
                {(selectedClient.phone || selectedClient.mobile) && (
                  <div className="flex items-start gap-2"><Phone className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" /><div><p className="text-xs text-emerald-500 font-medium">Phone</p><p className="text-xs text-emerald-800">{selectedClient.phone || selectedClient.mobile}</p></div></div>
                )}
                {(selectedClient.billingAddress || selectedClient.billingCity) && (
                  <div className="flex items-start gap-2"><MapPin className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" /><div><p className="text-xs text-emerald-500 font-medium">Address</p><p className="text-xs text-emerald-800">{[selectedClient.billingAddress, selectedClient.billingCity, selectedClient.billingState].filter(Boolean).join(", ")}</p></div></div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Item / Asset Details ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-bold text-gray-800 mb-5">Item / Asset Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <SelectField label="Category" required value={category} onChange={setCategory} options={categories} placeholder="Select Category" />
            <SelectField label="Sub Category (Optional)" value={subCategory} onChange={setSubCategory}
              options={availableSubCategories} placeholder="Select Sub Category" disabled={!category || availableSubCategories.length === 0} />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Item/Asset Name <span className="text-red-500">*</span></label>
              <input type="text" value={itemName} onChange={e => setItemName(e.target.value)} placeholder="Enter Item/Asset Name"
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mt-5">
            <SelectField label="Condition of Item" required value={condition} onChange={setCondition} options={CONDITIONS} placeholder="Select Condition" />
            <SelectField label="Reason for Disposal" required value={reason} onChange={setReason} options={REASONS} placeholder="Select Reason" />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Purchase Date (Optional)</label>
              <div className="relative">
                <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)}
                  className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors hover:border-gray-400" />
                <Calendar className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Invoice / Reference No. (Optional)</label>
              <input type="text" value={invoiceRef} onChange={e => setInvoiceRef(e.target.value)} placeholder="Enter Invoice / Reference No."
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors hover:border-gray-400" />
            </div>
          </div>
        </div>

        {/* ── Collection Details ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-bold text-gray-800 mb-5">Collection Details</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Preferred Collection Date <span className="text-red-500">*</span></label>
              <div className="relative">
                <input type="date" value={collectionDate} onChange={e => setCollectionDate(e.target.value)}
                  className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors hover:border-gray-400" />
                <Calendar className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <SelectField label="Preferred Time Slot" required value={timeSlot} onChange={setTimeSlot} options={TIME_SLOTS} placeholder="Select Time Slot" />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Contact Person <span className="text-red-500">*</span></label>
              <input type="text" value={contactPerson} onChange={e => setContactPerson(e.target.value)} placeholder="Enter Contact Person"
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors hover:border-gray-400" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Contact Number <span className="text-red-500">*</span></label>
              <input type="tel" inputMode="numeric" maxLength={10} value={contactNumber} onChange={e => setContactNumber(sanitizePhoneNumber(e.target.value))} placeholder="10-digit contact number"
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors hover:border-gray-400" />
            </div>
          </div>
        </div>

        {/* ── Additional Information ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-bold text-gray-800 mb-5">Additional Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                  <p className="text-xs text-gray-400 mt-0.5">Supported formats: JPG, PNG, PDF, DOC (Max size: 10MB)</p>
                </div>
              </div>
              <input ref={fileInputRef} type="file" multiple accept=".jpg,.jpeg,.png,.pdf,.doc,.docx" className="hidden" onChange={e => addFiles(e.target.files)} />
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
