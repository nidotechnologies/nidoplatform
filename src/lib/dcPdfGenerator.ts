import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadConfig } from './configService';

// ── Colour palette (same as invoicePdf) ──────────────────────────────────────
const BLUE: [number, number, number] = [31, 95, 190];
const DARK: [number, number, number] = [28, 39, 56];
const TEXT: [number, number, number] = [55, 62, 72];
const MUTED: [number, number, number] = [105, 112, 123];
const BORDER: [number, number, number] = [218, 222, 228];

// ── Types ─────────────────────────────────────────────────────────────────────
export interface DCLineItem {
  itemName: string;
  description?: string;
  hsnCode: string;
  qty: number;
  unit: string;
  unitRate?: number;    // per-unit rate before discount
  discount?: number;   // total item-level discount amount
  taxPercent?: number; // GST %
  taxableValue: number;
}

export interface DeliveryChallanData {
  challanNo: string;
  challanDate: string;      // DD/MM/YYYY
  invoiceRef?: string;
  poReference?: string;
  placeOfSupply?: string;
  // Consignee
  consigneeName: string;
  consigneeAddress: string;
  consigneeGstin?: string;
  consigneeContact?: string;
  // Shipping
  shippedToName: string;
  shippedToAddress: string;
  shippedToStateCode?: string;
  shippedToAttn?: string;
  // Items
  lineItems: DCLineItem[];
  // Totals (optional — auto-computed if omitted)
  shippingCharges?: number;
  adjustment?: number;
  // Transport
  transportationNote?: string;
  modeOfTransport?: string;
  vehicleLrNo?: string;
  eWayBillNo?: string;
  // Declaration
  declaration?: string[];
  // Footer / notes
  footerNote?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt2(value: number): string {
  return value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function splitLines(value: string | undefined): string[] {
  return (value || '').split(/[,\n]/).map((p) => p.trim()).filter(Boolean);
}

function getBrandHeader(displayName: string, industry: string) {
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
  opts: { size?: number; color?: [number, number, number]; bold?: boolean; align?: 'left' | 'center' | 'right' } = {},
) {
  doc
    .setFont('helvetica', opts.bold ? 'bold' : 'normal')
    .setFontSize(opts.size ?? 8)
    .setTextColor(...(opts.color ?? TEXT));
  doc.text(value, x, y, { align: opts.align ?? 'left' });
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
    return { data, format: blob.type.includes('jpeg') || blob.type.includes('jpg') ? 'JPEG' : 'PNG' };
  } catch {
    return null;
  }
}

function drawAddressCard(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  title: string,
  name: string,
  address: string,
  extras: string[] = [],
): number {
  const addressLines = splitLines(address);
  const totalLines = addressLines.length + extras.length;
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
  addressLines.forEach((line) => { drawText(doc, line, x + 13, cursor, { size: 8.5 }); cursor += 12; });
  extras.forEach((line) => { drawText(doc, line, x + 13, cursor, { size: 8.5 }); cursor += 12; });
  return cardHeight;
}

// ── Summary box (mirrors invoice drawSummary) ─────────────────────────────────
function drawDCSummary(
  doc: jsPDF,
  dc: DeliveryChallanData,
  x: number,
  y: number,
  width: number,
): number {
  const LIGHT_BLUE: [number, number, number] = [239, 246, 255];

  // Compute totals from line items
  const grossSubtotal = dc.lineItems.reduce((s, it) => {
    const gross = it.unitRate != null ? it.qty * it.unitRate : it.taxableValue;
    return s + gross;
  }, 0);
  const totalDiscount = dc.lineItems.reduce((s, it) => s + (it.discount ?? 0), 0);
  const totalTaxable = dc.lineItems.reduce((s, it) => s + it.taxableValue, 0);
  const totalGST = dc.lineItems.reduce((s, it) => {
    return s + (it.taxPercent != null ? it.taxableValue * (it.taxPercent / 100) : 0);
  }, 0);
  const hasGST = dc.lineItems.some((it) => it.taxPercent != null);
  const shipping = dc.shippingCharges ?? 0;
  const adjustment = dc.adjustment ?? 0;
  const grandTotal = totalTaxable + totalGST + shipping + adjustment;

  // Unique GST rates label
  const rates = hasGST
    ? [...new Set(dc.lineItems.filter((it) => it.taxPercent != null).map((it) => `${it.taxPercent}%`))]
        .sort()
        .join(', ')
    : '';

  const rows: Array<[string, string, boolean?]> = [
    ['Gross Subtotal', `INR ${fmt2(grossSubtotal)}`],
    ['Total Taxable Value', `INR ${fmt2(totalTaxable)}`, true],
    hasGST ? [`Total GST${rates ? ` (${rates})` : ''}`, `INR ${fmt2(totalGST)}`] : null,
    shipping !== 0 ? ['Shipping & Handling Charges', `INR ${fmt2(shipping)}`] : null,
    adjustment !== 0
      ? [`Round Off Adjustment`, `${adjustment < 0 ? '-' : ''}INR ${fmt2(Math.abs(adjustment))}`]
      : null,
  ].filter(Boolean) as Array<[string, string, boolean?]>;

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
    drawText(doc, label, x + 10, rowY + 13, { size: 7.7, color: bold ? DARK : TEXT, bold: !!bold });
    drawText(doc, value, x + width - 10, rowY + 13, { size: 7.7, color: DARK, align: 'right' });
  });

  const totalY = y + rows.length * rowHeight;
  doc.setFillColor(...LIGHT_BLUE);
  doc.rect(x + 0.5, totalY, width - 1, totalHeight - 0.5, 'F');
  doc.setDrawColor(...BORDER).setLineWidth(0.5);
  doc.line(x, totalY, x + width, totalY);
  drawText(doc, 'Total Amount', x + 10, totalY + 17, { size: 8.5, color: DARK, bold: true });
  drawText(doc, `INR ${fmt2(grandTotal)}`, x + width - 10, totalY + 17, {
    size: 8.5,
    color: DARK,
    bold: true,
    align: 'right',
  });
  return height;
}

