// ─── NIDO Tax Engine ─────────────────────────────────────────────────────────
// Single source of truth for all tax calculations across the platform.
// Every module must derive tax through this engine — never calculate separately.

// ─── Storage keys ─────────────────────────────────────────────────────────────
const KEYS = {
  TAX_CATEGORIES:        'nido_tax_categories',
  HSN_CODES:             'nido_hsn_codes_v2',
  SAC_CODES:             'nido_sac_codes_v2',
  PRODUCT_CAT_TAX_MAP:   'nido_product_cat_tax_map_v2',
  VENDOR_TAX_SETTINGS:   'nido_vendor_tax_settings',
  CLIENT_TAX_SETTINGS:   'nido_client_tax_settings',
  SERVICE_TAX_SETTINGS:  'nido_service_tax_settings',
  TAX_AUDIT_LOG:         'nido_tax_audit_log',
} as const;

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch { /* ignore */ }
  return fallback;
}

function save(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent('taxEngineUpdated', { detail: { key } }));
  // Also notify price-engine-aware pages so they re-render with updated tax rates
  window.dispatchEvent(new Event('priceEngineSettingsUpdated'));
}

// ─── Tax Category ─────────────────────────────────────────────────────────────
export interface TaxCategory {
  id: string;
  name: string;
  description: string;
  cgstPct: number;
  sgstPct: number;
  igstPct: number;
  utgstPct: number;
  isReverseCharge: boolean;
  isExempt: boolean;
  isZeroRated: boolean;
  applicableTo: 'Product' | 'Service' | 'Both';
  status: 'Active' | 'Inactive';
}

const DEFAULT_TAX_CATEGORIES: TaxCategory[] = [
  { id: 'tc-1', name: 'Standard GST 18%', description: 'Standard rate — electronics, most goods', cgstPct: 9, sgstPct: 9, igstPct: 18, utgstPct: 9, isReverseCharge: false, isExempt: false, isZeroRated: false, applicableTo: 'Both', status: 'Active' },
  { id: 'tc-2', name: 'Standard GST 12%', description: 'Processed foods, business class', cgstPct: 6, sgstPct: 6, igstPct: 12, utgstPct: 6, isReverseCharge: false, isExempt: false, isZeroRated: false, applicableTo: 'Product', status: 'Active' },
  { id: 'tc-3', name: 'Standard GST 5%', description: 'Essential goods, economy hotels', cgstPct: 2.5, sgstPct: 2.5, igstPct: 5, utgstPct: 2.5, isReverseCharge: false, isExempt: false, isZeroRated: false, applicableTo: 'Product', status: 'Active' },
  { id: 'tc-4', name: 'Zero Rated', description: 'Exports and supplies to SEZ', cgstPct: 0, sgstPct: 0, igstPct: 0, utgstPct: 0, isReverseCharge: false, isExempt: false, isZeroRated: true, applicableTo: 'Both', status: 'Active' },
  { id: 'tc-5', name: 'Exempt', description: 'Fresh food, healthcare, education', cgstPct: 0, sgstPct: 0, igstPct: 0, utgstPct: 0, isReverseCharge: false, isExempt: true, isZeroRated: false, applicableTo: 'Product', status: 'Active' },
  { id: 'tc-6', name: 'Reverse Charge', description: 'Supplies where recipient pays tax', cgstPct: 9, sgstPct: 9, igstPct: 18, utgstPct: 9, isReverseCharge: true, isExempt: false, isZeroRated: false, applicableTo: 'Both', status: 'Active' },
  { id: 'tc-7', name: 'SEZ', description: 'Special Economic Zone supplies', cgstPct: 0, sgstPct: 0, igstPct: 0, utgstPct: 0, isReverseCharge: false, isExempt: false, isZeroRated: true, applicableTo: 'Both', status: 'Active' },
  { id: 'tc-8', name: 'Government Exempt', description: 'Government entity exemptions', cgstPct: 0, sgstPct: 0, igstPct: 0, utgstPct: 0, isReverseCharge: false, isExempt: true, isZeroRated: false, applicableTo: 'Both', status: 'Active' },
  { id: 'tc-9', name: 'Service GST 18%', description: 'Standard service rate', cgstPct: 9, sgstPct: 9, igstPct: 18, utgstPct: 9, isReverseCharge: false, isExempt: false, isZeroRated: false, applicableTo: 'Service', status: 'Active' },
  { id: 'tc-10', name: 'Interstate GST', description: 'Cross-state supply — IGST applies', cgstPct: 0, sgstPct: 0, igstPct: 18, utgstPct: 0, isReverseCharge: false, isExempt: false, isZeroRated: false, applicableTo: 'Both', status: 'Active' },
];

export function getTaxCategories(): TaxCategory[] {
  return load(KEYS.TAX_CATEGORIES, DEFAULT_TAX_CATEGORIES);
}

export function saveTaxCategories(categories: TaxCategory[], auditUser = 'System'): void {
  const prev = getTaxCategories();
  recordAuditEntry({ user: auditUser, module: 'Tax Categories', prevValue: JSON.stringify(prev), newValue: JSON.stringify(categories) });
  save(KEYS.TAX_CATEGORIES, categories);
}

// ─── HSN Code ─────────────────────────────────────────────────────────────────
export interface HsnCode {
  id: string;
  code: string;
  description: string;
  gstRate: number;
  taxCategoryId: string;
  productCategory: string;
  status: 'Active' | 'Inactive';
}

