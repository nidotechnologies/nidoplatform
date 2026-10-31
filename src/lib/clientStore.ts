// The five entries below are intentionally shared demo data. User-created
// clients are stored separately for each signed-in account so one account
// cannot see another account's additions.
const STORE_KEY = 'nido_clients_v2';
const ARCHIVED_STORE_KEY = 'nido_clients_archived_v1';
const SCOPED_STORE_KEY = 'nido_clients_v3';
const SCOPED_ARCHIVED_STORE_KEY = 'nido_clients_archived_v2';
const LEGACY_MIGRATION_KEY = 'nido_clients_scoped_migration_v1';

export interface StoredClient {
  id: string;
  name: string;
  category?: string;
  tier?: string;
  rep?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  website?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  status?: string;
  billingAddress?: string;
  billingCity?: string;
  billingState?: string;
  billingPincode?: string;
  [key: string]: any;
}

/**
 * The CSV contract shared by the Clients list export/template and the
 * Client Onboarding form. Keep this list aligned with the non-file fields in
 * AddClient so an imported client can be opened and edited without losing
 * information.
 */
export const CLIENT_IMPORT_HEADERS = [
  "Client ID",
  "Company Name",
  "Category",
  "Client Tier",
  "Contact Person",
  "Email",
  "Phone",
  "Mobile",
  "Website",
  "Contract Start Date",
  "Contract End Date",
  "Client Logo URL",
  "GST Treatment",
  "GSTIN",
  "ID Reference Number",
  "Source of Supply",
  "PAN Number",
  "Currency",
  "Opening Balance",
  "Payment Terms",
  "TDS Rate",
  "Bank Name",
  "Account Number",
  "IFSC Code",
  "Branch",
  "Billing Address",
  "Billing Attention",
  "Billing Country",
  "Billing Address Line 2",
  "Billing City",
  "Billing State",
  "Billing Pincode",
  "Billing Phone Country Code",
  "Billing Phone",
  "Billing Fax Number",
  "Shipping Address",
  "Shipping Attention",
  "Shipping Country",
  "Shipping Address Line 2",
  "Shipping City",
  "Shipping State",
  "Shipping Pincode",
  "Shipping Phone Country Code",
  "Shipping Phone",
  "Shipping Fax Number",
  "Same Address",
  "Status",
] as const;

const importValue = (row: Record<string, string>, header: string) =>
  (row[header] || "").trim();

const importBoolean = (value: string) =>
  ["true", "yes", "1", "y"].includes(value.toLowerCase());

/** Parse a CSV document while preserving commas inside quoted values. */
export function parseClientCsv(csv: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    const next = csv[index + 1];
    if (character === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  if (rows.length < 2) return [];

  const headers = rows[0].map((header, index) =>
    header.replace(/^\uFEFF/, "").trim() || `Column ${index + 1}`,
  );
  return rows.slice(1).map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header, (cells[index] || "").trim()])),
  );
}

