import type { DeliveryChallanData } from './dcPdfGenerator';
import { getPrefix } from './configService';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface DCListItem {
  id: string;
  date: string;
  number: string;
  referenceNumber: string;
  customerName: string;
  status: 'OPEN' | 'CLOSED';
  invoiceStatus: 'INVOICED' | 'NOT INVOICED';
  amount: number;
}

// ── Seed details ──────────────────────────────────────────────────────────────
const _details: Record<string, DeliveryChallanData> = {
  dc_001: {
    challanNo: 'DC-2026-0092',
    challanDate: '24/07/2026',
    invoiceRef: 'INV-2026-0092',
    poReference: 'PO-99482',
    placeOfSupply: 'Telangana (36)',
    consigneeName: 'Express IT Solutions Pvt Ltd',
    consigneeAddress: '321 Cyber Towers, HITEC City\nHyderabad, Telangana - 500081',
    consigneeGstin: '36AAACE9876B1ZS',
    consigneeContact: 'accounts@expressit.com',
    shippedToName: 'Express IT Solutions Pvt Ltd',
    shippedToAddress: '321 Cyber Towers, HITEC City\nHyderabad, Telangana - 500081',
    shippedToStateCode: '36 (Telangana)',
    shippedToAttn: 'Operations Team',
    lineItems: [
      { itemName: 'Enterprise Cloud Workstation Setup', description: 'Hardware procurement & corporate installation.', hsnCode: '84713010', qty: 2, unit: 'Nos', unitRate: 65000, discount: 5000, taxPercent: 18, taxableValue: 125000 },
      { itemName: 'Commercial Computer Manuals & Printware', description: 'Printed documentation and operating guides.', hsnCode: '49011010', qty: 10, unit: 'Nos', unitRate: 1100, taxPercent: 5, taxableValue: 11000 },
      { itemName: 'Logitech Corporate Desktop Bundles', description: 'High-grade mouse and keyboard accessories.', hsnCode: '84716040', qty: 5, unit: 'Nos', unitRate: 4700, discount: 500, taxPercent: 18, taxableValue: 23000 },
    ],
    shippingCharges: 2000,
    transportationNote: 'This Delivery Challan accompanies the movement of physical goods specified above under Rule 55 of CGST Rules, 2017. Service items (e.g., Network Infrastructure Consulting) are excluded from physical dispatch.',
    modeOfTransport: 'Surface Express Cargo',
    vehicleLrNo: 'TN-09-CB-4491',
    eWayBillNo: '241098472910',
    declaration: [
      'Goods detailed above are being dispatched for supply as per Invoice #INV-2026-0092.',
      'Please verify the quantity and condition of goods upon delivery before signing acknowledgment.',
      'Any discrepancy must be reported within 24 hours of receipt.',
    ],
    footerNote: 'Thank you for choosing Nido-Tech as your corporate essentials partner!',
  },
  dc_002: {
    challanNo: 'DC-00032',
    challanDate: '14/02/2024',
    invoiceRef: 'INV-00045',
    poReference: 'SO-00045',
    placeOfSupply: 'Maharashtra (27)',
    consigneeName: 'Tech Solutions Inc',
    consigneeAddress: '45 Business Park, Andheri East\nMumbai, Maharashtra - 400069',
    consigneeGstin: '27AABCT1234A1ZS',
    consigneeContact: 'procurement@techsolutions.com',
    shippedToName: 'Tech Solutions Inc',
    shippedToAddress: '45 Business Park, Andheri East\nMumbai, Maharashtra - 400069',
    shippedToStateCode: '27 (Maharashtra)',
    shippedToAttn: 'Warehouse Manager',
    lineItems: [
      { itemName: 'Server Rack Units', description: '1U rack mount servers for data centre deployment.', hsnCode: '84715010', qty: 4, unit: 'Nos', unitRate: 80000, taxPercent: 18, taxableValue: 320000 },
      { itemName: 'Ethernet Switch 48-Port', description: 'Managed gigabit switch with PoE support.', hsnCode: '85176200', qty: 2, unit: 'Nos', unitRate: 42500, taxPercent: 18, taxableValue: 85000 },
    ],
    transportationNote: 'This Delivery Challan accompanies the movement of physical goods under Rule 55 of CGST Rules, 2017.',
    modeOfTransport: 'Road – Truck',
    vehicleLrNo: 'MH-04-DX-7812',
    eWayBillNo: '881034567210',
    declaration: [
      'Goods detailed above are being dispatched for supply as per Invoice #INV-00045.',
      'Please verify the quantity and condition of goods upon delivery before signing acknowledgment.',
      'Any discrepancy must be reported within 24 hours of receipt.',
    ],
  },
  dc_003: {
    challanNo: 'DC-00033',
    challanDate: '01/03/2024',
    invoiceRef: 'INV-00051',
    poReference: 'SO-00051',
    placeOfSupply: 'Karnataka (29)',
    consigneeName: 'Marketing Pro Agency',
    consigneeAddress: '88 Lavelle Road, Richmond Town\nBengaluru, Karnataka - 560001',
    consigneeGstin: '29AADCM5678B1ZK',
    consigneeContact: 'ops@marketingpro.in',
    shippedToName: 'Marketing Pro Agency',
    shippedToAddress: '88 Lavelle Road, Richmond Town\nBengaluru, Karnataka - 560001',
    shippedToStateCode: '29 (Karnataka)',
    shippedToAttn: 'Receiving Desk',
    lineItems: [
      { itemName: 'High-Resolution Projector', description: '4K laser projector for conference rooms.', hsnCode: '85286200', qty: 3, unit: 'Nos', unitRate: 30000, taxPercent: 18, taxableValue: 90000 },
      { itemName: 'Presentation Remote Kits', description: 'Wireless slide-advance clicker with laser pointer.', hsnCode: '85176900', qty: 12, unit: 'Nos', unitRate: 1200, taxPercent: 18, taxableValue: 14400 },
    ],
    transportationNote: 'This Delivery Challan accompanies the movement of physical goods under Rule 55 of CGST Rules, 2017.',
    modeOfTransport: 'Air Cargo',
    vehicleLrNo: 'KA-01-AB-3321',
    eWayBillNo: '330987654321',
    declaration: [
      'Goods detailed above are being dispatched for supply as per Invoice #INV-00051.',
      'Please verify the quantity and condition of goods upon delivery before signing acknowledgment.',
      'Any discrepancy must be reported within 24 hours of receipt.',
    ],
  },
};