const DEFAULT_HSN_CODES: HsnCode[] = [
  { id: 'hsn-1',  code: '8471', description: 'Computers, laptops, workstations, servers',        gstRate: 18, taxCategoryId: 'tc-1', productCategory: 'Computers & Laptops',        status: 'Active' },
  { id: 'hsn-2',  code: '8517', description: 'Routers, switches, access points, firewalls',       gstRate: 18, taxCategoryId: 'tc-1', productCategory: 'Networking',                 status: 'Active' },
  { id: 'hsn-3',  code: '8471', description: 'Keyboards, mouse, monitors, webcams, printers',     gstRate: 18, taxCategoryId: 'tc-1', productCategory: 'Computer Peripherals',       status: 'Active' },
  { id: 'hsn-4',  code: '8443', description: 'Printers, scanners, multifunction devices',         gstRate: 18, taxCategoryId: 'tc-1', productCategory: 'Printers & Scanners',        status: 'Active' },
  { id: 'hsn-5',  code: '8523', description: 'HDD, SSD, USB drives, memory cards',                gstRate: 18, taxCategoryId: 'tc-1', productCategory: 'Storage Devices',            status: 'Active' },
  { id: 'hsn-6',  code: '4820', description: 'Files, registers, office paper',                    gstRate: 12, taxCategoryId: 'tc-2', productCategory: 'Office Supplies',            status: 'Active' },
  { id: 'hsn-7',  code: '4820', description: 'Pens, notebooks, diaries, envelopes',               gstRate: 12, taxCategoryId: 'tc-2', productCategory: 'Stationery',                 status: 'Active' },
  { id: 'hsn-8',  code: '9403', description: 'Office furniture',                                  gstRate: 18, taxCategoryId: 'tc-1', productCategory: 'Furniture',                  status: 'Active' },
  { id: 'hsn-9',  code: '9401', description: 'Chairs, stools',                                    gstRate: 18, taxCategoryId: 'tc-1', productCategory: 'Office Chairs',              status: 'Active' },
  { id: 'hsn-10', code: '8536', description: 'Switches, sockets, electrical fittings',            gstRate: 18, taxCategoryId: 'tc-1', productCategory: 'Electrical Equipment',       status: 'Active' },
  { id: 'hsn-11', code: '8509', description: 'Small office appliances',                           gstRate: 18, taxCategoryId: 'tc-1', productCategory: 'Electrical Appliances',      status: 'Active' },
  { id: 'hsn-12', code: '9405', description: 'LED lights, lamps',                                 gstRate: 12, taxCategoryId: 'tc-2', productCategory: 'Lighting',                   status: 'Active' },
  { id: 'hsn-13', code: '8525', description: 'CCTV cameras and accessories',                      gstRate: 18, taxCategoryId: 'tc-1', productCategory: 'CCTV & Security',            status: 'Active' },
  { id: 'hsn-14', code: '8531', description: 'Biometric, attendance, access systems',             gstRate: 18, taxCategoryId: 'tc-1', productCategory: 'Access Control',             status: 'Active' },
  { id: 'hsn-15', code: '8507', description: 'UPS batteries, rechargeable batteries',             gstRate: 18, taxCategoryId: 'tc-1', productCategory: 'UPS & Batteries',            status: 'Active' },
  { id: 'hsn-16', code: '8504', description: 'UPS, inverters',                                    gstRate: 18, taxCategoryId: 'tc-1', productCategory: 'Power Backup',               status: 'Active' },
  { id: 'hsn-17', code: '8517', description: 'IP phones, communication devices',                  gstRate: 18, taxCategoryId: 'tc-1', productCategory: 'Telecommunication',           status: 'Active' },
  { id: 'hsn-18', code: '8518', description: 'Speakers, microphones',                             gstRate: 18, taxCategoryId: 'tc-1', productCategory: 'Audio & Video Equipment',    status: 'Active' },
  { id: 'hsn-19', code: '8528', description: 'Projectors, TVs, display panels',                   gstRate: 18, taxCategoryId: 'tc-1', productCategory: 'Projectors & Displays',      status: 'Active' },
  { id: 'hsn-20', code: '2106', description: 'General pantry items',                              gstRate: 18, taxCategoryId: 'tc-1', productCategory: 'Pantry Supplies',            status: 'Active' },
  { id: 'hsn-21', code: '2202', description: 'Tea, coffee, soft drinks',                          gstRate: 12, taxCategoryId: 'tc-2', productCategory: 'Beverages',                  status: 'Active' },
  { id: 'hsn-22', code: '3402', description: 'Cleaning chemicals, detergents',                    gstRate: 18, taxCategoryId: 'tc-1', productCategory: 'Cleaning Supplies',          status: 'Active' },
  { id: 'hsn-23', code: '9603', description: 'Brooms, brushes, mops',                             gstRate: 12, taxCategoryId: 'tc-2', productCategory: 'Housekeeping Materials',     status: 'Active' },
  { id: 'hsn-24', code: '3004', description: 'Medicines and consumables',                         gstRate: 12, taxCategoryId: 'tc-2', productCategory: 'Medical Supplies',           status: 'Active' },
  { id: 'hsn-25', code: '9018', description: 'Medical instruments',                               gstRate: 12, taxCategoryId: 'tc-2', productCategory: 'Medical Equipment',          status: 'Active' },
  { id: 'hsn-26', code: '6506', description: 'Helmets, PPE',                                      gstRate: 18, taxCategoryId: 'tc-1', productCategory: 'Safety Equipment',           status: 'Active' },
  { id: 'hsn-27', code: '8424', description: 'Fire extinguishers',                                gstRate: 18, taxCategoryId: 'tc-1', productCategory: 'Fire Safety',                status: 'Active' },
  { id: 'hsn-28', code: '8205', description: 'Hand tools',                                        gstRate: 18, taxCategoryId: 'tc-1', productCategory: 'Industrial Tools',           status: 'Active' },
  { id: 'hsn-29', code: '7318', description: 'Nuts, bolts, screws',                               gstRate: 18, taxCategoryId: 'tc-1', productCategory: 'Hardware & Fasteners',       status: 'Active' },
  { id: 'hsn-30', code: '6810', description: 'Cement products, construction materials',           gstRate: 18, taxCategoryId: 'tc-1', productCategory: 'Building Materials',         status: 'Active' },
  { id: 'hsn-31', code: '3917', description: 'Pipes, fittings',                                   gstRate: 18, taxCategoryId: 'tc-1', productCategory: 'Plumbing Materials',         status: 'Active' },
  { id: 'hsn-32', code: '3208', description: 'Paints, coatings',                                  gstRate: 18, taxCategoryId: 'tc-1', productCategory: 'Paints & Chemicals',         status: 'Active' },
  { id: 'hsn-33', code: '3923', description: 'Plastic packaging',                                 gstRate: 18, taxCategoryId: 'tc-1', productCategory: 'Packaging Materials',        status: 'Active' },
  { id: 'hsn-34', code: '4802', description: 'Copier paper, printing paper',                      gstRate: 12, taxCategoryId: 'tc-2', productCategory: 'Paper Products',             status: 'Active' },
  { id: 'hsn-35', code: '9999', description: 'Products not yet classified (temporary only)',      gstRate: 18, taxCategoryId: 'tc-1', productCategory: 'Miscellaneous Products',     status: 'Active' },
];