/** Convert one complete template row into the shape consumed by AddClient. */
export function clientFromImportRow(
  row: Record<string, string>,
  fallbackId: string,
): StoredClient {
  const id = importValue(row, "Client ID") || fallbackId;
  const name = importValue(row, "Company Name");
  const category = importValue(row, "Category");
  const tier = importValue(row, "Client Tier");
  const rep = importValue(row, "Contact Person");
  const billingAddress = importValue(row, "Billing Address");
  const billingAddressLine2 = importValue(row, "Billing Address Line 2");
  const shippingAddress = importValue(row, "Shipping Address");
  const shippingAddressLine2 = importValue(row, "Shipping Address Line 2");
  const billingPhoneCountryCode =
    importValue(row, "Billing Phone Country Code") || "+91";
  const shippingPhoneCountryCode =
    importValue(row, "Shipping Phone Country Code") || "+91";

  return {
    id,
    name: name || id,
    company_name: name,
    category,
    client_tier: tier,
    tier,
    contact_person: rep,
    rep,
    email: importValue(row, "Email"),
    phone: importValue(row, "Phone"),
    mobile: importValue(row, "Mobile"),
    website: importValue(row, "Website"),
    contract_start_date: importValue(row, "Contract Start Date"),
    contract_end_date: importValue(row, "Contract End Date"),
    contractStartDate: importValue(row, "Contract Start Date"),
    contractEndDate: importValue(row, "Contract End Date"),
    client_logo_url: importValue(row, "Client Logo URL"),
    gst_treatment: importValue(row, "GST Treatment"),
    gstin: importValue(row, "GSTIN"),
    id_reference_number: importValue(row, "ID Reference Number"),
    source_of_supply: importValue(row, "Source of Supply"),
    pan_number: importValue(row, "PAN Number"),
    currency: importValue(row, "Currency") || "INR",
    opening_balance: importValue(row, "Opening Balance"),
    payment_terms: importValue(row, "Payment Terms"),
    tds_rate: importValue(row, "TDS Rate"),
    bank_name: importValue(row, "Bank Name"),
    account_number: importValue(row, "Account Number"),
    ifsc_code: importValue(row, "IFSC Code"),
    branch: importValue(row, "Branch"),
    billing_address: billingAddress,
    billingAddress,
    billing_attention: importValue(row, "Billing Attention"),
    billingAttention: importValue(row, "Billing Attention"),
    billing_country: importValue(row, "Billing Country"),
    billingCountry: importValue(row, "Billing Country"),
    billing_address_line2: billingAddressLine2,
    billingAddressLine2,
    billing_city: importValue(row, "Billing City"),
    billingCity: importValue(row, "Billing City"),
    billing_state: importValue(row, "Billing State"),
    billingState: importValue(row, "Billing State"),
    billing_pincode: importValue(row, "Billing Pincode"),
    billingPincode: importValue(row, "Billing Pincode"),
    billing_phone_country_code: billingPhoneCountryCode,
    billingPhoneCountryCode,
    billing_phone: importValue(row, "Billing Phone"),
    billingPhone: importValue(row, "Billing Phone"),
    billing_fax_number: importValue(row, "Billing Fax Number"),
    billingFaxNumber: importValue(row, "Billing Fax Number"),
    shipping_address: shippingAddress,
    shippingAddress,
    shipping_attention: importValue(row, "Shipping Attention"),
    shippingAttention: importValue(row, "Shipping Attention"),
    shipping_country: importValue(row, "Shipping Country"),
    shippingCountry: importValue(row, "Shipping Country"),
    shipping_address_line2: shippingAddressLine2,
    shippingAddressLine2,
    shipping_city: importValue(row, "Shipping City"),
    shippingCity: importValue(row, "Shipping City"),
    shipping_state: importValue(row, "Shipping State"),
    shippingState: importValue(row, "Shipping State"),
    shipping_pincode: importValue(row, "Shipping Pincode"),
    shippingPincode: importValue(row, "Shipping Pincode"),
    shipping_phone_country_code: shippingPhoneCountryCode,
    shippingPhoneCountryCode,
    shipping_phone: importValue(row, "Shipping Phone"),
    shippingPhone: importValue(row, "Shipping Phone"),
    shipping_fax_number: importValue(row, "Shipping Fax Number"),
    shippingFaxNumber: importValue(row, "Shipping Fax Number"),
    same_address: importBoolean(importValue(row, "Same Address")),
    status: importValue(row, "Status") || "active",
  };
}

const exportValue = (value: unknown) => String(value ?? "");

/** Return values in the same order as CLIENT_IMPORT_HEADERS for CSV export. */
export function clientToImportValues(client: StoredClient): string[] {
  return [
    client.id,
    client.company_name || client.name,
    client.category,
    client.client_tier || client.tier,
    client.contact_person || client.rep,
    client.email,
    client.phone,
    client.mobile,
    client.website,
    client.contract_start_date || client.contractStartDate,
    client.contract_end_date || client.contractEndDate,
    client.client_logo_url,
    client.gst_treatment,
    client.gstin,
    client.id_reference_number,
    client.source_of_supply,
    client.pan_number,
    client.currency || "INR",
    client.opening_balance ?? client.openingBalance,
    client.payment_terms ?? client.paymentTerms,
    client.tds_rate ?? client.tdsRate,
    client.bank_name ?? client.bankName,
    client.account_number ?? client.accountNumber,
    client.ifsc_code ?? client.ifscCode,
    client.branch,
    client.billing_address || client.billingAddress,
    client.billing_attention || client.billingAttention,
    client.billing_country || client.billingCountry,
    client.billing_address_line2 || client.billingAddressLine2,
    client.billing_city || client.billingCity,
    client.billing_state || client.billingState,
    client.billing_pincode || client.billingPincode,
    client.billing_phone_country_code || client.billingPhoneCountryCode,
    client.billing_phone || client.billingPhone,
    client.billing_fax_number || client.billingFaxNumber,
    client.shipping_address || client.shippingAddress,
    client.shipping_attention || client.shippingAttention,
    client.shipping_country || client.shippingCountry,
    client.shipping_address_line2 || client.shippingAddressLine2,
    client.shipping_city || client.shippingCity,
    client.shipping_state || client.shippingState,
    client.shipping_pincode || client.shippingPincode,
    client.shipping_phone_country_code || client.shippingPhoneCountryCode,
    client.shipping_phone || client.shippingPhone,
    client.shipping_fax_number || client.shippingFaxNumber,
    client.same_address ? "Yes" : "No",
    client.status || "active",
  ].map(exportValue);
}

