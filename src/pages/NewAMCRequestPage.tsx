import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, CalendarDays, ListChecks, User, Phone, Mail, MapPin, Building2 } from "lucide-react";
import { toast } from "sonner";
import { addServiceRequest, peekNextId } from "@/lib/serviceRequestsStore";
import { getClients, type StoredClient } from "@/lib/clientStore";
import { getHsnCodes, getSacCodes } from "@/lib/taxEngine";
import {
  addCustomAMCEquipmentOption,
  getCustomAMCEquipmentOptions,
  type CustomAMCEquipmentOptions,
} from "@/lib/amcEquipmentOptionsStore";

// ─── Static options ────────────────────────────────────────────────────────────
const REQUEST_TYPES = ["AMC Service"];
const AMC_PERIODS   = ["6 Months", "1 Year", "2 Years", "3 Years"];
const FREQUENCIES   = ["Monthly", "Quarterly", "Half-Yearly", "Annually"];
const PRIORITIES    = ["Low", "Medium", "High"];

const VISITS_PER_PERIOD: Record<string, Record<string, number>> = {
  "6 Months": { Monthly: 6,  Quarterly: 2,  "Half-Yearly": 1, Annually: 0 },
  "1 Year":   { Monthly: 12, Quarterly: 4,  "Half-Yearly": 2, Annually: 1 },
  "2 Years":  { Monthly: 24, Quarterly: 8,  "Half-Yearly": 4, Annually: 2 },
  "3 Years":  { Monthly: 36, Quarterly: 12, "Half-Yearly": 6, Annually: 3 },
};