export function getHsnCodes(): HsnCode[] {
  return load(KEYS.HSN_CODES, DEFAULT_HSN_CODES);
}

export function saveHsnCodes(codes: HsnCode[], auditUser = 'System'): void {
  const prev = getHsnCodes();
  recordAuditEntry({ user: auditUser, module: 'HSN Codes', prevValue: JSON.stringify(prev), newValue: JSON.stringify(codes) });
  save(KEYS.HSN_CODES, codes);
}

// ─── SAC Code ─────────────────────────────────────────────────────────────────
export interface SacCode {
  id: string;
  code: string;
  description: string;
  gstRate: number;
  taxCategoryId: string;
  serviceCategory: string;
  status: 'Active' | 'Inactive';
}

const DEFAULT_SAC_CODES: SacCode[] = [
  { id: 'sac-1',  code: '998314', description: 'Software licensing & implementation',          gstRate: 18, taxCategoryId: 'tc-9', serviceCategory: 'Software',                           status: 'Active' },
  { id: 'sac-2',  code: '998315', description: 'Cloud hosting, SaaS, storage',                 gstRate: 18, taxCategoryId: 'tc-9', serviceCategory: 'Cloud Services',                     status: 'Active' },
  { id: 'sac-3',  code: '998912', description: 'Printing services',                            gstRate: 18, taxCategoryId: 'tc-9', serviceCategory: 'Printing & Branding',                status: 'Active' },
  { id: 'sac-4',  code: '9965',   description: 'Goods transport services',                     gstRate: 5,  taxCategoryId: 'tc-3', serviceCategory: 'Logistics & Transportation',         status: 'Active' },
  { id: 'sac-5',  code: '996812', description: 'Courier and parcel services',                  gstRate: 18, taxCategoryId: 'tc-9', serviceCategory: 'Courier Services',                   status: 'Active' },
  { id: 'sac-6',  code: '9954',   description: 'Installation work',                            gstRate: 18, taxCategoryId: 'tc-9', serviceCategory: 'Installation Services',              status: 'Active' },
  { id: 'sac-7',  code: '998719', description: 'Equipment maintenance',                        gstRate: 18, taxCategoryId: 'tc-9', serviceCategory: 'Repair & Maintenance',               status: 'Active' },
  { id: 'sac-8',  code: '998719', description: 'Maintenance contracts',                        gstRate: 18, taxCategoryId: 'tc-9', serviceCategory: 'AMC (Annual Maintenance Contract)',   status: 'Active' },
  { id: 'sac-9',  code: '9983',   description: 'Professional consulting',                      gstRate: 18, taxCategoryId: 'tc-9', serviceCategory: 'Consulting Services',                status: 'Active' },
  { id: 'sac-10', code: '998513', description: 'Staffing services',                            gstRate: 18, taxCategoryId: 'tc-9', serviceCategory: 'Recruitment Services',               status: 'Active' },
  { id: 'sac-11', code: '999293', description: 'Corporate training',                           gstRate: 18, taxCategoryId: 'tc-9', serviceCategory: 'Training Services',                  status: 'Active' },
  { id: 'sac-12', code: '998529', description: 'Security guards and surveillance',             gstRate: 18, taxCategoryId: 'tc-9', serviceCategory: 'Security Services',                  status: 'Active' },
  { id: 'sac-13', code: '998599', description: 'Facility management',                          gstRate: 18, taxCategoryId: 'tc-9', serviceCategory: 'Facility Management',                status: 'Active' },
  { id: 'sac-14', code: '998531', description: 'Cleaning services',                            gstRate: 18, taxCategoryId: 'tc-9', serviceCategory: 'Housekeeping Services',              status: 'Active' },
  { id: 'sac-15', code: '998422', description: 'ISP services',                                 gstRate: 18, taxCategoryId: 'tc-9', serviceCategory: 'Internet Services',                  status: 'Active' },
  { id: 'sac-16', code: '998412', description: 'Telephone and communication services',         gstRate: 18, taxCategoryId: 'tc-9', serviceCategory: 'Telecom Services',                   status: 'Active' },
  { id: 'sac-17', code: '998361', description: 'SEO, social media, advertising',               gstRate: 18, taxCategoryId: 'tc-9', serviceCategory: 'Digital Marketing',                  status: 'Active' },
  { id: 'sac-18', code: '998313', description: 'Web application development',                  gstRate: 18, taxCategoryId: 'tc-9', serviceCategory: 'Website Development',                status: 'Active' },
  { id: 'sac-19', code: '998313', description: 'Mobile application development',               gstRate: 18, taxCategoryId: 'tc-9', serviceCategory: 'Mobile App Development',             status: 'Active' },
  { id: 'sac-20', code: '998315', description: 'Colocation and hosting',                       gstRate: 18, taxCategoryId: 'tc-9', serviceCategory: 'Data Center Services',               status: 'Active' },
  { id: 'sac-21', code: '999799', description: 'Services not yet classified (temporary only)', gstRate: 18, taxCategoryId: 'tc-9', serviceCategory: 'Miscellaneous Services',             status: 'Active' },
];

export function getSacCodes(): SacCode[] {
  return load(KEYS.SAC_CODES, DEFAULT_SAC_CODES);
}

