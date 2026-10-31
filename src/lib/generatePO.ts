// ── Purchase Order PDF Generator ──────────────────────────────────────────────
// Generates a PDF that matches the Invoice PDF format exactly.
// Uses jsPDF + jspdf-autotable (both already installed).

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadConfig } from './configService';
import { formatCurrency, getCurrencySymbol } from './formatters';
import { numberToWords } from './quotePdfGenerator';
import type { StoredPO } from './purchaseOrderStore';
import { getCommercialTermsLines } from './productCommercialTerms';
import { getDocumentProductPresentation, isDigitalDocumentProduct } from './productDocumentRules';
import { getProductConfigurationEntries, getProductSpecLines } from './productConfiguration';

// ── Colour palette (identical to invoicePdf) ─────────────────────────────────
const BLUE: [number, number, number] = [31, 95, 190];
const DARK: [number, number, number] = [28, 39, 56];
const TEXT: [number, number, number] = [55, 62, 72];
const MUTED: [number, number, number] = [105, 112, 123];
const BORDER: [number, number, number] = [218, 222, 228];
const LIGHT_BLUE: [number, number, number] = [239, 246, 255];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt2(value: number): string {
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function money(value: number): string {
  return formatCurrency(value, loadConfig());
}

function splitLines(value: string | undefined): string[] {
  return (value || '')
    .split(/[,\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function getBrandHeader(displayName: string, industry: string): { name: string; subtitle: string } {
  const value = displayName.trim();
  const match = value.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  return {
    name: (match?.[1] || value || 'Nido Tech').trim(),
    subtitle: (match?.[2] || industry || 'Corporate Essentials & Integrated Services').trim(),
  };
}

function drawText(
  doc: jsPDF,
  value: string,
  x: number,
  y: number,
  options: { size?: number; color?: [number, number, number]; bold?: boolean; align?: 'left' | 'center' | 'right' } = {},
) {
  doc
    .setFont('helvetica', options.bold ? 'bold' : 'normal')
    .setFontSize(options.size ?? 8)
    .setTextColor(...(options.color ?? TEXT));
  doc.text(value, x, y, { align: options.align ?? 'left' });
}

async function loadImage(url: string): Promise<{ data: string; format: 'PNG' | 'JPEG' } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    return {
      data,
      format: blob.type.includes('jpeg') || blob.type.includes('jpg') ? 'JPEG' : 'PNG',
    };
  } catch {
    return null;
  }
}

/**
 * Draws a rounded address card (same as invoicePdf drawCard).
 * Returns the card height so the caller can advance `y`.
 */
function drawCard(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  title: string,
  name: string,
  address: string,
  extraLines: string[] = [],
): number {
  const addressLines = splitLines(address);
  const totalLines = addressLines.length + extraLines.length;
  const cardHeight = Math.max(92, 54 + totalLines * 12);

  doc.setDrawColor(...BORDER).setLineWidth(0.7);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, width, cardHeight, 5, 5, 'FD');

  drawText(doc, title.toUpperCase(), x + 13, y + 19, { size: 8, color: BLUE, bold: true });
  doc.setDrawColor(...BORDER).setLineWidth(0.5);
  doc.line(x + 13, y + 27, x + width - 13, y + 27);

  let cursor = y + 48;
  drawText(doc, name, x + 13, cursor, { size: 9, color: DARK, bold: true });
  cursor += 13;
  addressLines.forEach((line) => {
    drawText(doc, line, x + 13, cursor, { size: 8.5 });
    cursor += 12;
  });
  extraLines.forEach((line) => {
    drawText(doc, line, x + 13, cursor, { size: 8.5 });
    cursor += 12;
  });
  return cardHeight;
}

/**
 * Draws the PO summary box using the exact same row structure as invoicePdf.
 * POs do not currently store discounts, shipping, or round-off adjustments, so
 * those invoice rows are rendered as zero to preserve the shared PDF layout.
 */
function drawPOSummary(
  doc: jsPDF,
  po: StoredPO,
  x: number,
  y: number,
  width: number,
): number {
  const totalTax = (po.sgstAmt ?? 0) + (po.cgstAmt ?? 0);
  // Collect unique FULL GST rates from individual line items (fall back to combined sgstPct+cgstPct)
  const itemsList = po.items?.length > 0 ? po.items : [{ gstPct: po.sgstPct + po.cgstPct } as any];
  const rates = [...new Set(itemsList.map((li: any) => li.gstPct ?? (po.sgstPct + po.cgstPct)))]
    .filter((r) => Number.isFinite(r))
    .sort((a: number, b: number) => a - b)
    .map((r: number) => `${r}%`)
    .join(', ');

  const rows: Array<[string, string, boolean?]> = [
    ['Gross Subtotal', money(po.subtotal)],
    ['Item Level Discounts (-)', `${getCurrencySymbol(loadConfig())} - 0.00`, true],
    ['Total Taxable Value', money(po.subtotal), true],
    [`Total GST${rates ? ` (${rates})` : ''}`, money(totalTax)],
    ['Shipping & Handling Charges', money(0)],
    ['Round Off Adjustment', money(0)],
  ];

  const rowHeight = 20;
  const totalHeight = 27;
  const height = rows.length * rowHeight + totalHeight;

  doc.setDrawColor(...BORDER).setLineWidth(0.6);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, width, height, 5, 5, 'FD');

  rows.forEach(([label, value, bold], index) => {
    const rowY = y + index * rowHeight;
    if (index > 0) {
      doc.setDrawColor(...BORDER).setLineWidth(0.3);
      doc.line(x, rowY, x + width, rowY);
    }
    drawText(doc, label, x + 10, rowY + 13, {
      size: 7.7,
      color: bold ? DARK : TEXT,
      bold: !!bold,
    });
    drawText(doc, value, x + width - 10, rowY + 13, { size: 7.7, color: DARK, align: 'right' });
  });

  const totalY = y + rows.length * rowHeight;
  doc.setFillColor(...LIGHT_BLUE);
  doc.rect(x + 0.5, totalY, width - 1, totalHeight - 0.5, 'F');
  doc.setDrawColor(...BORDER).setLineWidth(0.5);
  doc.line(x, totalY, x + width, totalY);
  drawText(doc, 'Total Order Value', x + 10, totalY + 17, { size: 8.5, color: DARK, bold: true });
  drawText(doc, money(po.grandTotal), x + width - 10, totalY + 17, {
    size: 8.5,
    color: DARK,
    bold: true,
    align: 'right',
  });
  return height;
}

