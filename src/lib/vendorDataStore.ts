const STORE_KEY = 'nido_vendors_v2';

export type VendorStatus = "Active" | "Inactive" | "On Hold" | "Pending";

export interface StoredVendor {
  id: string;
  name: string;
  category: string;
  primaryContact: string;
  email: string;
  phone: string;
  rating: number;
  region: string;
  status: VendorStatus;
  onboardedDate: string;
  monthSpend: number;
  score: number;
  address: string;
  totalSpend: number;
  complianceIssues: number;
  archived: boolean;
  // Extended detail fields
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  website?: string;
  registrationNo?: string;
  taxId?: string;
  pan?: string;
  founded?: string;
  employees?: string;
  annualRevenue?: string;
  paymentMode?: string;
  paymentTerms?: string;
  bankAccount?: string;
  ifscCode?: string;
  bankName?: string;
  bankBranch?: string;
  billingAddressLine1?: string;
  billingAddressLine2?: string;
  billingCity?: string;
  billingState?: string;
  billingZip?: string;
  billingCountry?: string;
  shippingAddressLine1?: string;
  shippingAddressLine2?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingZip?: string;
  shippingCountry?: string;
  performanceQuality?: number;
  performanceDelivery?: number;
  performanceResponsiveness?: number;
  performanceCompliance?: number;
  createdByName?: string;
  createdByEmployeeId?: string;
  createdByEmail?: string;
  createdAt?: string;
  updatedByName?: string;
  updatedByEmployeeId?: string;
  updatedByEmail?: string;
  updatedAt?: string;
  onboardingFormData?: Record<string, unknown>;
  lastUpdatedFormData?: Record<string, unknown>;
  [key: string]: any;
}