export function saveSacCodes(codes: SacCode[], auditUser = 'System'): void {
  const prev = getSacCodes();
  recordAuditEntry({ user: auditUser, module: 'SAC Codes', prevValue: JSON.stringify(prev), newValue: JSON.stringify(codes) });
  save(KEYS.SAC_CODES, codes);
}

// ─── Product Category Tax Mapping ─────────────────────────────────────────────
export interface ProductCategoryTaxMap {
  id: string;
  productCategory: string;
  defaultHsnCode: string;
  taxCategoryId: string;
  gstRate: number;
  cgstPct: number;
  sgstPct: number;
  igstPct: number;
  taxInclusive: boolean;
  isReverseCharge: boolean;
  isExempt: boolean;
  priority: number;
}

const DEFAULT_PRODUCT_CATEGORY_TAX_MAP: ProductCategoryTaxMap[] = [
  { id: 'pctm-1',  productCategory: 'Computers & Laptops',        defaultHsnCode: '8471', taxCategoryId: 'tc-1', gstRate: 18, cgstPct: 9,   sgstPct: 9,   igstPct: 18, taxInclusive: false, isReverseCharge: false, isExempt: false, priority: 1 },
  { id: 'pctm-2',  productCategory: 'Networking',                  defaultHsnCode: '8517', taxCategoryId: 'tc-1', gstRate: 18, cgstPct: 9,   sgstPct: 9,   igstPct: 18, taxInclusive: false, isReverseCharge: false, isExempt: false, priority: 1 },
  { id: 'pctm-3',  productCategory: 'Computer Peripherals',        defaultHsnCode: '8471', taxCategoryId: 'tc-1', gstRate: 18, cgstPct: 9,   sgstPct: 9,   igstPct: 18, taxInclusive: false, isReverseCharge: false, isExempt: false, priority: 1 },
  { id: 'pctm-4',  productCategory: 'Printers & Scanners',         defaultHsnCode: '8443', taxCategoryId: 'tc-1', gstRate: 18, cgstPct: 9,   sgstPct: 9,   igstPct: 18, taxInclusive: false, isReverseCharge: false, isExempt: false, priority: 1 },
  { id: 'pctm-5',  productCategory: 'Storage Devices',             defaultHsnCode: '8523', taxCategoryId: 'tc-1', gstRate: 18, cgstPct: 9,   sgstPct: 9,   igstPct: 18, taxInclusive: false, isReverseCharge: false, isExempt: false, priority: 1 },
  { id: 'pctm-6',  productCategory: 'Office Supplies',             defaultHsnCode: '4820', taxCategoryId: 'tc-2', gstRate: 12, cgstPct: 6,   sgstPct: 6,   igstPct: 12, taxInclusive: false, isReverseCharge: false, isExempt: false, priority: 1 },
  { id: 'pctm-7',  productCategory: 'Stationery',                  defaultHsnCode: '4820', taxCategoryId: 'tc-2', gstRate: 12, cgstPct: 6,   sgstPct: 6,   igstPct: 12, taxInclusive: false, isReverseCharge: false, isExempt: false, priority: 1 },
  { id: 'pctm-8',  productCategory: 'Furniture',                   defaultHsnCode: '9403', taxCategoryId: 'tc-1', gstRate: 18, cgstPct: 9,   sgstPct: 9,   igstPct: 18, taxInclusive: false, isReverseCharge: false, isExempt: false, priority: 1 },
  { id: 'pctm-9',  productCategory: 'Office Chairs',               defaultHsnCode: '9401', taxCategoryId: 'tc-1', gstRate: 18, cgstPct: 9,   sgstPct: 9,   igstPct: 18, taxInclusive: false, isReverseCharge: false, isExempt: false, priority: 1 },
  { id: 'pctm-10', productCategory: 'Electrical Equipment',        defaultHsnCode: '8536', taxCategoryId: 'tc-1', gstRate: 18, cgstPct: 9,   sgstPct: 9,   igstPct: 18, taxInclusive: false, isReverseCharge: false, isExempt: false, priority: 1 },
  { id: 'pctm-11', productCategory: 'Electrical Appliances',       defaultHsnCode: '8509', taxCategoryId: 'tc-1', gstRate: 18, cgstPct: 9,   sgstPct: 9,   igstPct: 18, taxInclusive: false, isReverseCharge: false, isExempt: false, priority: 1 },
  { id: 'pctm-12', productCategory: 'Lighting',                    defaultHsnCode: '9405', taxCategoryId: 'tc-2', gstRate: 12, cgstPct: 6,   sgstPct: 6,   igstPct: 12, taxInclusive: false, isReverseCharge: false, isExempt: false, priority: 1 },
  { id: 'pctm-13', productCategory: 'CCTV & Security',             defaultHsnCode: '8525', taxCategoryId: 'tc-1', gstRate: 18, cgstPct: 9,   sgstPct: 9,   igstPct: 18, taxInclusive: false, isReverseCharge: false, isExempt: false, priority: 1 },
  { id: 'pctm-14', productCategory: 'Access Control',              defaultHsnCode: '8531', taxCategoryId: 'tc-1', gstRate: 18, cgstPct: 9,   sgstPct: 9,   igstPct: 18, taxInclusive: false, isReverseCharge: false, isExempt: false, priority: 1 },
  { id: 'pctm-15', productCategory: 'UPS & Batteries',             defaultHsnCode: '8507', taxCategoryId: 'tc-1', gstRate: 18, cgstPct: 9,   sgstPct: 9,   igstPct: 18, taxInclusive: false, isReverseCharge: false, isExempt: false, priority: 1 },
  { id: 'pctm-16', productCategory: 'Power Backup',                defaultHsnCode: '8504', taxCategoryId: 'tc-1', gstRate: 18, cgstPct: 9,   sgstPct: 9,   igstPct: 18, taxInclusive: false, isReverseCharge: false, isExempt: false, priority: 1 },
  { id: 'pctm-17', productCategory: 'Telecommunication',           defaultHsnCode: '8517', taxCategoryId: 'tc-1', gstRate: 18, cgstPct: 9,   sgstPct: 9,   igstPct: 18, taxInclusive: false, isReverseCharge: false, isExempt: false, priority: 1 },
  { id: 'pctm-18', productCategory: 'Audio & Video Equipment',     defaultHsnCode: '8518', taxCategoryId: 'tc-1', gstRate: 18, cgstPct: 9,   sgstPct: 9,   igstPct: 18, taxInclusive: false, isReverseCharge: false, isExempt: false, priority: 1 },
  { id: 'pctm-19', productCategory: 'Projectors & Displays',       defaultHsnCode: '8528', taxCategoryId: 'tc-1', gstRate: 18, cgstPct: 9,   sgstPct: 9,   igstPct: 18, taxInclusive: false, isReverseCharge: false, isExempt: false, priority: 1 },
  { id: 'pctm-20', productCategory: 'Pantry Supplies',             defaultHsnCode: '2106', taxCategoryId: 'tc-1', gstRate: 18, cgstPct: 9,   sgstPct: 9,   igstPct: 18, taxInclusive: false, isReverseCharge: false, isExempt: false, priority: 1 },
  { id: 'pctm-21', productCategory: 'Beverages',                   defaultHsnCode: '2202', taxCategoryId: 'tc-2', gstRate: 12, cgstPct: 6,   sgstPct: 6,   igstPct: 12, taxInclusive: false, isReverseCharge: false, isExempt: false, priority: 1 },
  { id: 'pctm-22', productCategory: 'Cleaning Supplies',           defaultHsnCode: '3402', taxCategoryId: 'tc-1', gstRate: 18, cgstPct: 9,   sgstPct: 9,   igstPct: 18, taxInclusive: false, isReverseCharge: false, isExempt: false, priority: 1 },
  { id: 'pctm-23', productCategory: 'Housekeeping Materials',      defaultHsnCode: '9603', taxCategoryId: 'tc-2', gstRate: 12, cgstPct: 6,   sgstPct: 6,   igstPct: 12, taxInclusive: false, isReverseCharge: false, isExempt: false, priority: 1 },
  { id: 'pctm-24', productCategory: 'Medical Supplies',            defaultHsnCode: '3004', taxCategoryId: 'tc-2', gstRate: 12, cgstPct: 6,   sgstPct: 6,   igstPct: 12, taxInclusive: false, isReverseCharge: false, isExempt: false, priority: 1 },
  { id: 'pctm-25', productCategory: 'Medical Equipment',           defaultHsnCode: '9018', taxCategoryId: 'tc-2', gstRate: 12, cgstPct: 6,   sgstPct: 6,   igstPct: 12, taxInclusive: false, isReverseCharge: false, isExempt: false, priority: 1 },
  { id: 'pctm-26', productCategory: 'Safety Equipment',            defaultHsnCode: '6506', taxCategoryId: 'tc-1', gstRate: 18, cgstPct: 9,   sgstPct: 9,   igstPct: 18, taxInclusive: false, isReverseCharge: false, isExempt: false, priority: 1 },
  { id: 'pctm-27', productCategory: 'Fire Safety',                 defaultHsnCode: '8424', taxCategoryId: 'tc-1', gstRate: 18, cgstPct: 9,   sgstPct: 9,   igstPct: 18, taxInclusive: false, isReverseCharge: false, isExempt: false, priority: 1 },
  { id: 'pctm-28', productCategory: 'Industrial Tools',            defaultHsnCode: '8205', taxCategoryId: 'tc-1', gstRate: 18, cgstPct: 9,   sgstPct: 9,   igstPct: 18, taxInclusive: false, isReverseCharge: false, isExempt: false, priority: 1 },
  { id: 'pctm-29', productCategory: 'Hardware & Fasteners',        defaultHsnCode: '7318', taxCategoryId: 'tc-1', gstRate: 18, cgstPct: 9,   sgstPct: 9,   igstPct: 18, taxInclusive: false, isReverseCharge: false, isExempt: false, priority: 1 },
  { id: 'pctm-30', productCategory: 'Building Materials',          defaultHsnCode: '6810', taxCategoryId: 'tc-1', gstRate: 18, cgstPct: 9,   sgstPct: 9,   igstPct: 18, taxInclusive: false, isReverseCharge: false, isExempt: false, priority: 1 },
  { id: 'pctm-31', productCategory: 'Plumbing Materials',          defaultHsnCode: '3917', taxCategoryId: 'tc-1', gstRate: 18, cgstPct: 9,   sgstPct: 9,   igstPct: 18, taxInclusive: false, isReverseCharge: false, isExempt: false, priority: 1 },
  { id: 'pctm-32', productCategory: 'Paints & Chemicals',          defaultHsnCode: '3208', taxCategoryId: 'tc-1', gstRate: 18, cgstPct: 9,   sgstPct: 9,   igstPct: 18, taxInclusive: false, isReverseCharge: false, isExempt: false, priority: 1 },
  { id: 'pctm-33', productCategory: 'Packaging Materials',         defaultHsnCode: '3923', taxCategoryId: 'tc-1', gstRate: 18, cgstPct: 9,   sgstPct: 9,   igstPct: 18, taxInclusive: false, isReverseCharge: false, isExempt: false, priority: 1 },
  { id: 'pctm-34', productCategory: 'Paper Products',              defaultHsnCode: '4802', taxCategoryId: 'tc-2', gstRate: 12, cgstPct: 6,   sgstPct: 6,   igstPct: 12, taxInclusive: false, isReverseCharge: false, isExempt: false, priority: 1 },
  { id: 'pctm-35', productCategory: 'Miscellaneous Products',      defaultHsnCode: '9999', taxCategoryId: 'tc-1', gstRate: 18, cgstPct: 9,   sgstPct: 9,   igstPct: 18, taxInclusive: false, isReverseCharge: false, isExempt: false, priority: 99 },
];