// ── PO Instructions ───────────────────────────────────────────────────────────
const PO_INSTRUCTIONS = [
  (poNumber: string) => `Please reference PO number #${poNumber} on all invoices and delivery notes.`,
  () => 'Deliveries are accepted Monday to Friday between 9:00 AM and 5:00 PM.',
  () => 'Notify procurement immediately if delivery date cannot be met.',
];

// ── Main generator ─────────────────────────────────────────────────────────────
export async function generatePOPdfBase64(po: StoredPO): Promise<string> {
  const org = loadConfig().organization;
  const brandHeader = getBrandHeader(org.displayName, org.industry);
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 42;
  const contentWidth = pageWidth - margin * 2;

  // ── Logo + brand name (left) ──────────────────────────────────────────────
  let logoLoaded = false;
  if (org.logoUrl) {
    const logo = org.logoUrl.startsWith('http')
      ? await loadImage(org.logoUrl)
      : { data: org.logoUrl, format: org.logoUrl.includes('jpeg') ? 'JPEG' as const : 'PNG' as const };
    if (logo) {
      try {
        doc.addImage(logo.data, logo.format, margin + 8, 26, 45, 45);
        logoLoaded = true;
      } catch {
        logoLoaded = false;
      }
    }
  }
  if (!logoLoaded) {
    doc.setFillColor(...BLUE);
    doc.roundedRect(margin + 8, 27, 38, 38, 9, 9, 'F');
    drawText(doc, 'N', margin + 27, 53, { size: 22, color: [255, 255, 255], bold: true, align: 'center' });
  }

  drawText(doc, brandHeader.name || org.companyName || 'Nido Tech', margin + 60, 50, { size: 18, color: DARK, bold: true });
  drawText(doc, brandHeader.subtitle, margin + 60, 64, { size: 7, color: MUTED });

  // ── PURCHASE ORDER label + number box (right) ─────────────────────────────
  drawText(doc, 'PURCHASE ORDER', pageWidth - margin, 48, { size: 18, color: DARK, bold: true, align: 'right' });
  doc.setDrawColor(...BORDER).setLineWidth(0.6);
  doc.roundedRect(pageWidth - margin - 130, 61, 130, 28, 4, 4, 'S');
  drawText(doc, '#', pageWidth - margin - 119, 79, { size: 11, color: BLUE });
  drawText(doc, po.poNumber, pageWidth - margin - 10, 79, { size: 10, color: DARK, bold: true, align: 'right' });

  // ── Company address block (left, below logo) ──────────────────────────────
  const companyLines = [
    org.companyName || org.displayName,
    ...splitLines(org.registeredAddress || org.billingAddress),
    [org.phone && `Phone: ${org.phone}`, org.email && `Email: ${org.email}`].filter(Boolean).join(' | '),
    org.gstNumber ? `GSTIN: ${org.gstNumber}` : '',
  ].filter(Boolean);
  let companyY = 102;
  companyLines.forEach((line, index) => {
    drawText(doc, line, margin + 8, companyY, {
      size: index === 0 ? 8.5 : 7.5,
      color: index === 0 ? DARK : TEXT,
      bold: index === 0,
    });
    companyY += 11;
  });

  // ── Dates + meta (right) ──────────────────────────────────────────────────
  let dateY = 112;
  drawText(doc, `PO Date: ${po.createdOnDisplay}`, pageWidth - margin, dateY, { size: 8, color: TEXT, align: 'right' });
  if (po.requestedDelivery) {
    dateY += 14;
    drawText(doc, `Delivery Date: ${po.requestedDelivery}`, pageWidth - margin, dateY, { size: 8, color: TEXT, align: 'right' });
  }
  if (po.paymentTerms) {
    dateY += 14;
    drawText(doc, `Payment Terms: ${po.paymentTerms}`, pageWidth - margin, dateY, { size: 8, color: TEXT, align: 'right' });
  }

  // ── Vendor Address / Deliver To cards ─────────────────────────────────────
  let y = Math.max(companyY + 12, 164);
  const cardGap = 12;
  const cardWidth = (contentWidth - cardGap) / 2;

  // Build vendor address string
  const vendorAddrParts = [
    po.vendorAddressLine1,
    po.vendorAddressLine2,
    po.vendorCity,
    po.vendorPincode ? `${po.vendorPincode} ${po.vendorState}` : po.vendorState,
    'India',
  ].filter(Boolean);
  const vendorAddr = vendorAddrParts.join(', ');
  const vendorExtras: string[] = [];
  if (po.vendorGstin) vendorExtras.push(`GSTIN: ${po.vendorGstin}`);
  if (po.vendorPhone) vendorExtras.push(`Phone: ${po.vendorPhone}`);
  if (po.vendorEmail) vendorExtras.push(`Email: ${po.vendorEmail}`);

  // Build deliver-to address string
  const deliverAddr = [
    ...splitLines(org.registeredAddress || org.billingAddress),
  ].join(', ');
  const deliverExtras: string[] = [];
  if (org.gstNumber) deliverExtras.push(`GSTIN: ${org.gstNumber}`);

  const cardHeight = Math.max(
    drawCard(doc, margin, y, cardWidth, 'Vendor Details', po.vendorName, vendorAddr, vendorExtras),
    drawCard(doc, margin + cardWidth + cardGap, y, cardWidth, 'Ship To Location', org.companyName || org.displayName || 'Nido Tech', deliverAddr, deliverExtras),
  );
  y += cardHeight + 16;

  // ── Line items table ──────────────────────────────────────────────────────
  const activePoLines = (po.items || []).filter(
    (line) => String((line as any).status || "").toLowerCase() !== "cancelled",
  );
  const tableItems =
    activePoLines.length > 0
      ? activePoLines
      : po.items && po.items.length > 0
        ? []
      : [{ item: po.item, referenceNumber: po.referenceNumber, hsnCode: po.hsnCode, qty: po.qty, unitPrice: po.unitPrice, lineSubtotal: po.subtotal, configuration: undefined }];

  const gstRate = po.sgstPct + po.cgstPct; // combined GST % for all PO items

  const renderTable = (items: typeof tableItems, digital: boolean, startY: number, indexOffset: number) => {
    const body = items.map((li, index) => {
      const itemGstRate = li.gstPct ?? gstRate;
      const taxable = li.lineSubtotal;
      const gst = taxable * (itemGstRate / 100);
      const amount = taxable + gst;
      const taxRateLabel = `${itemGstRate}%\nIGST`;
      const productSpecs = getProductSpecLines(li.specs, li.configuration);
      const specLine = productSpecs.length > 0 ? productSpecs[0] : '';
      let itemCell = li.item;
      if (specLine) itemCell += `\n${specLine}`;
      const configurationEntries = getProductConfigurationEntries(li.configuration);
      if (configurationEntries.length > 0) {
        itemCell += `\nConfiguration:\n${configurationEntries.map(([label, value]) => `${label}: ${value}`).join("\n")}`;
      }
      if (li.configurationPriceAdjustment) {
        itemCell += `\nOption adjustment / unit: Rs. ${fmt2(li.configurationPriceAdjustment)}`;
      }
      if (li.referenceNumber) itemCell += `\nRef/Model No: ${li.referenceNumber}`;
      if (li.commercialTerms) itemCell += `\n${getCommercialTermsLines(li.commercialTerms).join('\n')}`;
      if (!digital) {
        return [
          String(indexOffset + index + 1), itemCell, li.hsnCode || '', String(li.qty),
          fmt2(li.unitPrice), fmt2(0), fmt2(taxable), taxRateLabel, fmt2(gst), fmt2(amount),
        ];
      }
      const presentation = getDocumentProductPresentation(li, { quantity: li.qty });
      return [
        String(indexOffset + index + 1), itemCell, presentation.type, presentation.pricingModel,
        String(li.qty), presentation.tenureBilling, presentation.provisioningTime,
        li.hsnCode || '', fmt2(taxable), taxRateLabel, fmt2(gst), fmt2(amount),
      ];
    });
    autoTable(doc, {
      startY,
      margin: { left: margin, right: margin },
      head: [digital
        ? ['#', 'ITEM / SPECIFICATION', 'TYPE', 'PRICING MODEL', 'USERS / LICENSES', 'TENURE / BILLING', 'PROVISIONING TIME', 'HSN/SAC', 'TAXABLE', 'GST RATE', 'GST', 'NET AMOUNT']
        : ['#', 'ITEM / SPECIFICATION', 'HSN/SAC', 'QTY', 'UNIT RATE', 'DISC', 'TAXABLE', 'GST RATE', 'GST', 'NET AMOUNT']],
      body,
      theme: 'grid',
      tableWidth: contentWidth,
      styles: {
        font: 'helvetica',
        fontSize: 7.5,
        textColor: TEXT,
        lineColor: BORDER,
        lineWidth: 0.35,
        cellPadding: { top: 7, bottom: 7, left: 4, right: 4 },
        valign: 'middle',
      },
      headStyles: {
        fillColor: [248, 250, 252],
        textColor: DARK,
        fontStyle: 'bold',
        fontSize: 6.3,
        halign: 'center',
      },
      columnStyles: digital
        ? {
            0: { cellWidth: 18, halign: 'center' }, 1: { cellWidth: 74 }, 2: { cellWidth: 38 },
            3: { cellWidth: 54 }, 4: { cellWidth: 34, halign: 'center' }, 5: { cellWidth: 48 },
            6: { cellWidth: 52 }, 7: { cellWidth: 34, halign: 'center' }, 8: { cellWidth: 47, halign: 'right' },
            9: { cellWidth: 38, halign: 'center' }, 10: { cellWidth: 42, halign: 'right' }, 11: { cellWidth: 52, halign: 'right' },
          }
        : {
            0: { cellWidth: 20, halign: 'center' }, 1: { cellWidth: 104 }, 2: { cellWidth: 42, halign: 'center' },
            3: { cellWidth: 24, halign: 'center' }, 4: { cellWidth: 55, halign: 'right' }, 5: { cellWidth: 47, halign: 'right' },
            6: { cellWidth: 58, halign: 'right' }, 7: { cellWidth: 40, halign: 'center' }, 8: { cellWidth: 52, halign: 'right' },
            9: { cellWidth: 69, halign: 'right' },
          },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = DARK;
        }
        if (data.section === 'body' && data.column.index === (digital ? 11 : 9)) {
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });
    return (doc as any).lastAutoTable?.finalY ?? startY;
  };

  const physicalItems = tableItems.filter((li) => !isDigitalDocumentProduct(li));
  const digitalItems = tableItems.filter((li) => isDigitalDocumentProduct(li));
  let tableY = y;
  if (physicalItems.length > 0) {
    tableY = renderTable(physicalItems, false, tableY, 0) + (digitalItems.length > 0 ? 10 : 0);
  }
  if (digitalItems.length > 0) {
    renderTable(digitalItems, true, tableY, physicalItems.length);
  }

  // ── Summary box (right) + Left text blocks ────────────────────────────────
  y = ((doc as any).lastAutoTable?.finalY ?? y) + 15;
  const summaryWidth = 255;
  const summaryX = pageWidth - margin - summaryWidth;
  const summaryHeight = drawPOSummary(doc, po, summaryX, y, summaryWidth);

  // Left side: PO Instructions + Invoicing & Payment Terms
  let leftY = y + 2;
  const leftWidth = summaryX - margin - 14;

  // Purchase Order Instructions
  drawText(doc, 'PURCHASE ORDER INSTRUCTIONS', margin, leftY + 9, { size: 8, color: BLUE, bold: true });
  leftY += 23;
  PO_INSTRUCTIONS.forEach((instrFn, index) => {
    const text = instrFn(po.poNumber);
    const wrapped = doc.splitTextToSize(`${index + 1}. ${text}`, leftWidth);
    drawText(doc, wrapped.join('\n'), margin, leftY, { size: 7.5, color: TEXT });
    leftY += wrapped.length * 11 + 4;
  });

  // Invoicing & Payment Terms
  leftY += 8;
  drawText(doc, 'INVOICING & PAYMENT TERMS', margin, leftY, { size: 8, color: BLUE, bold: true });
  leftY += 14;
  const invoicingLines = [
    `Payment Terms: ${po.paymentTerms || 'Net 30 Days from receipt of invoice & goods inspection'}`,
    `Billing Contact: ${org.email || 'accounts.payable@nido-tech.com'}`,
    org.gstNumber ? `Tax Registration: GSTIN ${org.gstNumber}` : '',
    'Dispatch Mode: Express Road Freight',
  ].filter(Boolean);
  invoicingLines.forEach((line) => {
    drawText(doc, line, margin, leftY, { size: 7.5, color: TEXT });
    leftY += 12;
  });

  if (leftY < y + summaryHeight) leftY = y + summaryHeight + 10;

  // ── Total in Words + Authorized Signature ────────────────────────────────
  y = Math.max(leftY + 8, y + summaryHeight) + 20;

  if (y > pageHeight - 80) {
    doc.addPage();
    y = margin + 20;
  }

  drawText(doc, 'TOTAL PO VALUE IN WORDS', margin, y, { size: 8, color: BLUE, bold: true });
  drawText(doc, numberToWords(po.grandTotal), margin, y + 15, { size: 8.5, color: DARK, bold: true });

  // Signature sits below the words line (words at y+15, so signature line at y+42)
  const signatureX = pageWidth - margin - 160;
  doc.setDrawColor(...MUTED).setLineWidth(0.6);
  doc.line(signatureX, y + 42, pageWidth - margin, y + 42);
  drawText(doc, 'Authorized Person', (signatureX + pageWidth - margin) / 2, y + 55, {
    size: 7.5,
    color: MUTED,
    align: 'center',
  });

  // ── Footer ────────────────────────────────────────────────────────────────
  const footerY = Math.min(pageHeight - 22, y + 95);
  doc.setDrawColor(...BORDER).setLineWidth(0.5);
  doc.line(margin, footerY - 18, pageWidth - margin, footerY - 18);
  drawText(
    doc,
    'This is a computer-generated Purchase Order. Please send acknowledgment upon receipt.',
    pageWidth / 2,
    footerY,
    { size: 8, color: MUTED, align: 'center' },
  );

  return doc.output('datauristring');
}