const DEFAULT_CLIENTS: StoredClient[] = [
  { id: "CI-00019", name: "Raj Manufacturing", category: "IT Hardware", tier: "Premium", rep: "Rajesh Kumar", email: "rajesh@gmail.com", phone: "+91 98765 43210", mobile: "+91 99876 54321", website: "www.rajmfg.com", contractStartDate: "2024-01-01", contractEndDate: "2025-01-01", status: "active", billingAddress: "123 Tech Street", billingCity: "Mumbai", billingState: "Maharashtra", billingPincode: "400001" },
  { id: "CI-00018", name: "Tech Solutions Ltd", category: "Cloud Servers", tier: "Standard", rep: "Amit Singh", email: "amit@gmail.com", phone: "+91 87654 32109", mobile: "+91 88765 43210", website: "www.techsol.com", contractStartDate: "2024-02-01", contractEndDate: "2025-02-01", status: "active", billingAddress: "456 IT Park", billingCity: "Bangalore", billingState: "Karnataka", billingPincode: "560001" },
  { id: "CI-00017", name: "Global Exports", category: "Office Supplies", tier: "Basic", rep: "Priya Sharma", email: "priya@gmail.com", phone: "+91 76543 21098", mobile: "+91 77654 32109", website: "www.globalexp.com", contractStartDate: "2024-03-01", contractEndDate: "2025-03-01", status: "pending", billingAddress: "789 Export Plaza", billingCity: "Delhi", billingState: "Delhi", billingPincode: "110001" },
  { id: "CI-00016", name: "Express IT Services", category: "IT Hardware", tier: "Premium", rep: "Vikram Patel", email: "vikram@gmail.com", phone: "+91 65432 10987", mobile: "+91 66543 21098", website: "www.expressit.com", contractStartDate: "2024-04-01", contractEndDate: "2025-04-01", status: "active", billingAddress: "321 Tech Hub", billingCity: "Hyderabad", billingState: "Telangana", billingPincode: "500001" },
  { id: "CI-00015", name: "Digital Innovations", category: "Cloud Servers", tier: "Standard", rep: "Anita Desai", email: "anita@gmail.com", phone: "+91 54321 09876", mobile: "+91 55432 10987", website: "www.diginnovate.com", contractStartDate: "2024-05-01", contractEndDate: "2025-05-01", status: "active", billingAddress: "654 Innovation Drive", billingCity: "Pune", billingState: "Maharashtra", billingPincode: "411001" },
];
const DEFAULT_CLIENT_IDS = new Set(DEFAULT_CLIENTS.map(client => client.id));

export function isSharedClient(clientId: string): boolean {
  return DEFAULT_CLIENT_IDS.has(clientId);
}

function currentUserScope(): string {
  try {
    const rawUser = localStorage.getItem('nido_user');
    if (rawUser) {
      const user = JSON.parse(rawUser) as { id?: string; email?: string };
      const identity = user.id || user.email;
      if (identity) return identity;
    }
  } catch {
    // Fall back to the anonymous scope when the session is unavailable.
  }
  return 'anonymous';
}

function scopedKey(baseKey: string): string {
  return `${baseKey}:${encodeURIComponent(currentUserScope())}`;
}