// ── Seed list ─────────────────────────────────────────────────────────────────
const _challans: DCListItem[] = [
  { id: 'dc_001', date: '2026-07-24', number: 'DC-2026-0092', referenceNumber: 'INV-2026-0092', customerName: 'EXPRESS IT SOLUTIONS PVT LTD', status: 'OPEN', invoiceStatus: 'NOT INVOICED', amount: 159000 },
  { id: 'dc_002', date: '2024-02-14', number: 'DC-00032', referenceNumber: 'SO-00045', customerName: 'TECH SOLUTIONS INC', status: 'CLOSED', invoiceStatus: 'INVOICED', amount: 405000 },
  { id: 'dc_003', date: '2024-03-01', number: 'DC-00033', referenceNumber: 'SO-00051', customerName: 'MARKETING PRO AGENCY', status: 'OPEN', invoiceStatus: 'NOT INVOICED', amount: 104400 },
];

// ── Public API ────────────────────────────────────────────────────────────────
export function getChallans(): DCListItem[] {
  return [..._challans];
}

export function getDCDetail(id: string): DeliveryChallanData | undefined {
  return _details[id];
}

export function addChallan(item: DCListItem, dc: DeliveryChallanData): void {
  _challans.unshift(item);
  _details[item.id] = dc;
}

export function removeChallan(id: string): void {
  const idx = _challans.findIndex((c) => c.id === id);
  if (idx >= 0) _challans.splice(idx, 1);
  delete _details[id];
}

export function generateDCNumber(): string {
  const year = new Date().getFullYear();
  const prefix = getPrefix("deliveryChallan") || "DC-";
  const prefixEscaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${prefixEscaped}${year}-(\\d+)$`);
  const serials = _challans
    .map((c) => { const m = c.number.match(re); return m ? parseInt(m[1], 10) : 0; })
    .filter((n) => n > 0);
  const next = serials.length > 0 ? Math.max(...serials) + 1 : 1;
  return `${prefix}${year}-${String(next).padStart(5, "0")}`;
}