// ── Main generator ────────────────────────────────────────────────────────────
export async function generateDCPdfBase64(dc: DeliveryChallanData): Promise<string> {
  const org = loadConfig().organization;
  const brand = getBrandHeader(org.displayName, org.industry);

  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 42;
  const contentWidth = pageWidth - margin * 2;

  // ── Logo / brand mark ─────────────────────────────────────────────────────
  let logoLoaded = false;
  if (org.logoUrl) {
    const logo = org.logoUrl.startsWith('http')
      ? await loadImage(org.logoUrl)
      : { data: org.logoUrl, format: org.logoUrl.includes('jpeg') ? 'JPEG' as const : 'PNG' as const };
    if (logo) {
      try { doc.addImage(logo.data, logo.format, margin + 8, 26, 45, 45); logoLoaded = true; }
      catch { logoLoaded = false; }
    }
  }
  if (!logoLoaded) {
    doc.setFillColor(...BLUE);
    doc.roundedRect(margin + 8, 27, 38, 38, 9, 9, 'F');
    drawText(doc, 'N', margin + 27, 53, { size: 22, color: [255, 255, 255], bold: true, align: 'center' });
  }

  drawText(doc, brand.name || org.companyName || 'Nido Tech', margin + 60, 50, { size: 18, color: DARK, bold: true });
  drawText(doc, brand.subtitle, margin + 60, 64, { size: 7, color: MUTED });

  // ── "DELIVERY CHALLAN" title + challan number box (right) ─────────────────
  drawText(doc, 'DELIVERY CHALLAN', pageWidth - margin, 48, { size: 18, color: DARK, bold: true, align: 'right' });
  doc.setDrawColor(...BORDER).setLineWidth(0.6);
  doc.roundedRect(pageWidth - margin - 114, 61, 114, 28, 4, 4, 'S');
  drawText(doc, '#', pageWidth - margin - 103, 79, { size: 11, color: BLUE });
  drawText(doc, dc.challanNo, pageWidth - margin - 10, 79, { size: 10, color: DARK, bold: true, align: 'right' });

  // ── Company address block (left) ──────────────────────────────────────────
  const companyLines = [
    org.companyName || org.displayName,
    ...splitLines(org.registeredAddress || org.billingAddress),
    [org.phone && `Phone: ${org.phone}`, org.email && `Email: ${org.email}`].filter(Boolean).join(' | '),
    org.gstNumber ? `GSTIN: ${org.gstNumber}` : '',
    org.website ? `Web: ${org.website}` : '',
  ].filter(Boolean);
  let companyY = 102;
  companyLines.forEach((line, i) => {
    drawText(doc, line, margin + 8, companyY, { size: i === 0 ? 8.5 : 7.5, color: i === 0 ? DARK : TEXT, bold: i === 0 });
    companyY += 11;
  });

  // ── Right-side metadata (Challan Date, Invoice Ref, PO Ref, Place of Supply)
  let dateY = 112;
  drawText(doc, `Challan Date: ${dc.challanDate}`, pageWidth - margin, dateY, { size: 8, color: TEXT, align: 'right' });
  if (dc.invoiceRef) {
    dateY += 14;
    drawText(doc, `Invoice Ref: #${dc.invoiceRef}`, pageWidth - margin, dateY, { size: 8, color: TEXT, align: 'right' });
  }
  if (dc.poReference) {
    dateY += 14;
    drawText(doc, `PO Reference: ${dc.poReference}`, pageWidth - margin, dateY, { size: 8, color: TEXT, align: 'right' });
  }
  if (dc.placeOfSupply) {
    dateY += 14;
    drawText(doc, `Place of Supply: ${dc.placeOfSupply}`, pageWidth - margin, dateY, { size: 8, color: TEXT, align: 'right' });
  }

  // ── Address cards ─────────────────────────────────────────────────────────
  let y = Math.max(companyY + 12, 168);
  const cardGap = 12;
  const cardWidth = (contentWidth - cardGap) / 2;

  const billExtras: string[] = [];
  if (dc.consigneeGstin) billExtras.push(`GSTIN: ${dc.consigneeGstin}`);
  if (dc.consigneeContact) billExtras.push(`Contact: ${dc.consigneeContact}`);

  const shipExtras: string[] = [];
  if (dc.shippedToStateCode) shipExtras.push(`State Code: ${dc.shippedToStateCode}`);
  if (dc.shippedToAttn) shipExtras.push(`Attn: ${dc.shippedToAttn}`);

  const leftCardH = drawAddressCard(doc, margin, y, cardWidth, 'Consignee (Billed To)', dc.consigneeName, dc.consigneeAddress, billExtras);
  const rightCardH = drawAddressCard(doc, margin + cardWidth + cardGap, y, cardWidth, 'Shipped To (Delivery Address)', dc.shippedToName, dc.shippedToAddress, shipExtras);
  y += Math.max(leftCardH, rightCardH) + 16;

  // ── Item table ────────────────────────────────────────────────────────────
  const tableBody = dc.lineItems.map((it, idx) => {
    const gstAmt = it.taxPercent != null ? it.taxableValue * (it.taxPercent / 100) : 0;
    return [
      String(idx + 1),
      it.itemName + (it.description ? `\n${it.description}` : ''),
      it.hsnCode,
      String(it.qty),
      it.unit,
      fmt2(it.taxableValue),
      it.taxPercent != null ? `${it.taxPercent}%` : '-',
      it.taxPercent != null ? fmt2(gstAmt) : '-',
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['#', 'ITEM / DESCRIPTION', 'HSN CODE', 'QTY', 'UNIT', 'TAXABLE VAL (INR)', 'GST %', 'GST AMT (INR)']],
    body: tableBody,
    theme: 'grid',
    tableWidth: contentWidth,
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      textColor: TEXT,
      lineColor: BORDER,
      lineWidth: 0.35,
      cellPadding: { top: 7, bottom: 7, left: 5, right: 5 },
      valign: 'middle',
    },
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: DARK,
      fontStyle: 'bold',
      fontSize: 6.8,
      halign: 'center',
      cellPadding: { top: 6, bottom: 6, left: 5, right: 5 },
    },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 62, halign: 'center' },
      3: { cellWidth: 30, halign: 'center' },
      4: { cellWidth: 36, halign: 'center' },
      5: { cellWidth: 72, halign: 'right' },
      6: { cellWidth: 38, halign: 'center' },
      7: { cellWidth: 72, halign: 'right' },
    },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = DARK;
      }
      if (data.section === 'body' && (data.column.index === 5 || data.column.index === 7)) {
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  y = ((doc as any).lastAutoTable?.finalY ?? y) + 14;

  // ── Summary box (right) + Transportation note (left) ─────────────────────
  const summaryWidth = 255;
  const summaryX = pageWidth - margin - summaryWidth;
  const summaryHeight = drawDCSummary(doc, dc, summaryX, y, summaryWidth);

  // Transportation note on the left, vertically centred with summary
  if (dc.transportationNote) {
    const leftNoteWidth = summaryX - margin - 14;
    const noteText = doc.splitTextToSize(dc.transportationNote, leftNoteWidth - 18);
    const noteH = Math.max(noteText.length * 12 + 24, summaryHeight);
    doc.setDrawColor(...BORDER).setLineWidth(0.4);
    doc.setFillColor(252, 252, 253);
    doc.roundedRect(margin, y, leftNoteWidth, noteH, 4, 4, 'FD');
    drawText(doc, 'TRANSPORTATION NOTE', margin + 10, y + 16, { size: 7, color: BLUE, bold: true });
    drawText(doc, noteText.join('\n'), margin + 10, y + 30, { size: 7.5, color: MUTED });
  }

  y += Math.max(summaryHeight, 60) + 16;

  // ── Bottom two-column section ─────────────────────────────────────────────
  const colGap = 14;
  const leftColW = contentWidth * 0.55;
  const rightColW = contentWidth - leftColW - colGap;
  const rightColX = margin + leftColW + colGap;

  let leftY = y;
  let rightY = y;

  // ── Left: Declaration & Terms ─────────────────────────────────────────────
  if (dc.declaration && dc.declaration.length > 0) {
    drawText(doc, 'DECLARATION & TERMS', margin, leftY, { size: 8, color: BLUE, bold: true });
    leftY += 16;
    dc.declaration.forEach((point, i) => {
      const wrapped = doc.splitTextToSize(`${i + 1}. ${point}`, leftColW - 10);
      drawText(doc, wrapped.join('\n'), margin, leftY, { size: 7.5, color: TEXT });
      leftY += wrapped.length * 11 + 5;
    });
    leftY += 10;
  }

  // ── Left: Dispatch / Transport Details ────────────────────────────────────
  if (dc.modeOfTransport || dc.vehicleLrNo || dc.eWayBillNo) {
    doc.setDrawColor(...BORDER).setLineWidth(0.4);
    doc.line(margin, leftY - 4, margin + leftColW, leftY - 4);
    leftY += 8;
    drawText(doc, 'DISPATCH / TRANSPORT DETAILS', margin, leftY, { size: 8, color: BLUE, bold: true });
    leftY += 14;
    if (dc.modeOfTransport) {
      drawText(doc, `Mode of Transport: ${dc.modeOfTransport}`, margin, leftY, { size: 7.5, color: TEXT });
      leftY += 13;
    }
    if (dc.vehicleLrNo) {
      drawText(doc, `Vehicle / LR No: ${dc.vehicleLrNo}`, margin, leftY, { size: 7.5, color: TEXT });
      leftY += 13;
    }
    if (dc.eWayBillNo) {
      drawText(doc, `E-Way Bill No: ${dc.eWayBillNo}`, margin, leftY, { size: 7.5, color: TEXT });
      leftY += 13;
    }
  }

  // ── Right: Consignee Acknowledgment box ───────────────────────────────────
  const ackBoxH = Math.max(leftY - y + 10, 120);
  doc.setDrawColor(...BORDER).setLineWidth(0.6);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(rightColX, y, rightColW, ackBoxH, 5, 5, 'FD');

  drawText(doc, 'CONSIGNEE ACKNOWLEDGMENT & RECEIPT', rightColX + 10, y + 18, { size: 7, color: BLUE, bold: true });
  doc.setDrawColor(...BORDER).setLineWidth(0.4);
  doc.line(rightColX + 10, y + 26, rightColX + rightColW - 10, y + 26);
  drawText(doc, 'Received the above goods in good order', rightColX + 10, y + 44, { size: 7.5, color: TEXT });
  drawText(doc, 'and condition.', rightColX + 10, y + 56, { size: 7.5, color: TEXT });

  drawText(doc, "Receiver's Signature & Stamp", rightColX + 10, y + ackBoxH - 38, { size: 7.5, color: MUTED });
  const dateLineY = y + ackBoxH - 18;
  drawText(doc, 'Date: ____ / ____ / ____', rightColX + 10, dateLineY, { size: 7.5, color: MUTED });

  const advancedY = Math.max(leftY, y + ackBoxH) + 20;

  // ── Authorized signatory ──────────────────────────────────────────────────
  drawText(doc, `For ${brand.name || org.companyName || 'Nido Tech'}`, pageWidth - margin, advancedY, { size: 8, color: DARK, bold: true, align: 'right' });
  const sigLineY = advancedY + 40;
  doc.setDrawColor(...MUTED).setLineWidth(0.5);
  doc.line(pageWidth - margin - 130, sigLineY, pageWidth - margin, sigLineY);
  drawText(doc, 'Authorized Signatory', pageWidth - margin - 65, sigLineY + 14, { size: 7.5, color: MUTED, align: 'center' });

  // ── Footer ────────────────────────────────────────────────────────────────
  const footerY = Math.min(pageHeight - 22, sigLineY + 52);
  doc.setDrawColor(...BORDER).setLineWidth(0.5);
  doc.line(margin, footerY - 18, pageWidth - margin, footerY - 18);
  const footerMsg = dc.footerNote || `Thank you for choosing ${brand.name || org.companyName || 'Nido Tech'} as your corporate essentials partner!`;
  drawText(doc, footerMsg, pageWidth / 2, footerY, { size: 8, color: BLUE, bold: true, align: 'center' });

  return doc.output('datauristring');
}

export async function generateDCPdfBlob(dc: DeliveryChallanData): Promise<Blob> {
  // Re-use the same generator but return a Blob (avoids Chrome data: URI block)
  const dataUri = await generateDCPdfBase64(dc);
  const base64 = dataUri.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: 'application/pdf' });
}

export async function downloadDCPdf(dc: DeliveryChallanData, filename: string): Promise<void> {
  const blob = await generateDCPdfBlob(dc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
