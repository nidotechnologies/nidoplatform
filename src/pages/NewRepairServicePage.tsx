import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, ListChecks, Upload, X, Building2, User, Phone, Mail, MapPin } from "lucide-react";
import { toast } from "sonner";
import { addServiceRequest, peekNextId } from "@/lib/serviceRequestsStore";
import { getClients, type StoredClient } from "@/lib/clientStore";
import { getHsnCodes, getSacCodes } from "@/lib/taxEngine";

// ─── Static options ────────────────────────────────────────────────────────────
const PRIORITIES = ["Low", "Medium", "High"];

// ─── Brand / Model mapping (same reference data as AMC page) ──────────────────
const BRANDS_BY_CATEGORY: Record<string, string[]> = {
  "Computers & Laptops":     ["Dell", "HP", "Lenovo", "Apple", "Asus", "Acer", "Microsoft"],
  "Computer Peripherals":    ["Logitech", "Dell", "HP", "Samsung", "LG", "BenQ"],
  "Networking":              ["Cisco", "D-Link", "TP-Link", "Netgear", "Aruba", "Ubiquiti"],
  "Printers & Scanners":     ["HP", "Canon", "Epson", "Brother", "Xerox", "Ricoh"],
  "Storage Devices":         ["Seagate", "WD", "Samsung", "SanDisk", "Toshiba"],
  "Furniture":               ["Godrej", "Herman Miller", "Durian", "Featherlite"],
  "Office Chairs":           ["Godrej", "Herman Miller", "Green Soul", "Featherlite"],
  "Electrical Equipment":    ["Havells", "Schneider", "ABB", "Legrand", "Siemens"],
  "Electrical Appliances":   ["Havells", "Bajaj", "Philips", "Crompton"],
  "Lighting":                ["Philips", "Havells", "Osram", "Syska", "Bajaj"],
  "CCTV & Security":         ["Hikvision", "Dahua", "Axis", "Bosch", "CP Plus"],
  "Access Control":          ["HID", "Honeywell", "ZKTeco", "Suprema", "eSSL"],
  "UPS & Batteries":         ["APC", "Emerson", "Luminous", "Eaton", "Microtek"],
  "Power Backup":            ["APC", "Emerson", "Luminous", "Eaton", "Su-Kam"],
  "Telecommunication":       ["Cisco", "Panasonic", "Polycom", "Avaya", "Grandstream"],
  "Audio & Video Equipment": ["Sony", "Samsung", "LG", "Bose", "JBL", "Yamaha"],
  "Projectors & Displays":   ["Epson", "BenQ", "ViewSonic", "Sony", "NEC"],
  "Medical Equipment":       ["Philips", "GE Healthcare", "Siemens Healthineers", "Mindray"],
  "Safety Equipment":        ["Honeywell", "3M", "Karam", "Uvex"],
  "Fire Safety":             ["Minimax", "Firepro", "Ceasefire", "Hochiki"],
  "Industrial Tools":        ["Bosch", "Makita", "DeWalt", "Stanley"],
};