/** Trigger a browser download of the PO PDF. */
export async function downloadPOPdf(po: StoredPO): Promise<void> {
  const dataUri = await generatePOPdfBase64(po);
  const link = document.createElement('a');
  link.href = dataUri;
  link.download = `${po.poNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** Return the PDF as a base64 data-URI string. */
export async function getPODataUri(po: StoredPO): Promise<string> {
  return generatePOPdfBase64(po);
}

// ── Legacy sync shim (kept so old callers compile — prefer the async versions) ─
/** @deprecated Use downloadPOPdf (async) instead. */
export function generatePOPdf(po: StoredPO): never {
  throw new Error('generatePOPdf is now async — use downloadPOPdf() or getPODataUri() instead.');
}

// ── Manual PO PDF (PurchaseOrderEntry shape from PurchaseOrdersPage) ──────────
interface ManualPOItem {
  id: string;
  itemName: string;
  description: string;
  account: string;
  hsnSac: string;
  quantity: number;
  rate: number;
  taxPercent: number;
}

interface ManualPOEntry {
  id: string;
  poNumber: string;
  referenceNumber: string;
  vendorName: string;
  vendorAddress: string;
  deliveryAddressType: string;
  deliveryAddress: string;
  date: string;
  deliveryDate: string;
  paymentTerms: string;
  shipmentPreference: string;
  includeInterStateGst: boolean;
  discountPercent: number;
  adjustment: number;
  notes: string;
  termsAndConditions: string;
  items: ManualPOItem[];
}

/** Download a PDF for a manually-created PurchaseOrderEntry. */
export async function generateManualPOPdf(po: ManualPOEntry): Promise<void> {
  // Map ManualPOEntry → StoredPO-compatible shape for the existing renderer
  const subtotal = po.items.reduce((sum, li) => sum + li.quantity * li.rate, 0);
  const discountAmt = subtotal * (po.discountPercent / 100);
  const taxableAmt = subtotal - discountAmt;
  // Compute blended tax (use first item's taxPercent as representative)
  const blendedGstPct = po.items.length > 0 ? po.items[0].taxPercent : 18;
  const halfGst = blendedGstPct / 2;
  const sgstAmt = taxableAmt * (halfGst / 100);
  const cgstAmt = taxableAmt * (halfGst / 100);
  const grandTotal = taxableAmt + sgstAmt + cgstAmt + po.adjustment;

  const isoToIndian = (v: string) => {
    if (!v) return '';
    const [y, m, d] = v.split('-');
    return y && m && d ? `${d}/${m}/${y}` : v;
  };

  const adapted: StoredPO = {
    poNumber: po.poNumber,
    orderId: po.id,
    subOrderId: po.id,
    subOrderIds: [po.id],
    vendorId: '',
    vendorName: po.vendorName,
    vendorContact: '',
    vendorEmail: '',
    vendorPhone: '',
    vendorGstin: '',
    vendorAddress: po.vendorAddress,
    vendorAddressLine1: po.vendorAddress,
    vendorAddressLine2: '',
    vendorCity: '',
    vendorState: '',
    vendorPincode: '',
    item: po.items[0]?.itemName || '',
    sku: '',
    category: '',
    hsnCode: po.items[0]?.hsnSac || '',
    specs: [],
    referenceNumber: po.referenceNumber,
    qty: po.items[0]?.quantity ?? 1,
    unitPrice: po.items[0]?.rate ?? 0,
    subtotal: taxableAmt,
    sgstPct: halfGst,
    cgstPct: halfGst,
    sgstAmt,
    cgstAmt,
    grandTotal,
    paymentTerms: po.paymentTerms,
    status: 'ISSUED',
    createdOn: po.date,
    createdOnDisplay: isoToIndian(po.date),
    requestedDelivery: po.deliveryDate ? isoToIndian(po.deliveryDate) : '',
    documents: [],
    notes: [],
    items: po.items.map((li) => {
      const lineSubtotal = li.quantity * li.rate;
      return {
        item: li.itemName,
        hsnCode: li.hsnSac,
        qty: li.quantity,
        unitPrice: li.rate,
        lineSubtotal,
        gstPct: li.taxPercent,
        specs: li.description ? [li.description] : [],
        referenceNumber: '',
      } as any;
    }),
  };

  await downloadPOPdf(adapted);
}
