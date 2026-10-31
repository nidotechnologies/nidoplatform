import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CATEGORY_LIST } from "@/lib/categories";
import {
  addClient as addStoredClient,
  getClients,
  isSharedClient,
  CLIENT_IMPORT_HEADERS,
  clientFromImportRow,
  parseClientCsv,
} from "@/lib/clientStore";
import { getPrefix } from "@/lib/configService";
import { Button } from "@/components/ui/button";
import { sanitizePhoneNumber, isValidPhoneNumber } from "@/lib/phoneValidation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Check, Download, Upload, Loader2 } from "lucide-react";
import AddressPairFields from "@/components/shared/AddressPairFields";
import {
  isValidGst,
  isValidPan,
  normalizeGstInput,
  normalizePanInput,
  type AddressDetails,
} from "@/lib/addressTypes";
import { toast } from "sonner";

const STEPS = [
  { label: "Basic Info", icon: "A" },
  { label: "Business", icon: "B" },
  { label: "Financial", icon: "C" },
  { label: "Address", icon: "D" },
  { label: "Documents", icon: "E" },
];

const CATEGORIES = CATEGORY_LIST;

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "JPY"];

const isAlphaOnly = (value: string) => /^[A-Za-z\s]*$/.test(value);

const GST_TREATMENTS = [
  "Registered Business",
  "Unregistered Business",
  "Compositions Scheme",
  "Overseas",
  "SEZ",
];

const PAYMENT_TERMS = ["Net 15", "Net 30", "Net 45", "Net 60", "Due on Receipt"];

const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