export function getProductCategoryTaxMap(): ProductCategoryTaxMap[] {
  return load(KEYS.PRODUCT_CAT_TAX_MAP, DEFAULT_PRODUCT_CATEGORY_TAX_MAP);
}

export function saveProductCategoryTaxMap(maps: ProductCategoryTaxMap[], auditUser = 'System'): void {
  const prev = getProductCategoryTaxMap();
  recordAuditEntry({ user: auditUser, module: 'Product Category Tax Map', prevValue: JSON.stringify(prev), newValue: JSON.stringify(maps) });
  save(KEYS.PRODUCT_CAT_TAX_MAP, maps);
}

// ─── Vendor Tax Settings ──────────────────────────────────────────────────────
export interface VendorTaxSettings {
  enableVendorTax: boolean;
  defaultTaxRule: string;
  taxInclusive: boolean;
  defaultCurrency: string;
  productCategoryBasedMapping: boolean;
  gstApplicable: boolean;
  cgstPct: number;
  sgstPct: number;
  igstPct: number;
  utgstPct: number;
  gstCalcMethod: 'exclusive' | 'inclusive';
  defaultTaxCategory: string;
  taxExemption: boolean;
  reverseCharge: boolean;
  tdsApplicable: boolean;
  tdsPct: number;
  tcsApplicable: boolean;
  tcsPct: number;
  importTax: boolean;
  importTaxPct: number;
  exportTax: boolean;
  interstateRules: boolean;
  intrastateRules: boolean;
  mapTaxByCategory: boolean;
  mapTaxByHsn: boolean;
  categoryWiseExemption: boolean;
  categoryWiseReverseCharge: boolean;
}