const MODELS_BY_BRAND: Record<string, Record<string, string[]>> = {
  "Computers & Laptops": {
    Dell:      ["Latitude 5420", "Latitude 7420", "Inspiron 15", "XPS 13", "OptiPlex 3080"],
    HP:        ["EliteBook 840", "ProBook 450", "Pavilion 15", "EliteDesk 800"],
    Lenovo:    ["ThinkPad E14", "IdeaPad 3", "ThinkPad X1 Carbon", "ThinkCentre M720"],
    Apple:     ["MacBook Air M2", "MacBook Pro 14", "MacBook Pro 16", "Mac Mini M2"],
    Asus:      ["ZenBook 14", "VivoBook 15", "ExpertBook B9"],
    Acer:      ["Aspire 5", "Swift 3", "Predator Helios 300"],
    Microsoft: ["Surface Laptop 5", "Surface Pro 9", "Surface Book 3"],
  },
  Networking: {
    Cisco:    ["Catalyst 2960-X", "Catalyst 9200", "ASA 5506", "RV340", "SG350"],
    "D-Link": ["DGS-1210", "DES-1210", "DIR-878"],
    "TP-Link":["TL-SG108", "TL-SG1016", "Deco M5", "EAP670"],
    Netgear:  ["GS308", "GS724T", "Nighthawk AX12"],
    Aruba:    ["Instant On AP22", "2530 Switch", "ClearPass"],
    Ubiquiti: ["UniFi AP-AC-Pro", "EdgeSwitch 24", "Dream Machine"],
  },
  "Printers & Scanners": {
    HP:     ["LaserJet Pro M404n", "OfficeJet Pro 9010", "Color LaserJet M452dn"],
    Canon:  ["imageCLASS MF3010", "PIXMA G3010", "imageRUNNER 2425"],
    Epson:  ["EcoTank L3150", "WorkForce WF-7820", "DS-530"],
    Brother:["HL-L2321D", "MFC-L2701DW", "DCP-L3551CDW"],
    Xerox:  ["VersaLink C405", "WorkCentre 6515", "Phaser 6510"],
  },
  "CCTV & Security": {
    Hikvision: ["DS-2CD2143G2-I", "DS-2CD2347G2-LU", "DS-7608NI-K2"],
    Dahua:     ["IPC-HDW2831T-AS", "NVR4104HS-P-4KS2", "SD49425XB-HNR"],
    Axis:      ["P3245-V", "M3106-L Mk II", "Q6135-LE"],
    Bosch:     ["FLEXIDOME 5100i", "AUTODOME 5100i", "DIVAR IP 3000"],
    "CP Plus": ["CP-UNC-DA41PL3-MDS", "CP-UVR-0401E1-H", "CP-VNR-0401E1"],
  },
  "UPS & Batteries": {
    APC:      ["Smart-UPS 1500VA", "Back-UPS 650VA", "Smart-UPS 3000VA", "Easy UPS 1Ph"],
    Emerson:  ["Liebert PS 1000", "Liebert GXT5", "Liebert ITA2"],
    Luminous: ["Cruze 1 KVA", "Eco Volt Neo 1050", "Pro 1650"],
    Eaton:    ["5P 1550VA", "9PX 2000", "Ellipse ECO 650"],
    Microtek: ["UPS Tuff Plus 1250", "UPS EB 700 VA", "UPS Hybrid"],
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
function loadCategories(): string[] {
  const hsn = getHsnCodes().filter(c => c.status === "Active").map(c => c.productCategory);
  const sac = getSacCodes().filter(c => c.status === "Active").map(c => c.serviceCategory);
  return Array.from(new Set([...hsn, ...sac])).sort((a, b) => a.localeCompare(b));
}

// ─── Sub-components ────────────────────────────────────────────────────────────
interface SelectFieldProps {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
}
function SelectField({ label, required, value, onChange, options, placeholder, disabled }: SelectFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
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
export default function NewRepairServicePage() {
  const navigate = useNavigate();

  // ── Live data ──
  const [clients,    setClients]    = useState<StoredClient[]>(() => getClients());
  const [categories, setCategories] = useState<string[]>(() => loadCategories());

  useEffect(() => {
    const onClientsChange = () => setClients(getClients());
    const onTaxChange     = () => setCategories(loadCategories());
    window.addEventListener("nidoClientsUpdated", onClientsChange);
    window.addEventListener("taxEngineUpdated",   onTaxChange);
    return () => {
      window.removeEventListener("nidoClientsUpdated", onClientsChange);
      window.removeEventListener("taxEngineUpdated",   onTaxChange);
    };
  }, []);

  // ── Request Details ──
  const [clientId,  setClientId]  = useState("");
  const [location,  setLocation]  = useState("");

  // ── Equipment Details ──
  const [category,     setCategory]     = useState("");
  const [brand,        setBrand]        = useState("");
  const [model,        setModel]        = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [assetTag,     setAssetTag]     = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");

  // ── Issue Details ──
  const [issueSubject, setIssueSubject] = useState("");
  const [priority,     setPriority]     = useState("Medium");
  const [issueDesc,    setIssueDesc]    = useState("");
  const [prefDate,     setPrefDate]     = useState("");

  // ── Attachments ──
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  // ── Preview Request ID (shown before submission) ──
  const [previewId] = useState(() => peekNextId("REP"));

  // ── Derived selected client ──
  const selectedClient = clients.find(c => c.id === clientId) ?? null;

  // ── Auto-fill location from client ──
  useEffect(() => {
    if (!selectedClient) { setLocation(""); return; }
    const city  = selectedClient.billingCity  || "";
    const state = selectedClient.billingState || "";
    setLocation(city && state ? `${city}, ${state}` : city || state || selectedClient.billingAddress || "");
  }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset brand/model when category changes ──
  useEffect(() => { setBrand(""); setModel(""); }, [category]);
  useEffect(() => { setModel(""); }, [brand]);

  // ── Derived options ──
  const availableBrands = category ? (BRANDS_BY_CATEGORY[category] ?? ["Other"]) : [];
  const availableModels = category && brand ? (MODELS_BY_BRAND[category]?.[brand] ?? ["Other"]) : [];

  // ── Attachment helpers ──
  function addFiles(files: FileList | null) {
    if (!files) return;
    const valid: File[] = [];
    Array.from(files).forEach(f => {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      const allowed = ["jpg", "jpeg", "png", "pdf", "doc", "docx"];
      if (!allowed.includes(ext)) { toast.error(`${f.name}: unsupported format`); return; }
      if (f.size > 10 * 1024 * 1024) { toast.error(`${f.name}: exceeds 10 MB`); return; }
      valid.push(f);
    });
    setAttachments(prev => [...prev, ...valid]);
  }

  function removeAttachment(idx: number) {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  }

  // ── Validate & Submit ──
  const handleSubmit = () => {
    if (!clientId)     { toast.error("Please select a Client."); return; }
    if (!location)     { toast.error("Please enter a Location."); return; }
    if (!category)     { toast.error("Please select a Category in Equipment Details."); return; }
    if (!issueSubject) { toast.error("Please enter an Issue Subject."); return; }
    if (!issueDesc)    { toast.error("Please enter an Issue Description."); return; }

    setSubmitting(true);
    try {
      const clientName = selectedClient?.name ?? clientId;
      const itemLabel  = [brand, model].filter(Boolean).join(" ") || category;
      addServiceRequest({
        requestType: "Repair Service",
        itemAsset: itemLabel,
        assetTag: assetTag || "",
        location,
        requestDate: "",
        status: "Scheduled",
        priority: priority as "Low" | "Medium" | "High",
        nextAppointment: prefDate
          ? new Date(prefDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) + "\n10:00 AM"
          : "-",
        requestedBy: selectedClient?.rep || "—",
        payload: {
          clientId, client: clientName,
          location, requestType: "Repair Service",
          category, brand, model,
          serialNumber, assetTag, purchaseDate,
          issueSubject, priority, issueDesc, prefDate,
          attachments: attachments.map(f => f.name),
        },
      }, "REP");

      toast.success("Repair service request submitted successfully!");
      navigate("/my-services");
    } catch {
      toast.error("Failed to submit request. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Page Header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Repair Service</h1>
            <p className="text-sm text-gray-500 mt-0.5">Raise a new repair service request</p>
          </div>
          <button
            onClick={() => navigate("/my-services")}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-gray-700 transition-colors flex-shrink-0"
          >
            <ListChecks className="w-4 h-4" /> View My Repair Requests
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

            {/* Client */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Client <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  className="w-full appearance-none pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer transition-colors hover:border-gray-400"
                >
                  <option value="">Select Client</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <svg className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Location — auto-filled */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Location <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder={clientId ? "Location from client" : "Select a client first"}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors hover:border-gray-400"
              />
            </div>

            {/* Request Type — read-only */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Request Type <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value="Repair Service"
                readOnly
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
              />
            </div>
          </div>

          {/* Client Details Card */}
          {selectedClient && (
            <div className="mt-5 rounded-xl border border-orange-100 bg-orange-50 px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-semibold text-orange-800">
                  {selectedClient.name}
                  {selectedClient.tier && (
                    <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">{selectedClient.tier}</span>
                  )}
                  {selectedClient.status && (
                    <span className={`ml-2 text-xs font-medium px-2 py-0.5 rounded-full ${selectedClient.status === "active" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                      {selectedClient.status.charAt(0).toUpperCase() + selectedClient.status.slice(1)}
                    </span>
                  )}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {selectedClient.rep && (
                  <div className="flex items-start gap-2">
                    <User className="w-3.5 h-3.5 text-orange-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-orange-500 font-medium">Contact Person</p>
                      <p className="text-xs text-orange-800">{selectedClient.rep}</p>
                    </div>
                  </div>
                )}
                {selectedClient.email && (
                  <div className="flex items-start gap-2">
                    <Mail className="w-3.5 h-3.5 text-orange-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-orange-500 font-medium">Email</p>
                      <p className="text-xs text-orange-800 break-all">{selectedClient.email}</p>
                    </div>
                  </div>
                )}
                {(selectedClient.phone || selectedClient.mobile) && (
                  <div className="flex items-start gap-2">
                    <Phone className="w-3.5 h-3.5 text-orange-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-orange-500 font-medium">Phone</p>
                      <p className="text-xs text-orange-800">{selectedClient.phone || selectedClient.mobile}</p>
                    </div>
                  </div>
                )}
                {(selectedClient.billingAddress || selectedClient.billingCity) && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-orange-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-orange-500 font-medium">Billing Address</p>
                      <p className="text-xs text-orange-800">
                        {[selectedClient.billingAddress, selectedClient.billingCity, selectedClient.billingState, selectedClient.billingPincode]
                          .filter(Boolean).join(", ")}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Equipment Details ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-bold text-gray-800 mb-5">Equipment Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <SelectField
              label="Category" required value={category} onChange={setCategory}
              options={categories} placeholder="Select Category"
            />
            <SelectField
              label="Brand (Optional)" value={brand} onChange={setBrand}
              options={availableBrands}
              placeholder={category ? "Select Brand" : "Select Category first"}
              disabled={!category}
            />
            <SelectField
              label="Model (Optional)" value={model} onChange={setModel}
              options={availableModels}
              placeholder={brand ? "Select Model" : "Select Brand first"}
              disabled={!brand}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5">
            {/* Serial Number */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Serial Number / IMEI</label>
              <input
                type="text"
                value={serialNumber}
                onChange={e => setSerialNumber(e.target.value)}
                placeholder="Enter Serial Number / IMEI"
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors hover:border-gray-400"
              />
            </div>
            {/* Asset Tag */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Asset Tag (Optional)</label>
              <input
                type="text"
                value={assetTag}
                onChange={e => setAssetTag(e.target.value)}
                placeholder="Enter Asset Tag"
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors hover:border-gray-400"
              />
            </div>
            {/* Purchase Date */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Purchase Date (Optional)</label>
              <div className="relative">
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={e => setPurchaseDate(e.target.value)}
                  className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors hover:border-gray-400"
                />
                <Calendar className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Issue Details ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-bold text-gray-800 mb-5">Issue Details</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Issue Subject */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Issue Subject <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={issueSubject}
                onChange={e => setIssueSubject(e.target.value)}
                placeholder="Brief description of the issue"
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors hover:border-gray-400"
              />
            </div>
            {/* Priority */}
            <SelectField
              label="Priority" required value={priority} onChange={setPriority}
              options={PRIORITIES}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
            {/* Issue Description */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Issue Description <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <textarea
                  value={issueDesc}
                  onChange={e => setIssueDesc(e.target.value.slice(0, 1000))}
                  placeholder="Please provide detailed information about the issue..."
                  rows={5}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-colors hover:border-gray-400"
                />
                <span className="absolute bottom-2 right-3 text-xs text-gray-400">{issueDesc.length} / 1000</span>
              </div>
            </div>

            {/* Preferred Appointment Date */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Preferred Appointment Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={prefDate}
                  onChange={e => setPrefDate(e.target.value)}
                  className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors hover:border-gray-400"
                />
                <Calendar className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Attachments ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-bold text-gray-800 mb-5">Attachments (Optional)</h2>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-8 cursor-pointer transition-colors ${
              dragging
                ? "border-blue-400 bg-blue-50"
                : "border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100"
            }`}
          >
            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
              <Upload className="w-5 h-5 text-gray-500" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">Drag and drop files here or click to upload</p>
              <p className="text-xs text-gray-400 mt-0.5">Supported formats: JPG, PNG, PDF, DOC, DOCX &nbsp;•&nbsp; Max size: 10MB</p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
            className="hidden"
            onChange={e => addFiles(e.target.files)}
          />

          {/* File list */}
          {attachments.length > 0 && (
            <ul className="mt-4 space-y-2">
              {attachments.map((f, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-4 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-bold text-gray-500 uppercase">{f.name.split(".").pop()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-700 truncate">{f.name}</p>
                      <p className="text-[10px] text-gray-400">{(f.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeAttachment(i)}
                    className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Action Buttons ── */}
        <div className="flex justify-end gap-3 pb-8">
          <button
            onClick={() => navigate("/services")}
            className="px-6 py-2.5 text-sm font-medium border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-6 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Submitting…" : "Submit Request"}
          </button>
        </div>

      </div>
    </div>
  );
}