function readList<T>(key: string): T[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * One-time migration for an existing imported app. The old store was shared
 * by every account, so its data is assigned to the first authenticated user
 * who opens the clients page. Later users start with the five demo clients.
 * This prevents legacy custom data from leaking between accounts.
 */
function initialClientsForScope(): StoredClient[] {
  const scope = currentUserScope();

  if (scope === 'anonymous' || localStorage.getItem(LEGACY_MIGRATION_KEY)) {
    return [];
  }

  const legacy = readList<StoredClient>(STORE_KEY);
  if (legacy) {
    localStorage.setItem(LEGACY_MIGRATION_KEY, scope);
    // Keep the original five demo rows in the shared seed. Only migrate
    // records that were added by a user from the old shared store.
    return legacy.filter(client => !DEFAULT_CLIENT_IDS.has(client.id));
  }

  localStorage.setItem(LEGACY_MIGRATION_KEY, scope);
  return [];
}

export function getClients(): StoredClient[] {
  const key = scopedKey(SCOPED_STORE_KEY);
  const stored = readList<StoredClient>(key);
  if (stored) {
    // v3 initially stored the full list. Normalize it to custom rows so the
    // five shared demo clients cannot be edited or removed for an account.
    const custom = stored.filter(client => !DEFAULT_CLIENT_IDS.has(client.id));
    if (custom.length !== stored.length) {
      localStorage.setItem(key, JSON.stringify(custom));
    }
    return [...DEFAULT_CLIENTS.map(client => ({ ...client })), ...custom];
  }

  const custom = initialClientsForScope();
  localStorage.setItem(key, JSON.stringify(custom));
  return [...DEFAULT_CLIENTS.map(client => ({ ...client })), ...custom];
}

/**
 * Resolve one client for a portal session.
 *
 * Portal users have their own auth scope, while the client itself is created
 * in the owner/admin scope. We still restrict the lookup to the requested
 * client ID so a portal session cannot receive another client's record.
 */
export function getClientForPortal(clientId: string): StoredClient | undefined {
  if (!clientId) return undefined;

  const current = getClients().find((client) => client.id === clientId);
  if (current) return current;

  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(`${SCOPED_STORE_KEY}:`)) continue;
      const scopedClients = readList<StoredClient>(key);
      const match = scopedClients?.find((client) => client.id === clientId);
      if (match) return { ...match };
    }

    const legacyMatch = readList<StoredClient>(STORE_KEY)?.find(
      (client) => client.id === clientId,
    );
    if (legacyMatch) return { ...legacyMatch };
  } catch {
    // localStorage can be unavailable in restricted browser contexts.
  }

  return undefined;
}

export function saveClients(clients: StoredClient[]): void {
  const custom = clients.filter(client => !DEFAULT_CLIENT_IDS.has(client.id));
  localStorage.setItem(scopedKey(SCOPED_STORE_KEY), JSON.stringify(custom));
  window.dispatchEvent(new Event('nidoClientsUpdated'));
}

export function addClient(client: StoredClient): void {
  const existing = getClients();
  const idx = existing.findIndex(c => c.id === client.id);
  if (idx > -1) {
    existing[idx] = client;
  } else {
    existing.push(client);
  }
  saveClients(existing);
}

export interface ArchivedClient extends StoredClient {
  archivedOn: string;
}

export function getArchivedClients(): ArchivedClient[] {
  const key = scopedKey(SCOPED_ARCHIVED_STORE_KEY);
  const stored = readList<ArchivedClient>(key);
  if (stored) {
    const custom = stored.filter(client => !DEFAULT_CLIENT_IDS.has(client.id));
    if (custom.length !== stored.length) {
      localStorage.setItem(key, JSON.stringify(custom));
    }
    return custom;
  }

  // Migrate archived records for the same first account as the client list.
  const scope = currentUserScope();
  const legacy = scope !== 'anonymous' && localStorage.getItem(LEGACY_MIGRATION_KEY) === scope
    ? readList<ArchivedClient>(ARCHIVED_STORE_KEY)
    : null;
  const initial = (legacy || []).filter(client => !DEFAULT_CLIENT_IDS.has(client.id));
  localStorage.setItem(key, JSON.stringify(initial));
  return initial;
}

export function saveArchivedClients(clients: ArchivedClient[]): void {
  const custom = clients.filter(client => !DEFAULT_CLIENT_IDS.has(client.id));
  localStorage.setItem(scopedKey(SCOPED_ARCHIVED_STORE_KEY), JSON.stringify(custom));
  window.dispatchEvent(new Event('nidoClientsUpdated'));
}