const DEFAULT_VENDOR_TAX_SETTINGS: VendorTaxSettings = {
  enableVendorTax: true,
  defaultTaxRule: 'Standard GST 18%',
  taxInclusive: false,
  defaultCurrency: 'INR',
  productCategoryBasedMapping: true,
  gstApplicable: true,
  cgstPct: 9,
  sgstPct: 9,
  igstPct: 18,
  utgstPct: 9,
  gstCalcMethod: 'exclusive',
  defaultTaxCategory: 'tc-1',
  taxExemption: false,
  reverseCharge: false,
  tdsApplicable: true,
  tdsPct: 1,
  tcsApplicable: false,
  tcsPct: 0.1,
  importTax: false,
  importTaxPct: 10,
  exportTax: false,
  interstateRules: true,
  intrastateRules: true,
  mapTaxByCategory: true,
  mapTaxByHsn: true,
  categoryWiseExemption: false,
  categoryWiseReverseCharge: false,
};

export function getVendorTaxSettings(): VendorTaxSettings {
  return load(KEYS.VENDOR_TAX_SETTINGS, DEFAULT_VENDOR_TAX_SETTINGS);
}

export function saveVendorTaxSettings(settings: VendorTaxSettings, auditUser = 'System'): void {
  const prev = getVendorTaxSettings();
  recordAuditEntry({ user: auditUser, module: 'Vendor Tax Settings', prevValue: JSON.stringify(prev), newValue: JSON.stringify(settings) });
  save(KEYS.VENDOR_TAX_SETTINGS, settings);
}

// ─── Client Tax Settings ──────────────────────────────────────────────────────
export interface ClientTaxSettings {
  enableClientTax: boolean;
  taxInclusive: boolean;
  defaultTaxCategory: string;
  productCategoryBasedMapping: boolean;
  cgstPct: number;
  sgstPct: number;
  igstPct: number;
  gstCategory: string;
  hsnValidation: boolean;
  clientTaxExemption: boolean;
  governmentClientRules: boolean;
  sezClientRules: boolean;
  exportClientRules: boolean;
  applyTaxByCategory: boolean;
  applyTaxByHsn: boolean;
  categoryWiseTaxExemption: boolean;
  productWiseTaxOverride: boolean;
  clientSpecificCategoryOverride: boolean;
  showTaxBreakdown: boolean;
  roundOffRule: 'none' | 'nearest' | 'up' | 'down';
  taxDisplayFormat: 'inclusive' | 'exclusive' | 'breakdown';
  taxLabel: string;
}

const DEFAULT_CLIENT_TAX_SETTINGS: ClientTaxSettings = {
  enableClientTax: true,
  taxInclusive: false,
  defaultTaxCategory: 'tc-1',
  productCategoryBasedMapping: true,
  cgstPct: 9,
  sgstPct: 9,
  igstPct: 18,
  gstCategory: 'B2B',
  hsnValidation: true,
  clientTaxExemption: false,
  governmentClientRules: false,
  sezClientRules: false,
  exportClientRules: false,
  applyTaxByCategory: true,
  applyTaxByHsn: true,
  categoryWiseTaxExemption: false,
  productWiseTaxOverride: false,
  clientSpecificCategoryOverride: false,
  showTaxBreakdown: true,
  roundOffRule: 'nearest',
  taxDisplayFormat: 'breakdown',
  taxLabel: 'GST',
};

export function getClientTaxSettings(): ClientTaxSettings {
  return load(KEYS.CLIENT_TAX_SETTINGS, DEFAULT_CLIENT_TAX_SETTINGS);
}

export function saveClientTaxSettings(settings: ClientTaxSettings, auditUser = 'System'): void {
  const prev = getClientTaxSettings();
  recordAuditEntry({ user: auditUser, module: 'Client Tax Settings', prevValue: JSON.stringify(prev), newValue: JSON.stringify(settings) });
  save(KEYS.CLIENT_TAX_SETTINGS, settings);
}

// ─── Service Tax Settings ─────────────────────────────────────────────────────
export interface ServiceCategoryTaxRule {
  id: string;
  serviceCategory: string;
  sacCode: string;
  gstRate: number;
  taxCategoryId: string;
  isReverseCharge: boolean;
  isExempt: boolean;
  taxInclusive: boolean;
}

export interface ServiceTaxSettings {
  enableServiceTax: boolean;
  gstOnServices: boolean;
  taxInclusive: boolean;
  reverseCharge: boolean;
  defaultGstRate: number;
  defaultTaxCategoryId: string;
  professionalServices: boolean;
  amcServices: boolean;
  installationServices: boolean;
  maintenanceServices: boolean;
  supportServices: boolean;
  consultancyServices: boolean;
  serviceCategoryRules: ServiceCategoryTaxRule[];
}