export default function AddClient() {
  const navigate = useNavigate();
  const { id: clientIdToEdit } = useParams<{ id: string }>();
  const [step, setStep] = useState(0);
  const [showMagicUpload, setShowMagicUpload] = useState(false);
  const [isLoading, setIsLoading] = useState(!!clientIdToEdit);

  const [formData, setFormData] = useState({
    // Step 1: Basic Info
    client_id: "", // Auto-generated
    company_name: "",
    category: "",
    client_tier: "",
    contact_person: "",
    email: "",
    phone: "",
    mobile: "",
    website: "",
    contract_start_date: "",
    contract_end_date: "",
    client_logo: null as File | null,
    client_logo_url: "",

    // Step 2: Business
    gst_treatment: "",
    gstin: "",
    id_reference_number: "",
    source_of_supply: "",
    pan_number: "",
    currency: "INR",
    opening_balance: "",

    // Step 3: Financial
    payment_terms: "",
    tds_rate: "",
    bank_name: "",
    account_number: "",
    ifsc_code: "",
    branch: "",

    // Step 4: Address
    billing_address: "",
    billing_attention: "",
    billing_country: "",
    billing_address_line2: "",
    shipping_address: "",
    shipping_attention: "",
    shipping_country: "",
    shipping_address_line2: "",
    billing_city: "",
    shipping_city: "",
    billing_state: "",
    shipping_state: "",
    billing_pincode: "",
    shipping_pincode: "",
    billing_phone_country_code: "+91",
    billing_phone: "",
    billing_fax_number: "",
    shipping_phone_country_code: "+91",
    shipping_phone: "",
    shipping_fax_number: "",
    same_address: false,

    // Step 5: Documents
    documents: [] as File[],
  });

  const [clientTiers, setClientTiers] = useState([
    "Premium Clients",
    "Medium Clients",
    "Standard Clients",
  ]);
  const [showAddTier, setShowAddTier] = useState(false);
  const [newTier, setNewTier] = useState("");

  const [categoriesList, setCategoriesList] = useState<string[]>(CATEGORIES);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  const [currenciesList, setCurrenciesList] = useState<string[]>(CURRENCIES);
  const [showAddCurrency, setShowAddCurrency] = useState(false);
  const [newCurrency, setNewCurrency] = useState("");

  // Load client data for editing or generate Client ID for new client
  useEffect(() => {
    if (clientIdToEdit) {
      // Load the real, previously saved client data
      console.log("[v0] Loading client data for:", clientIdToEdit);

      const existing = getClients().find((c) => c.id === clientIdToEdit);

      if (existing) {
        const loadedClient = {
          client_id: existing.id || clientIdToEdit,
          company_name: existing.company_name || existing.name || "",
          category: existing.category || "",
          client_tier: existing.client_tier || existing.tier || "",
          contact_person: existing.contact_person || existing.rep || "",
          email: existing.email || "",
          phone: existing.phone || "",
          mobile: existing.mobile || "",
          website: existing.website || "",
          contract_start_date:
            existing.contract_start_date || existing.contractStartDate || "",
          contract_end_date:
            existing.contract_end_date || existing.contractEndDate || "",
          client_logo_url: existing.client_logo_url || "",
          gst_treatment: existing.gst_treatment || "",
          gstin: normalizeGstInput(existing.gstin || ""),
          id_reference_number: existing.id_reference_number || "",
          source_of_supply: existing.source_of_supply || "",
          pan_number: normalizePanInput(existing.pan_number || ""),
          currency: existing.currency || "INR",
          opening_balance:
            existing.opening_balance != null
              ? String(existing.opening_balance)
              : "",
          payment_terms: existing.payment_terms || "",
          tds_rate: existing.tds_rate != null ? String(existing.tds_rate) : "",
          bank_name: existing.bank_name || "",
          account_number: existing.account_number || "",
          ifsc_code: existing.ifsc_code || "",
          branch: existing.branch || "",
          billing_address:
            existing.billing_address || existing.billingAddress || "",
          billing_attention: existing.billing_attention || existing.billingAttention || "",
          billing_country: existing.billing_country || existing.billingCountry || "",
          billing_address_line2: existing.billing_address_line2 || existing.billingAddressLine2 || "",
          billing_city: existing.billing_city || existing.billingCity || "",
          billing_state: existing.billing_state || existing.billingState || "",
          billing_pincode:
            existing.billing_pincode || existing.billingPincode || "",
          shipping_address:
            existing.shipping_address || existing.shippingAddress || "",
          shipping_attention: existing.shipping_attention || existing.shippingAttention || "",
          shipping_country: existing.shipping_country || existing.shippingCountry || "",
          shipping_address_line2: existing.shipping_address_line2 || existing.shippingAddressLine2 || "",
          shipping_city:
            existing.shipping_city || existing.shippingCity || "",
          shipping_state:
            existing.shipping_state || existing.shippingState || "",
          shipping_pincode:
            existing.shipping_pincode || existing.shippingPincode || "",
          billing_phone_country_code: existing.billing_phone_country_code || existing.billingPhoneCountryCode || "+91",
          billing_phone: existing.billing_phone || existing.billingPhone || "",
          billing_fax_number: existing.billing_fax_number || existing.billingFaxNumber || "",
          shipping_phone_country_code: existing.shipping_phone_country_code || existing.shippingPhoneCountryCode || "+91",
          shipping_phone: existing.shipping_phone || existing.shippingPhone || "",
          shipping_fax_number: existing.shipping_fax_number || existing.shippingFaxNumber || "",
          same_address: !!existing.same_address,
        };

        setFormData((prev) => ({
          ...prev,
          ...loadedClient,
        }));

        // Make sure dropdown lists include the client's saved values
        if (loadedClient.category) {
          setCategoriesList((prev) =>
            prev.includes(loadedClient.category)
              ? prev
              : [...prev, loadedClient.category]
          );
        }
        if (loadedClient.client_tier) {
          setClientTiers((prev) =>
            prev.includes(loadedClient.client_tier)
              ? prev
              : [...prev, loadedClient.client_tier]
          );
        }
        if (loadedClient.currency) {
          setCurrenciesList((prev) =>
            prev.includes(loadedClient.currency)
              ? prev
              : [...prev, loadedClient.currency]
          );
        }
      } else {
        toast.error("Client not found");
      }

      setIsLoading(false);
    } else {
      // Generate new Client ID
      setIsLoading(true);
      const timer = setTimeout(() => {
        // Generate the next unused ID instead of a random ID that can collide.
        const prefix = getPrefix("client") || "CL-";
        const existingIds = new Set(getClients().map((client) => client.id));
        const nextNumber = getClients().reduce((highest, client) => {
          if (!client.id.startsWith(prefix)) return highest;
          const number = Number(client.id.slice(prefix.length));
          return Number.isFinite(number) ? Math.max(highest, number) : highest;
        }, 0) + 1;
        let candidateNumber = nextNumber;
        while (existingIds.has(`${prefix}${String(candidateNumber).padStart(5, "0")}`)) {
          candidateNumber += 1;
        }
        const clientId = `${prefix}${String(candidateNumber).padStart(5, "0")}`;

        setFormData((prev) => ({
          ...prev,
          client_id: clientId,
        }));
        setIsLoading(false);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [clientIdToEdit]);

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const billingAddressDetails: AddressDetails = {
    attention: formData.billing_attention,
    country: formData.billing_country,
    addressLine1: formData.billing_address,
    addressLine2: formData.billing_address_line2,
    city: formData.billing_city,
    state: formData.billing_state,
    pinCode: formData.billing_pincode,
    phoneCountryCode: formData.billing_phone_country_code,
    phone: formData.billing_phone,
    faxNumber: formData.billing_fax_number,
  };

  const shippingAddressDetails: AddressDetails = {
    attention: formData.shipping_attention,
    country: formData.shipping_country,
    addressLine1: formData.shipping_address,
    addressLine2: formData.shipping_address_line2,
    city: formData.shipping_city,
    state: formData.shipping_state,
    pinCode: formData.shipping_pincode,
    phoneCountryCode: formData.shipping_phone_country_code,
    phone: formData.shipping_phone,
    faxNumber: formData.shipping_fax_number,
  };

  const updateAddressDetails = (
    kind: "billing" | "shipping",
    patch: Partial<AddressDetails>,
  ) => {
    const prefix = kind === "billing" ? "billing" : "shipping";
    const fieldMap: Record<keyof AddressDetails, string> = {
      attention: `${prefix}_attention`,
      country: `${prefix}_country`,
      addressLine1: `${prefix}_address`,
      addressLine2: `${prefix}_address_line2`,
      city: `${prefix}_city`,
      state: `${prefix}_state`,
      pinCode: `${prefix}_pincode`,
      phoneCountryCode: `${prefix}_phone_country_code`,
      phone: `${prefix}_phone`,
      faxNumber: `${prefix}_fax_number`,
    };
    const updates: Record<string, string> = {};
    Object.entries(patch).forEach(([field, value]) => {
      if (value !== undefined) updates[fieldMap[field as keyof AddressDetails]] = value;
    });
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const handleFileSelect = (files: FileList | null) => {
    if (files) {
      setFormData((prev) => ({
        ...prev,
        documents: Array.from(files),
      }));
    }
  };

  const canProceed = () => {
    if (step === 0) {
      return !!(
        formData.client_id.trim() &&
        formData.company_name.trim() &&
        formData.category &&
        formData.client_tier &&
        formData.contact_person.trim() &&
        formData.email.trim() &&
        formData.contract_start_date &&
        formData.contract_end_date
      );
    }
    if (step === 1) {
      const gstinRequired = formData.gst_treatment === "Registered Business";
      return !!(
        formData.gst_treatment &&
        (!formData.gstin || isValidGst(formData.gstin)) &&
        (!gstinRequired || isValidGst(formData.gstin)) &&
        isValidPan(formData.pan_number)
      );
    }
    if (step === 2) {
      return !!(
        formData.payment_terms &&
        formData.bank_name.trim() &&
        formData.account_number.trim() &&
        formData.ifsc_code.trim() &&
        formData.branch.trim()
      );
    }
    if (step === 3) {
      return !!(
        formData.billing_address.trim() &&
        formData.billing_city.trim() &&
        formData.billing_state &&
        formData.billing_pincode.trim() &&
        (formData.same_address ||
          (formData.shipping_address.trim() &&
            formData.shipping_city.trim() &&
            formData.shipping_state &&
            formData.shipping_pincode.trim()))
      );
    }
    return true;
  };

  const getValidationIssues = () => {
    const issues: { step: number; label: string; fields: string[] }[] = [];
    const addIssue = (stepIndex: number, label: string, fields: string[]) => {
      if (fields.length) issues.push({ step: stepIndex, label, fields });
    };

    const basicFields: string[] = [];
    if (!formData.client_id.trim()) basicFields.push("Client ID");
    if (!formData.company_name.trim()) basicFields.push("Company Name");
    if (!formData.category) basicFields.push("Category");
    if (!formData.client_tier) basicFields.push("Client Tier");
    if (!formData.contact_person.trim()) basicFields.push("Contact Person");
    if (!formData.email.trim()) basicFields.push("Email");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      basicFields.push("valid Email");
    }
    if (!formData.contract_start_date) basicFields.push("Contract Start Date");
    if (!formData.contract_end_date) basicFields.push("Contract End Date");
    if (formData.phone && !isValidPhoneNumber(formData.phone)) {
      basicFields.push("valid Phone");
    }
    if (formData.mobile && !isValidPhoneNumber(formData.mobile)) {
      basicFields.push("valid Mobile");
    }
    addIssue(0, "Basic Info", basicFields);

    const businessFields: string[] = [];
    if (!formData.gst_treatment) businessFields.push("GST Treatment");
    if (formData.gstin && !isValidGst(formData.gstin)) {
      businessFields.push("valid GSTIN");
    } else if (formData.gst_treatment === "Registered Business" && !formData.gstin) {
      businessFields.push("GSTIN");
    }
    if (!formData.pan_number) businessFields.push("PAN Number");
    else if (!isValidPan(formData.pan_number)) businessFields.push("valid PAN Number");
    addIssue(1, "Business", businessFields);

    const financialFields: string[] = [];
    if (!formData.payment_terms) financialFields.push("Payment Terms");
    if (!formData.bank_name.trim()) financialFields.push("Bank Name");
    if (!formData.account_number.trim()) financialFields.push("Account Number");
    if (!formData.ifsc_code.trim()) financialFields.push("IFSC Code");
    if (!formData.branch.trim()) financialFields.push("Branch");
    addIssue(2, "Financial", financialFields);

    const addressFields: string[] = [];
    if (!formData.billing_address.trim()) addressFields.push("Billing Address");
    if (!formData.billing_city.trim()) addressFields.push("Billing City");
    if (!formData.billing_state) addressFields.push("Billing State");
    if (!formData.billing_pincode.trim()) addressFields.push("Billing Pincode");
    if (!formData.same_address) {
      if (!formData.shipping_address.trim()) addressFields.push("Shipping Address");
      if (!formData.shipping_city.trim()) addressFields.push("Shipping City");
      if (!formData.shipping_state) addressFields.push("Shipping State");
      if (!formData.shipping_pincode.trim()) addressFields.push("Shipping Pincode");
    }
    addIssue(3, "Address", addressFields);

    return issues;
  };

  const downloadTemplate = () => {
    const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const csv = CLIENT_IMPORT_HEADERS.map(escapeCsv).join(",");
    const blob = new Blob([`\uFEFF${csv}\r\n`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `client_template_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Template downloaded successfully");
  };

  const handleMagicUpload = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rows = parseClientCsv(String(event.target?.result || ""));
        if (!rows.length) {
          toast.error("The CSV has no client data row");
          return;
        }

        const imported = clientFromImportRow(
          rows[0],
          formData.client_id || "CL-00001",
        );
        setFormData((previous) => ({
          ...previous,
          client_id: imported.id,
          company_name: imported.company_name || imported.name || "",
          category: imported.category || "",
          client_tier: imported.client_tier || imported.tier || "",
          contact_person: imported.contact_person || imported.rep || "",
          email: imported.email || "",
          phone: imported.phone || "",
          mobile: imported.mobile || "",
          website: imported.website || "",
          contract_start_date:
            imported.contract_start_date || imported.contractStartDate || "",
          contract_end_date:
            imported.contract_end_date || imported.contractEndDate || "",
          client_logo_url: imported.client_logo_url || "",
          gst_treatment: imported.gst_treatment || "",
          gstin: imported.gstin || "",
          id_reference_number: imported.id_reference_number || "",
          source_of_supply: imported.source_of_supply || "",
          pan_number: imported.pan_number || "",
          currency: imported.currency || "INR",
          opening_balance:
            imported.opening_balance != null
              ? String(imported.opening_balance)
              : "",
          payment_terms: imported.payment_terms || "",
          tds_rate:
            imported.tds_rate != null ? String(imported.tds_rate) : "",
          bank_name: imported.bank_name || "",
          account_number: imported.account_number || "",
          ifsc_code: imported.ifsc_code || "",
          branch: imported.branch || "",
          billing_address:
            imported.billing_address || imported.billingAddress || "",
          billing_attention:
            imported.billing_attention || imported.billingAttention || "",
          billing_country:
            imported.billing_country || imported.billingCountry || "",
          billing_address_line2:
            imported.billing_address_line2 ||
            imported.billingAddressLine2 ||
            "",
          billing_city: imported.billing_city || imported.billingCity || "",
          billing_state: imported.billing_state || imported.billingState || "",
          billing_pincode:
            imported.billing_pincode || imported.billingPincode || "",
          billing_phone_country_code:
            imported.billing_phone_country_code ||
            imported.billingPhoneCountryCode ||
            "+91",
          billing_phone: imported.billing_phone || imported.billingPhone || "",
          billing_fax_number:
            imported.billing_fax_number || imported.billingFaxNumber || "",
          shipping_address:
            imported.shipping_address || imported.shippingAddress || "",
          shipping_attention:
            imported.shipping_attention || imported.shippingAttention || "",
          shipping_country:
            imported.shipping_country || imported.shippingCountry || "",
          shipping_address_line2:
            imported.shipping_address_line2 ||
            imported.shippingAddressLine2 ||
            "",
          shipping_city:
            imported.shipping_city || imported.shippingCity || "",
          shipping_state:
            imported.shipping_state || imported.shippingState || "",
          shipping_pincode:
            imported.shipping_pincode || imported.shippingPincode || "",
          shipping_phone_country_code:
            imported.shipping_phone_country_code ||
            imported.shippingPhoneCountryCode ||
            "+91",
          shipping_phone:
            imported.shipping_phone || imported.shippingPhone || "",
          shipping_fax_number:
            imported.shipping_fax_number || imported.shippingFaxNumber || "",
          same_address: !!imported.same_address,
        }));

        setCategoriesList((current) =>
          imported.category && !current.includes(imported.category)
            ? [...current, imported.category]
            : current,
        );
        setClientTiers((current) =>
          imported.client_tier && !current.includes(imported.client_tier)
            ? [...current, imported.client_tier]
            : current,
        );
        setCurrenciesList((current) =>
          imported.currency && !current.includes(imported.currency)
            ? [...current, imported.currency]
            : current,
        );
        setShowMagicUpload(false);
        toast.success("Client details imported into the form");
      } catch {
        toast.error("Could not read the CSV. Please use the downloaded template.");
      }
    };
    reader.readAsText(file);
  };

  const handleSave = async () => {
    const validationIssues = getValidationIssues();
    if (validationIssues.length) {
      const firstIssue = validationIssues[0];
      setStep(firstIssue.step);
      const message = validationIssues
        .map((issue) => `${issue.label}: ${issue.fields.join(", ")}`)
        .join(" • ");
      toast.error(`Please complete the client form: ${message}`);
      return;
    }

    try {
      console.log("[v0] Saving client data:", formData.company_name);

      if (clientIdToEdit && isSharedClient(clientIdToEdit)) {
        toast.error("Shared demo clients are read-only. Add a new client to save changes.");
        return;
      }

      const existingClient = clientIdToEdit
        ? getClients().find((client) => client.id === clientIdToEdit)
        : undefined;

      // Mock save operation
      const clientData = {
        company_name: formData.company_name,
        category: formData.category,
        client_tier: formData.client_tier,
        contact_person: formData.contact_person,
        email: formData.email,
        phone: formData.phone,
        mobile: formData.mobile,
        website: formData.website,
        contract_start_date: formData.contract_start_date,
        contract_end_date: formData.contract_end_date,
        contractStartDate: formData.contract_start_date,
        contractEndDate: formData.contract_end_date,
        client_logo_url: formData.client_logo_url,
        gst_treatment: formData.gst_treatment,
        gstin: formData.gstin,
        id_reference_number: formData.id_reference_number,
        source_of_supply: formData.source_of_supply,
        pan_number: formData.pan_number,
        currency: formData.currency,
        opening_balance: formData.opening_balance
          ? parseFloat(formData.opening_balance)
          : 0,
        payment_terms: formData.payment_terms,
        tds_rate: formData.tds_rate
          ? parseFloat(formData.tds_rate)
          : 0,
        bank_name: formData.bank_name,
        account_number: formData.account_number,
        ifsc_code: formData.ifsc_code,
        branch: formData.branch,
        billing_address: [billingAddressDetails.addressLine1, billingAddressDetails.addressLine2].filter(Boolean).join(", "),
        billingAddress: [billingAddressDetails.addressLine1, billingAddressDetails.addressLine2].filter(Boolean).join(", "),
        billing_attention: billingAddressDetails.attention,
        billingAttention: billingAddressDetails.attention,
        billing_country: billingAddressDetails.country,
        billingCountry: billingAddressDetails.country,
        billing_address_line2: billingAddressDetails.addressLine2,
        billingAddressLine2: billingAddressDetails.addressLine2,
        billing_city: formData.billing_city,
        billingCity: formData.billing_city,
        billing_state: formData.billing_state,
        billingState: formData.billing_state,
        billing_pincode: formData.billing_pincode,
        billingPincode: formData.billing_pincode,
        shipping_address: [shippingAddressDetails.addressLine1, shippingAddressDetails.addressLine2].filter(Boolean).join(", "),
        shipping_city: shippingAddressDetails.city,
        shipping_state: shippingAddressDetails.state,
        shipping_pincode: shippingAddressDetails.pinCode,
        shipping_attention: shippingAddressDetails.attention,
        shippingAttention: shippingAddressDetails.attention,
        shipping_country: shippingAddressDetails.country,
        shippingCountry: shippingAddressDetails.country,
        shipping_address_line2: shippingAddressDetails.addressLine2,
        shippingAddressLine2: shippingAddressDetails.addressLine2,
        billing_phone_country_code: billingAddressDetails.phoneCountryCode,
        billingPhoneCountryCode: billingAddressDetails.phoneCountryCode,
        billing_phone: billingAddressDetails.phone,
        billingPhone: billingAddressDetails.phone,
        billing_fax_number: billingAddressDetails.faxNumber,
        billingFaxNumber: billingAddressDetails.faxNumber,
        shipping_phone_country_code: shippingAddressDetails.phoneCountryCode,
        shippingPhoneCountryCode: shippingAddressDetails.phoneCountryCode,
        shipping_phone: shippingAddressDetails.phone,
        shippingPhone: shippingAddressDetails.phone,
        shipping_fax_number: shippingAddressDetails.faxNumber,
        shippingFaxNumber: shippingAddressDetails.faxNumber,
        same_address: formData.same_address,
        tier: formData.client_tier,
        rep: formData.contact_person,
        status: existingClient?.status || "active",
      };

      // Save to shared client store
      addStoredClient({
        id: formData.client_id,
        name: clientData.company_name || formData.client_id,
        ...clientData,
      });
      const savedClient = getClients().find((client) => client.id === formData.client_id);
      if (!savedClient || savedClient.company_name !== clientData.company_name) {
        throw new Error("The client could not be confirmed in local storage.");
      }
      if (clientIdToEdit) {
        console.log("[v0] Client updated successfully");
        toast.success("Client updated successfully");
      } else {
        console.log("[v0] Client saved successfully");
        toast.success("Client registered successfully");
      }

      // Navigate back to clients page after successful save
      setTimeout(() => {
        navigate("/clients");
      }, 1000);
    } catch (err) {
      console.error("[v0] Error:", err);
      const reason = err instanceof Error ? err.message : "Unknown storage error";
      toast.error(`Could not save client: ${reason}`);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b p-6">
        <div className="max-w-6xl mx-auto flex items-start justify-between">
          <button
            onClick={() => navigate("/clients")}
            className="text-gray-600 hover:text-gray-900 flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Clients
          </button>
          <div className="text-right">
            <h1 className="text-2xl font-bold">
              {clientIdToEdit ? "Edit Client" : "Client Onboarding"}
            </h1>
            <p className="text-sm text-gray-500">
              {clientIdToEdit
                ? "Update client information"
                : "Complete all 5 steps to register a new client"}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-12 w-12 text-[#4A6CF7] animate-spin mb-4" />
              <p className="text-gray-600">Loading client information...</p>
            </div>
          </div>
        ) : (
          <div>
            {/* Progress Indicator */}
            <div className="bg-white rounded-lg p-2 mb-6">
              <div className="flex items-center justify-between">
                {STEPS.map((s, idx) => (
                  <div key={idx} className="flex items-center flex-1">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                    step === idx
                      ? "bg-[#4A6CF7] text-white"
                      : step > idx
                        ? "bg-green-500 text-white"
                        : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {step > idx ? <Check className="h-5 w-5" /> : s.icon}
                </div>
                <p
                  className={`ml-2 text-sm font-medium ${
                    step === idx
                      ? "text-[#4A6CF7]"
                      : step > idx
                        ? "text-green-500"
                        : "text-gray-600"
                  }`}
                >
                  {s.label}
                </p>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 transition-colors ${
                      step > idx ? "bg-green-500" : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Magic Upload Section */}
        <div
          className="bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg p-2 mb-6 cursor-pointer hover:bg-blue-100 transition-colors"
          onClick={() => setShowMagicUpload(true)}
        >
          <div className="flex items-center gap-2 text-blue-600">
            <Upload className="h-5 w-5" />
            <span className="font-medium">Magic Upload</span>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            Upload a template file to auto-fill client details
          </p>
        </div>

        {/* Step Content */}
        <Card className="bg-white">
          <CardContent className="p-4 md:p-6 lg:p-8">
            {/* Step 1: Basic Info */}
            {step === 0 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold mb-1">Step 1: Basic Info</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Client ID
                    </label>
                    <Input
                      placeholder="Auto-generated"
                      value={formData.client_id}
                      disabled
                      className="bg-gray-100 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 mt-1">Auto-generated</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Company Name *
                    </label>
                    <Input
                      placeholder="Legal company name"
                      value={formData.company_name}
                      onChange={(e) =>
                        handleInputChange("company_name", e.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Category *
                    </label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => {
                        if (value === "add_new") {
                          setShowAddCategory(true);
                        } else {
                          handleInputChange("category", value);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categoriesList.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                        <SelectItem value="add_new" className="text-[#4A6CF7]">
                          + Add New Category
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {showAddCategory && (
                      <div className="mt-3 p-2 border border-[#E8ECF1] rounded-md bg-[#F8FAFD]">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Enter new category name"
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value)}
                          />
                          <Button
                            size="sm"
                            className="bg-[#4A6CF7] hover:bg-[#3B5DE8] text-white"
                            onClick={() => {
                              if (newCategory.trim()) {
                                setCategoriesList([...categoriesList, newCategory]);
                                handleInputChange("category", newCategory);
                                setNewCategory("");
                                setShowAddCategory(false);
                                toast.success("Category added successfully");
                              }
                            }}
                          >
                            Add
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setShowAddCategory(false);
                              setNewCategory("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Client Tier *
                    </label>
                    <Select
                      value={formData.client_tier}
                      onValueChange={(value) => {
                        if (value === "add_new") {
                          setShowAddTier(true);
                        } else {
                          handleInputChange("client_tier", value);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select tier" />
                      </SelectTrigger>
                      <SelectContent>
                        {clientTiers.map((tier) => (
                          <SelectItem key={tier} value={tier}>
                            {tier}
                          </SelectItem>
                        ))}
                        <SelectItem value="add_new" className="text-[#4A6CF7]">
                          + Add New Tier
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {showAddTier && (
                      <div className="mt-3 p-2 border border-[#E8ECF1] rounded-md bg-[#F8FAFD]">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Enter new tier name"
                            value={newTier}
                            onChange={(e) => setNewTier(e.target.value)}
                          />
                          <Button
                            size="sm"
                            className="bg-[#4A6CF7] hover:bg-[#3B5DE8] text-white"
                            onClick={() => {
                              if (newTier.trim()) {
                                setClientTiers([...clientTiers, newTier]);
                                handleInputChange("client_tier", newTier);
                                setNewTier("");
                                setShowAddTier(false);
                                toast.success("Tier added successfully");
                              }
                            }}
                          >
                            Add
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setShowAddTier(false);
                              setNewTier("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Client Logo (PNG)
                    </label>
                    <input
                      type="file"
                      accept=".png"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          const file = e.target.files[0];
                          if (file.type === "image/png") {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              handleInputChange("client_logo", file);
                              handleInputChange("client_logo_url", event.target?.result);
                            };
                            reader.readAsDataURL(file);
                          } else {
                            toast.error("Please upload a PNG file");
                          }
                        }
                      }}
                      className="block w-full text-sm text-gray-500 border border-gray-300 rounded-md cursor-pointer focus:outline-none"
                    />
                    {formData.client_logo_url && (
                      <div className="mt-2">
                        <img
                          src={formData.client_logo_url}
                          alt="Logo preview"
                          className="h-16 w-16 rounded object-cover"
                        />
                      </div>
                    )}
                  </div>
                  <div></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Contact Person *
                    </label>
                    <Input
                      placeholder="Primary contact name"
                      value={formData.contact_person}
                      onChange={(e) =>
                        handleInputChange("contact_person", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Email *
                    </label>
                    <Input
                      type="email"
                      placeholder="contact@company.com"
                      value={formData.email}
                      onChange={(e) =>
                        handleInputChange("email", e.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Phone
                    </label>
                    <Input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="10-digit phone number"
                      value={formData.phone}
                      onChange={(e) =>
                        handleInputChange("phone", sanitizePhoneNumber(e.target.value))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Mobile
                    </label>
                    <Input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="Alternate mobile number"
                      value={formData.mobile}
                      onChange={(e) =>
                        handleInputChange("mobile", sanitizePhoneNumber(e.target.value))
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Website
                  </label>
                  <Input
                    placeholder="www.example.com"
                    value={formData.website}
                    onChange={(e) =>
                      handleInputChange("website", e.target.value)
                    }
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Contract Start Date *
                    </label>
                    <Input
                      type="date"
                      value={formData.contract_start_date}
                      onChange={(e) => {
                        const newStart = e.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          contract_start_date: newStart,
                          contract_end_date:
                            prev.contract_end_date && newStart && prev.contract_end_date <= newStart
                              ? ""
                              : prev.contract_end_date,
                        }));
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Contract End Date *
                    </label>
                    <Input
                      type="date"
                      value={formData.contract_end_date}
                      min={
                        formData.contract_start_date
                          ? new Date(
                              new Date(formData.contract_start_date).getTime() + 86400000
                            )
                              .toISOString()
                              .split("T")[0]
                          : undefined
                      }
                      disabled={!formData.contract_start_date}
                      onChange={(e) => {
                        if (
                          formData.contract_start_date &&
                          e.target.value <= formData.contract_start_date
                        ) {
                          toast.error(
                            "Contract End Date must be after the Contract Start Date"
                          );
                          return;
                        }
                        handleInputChange("contract_end_date", e.target.value);
                      }}
                    />
                    {!formData.contract_start_date && (
                      <p className="text-xs text-gray-500 mt-1">
                        Select a Contract Start Date first
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Business */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold mb-1">Step 2: Business</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      GST Treatment *
                    </label>
                    <Select
                      value={formData.gst_treatment}
                      onValueChange={(value) =>
                        handleInputChange("gst_treatment", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select treatment" />
                      </SelectTrigger>
                      <SelectContent>
                        {GST_TREATMENTS.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Source of Supply
                    </label>
                    <Input
                      placeholder="State/UT"
                      value={formData.source_of_supply}
                      onChange={(e) => {
                        if (isAlphaOnly(e.target.value)) {
                          handleInputChange("source_of_supply", e.target.value);
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      GSTIN {formData.gst_treatment === "Registered Business" ? "*" : ""}
                    </label>
                    <Input
                      placeholder="27AABCT1234A1Z5"
                      value={formData.gstin}
                      maxLength={15}
                      pattern="[A-Za-z0-9]{15}"
                      onChange={(e) =>
                        handleInputChange("gstin", normalizeGstInput(e.target.value))
                      }
                      className={
                        formData.gstin && !isValidGst(formData.gstin)
                          ? "border-red-400 focus-visible:ring-red-400"
                          : ""
                      }
                    />
                    <p className={`mt-1 text-xs ${formData.gstin.length === 15 ? "text-green-600" : "text-gray-500"}`}>
                      {formData.gstin.length}/15 characters
                    </p>
                    {formData.gstin && !isValidGst(formData.gstin) && (
                      <p className="text-xs text-red-500 mt-1">
                        GSTIN must contain exactly 15 letters and numbers.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      PAN Number *
                    </label>
                    <Input
                      placeholder="AAAAA0000A"
                      value={formData.pan_number}
                      maxLength={10}
                      pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]"
                      onChange={(e) =>
                        handleInputChange("pan_number", normalizePanInput(e.target.value))
                      }
                    />
                    <p className={`mt-1 text-xs ${isValidPan(formData.pan_number) ? "text-green-600" : "text-gray-500"}`}>
                      {formData.pan_number.length}/10 characters · 5 letters, 4 numbers, 1 letter
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      ID/Reference Number
                    </label>
                    <Input
                      placeholder="Enter ID or reference number"
                      value={formData.id_reference_number}
                      onChange={(e) =>
                        handleInputChange("id_reference_number", e.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Currency
                    </label>
                    <Select
                      value={formData.currency}
                      onValueChange={(value) => {
                        if (value === "add_new") {
                          setShowAddCurrency(true);
                        } else {
                          handleInputChange("currency", value);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currenciesList.map((curr) => (
                          <SelectItem key={curr} value={curr}>
                            {curr}
                          </SelectItem>
                        ))}
                        <SelectItem value="add_new" className="text-[#4A6CF7]">
                          + Add New Currency
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {showAddCurrency && (
                      <div className="mt-3 p-2 border border-[#E8ECF1] rounded-md bg-[#F8FAFD]">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Enter new currency code (e.g., AUD)"
                            value={newCurrency}
                            onChange={(e) => setNewCurrency(e.target.value.toUpperCase())}
                          />
                          <Button
                            size="sm"
                            className="bg-[#4A6CF7] hover:bg-[#3B5DE8] text-white"
                            onClick={() => {
                              if (newCurrency.trim()) {
                                setCurrenciesList([...currenciesList, newCurrency]);
                                handleInputChange("currency", newCurrency);
                                setNewCurrency("");
                                setShowAddCurrency(false);
                                toast.success("Currency added successfully");
                              }
                            }}
                          >
                            Add
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setShowAddCurrency(false);
                              setNewCurrency("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Opening Balance
                    </label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={formData.opening_balance}
                      onChange={(e) =>
                        handleInputChange("opening_balance", e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Financial */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold mb-1">Step 3: Financial</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Payment Terms *
                    </label>
                    <Select
                      value={formData.payment_terms}
                      onValueChange={(value) =>
                        handleInputChange("payment_terms", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Net 30" />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_TERMS.map((term) => (
                          <SelectItem key={term} value={term}>
                            {term}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      TDS Rate (%)
                    </label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={formData.tds_rate}
                      onChange={(e) =>
                        handleInputChange("tds_rate", e.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Bank Name *
                    </label>
                    <Input
                      placeholder="Bank name"
                      value={formData.bank_name}
                      onChange={(e) =>
                        handleInputChange("bank_name", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Account Number *
                    </label>
                    <Input
                      placeholder="Account number"
                      value={formData.account_number}
                      onChange={(e) =>
                        handleInputChange("account_number", e.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      IFSC Code *
                    </label>
                    <Input
                      placeholder="SBIN0001234"
                      value={formData.ifsc_code}
                      onChange={(e) =>
                        handleInputChange("ifsc_code", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Branch *
                    </label>
                    <Input
                      placeholder="Branch name"
                      value={formData.branch}
                      onChange={(e) =>
                        handleInputChange("branch", e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Address */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold mb-1">Step 4: Address</h2>
                </div>
                <AddressPairFields
                  billing={billingAddressDetails}
                  shipping={shippingAddressDetails}
                  states={INDIAN_STATES}
                  onBillingChange={(patch) => updateAddressDetails("billing", patch)}
                  onShippingChange={(patch) => {
                    updateAddressDetails("shipping", patch);
                    handleInputChange("same_address", false);
                  }}
                  onCopyBilling={() => handleInputChange("same_address", true)}
                />
              </div>
            )}

            {/* Step 5: Documents */}
            {step === 4 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold mb-1">
                    Step 5: Documents
                  </h2>
                  <p className="text-sm text-gray-600">
                    Upload Documents (GST Certificate, PAN Card, etc.)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Choose Files
                  </label>
                  <input
                    type="file"
                    multiple
                    onChange={(e) => handleFileSelect(e.target.files)}
                    className="block w-full border border-gray-300 rounded-lg p-2 cursor-pointer"
                  />
                  {formData.documents.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {formData.documents.map((doc, idx) => (
                        <div
                          key={idx}
                          className="text-sm text-gray-600 flex items-center gap-2"
                        >
                          <span>📄</span> {doc.name}
                        </div>
                      ))}
                    </div>
                  )}
                  {!formData.documents.length && (
                    <p className="text-sm text-gray-500 mt-2">No file chosen</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-6">
          <div>
            {step > 0 && (
              <Button
                variant="outline"
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" /> Previous
              </Button>
            )}
            {step === 0 && (
              <Button
                variant="ghost"
                onClick={() => navigate("/clients")}
              >
                Cancel
              </Button>
            )}
          </div>

          <div className="flex gap-3">
            {step === STEPS.length - 1 && (
              <Button
                variant="outline"
                onClick={downloadTemplate}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" /> Download Template
              </Button>
            )}
            {step < STEPS.length - 1 && (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={!canProceed()}
                className="bg-[#4A6CF7] hover:bg-[#3B5DE8] text-white flex items-center gap-2"
              >
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            {step === STEPS.length - 1 && (
              <Button
                onClick={handleSave}
                className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
              >
                <Check className="h-4 w-4" /> {clientIdToEdit ? "Save Changes" : "Register Client"}
              </Button>
            )}
          </div>
        </div>
      </div>
        )}

        {/* Magic Upload Modal */}
        {showMagicUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-96">
            <CardContent className="p-6 space-y-4">
              <h2 className="text-lg font-bold">Magic Upload</h2>
              <p className="text-sm text-gray-600">
                Upload a CSV file to auto-fill client details
              </p>
              <input
                type="file"
                accept=".csv"
                className="block w-full border border-gray-300 rounded-lg p-3"
                onChange={(event) =>
                  handleMagicUpload(event.target.files?.[0])
                }
              />
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowMagicUpload(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-[#4A6CF7] hover:bg-[#3B5DE8] text-white"
                  onClick={() =>
                    toast.success(
                      "Choose a CSV file above to fill all client fields",
                    )
                  }
                >
                  Upload
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        )}
      </div>
    </div>
  );
}