const DEFAULT_VENDORS: StoredVendor[] = [
  {
    id: "VND-1001", name: "InfoTech Pvt. Ltd.", category: "IT Services",
    primaryContact: "Rahul Sharma", email: "rahul@infotech.com", phone: "+91 98765 43210",
    rating: 4.5, region: "North", status: "Active", onboardedDate: "12 Jan 2023",
    monthSpend: 75000000, score: 4.8, address: "Delhi, India", totalSpend: 850000000,
    complianceIssues: 0, archived: false,
    addressLine1: "B-12, Sector 63", addressLine2: "NSEZ Phase II", city: "Noida",
    state: "Uttar Pradesh", zipCode: "201301", country: "India",
    website: "www.infotech.in", registrationNo: "UP-2015-112233",
    taxId: "09AABCI1234F1Z5", pan: "AABCI1234F", founded: "2010", employees: "500+",
    annualRevenue: "₹85 Cr+", paymentMode: "NEFT / RTGS", paymentTerms: "NET 30",
    bankAccount: "XXXX-XXXX-4321", ifscCode: "HDFC0002345", bankName: "HDFC Bank Ltd.",
    bankBranch: "Sector 18, Noida",
    billingAddressLine1: "B-12, Sector 63", billingAddressLine2: "NSEZ Phase II",
    billingCity: "Noida", billingState: "Uttar Pradesh", billingZip: "201301", billingCountry: "India",
    shippingAddressLine1: "Plot 5, Sector 25", shippingAddressLine2: "Noida Export Zone",
    shippingCity: "Noida", shippingState: "Uttar Pradesh", shippingZip: "201301", shippingCountry: "India",
    performanceQuality: 88, performanceDelivery: 92, performanceResponsiveness: 85, performanceCompliance: 94,
  },
  {
    id: "VND-1002", name: "Logistics Express", category: "Logistics",
    primaryContact: "Priya Mehta", email: "priya@logexp.com", phone: "+91 87654 32109",
    rating: 3.8, region: "West", status: "Active", onboardedDate: "5 Mar 2023",
    monthSpend: 42000000, score: 3.9, address: "Mumbai, India", totalSpend: 420000000,
    complianceIssues: 2, archived: false,
    addressLine1: "3rd Floor, Trade Centre", addressLine2: "Bandra Kurla Complex", city: "Mumbai",
    state: "Maharashtra", zipCode: "400051", country: "India",
    website: "www.logisticsexpress.co.in", registrationNo: "MH-2016-334455",
    taxId: "27AABLG5678K1Z2", pan: "AABLG5678K", founded: "2009", employees: "200-500",
    annualRevenue: "₹42 Cr+", paymentMode: "RTGS", paymentTerms: "NET 45",
    bankAccount: "XXXX-XXXX-7890", ifscCode: "ICIC0003456", bankName: "ICICI Bank Ltd.",
    bankBranch: "BKC, Mumbai",
    billingAddressLine1: "3rd Floor, Trade Centre", billingAddressLine2: "Bandra Kurla Complex",
    billingCity: "Mumbai", billingState: "Maharashtra", billingZip: "400051", billingCountry: "India",
    shippingAddressLine1: "Warehouse 7, JNPT Road", shippingAddressLine2: "",
    shippingCity: "Navi Mumbai", shippingState: "Maharashtra", shippingZip: "400707", shippingCountry: "India",
    performanceQuality: 76, performanceDelivery: 81, performanceResponsiveness: 74, performanceCompliance: 79,
  },
  {
    id: "VND-1003", name: "GreenLeaf Supplies", category: "Raw Materials",
    primaryContact: "Ankit Patel", email: "ankit@greenleaf.com", phone: "+91 76543 21098",
    rating: 4.2, region: "South", status: "On Hold", onboardedDate: "20 Jun 2022",
    monthSpend: 0, score: 4.1, address: "Bangalore, India", totalSpend: 310000000,
    complianceIssues: 5, archived: false,
    addressLine1: "45, 2nd Cross, Peenya", addressLine2: "Industrial Area Phase I", city: "Bangalore",
    state: "Karnataka", zipCode: "560058", country: "India",
    website: "www.greenleafsupplies.com", registrationNo: "KA-2013-556677",
    taxId: "29AABCG3456J1Z3", pan: "AABCG3456J", founded: "2008", employees: "100-200",
    annualRevenue: "₹31 Cr+", paymentMode: "NEFT", paymentTerms: "NET 30",
    bankAccount: "XXXX-XXXX-2211", ifscCode: "SBIN0004567", bankName: "State Bank of India",
    bankBranch: "Peenya, Bangalore",
    billingAddressLine1: "45, 2nd Cross, Peenya", billingAddressLine2: "Industrial Area Phase I",
    billingCity: "Bangalore", billingState: "Karnataka", billingZip: "560058", billingCountry: "India",
    shippingAddressLine1: "Survey No 12, Dobbespet", shippingAddressLine2: "",
    shippingCity: "Bangalore Rural", shippingState: "Karnataka", shippingZip: "562135", shippingCountry: "India",
    performanceQuality: 82, performanceDelivery: 78, performanceResponsiveness: 80, performanceCompliance: 70,
  },
  {
    id: "VND-1004", name: "Cloud Systems India", category: "IT Services",
    primaryContact: "Sneha Reddy", email: "sneha@cloudsys.in", phone: "+91 65432 10987",
    rating: 4.7, region: "South", status: "Active", onboardedDate: "8 Sep 2022",
    monthSpend: 96000000, score: 4.9, address: "Hyderabad, India", totalSpend: 960000000,
    complianceIssues: 0, archived: false,
    addressLine1: "Level 8, Raheja Mindspace", addressLine2: "HITEC City", city: "Hyderabad",
    state: "Telangana", zipCode: "500081", country: "India",
    website: "www.cloudsystems.in", registrationNo: "TS-2012-778899",
    taxId: "36AABCC7890M1Z4", pan: "AABCC7890M", founded: "2012", employees: "1000+",
    annualRevenue: "₹96 Cr+", paymentMode: "NEFT / RTGS", paymentTerms: "NET 30",
    bankAccount: "XXXX-XXXX-5566", ifscCode: "AXIB0005678", bankName: "Axis Bank Ltd.",
    bankBranch: "HITEC City, Hyderabad",
    billingAddressLine1: "Level 8, Raheja Mindspace", billingAddressLine2: "HITEC City",
    billingCity: "Hyderabad", billingState: "Telangana", billingZip: "500081", billingCountry: "India",
    shippingAddressLine1: "Plot 22, IDA Nacharam", shippingAddressLine2: "",
    shippingCity: "Hyderabad", shippingState: "Telangana", shippingZip: "500076", shippingCountry: "India",
    performanceQuality: 91, performanceDelivery: 95, performanceResponsiveness: 93, performanceCompliance: 97,
  },
  {
    id: "VND-1005", name: "FastTrack Movers", category: "Logistics",
    primaryContact: "Vikram Singh", email: "vikram@fasttrack.co", phone: "+91 54321 09876",
    rating: 3.5, region: "East", status: "Pending", onboardedDate: "14 Nov 2023",
    monthSpend: 18000000, score: 3.6, address: "Kolkata, India", totalSpend: 75000000,
    complianceIssues: 1, archived: false,
    addressLine1: "7B, Park Street", addressLine2: "", city: "Kolkata",
    state: "West Bengal", zipCode: "700016", country: "India",
    website: "www.fasttrackmove.in", registrationNo: "WB-2019-990011",
    taxId: "19AABCF2345N1Z5", pan: "AABCF2345N", founded: "2018", employees: "50-100",
    annualRevenue: "₹7.5 Cr+", paymentMode: "NEFT", paymentTerms: "NET 60",
    bankAccount: "XXXX-XXXX-3344", ifscCode: "PUNB0006789", bankName: "Punjab National Bank",
    bankBranch: "Park Street, Kolkata",
    billingAddressLine1: "7B, Park Street", billingAddressLine2: "",
    billingCity: "Kolkata", billingState: "West Bengal", billingZip: "700016", billingCountry: "India",
    shippingAddressLine1: "NH-6 Uluberia", shippingAddressLine2: "Logistics Hub",
    shippingCity: "Howrah", shippingState: "West Bengal", shippingZip: "711315", shippingCountry: "India",
    performanceQuality: 72, performanceDelivery: 75, performanceResponsiveness: 68, performanceCompliance: 77,
  },
];

export function getVendors(): StoredVendor[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  localStorage.setItem(STORE_KEY, JSON.stringify(DEFAULT_VENDORS));
  return DEFAULT_VENDORS;
}

export function getVendorById(id: string): StoredVendor | undefined {
  return getVendors().find(v => v.id === id);
}

export function saveVendors(vendors: StoredVendor[]): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(vendors));
  window.dispatchEvent(new Event('nidoVendorsUpdated'));
}

export function updateVendor(id: string, updates: Partial<StoredVendor>): void {
  const vendors = getVendors();
  const idx = vendors.findIndex(v => v.id === id);
  if (idx > -1) {
    vendors[idx] = { ...vendors[idx], ...updates };
    saveVendors(vendors);
  }
}

export function addVendor(vendor: StoredVendor): void {
  const existing = getVendors();
  const idx = existing.findIndex(v => v.id === vendor.id);
  if (idx > -1) {
    existing[idx] = vendor;
  } else {
    existing.push(vendor);
  }
  saveVendors(existing);
}