const DEFAULT_SERVICE_TAX_SETTINGS: ServiceTaxSettings = {
  enableServiceTax: true,
  gstOnServices: true,
  taxInclusive: false,
  reverseCharge: false,
  defaultGstRate: 18,
  defaultTaxCategoryId: 'tc-9',
  professionalServices: true,
  amcServices: true,
  installationServices: true,
  maintenanceServices: true,
  supportServices: true,
  consultancyServices: true,
  serviceCategoryRules: [
    { id: 'scr-1', serviceCategory: 'AMC Services', sacCode: '998315', gstRate: 18, taxCategoryId: 'tc-9', isReverseCharge: false, isExempt: false, taxInclusive: false },
    { id: 'scr-2', serviceCategory: 'Installation Services', sacCode: '998352', gstRate: 18, taxCategoryId: 'tc-9', isReverseCharge: false, isExempt: false, taxInclusive: false },
    { id: 'scr-3', serviceCategory: 'Maintenance Services', sacCode: '998711', gstRate: 18, taxCategoryId: 'tc-9', isReverseCharge: false, isExempt: false, taxInclusive: false },
    { id: 'scr-4', serviceCategory: 'Support Services', sacCode: '998316', gstRate: 18, taxCategoryId: 'tc-9', isReverseCharge: false, isExempt: false, taxInclusive: false },
    { id: 'scr-5', serviceCategory: 'IT Consultancy', sacCode: '998313', gstRate: 18, taxCategoryId: 'tc-9', isReverseCharge: false, isExempt: false, taxInclusive: false },
  ],
};

export function getServiceTaxSettings(): ServiceTaxSettings {
  return load(KEYS.SERVICE_TAX_SETTINGS, DEFAULT_SERVICE_TAX_SETTINGS);
}

export function saveServiceTaxSettings(settings: ServiceTaxSettings, auditUser = 'System'): void {
  const prev = getServiceTaxSettings();
  recordAuditEntry({ user: auditUser, module: 'Service Tax Settings', prevValue: JSON.stringify(prev), newValue: JSON.stringify(settings) });
  save(KEYS.SERVICE_TAX_SETTINGS, settings);
}

// ─── Audit Log ────────────────────────────────────────────────────────────────
export interface TaxAuditEntry {
  id: string;
  user: string;
  timestamp: string;
  module: string;
  prevValue: string;
  newValue: string;
  reason?: string;
  clientIp?: string;
}

function recordAuditEntry(entry: Omit<TaxAuditEntry, 'id' | 'timestamp'>): void {
  const log = load<TaxAuditEntry[]>(KEYS.TAX_AUDIT_LOG, []);
  log.unshift({ ...entry, id: crypto.randomUUID(), timestamp: new Date().toISOString() });
  // Keep last 500 entries
  if (log.length > 500) log.splice(500);
  localStorage.setItem(KEYS.TAX_AUDIT_LOG, JSON.stringify(log));
}

export function getTaxAuditLog(): TaxAuditEntry[] {
  return load<TaxAuditEntry[]>(KEYS.TAX_AUDIT_LOG, []);
}

// ─── Tax Calculation Engine ───────────────────────────────────────────────────
export interface TaxInput {
  basePrice: number;
  quantity?: number;
  productCategory?: string;
  hsnCode?: string;
  sacCode?: string;
  serviceCategory?: string;
  isInterstate?: boolean;
  isExport?: boolean;
  isSez?: boolean;
  isGovernment?: boolean;
  overrideTaxCategoryId?: string;
  context: 'vendor' | 'client' | 'service';
}

export interface TaxBreakdown {
  taxCategoryName: string;
  cgst: number;
  sgst: number;
  igst: number;
  utgst: number;
  tds: number;
  tcs: number;
  totalTax: number;
  taxRate: number;
  isReverseCharge: boolean;
  isExempt: boolean;
  hsnCode: string;
  sacCode: string;
}

export interface TaxResult {
  basePrice: number;
  preTaxPrice: number;
  breakdown: TaxBreakdown;
  finalPrice: number;
  taxInclusive: boolean;
}

/** Resolve the effective tax category for a given product/service context. */
function resolveTaxCategory(input: TaxInput): TaxCategory | null {
  const categories = getTaxCategories().filter(c => c.status === 'Active');

  // 1. Explicit override
  if (input.overrideTaxCategoryId) {
    return categories.find(c => c.id === input.overrideTaxCategoryId) || null;
  }

  // 2. HSN-code based lookup (for products)
  if (input.hsnCode) {
    const hsn = getHsnCodes().find(h => h.code === input.hsnCode && h.status === 'Active');
    if (hsn) {
      const cat = categories.find(c => c.id === hsn.taxCategoryId);
      if (cat) return cat;
    }
  }

  // 3. SAC-code based lookup (for services)
  if (input.sacCode) {
    const sac = getSacCodes().find(s => s.code === input.sacCode && s.status === 'Active');
    if (sac) {
      const cat = categories.find(c => c.id === sac.taxCategoryId);
      if (cat) return cat;
    }
  }

  // 4. Product category mapping
  if (input.productCategory) {
    const map = getProductCategoryTaxMap().find(
      m => m.productCategory.toLowerCase() === (input.productCategory || '').toLowerCase()
    );
    if (map) {
      const cat = categories.find(c => c.id === map.taxCategoryId);
      if (cat) return cat;
    }
  }

  // 5. Service category rules
  if (input.serviceCategory) {
    const svcSettings = getServiceTaxSettings();
    const rule = svcSettings.serviceCategoryRules.find(
      r => r.serviceCategory.toLowerCase() === (input.serviceCategory || '').toLowerCase()
    );
    if (rule) {
      const cat = categories.find(c => c.id === rule.taxCategoryId);
      if (cat) return cat;
    }
  }

  // 6. Context-based default
  if (input.context === 'vendor') {
    const vts = getVendorTaxSettings();
    return categories.find(c => c.id === vts.defaultTaxCategory) || categories[0] || null;
  }
  if (input.context === 'service') {
    const sts = getServiceTaxSettings();
    return categories.find(c => c.id === sts.defaultTaxCategoryId) || categories[0] || null;
  }
  // client
  const cts = getClientTaxSettings();
  return categories.find(c => c.id === cts.defaultTaxCategory) || categories[0] || null;
}