// ─── Brand / Model mapping keyed by HSN/SAC category name ─────────────────────
// Brands and models are static reference data; categories are driven by HSN/SAC.
const BRANDS_BY_CATEGORY: Record<string, string[]> = {
  "Computers & Laptops":      ["Dell", "HP", "Lenovo", "Apple", "Asus", "Acer", "Microsoft"],
  "Computer Peripherals":     ["Logitech", "Dell", "HP", "Samsung", "LG", "BenQ"],
  "Networking":               ["Cisco", "D-Link", "TP-Link", "Netgear", "Aruba", "Ubiquiti"],
  "Printers & Scanners":      ["HP", "Canon", "Epson", "Brother", "Xerox", "Ricoh"],
  "Storage Devices":          ["Seagate", "WD", "Samsung", "SanDisk", "Toshiba"],
  "Furniture":                ["Godrej", "Herman Miller", "Durian", "Featherlite"],
  "Office Chairs":            ["Godrej", "Herman Miller", "Green Soul", "Featherlite"],
  "Electrical Equipment":     ["Havells", "Schneider", "ABB", "Legrand", "Siemens"],
  "Electrical Appliances":    ["Havells", "Bajaj", "Philips", "Crompton"],
  "Lighting":                 ["Philips", "Havells", "Osram", "Syska", "Bajaj"],
  "CCTV & Security":          ["Hikvision", "Dahua", "Axis", "Bosch", "CP Plus"],
  "Access Control":           ["HID", "Honeywell", "ZKTeco", "Suprema", "eSSL"],
  "UPS & Batteries":          ["APC", "Emerson", "Luminous", "Eaton", "Microtek"],
  "Power Backup":             ["APC", "Emerson", "Luminous", "Eaton", "Su-Kam"],
  "Telecommunication":        ["Cisco", "Panasonic", "Polycom", "Avaya", "Grandstream"],
  "Audio & Video Equipment":  ["Sony", "Samsung", "LG", "Bose", "JBL", "Yamaha"],
  "Projectors & Displays":    ["Epson", "BenQ", "ViewSonic", "Sony", "NEC"],
  "Medical Equipment":        ["Philips", "GE Healthcare", "Siemens Healthineers", "Mindray"],
  "Safety Equipment":         ["Honeywell", "3M", "Karam", "Uvex"],
  "Fire Safety":              ["Minimax", "Firepro", "Ceasefire", "Hochiki"],
  "Industrial Tools":         ["Bosch", "Makita", "DeWalt", "Stanley"],
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
  "Power Backup": {
    APC:      ["Smart-UPS 1500VA", "Smart-UPS 3000VA", "Symmetra LX 8kVA"],
    Emerson:  ["Liebert GXT5 10kVA", "Liebert NX 10kVA"],
    Luminous: ["Cruze+ 1 KVA", "Solar NXT 1100"],
    Eaton:    ["9SX 3000VA", "9PX 6000VA"],
    "Su-Kam": ["Falcon+ 1 KVA", "Brainy Eco 1100"],
  },
  Telecommunication: {
    Cisco:       ["IP Phone 7945", "IP Phone 8851", "IP Phone 7821", "IP Phone 8865"],
    Panasonic:   ["KX-NT553", "KX-NT343", "KX-TGP600"],
    Polycom:     ["VVX 411", "VVX 501", "Trio 8500"],
    Avaya:       ["J179", "J189", "B179"],
    Grandstream: ["GXP2170", "GXP1628", "GRP2601"],
  },
  "Projectors & Displays": {
    Epson:     ["EB-X49", "EB-W50", "EB-2265U"],
    BenQ:      ["MH560", "TH671ST", "LU9715"],
    ViewSonic: ["PA503S", "PS501W", "LS740W"],
    Sony:      ["VPL-EX575", "VPL-FHZ75", "FW65BZ35J"],
    NEC:       ["NP-ME382W", "NP-P525UL"],
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** Returns days to add for each AMC period */
function periodDays(period: string): number {
  switch (period) {
    case "6 Months": return 180;
    case "1 Year":   return 365;
    case "2 Years":  return 730;
    case "3 Years":  return 1095;
    default:         return 365;
  }
}

/** Build a location label from a client record */
function clientLocationLabel(c: StoredClient): string {
  const parts: string[] = [];
  if (c.name) parts.push(c.name);
  if (c.billingCity) parts.push(c.billingCity);
  if (c.billingState) parts.push(c.billingState);
  return parts.join(" — ");
}

/** Derive unique categories from live HSN + SAC codes, alphabetically sorted */
function loadCategories(): string[] {
  const hsn = getHsnCodes().filter(c => c.status === "Active").map(c => c.productCategory);
  const sac = getSacCodes().filter(c => c.status === "Active").map(c => c.serviceCategory);
  const custom = getCustomAMCEquipmentOptions().categories;
  return Array.from(new Set([...hsn, ...sac, ...custom])).sort((a, b) => a.localeCompare(b));
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
  onAddNew?: () => void;
  addNewLabel?: string;
}
const ADD_NEW_OPTION_VALUE = "__add_new_option__";

function SelectField({
  label,
  required,
  value,
  onChange,
  options,
  placeholder = `Select ${label}`,
  disabled,
  onAddNew,
  addNewLabel = `+ Add new ${label.toLowerCase()}`,
}: SelectFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={e => {
            if (e.target.value === ADD_NEW_OPTION_VALUE) {
              onAddNew?.();
              return;
            }
            onChange(e.target.value);
          }}
          disabled={disabled}
          className="w-full appearance-none pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400 cursor-pointer transition-colors hover:border-gray-400"
        >
          <option value="">{placeholder}</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
          {onAddNew && <option value={ADD_NEW_OPTION_VALUE}>{addNewLabel}</option>}
        </select>
        <svg className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </div>
    </div>
  );
}

interface TextFieldProps {
  label: string;
  required?: boolean;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  type?: string;
  readOnly?: boolean;
}
function TextField({ label, required, value, onChange, placeholder, type = "text", readOnly }: TextFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        required={required}
        onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors hover:border-gray-400 ${readOnly ? "bg-gray-50 text-gray-500 cursor-not-allowed" : ""}`}
      />
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function NewAMCRequestPage() {
  const navigate = useNavigate();

  // ── Live data ──
  const [clients,    setClients]    = useState<StoredClient[]>(() => getClients());
  const [categories, setCategories] = useState<string[]>(() => loadCategories());
  const [equipmentOptions, setEquipmentOptions] = useState<CustomAMCEquipmentOptions>(() => getCustomAMCEquipmentOptions());

  // Reload when underlying stores change
  useEffect(() => {
    const onClientsChange = () => setClients(getClients());
    const onTaxChange     = () => setCategories(loadCategories());
    const onEquipmentOptionsChange = () => {
      setEquipmentOptions(getCustomAMCEquipmentOptions());
      setCategories(loadCategories());
    };
    window.addEventListener("nidoClientsUpdated", onClientsChange);
    window.addEventListener("taxEngineUpdated",   onTaxChange);
    window.addEventListener("amcEquipmentOptionsUpdated", onEquipmentOptionsChange);
    return () => {
      window.removeEventListener("nidoClientsUpdated", onClientsChange);
      window.removeEventListener("taxEngineUpdated",   onTaxChange);
      window.removeEventListener("amcEquipmentOptionsUpdated", onEquipmentOptionsChange);
    };
  }, []);

  // ── Request Details ──
  const [clientId,    setClientId]    = useState("");
  const [location,    setLocation]    = useState("");
  const [requestType, setRequestType] = useState("AMC Service");

  // ── Equipment Details ──
  const [category,     setCategory]     = useState("");
  const [brand,        setBrand]        = useState("");
  const [model,        setModel]        = useState("");
  const [addingOptionFor, setAddingOptionFor] = useState<"category" | "brand" | "model" | null>(null);
  const [newOptionValue, setNewOptionValue] = useState("");
  const [newOptionError, setNewOptionError] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [assetTag,     setAssetTag]     = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");

  // ── AMC Plan ──
  const [amcPeriod, setAmcPeriod] = useState("1 Year");
  const [startDate, setStartDate] = useState("");
  const [endDate,   setEndDate]   = useState("");
  const [visitFreq, setVisitFreq] = useState("Monthly");

  // ── Issue / Visit Details ──
  const [issueSubject, setIssueSubject] = useState("");
  const [priority,     setPriority]     = useState("Medium");
  const [issueDesc,    setIssueDesc]    = useState("");
  const [prefDate,     setPrefDate]     = useState("");

  const [submitting, setSubmitting] = useState(false);

  // ── Preview Request ID (shown before submission) ──
  const [previewId] = useState(() => peekNextId("AMC"));

  // ── Derived selected client object ──
  const selectedClient = clients.find(c => c.id === clientId) ?? null;

  // ── Auto-fill location & details when client changes ──
  useEffect(() => {
    if (!selectedClient) { setLocation(""); return; }
    const city  = selectedClient.billingCity  || "";
    const state = selectedClient.billingState || "";
    setLocation(city && state ? `${city}, ${state}` : city || state || selectedClient.billingAddress || "");
  }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-compute end date from start date + period (read-only) ──
  useEffect(() => {
    if (!startDate) { setEndDate(""); return; }
    const d   = new Date(startDate);
    const end = addDays(d, periodDays(amcPeriod));
    setEndDate(end.toISOString().slice(0, 10));
  }, [startDate, amcPeriod]);

  // ── Reset brand/model when category changes ──
  useEffect(() => { setBrand(""); setModel(""); }, [category]);
  useEffect(() => { setModel(""); }, [brand]);

  // ── Computed options ──
  const availableBrands = category
    ? Array.from(new Set([
        ...(BRANDS_BY_CATEGORY[category] ?? []),
        ...(equipmentOptions.brandsByCategory[category] ?? []),
      ])).sort((a, b) => a.localeCompare(b))
    : [];

  const availableModels = category && brand
    ? Array.from(new Set([
        ...(MODELS_BY_BRAND[category]?.[brand] ?? []),
        ...(equipmentOptions.modelsByCategory[category]?.[brand] ?? []),
      ])).sort((a, b) => a.localeCompare(b))
    : [];

  const startAddingOption = (kind: "category" | "brand" | "model") => {
    setAddingOptionFor(kind);
    setNewOptionValue("");
    setNewOptionError("");
  };

  const saveNewEquipmentOption = () => {
    const cleaned = newOptionValue.trim().replace(/\s+/g, " ");
    if (!cleaned || !addingOptionFor) {
      setNewOptionError("Enter a name to add.");
      return;
    }

    const currentOptions = addingOptionFor === "category"
      ? categories
      : addingOptionFor === "brand"
        ? availableBrands
        : availableModels;
    const existing = currentOptions.find((option) => option.toLocaleLowerCase() === cleaned.toLocaleLowerCase());
    if (existing) {
      if (addingOptionFor === "category") setCategory(existing);
      if (addingOptionFor === "brand") setBrand(existing);
      if (addingOptionFor === "model") setModel(existing);
      setAddingOptionFor(null);
      setNewOptionValue("");
      toast.info(`${existing} is already available and has been selected.`);
      return;
    }

    try {
      const result = addCustomAMCEquipmentOption(addingOptionFor, cleaned, category, brand);
      setEquipmentOptions(getCustomAMCEquipmentOptions());
      if (addingOptionFor === "category") setCategory(result.value);
      if (addingOptionFor === "brand") setBrand(result.value);
      if (addingOptionFor === "model") setModel(result.value);
      setAddingOptionFor(null);
      setNewOptionValue("");
      setNewOptionError("");
      toast.success(`${result.value} added to ${addingOptionFor} options.`);
    } catch (error) {
      setNewOptionError(error instanceof Error ? error.message : "Could not add this option.");
    }
  };

  // ── Computed AMC schedule info ──
  const totalVisits  = VISITS_PER_PERIOD[amcPeriod]?.[visitFreq] ?? 0;
  const nextTicketOn = startDate
    ? fmtDate(addDays(new Date(startDate), 31))
    : "—";
  const freqLabel = visitFreq === "Monthly" ? "1 Month"
    : visitFreq === "Quarterly" ? "3 Months"
    : visitFreq === "Half-Yearly" ? "6 Months"
    : "1 Year";

  // ── Validate & Submit ──
  const handleSubmit = () => {
    if (!clientId || !location || !requestType) { toast.error("Please fill in all required Request Details."); return; }
    if (!category || !brand || !model)          { toast.error("Please fill in all required Equipment Details."); return; }
    if (!purchaseDate)                          { toast.error("Please enter the Purchase Date in Equipment Details."); return; }
    if (!amcPeriod || !startDate || !endDate || !visitFreq) { toast.error("Please fill in all AMC Plan fields."); return; }
    if (!issueSubject || !issueDesc || !priority) { toast.error("Please fill in all Issue / Visit Details."); return; }

    setSubmitting(true);
    try {
      const clientName = selectedClient?.name ?? clientId;
      addServiceRequest({
        requestType: "AMC",
        itemAsset: `${brand} ${model}`,
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
          location, requestType: "AMC",
          category, brand, model,
          serialNumber, assetTag, purchaseDate,
          amcPeriod, startDate, endDate, visitFreq, totalVisits,
          issueSubject, priority, issueDesc, prefDate,
        },
      }, "AMC");

      toast.success("AMC request submitted successfully!");
      setTimeout(() => navigate("/my-services"), 800);
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
            <h1 className="text-2xl font-bold text-gray-900">AMC (Annual Maintenance Contract)</h1>
            <p className="text-sm text-gray-500 mt-0.5">Raise a new AMC service request</p>
          </div>
          <button
            onClick={() => navigate("/my-services")}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-gray-700 transition-colors flex-shrink-0"
          >
            <ListChecks className="w-4 h-4" /> View My AMC Requests
          </button>
        </div>
      </div>

      <div className="px-6 py-6 max-w-6xl mx-auto space-y-6">

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

            {/* Client dropdown — live from clientStore */}
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
                <svg className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>

            {/* Location — auto-filled from client */}
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

            {/* Request Type — single fixed value, shown as read-only */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Request Type <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={requestType}
                readOnly
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
              />
            </div>
          </div>

          {/* ── Client Details Card (shown after selection) ── */}
          {selectedClient && (
            <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold text-blue-800">
                  {selectedClient.name}
                  {selectedClient.tier && (
                    <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{selectedClient.tier}</span>
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
                    <User className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-blue-500 font-medium">Contact Person</p>
                      <p className="text-xs text-blue-800">{selectedClient.rep}</p>
                    </div>
                  </div>
                )}
                {selectedClient.email && (
                  <div className="flex items-start gap-2">
                    <Mail className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-blue-500 font-medium">Email</p>
                      <p className="text-xs text-blue-800 break-all">{selectedClient.email}</p>
                    </div>
                  </div>
                )}
                {(selectedClient.phone || selectedClient.mobile) && (
                  <div className="flex items-start gap-2">
                    <Phone className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-blue-500 font-medium">Phone</p>
                      <p className="text-xs text-blue-800">{selectedClient.phone || selectedClient.mobile}</p>
                    </div>
                  </div>
                )}
                {(selectedClient.billingAddress || selectedClient.billingCity) && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-blue-500 font-medium">Billing Address</p>
                      <p className="text-xs text-blue-800">
                        {[selectedClient.billingAddress, selectedClient.billingCity, selectedClient.billingState, selectedClient.billingPincode]
                          .filter(Boolean).join(", ")}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              {(selectedClient.contractStartDate || selectedClient.contractEndDate) && (
                <div className="mt-3 pt-3 border-t border-blue-100 flex gap-6">
                  {selectedClient.contractStartDate && (
                    <div>
                      <span className="text-xs text-blue-500 font-medium">Contract Start: </span>
                      <span className="text-xs text-blue-800">{selectedClient.contractStartDate}</span>
                    </div>
                  )}
                  {selectedClient.contractEndDate && (
                    <div>
                      <span className="text-xs text-blue-500 font-medium">Contract End: </span>
                      <span className="text-xs text-blue-800">{selectedClient.contractEndDate}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Equipment Details ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-bold text-gray-800 mb-5">Equipment Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Category — from live HSN/SAC codes */}
            <SelectField
              label="Category" required value={category} onChange={setCategory}
              options={categories} placeholder="Select Category"
              onAddNew={() => startAddingOption("category")}
            />
            <SelectField
              label="Brand" required value={brand} onChange={setBrand}
              options={availableBrands} placeholder={category ? "Select Brand" : "Select Category first"}
              disabled={!category}
              onAddNew={() => startAddingOption("brand")}
            />
            <SelectField
              label="Model" required value={model} onChange={setModel}
              options={availableModels} placeholder={brand ? "Select Model" : "Select Brand first"}
              disabled={!brand}
              onAddNew={() => startAddingOption("model")}
            />
          </div>
          {addingOptionFor && (
            <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/70 p-4">
              <label htmlFor="new-amc-equipment-option" className="mb-2 block text-sm font-medium text-gray-800">
                Add new {addingOptionFor}
                {addingOptionFor !== "category" && (
                  <span className="ml-1 text-xs font-normal text-gray-500">
                    under {addingOptionFor === "brand" ? category : `${brand} · ${category}`}
                  </span>
                )}
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="new-amc-equipment-option"
                  autoFocus
                  value={newOptionValue}
                  onChange={(event) => {
                    setNewOptionValue(event.target.value);
                    setNewOptionError("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      saveNewEquipmentOption();
                    }
                  }}
                  placeholder={`Enter ${addingOptionFor} name`}
                  className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setAddingOptionFor(null)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveNewEquipmentOption}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Add {addingOptionFor}
                </button>
              </div>
              {newOptionError && <p role="alert" className="mt-2 text-xs text-red-600">{newOptionError}</p>}
              <p className="mt-2 text-xs text-gray-500">This option will be saved for future AMC requests.</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5">
            <TextField label="Serial Number"          value={serialNumber} onChange={setSerialNumber} placeholder="Enter Serial Number" />
            <TextField label="Asset Tag (Optional)"   value={assetTag}     onChange={setAssetTag}     placeholder="Enter Asset Tag" />
            <TextField label="Purchase Date" required type="date" value={purchaseDate} onChange={setPurchaseDate} />
          </div>
        </div>

        {/* ── AMC Plan & Recurring Schedule ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-bold text-gray-800 mb-5">AMC Plan &amp; Recurring Schedule</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <SelectField label="AMC Period"      required value={amcPeriod} onChange={setAmcPeriod} options={AMC_PERIODS} />

            {/* Start Date */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Start Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors hover:border-gray-400"
              />
            </div>

            {/* End Date — auto-filled, read-only */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                End Date <span className="text-red-500">*</span>
                <span className="text-xs text-blue-600 font-normal bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5">Auto</span>
              </label>
              <input
                type="date"
                value={endDate}
                readOnly
                placeholder="Set start date & period"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
              />
              {startDate && endDate && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {periodDays(amcPeriod)} days from start date
                </p>
              )}
            </div>

            <SelectField label="Visit Frequency" required value={visitFreq} onChange={setVisitFreq} options={FREQUENCIES} />
          </div>

          {/* Info box */}
          {startDate && (
            <div className="mt-5 flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
              <CalendarDays className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-800">
                  Auto ticket will be created every {freqLabel}
                </p>
                <p className="text-xs text-blue-600 mt-0.5">
                  Total visits: {totalVisits} &nbsp;•&nbsp; Next ticket on: {nextTicketOn}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Issue / Visit Details ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-bold text-gray-800 mb-5">Issue / Visit Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <TextField label="Issue Subject" required value={issueSubject} onChange={setIssueSubject} placeholder="Brief description of the issue" />
            <SelectField label="Priority"    required value={priority}     onChange={setPriority}     options={PRIORITIES} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
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