function getEffectiveTaxInclusive(input: TaxInput): boolean {
  if (input.context === 'vendor') return getVendorTaxSettings().taxInclusive;
  if (input.context === 'service') return getServiceTaxSettings().taxInclusive;
  return getClientTaxSettings().taxInclusive;
}

/** Main tax calculation function — every module calls this. */
export function calculateTax(input: TaxInput): TaxResult {
  const { basePrice, quantity = 1 } = input;
  const taxCat = resolveTaxCategory(input);
  const taxInclusive = getEffectiveTaxInclusive(input);
  const vts = getVendorTaxSettings();
  const cts = getClientTaxSettings();

  // Short-circuit for special cases
  const isExemptContext =
    (input.isExport && cts.exportClientRules) ||
    (input.isSez && cts.sezClientRules) ||
    (input.isGovernment && cts.governmentClientRules);

  const isExempt = !!(taxCat?.isExempt || taxCat?.isZeroRated || isExemptContext);

  let cgst = 0, sgst = 0, igst = 0, utgst = 0, tds = 0, tcs = 0;

  if (!isExempt && taxCat) {
    if (input.isInterstate) {
      // Interstate: only IGST
      igst = taxCat.igstPct;
    } else {
      // Intrastate: CGST + SGST (or UTGST for Union Territories)
      cgst = taxCat.cgstPct;
      sgst = taxCat.sgstPct;
    }
  }

  // TDS / TCS only on vendor context
  if (input.context === 'vendor' && vts.tdsApplicable) tds = vts.tdsPct;
  if (input.context === 'vendor' && vts.tcsApplicable) tcs = vts.tcsPct;

  const totalGstRate = igst > 0 ? igst : cgst + sgst;
  const preTaxPrice = basePrice * quantity;

  let taxAmount = 0;
  let finalPrice = 0;

  if (taxInclusive) {
    // Tax is included in the price — back-calculate
    taxAmount = preTaxPrice - (preTaxPrice / (1 + totalGstRate / 100));
    finalPrice = preTaxPrice;
  } else {
    taxAmount = (preTaxPrice * totalGstRate) / 100;
    finalPrice = preTaxPrice + taxAmount;
  }

  // Apply TDS deduction (reduces what vendor receives)
  if (tds > 0) {
    const tdsAmt = (finalPrice * tds) / 100;
    tds = tdsAmt;
  }
  if (tcs > 0) {
    const tcsAmt = (preTaxPrice * tcs) / 100;
    tcs = tcsAmt;
  }

  const cgstAmt = igst > 0 ? 0 : (preTaxPrice * cgst) / 100;
  const sgstAmt = igst > 0 ? 0 : (preTaxPrice * sgst) / 100;
  const igstAmt = igst > 0 ? (preTaxPrice * igst) / 100 : 0;

  // Resolve HSN / SAC for breakdown display
  const resolvedHsn = input.hsnCode || getProductCategoryTaxMap().find(
    m => m.productCategory.toLowerCase() === (input.productCategory || '').toLowerCase()
  )?.defaultHsnCode || '';
  const resolvedSac = input.sacCode || '';

  return {
    basePrice: preTaxPrice,
    preTaxPrice,
    breakdown: {
      taxCategoryName: taxCat?.name || 'No Tax',
      cgst: cgstAmt,
      sgst: sgstAmt,
      igst: igstAmt,
      utgst: 0,
      tds: typeof tds === 'number' ? tds : 0,
      tcs: typeof tcs === 'number' ? tcs : 0,
      totalTax: taxAmount,
      taxRate: totalGstRate,
      isReverseCharge: taxCat?.isReverseCharge || false,
      isExempt,
      hsnCode: resolvedHsn,
      sacCode: resolvedSac,
    },
    finalPrice,
    taxInclusive,
  };
}

/** Get the effective GST % for a product category (for backward compat with priceEngineStore). */
export function getEffectiveTaxPctForCategory(productCategory: string, isInterstate = false): number {
  const clientTax = getClientTaxSettings();
  if (!clientTax.enableClientTax) return 0;

  const map = getProductCategoryTaxMap().find(
    m => m.productCategory.toLowerCase() === productCategory.toLowerCase()
  );
  if (map) {
    return isInterstate ? map.igstPct : map.cgstPct + map.sgstPct;
  }

  // Fall back to default client tax
  return isInterstate ? clientTax.igstPct : clientTax.cgstPct + clientTax.sgstPct;
}

/** Get the effective vendor tax % for a product category. */
export function getEffectiveVendorTaxPct(productCategory: string, isInterstate = false): number {
  const vts = getVendorTaxSettings();
  if (!vts.enableVendorTax || !vts.gstApplicable) return 0;

  if (vts.mapTaxByCategory) {
    const map = getProductCategoryTaxMap().find(
      m => m.productCategory.toLowerCase() === productCategory.toLowerCase()
    );
    if (map) return isInterstate ? map.igstPct : map.cgstPct + map.sgstPct;
  }

  return isInterstate ? vts.igstPct : vts.cgstPct + vts.sgstPct;
}

/** Get the effective service tax % for a service category. */
export function getEffectiveServiceTaxPct(serviceCategory: string): number {
  const sts = getServiceTaxSettings();
  if (!sts.enableServiceTax || !sts.gstOnServices) return 0;

  const rule = sts.serviceCategoryRules.find(
    r => r.serviceCategory.toLowerCase() === serviceCategory.toLowerCase()
  );
  if (rule) return rule.gstRate;
  return sts.defaultGstRate;
}
