import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadConfig } from './configService';
import { numberToWords } from './quotePdfGenerator';

// ── Colour palette (identical to invoicePdf.ts) ───────────────────────────────
const BLUE: [number, number, number] = [31, 95, 190];
const DARK: [number, number, number] = [28, 39, 56];
const TEXT: [number, number, number] = [55, 62, 72];
const MUTED: [number, number, number] = [105, 112, 123];
const BORDER: [number, number, number] = [218, 222, 228];
const LIGHT_BLUE: [number, number, number] = [239, 246, 255];

// ── Types ─────────────────────────────────────────────────────────────────────
export interface VendorCreditItem {
  itemDetails: string;
  account: string;
  hsnSac: string;
  quantity: number;
  rate: number;
  discount: number;
  taxPercent: number;
}

export interface VendorCreditForPdf {
  creditNoteNumber: string;
  referenceNumber: string;
  vendorName: string;
  vendorAddress: string;
  creditDate: string;
  associatedBillNumber?: string;
  status: string;
  notes?: string;
  items: VendorCreditItem[];
  adjustment: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt2(value: number): string {
  return value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(value: string): string {
  if (!value) return '';
  // dd/mm/yyyy already
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value;
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function splitLines(value: string | undefined): string[] {
  return (value || '').split(/[,\n]/).map((p) => p.trim()).filter(Boolean);
}

function getBrandHeader(displayName: string, industry: string) {
  const v = displayName.trim();
  const m = v.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  return {
    name: (m?.[1] || v || 'Nido Tech').trim(),
    subtitle: (m?.[2] || industry || 'Corporate Essentials & Integrated Services').trim(),
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
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
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

function calcTotals(credit: VendorCreditForPdf) {
  const grossSubtotal = credit.items.reduce((s, i) => s + i.quantity * i.rate, 0);
  const totalDiscount = credit.items.reduce((s, i) => {
    const base = i.quantity * i.rate;
    return s + (base * i.discount) / 100;
  }, 0);
  const subtotal = grossSubtotal - totalDiscount;
  const totalTax = credit.items.reduce((s, i) => {
    const base = i.quantity * i.rate;
    const disc = (base * i.discount) / 100;
    return s + ((base - disc) * i.taxPercent) / 100;
  }, 0);
  const grandTotal = subtotal + totalTax + credit.adjustment;
  return { grossSubtotal, totalDiscount, subtotal, totalTax, grandTotal };
}

// ── Main generator ─────────────────────────────────────────────────────────────
export async function generateVendorCreditPdf(credit: VendorCreditForPdf): Promise<void> {
  const org = loadConfig().organization;
  const brand = getBrandHeader(org.displayName, org.industry);
  const totals = calcTotals(credit);

  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 42;
  const contentWidth = pageWidth - margin * 2;

  // ── Logo + brand name ─────────────────────────────────────────────────────
  let logoLoaded = false;
  if (org.logoUrl) {
    const logo = org.logoUrl.startsWith('http')
      ? await loadImage(org.logoUrl)
      : { data: org.logoUrl, format: org.logoUrl.includes('jpeg') ? 'JPEG' as const : 'PNG' as const };
    if (logo) {
      try {
        doc.addImage(logo.data, logo.format, margin + 8, 26, 45, 45);
        logoLoaded = true;
      } catch { logoLoaded = false; }
    }
  }
  if (!logoLoaded) {
    doc.setFillColor(...BLUE);
    doc.roundedRect(margin + 8, 27, 38, 38, 9, 9, 'F');
    drawText(doc, 'N', margin + 27, 53, { size: 22, color: [255, 255, 255], bold: true, align: 'center' });
  }

  drawText(doc, brand.name || org.companyName || 'Nido Tech', margin + 60, 50, { size: 18, color: DARK, bold: true });
  drawText(doc, brand.subtitle, margin + 60, 64, { size: 7, color: MUTED });

  // ── VENDOR CREDIT label + number box (right) ──────────────────────────────
  drawText(doc, 'VENDOR CREDIT', pageWidth - margin, 48, { size: 18, color: DARK, bold: true, align: 'right' });
  doc.setDrawColor(...BORDER).setLineWidth(0.6);
  doc.roundedRect(pageWidth - margin - 120, 61, 120, 28, 4, 4, 'S');
  drawText(doc, '#', pageWidth - margin - 109, 79, { size: 11, color: BLUE });
  drawText(doc, credit.creditNoteNumber, pageWidth - margin - 10, 79, { size: 10, color: DARK, bold: true, align: 'right' });

  // ── Company address block ─────────────────────────────────────────────────
  const companyLines = [
    org.companyName || org.displayName,
    ...splitLines(org.registeredAddress || org.billingAddress),
    [org.phone && `Phone: ${org.phone}`, org.email && `Email: ${org.email}`].filter(Boolean).join(' | '),
    org.gstNumber ? `GSTIN: ${org.gstNumber}` : '',
  ].filter(Boolean);
  let companyY = 102;
  companyLines.forEach((line, idx) => {
    drawText(doc, line, margin + 8, companyY, {
      size: idx === 0 ? 8.5 : 7.5,
      color: idx === 0 ? DARK : TEXT,
      bold: idx === 0,
    });
    companyY += 11;
  });

  // ── Credit date + Reference (right) ──────────────────────────────────────
  let dateY = 112;
  drawText(doc, `Credit Date: ${fmtDate(credit.creditDate)}`, pageWidth - margin, dateY, { size: 8, color: TEXT, align: 'right' });
  if (credit.referenceNumber) {
    dateY += 14;
    drawText(doc, `Reference: ${credit.referenceNumber}`, pageWidth - margin, dateY, { size: 8, color: TEXT, align: 'right' });
  }
  if (credit.associatedBillNumber) {
    dateY += 14;
    drawText(doc, `Against Bill: ${credit.associatedBillNumber}`, pageWidth - margin, dateY, { size: 8, color: TEXT, align: 'right' });
  }
  dateY += 14;
  const statusColor: [number, number, number] = credit.status === 'OPEN' ? [5, 150, 105] : [100, 116, 139];
  drawText(doc, `Status: ${credit.status}`, pageWidth - margin, dateY, { size: 8, color: statusColor, bold: true, align: 'right' });

  // ── Vendor card ───────────────────────────────────────────────────────────
  let y = Math.max(companyY + 12, 170);

  // draw card
  const cardHeight = 94;
  const cardWidth = (contentWidth - 12) / 2;
  doc.setDrawColor(...BORDER).setLineWidth(0.7);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, y, cardWidth, cardHeight, 5, 5, 'FD');
  drawText(doc, 'VENDOR', margin + 13, y + 19, { size: 8, color: BLUE, bold: true });
  doc.setDrawColor(...BORDER).setLineWidth(0.5);
  doc.line(margin + 13, y + 27, margin + cardWidth - 13, y + 27);
  let cardY = y + 48;
  drawText(doc, credit.vendorName, margin + 13, cardY, { size: 9, color: DARK, bold: true });
  cardY += 13;
  splitLines(credit.vendorAddress).forEach((line) => {
    drawText(doc, line, margin + 13, cardY, { size: 8.5 });
    cardY += 12;
  });

  // credits remaining card (right)
  const creditCardX = margin + cardWidth + 12;
  doc.setDrawColor(...BORDER).setLineWidth(0.7);
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(creditCardX, y, cardWidth, cardHeight, 5, 5, 'FD');
  drawText(doc, 'CREDIT SUMMARY', creditCardX + 13, y + 19, { size: 8, color: BLUE, bold: true });
  doc.setDrawColor(...BORDER).setLineWidth(0.5);
  doc.line(creditCardX + 13, y + 27, creditCardX + cardWidth - 13, y + 27);
  drawText(doc, 'Total Credit Amount', creditCardX + 13, y + 48, { size: 8, color: MUTED });
  drawText(doc, `INR ${fmt2(totals.grandTotal)}`, creditCardX + 13, y + 62, { size: 13, color: DARK, bold: true });
  drawText(doc, 'Balance Remaining', creditCardX + 13, y + 78, { size: 8, color: MUTED });
  drawText(doc, `INR ${fmt2(totals.grandTotal)}`, creditCardX + 13, y + 90, { size: 9, color: [5, 150, 105], bold: true });

  y += cardHeight + 16;

  // ── Line items table ──────────────────────────────────────────────────────
  const tableBody = credit.items.map((item, idx) => {
    const base = item.quantity * item.rate;
    const disc = (base * item.discount) / 100;
    const taxable = base - disc;
    const gst = (taxable * item.taxPercent) / 100;
    const taxLabel = `${item.taxPercent}%`;
    return [
      String(idx + 1),
      item.itemDetails || 'General vendor adjustment',
      item.hsnSac || '',
      String(item.quantity),
      fmt2(item.rate),
      fmt2(disc),
      fmt2(taxable),
      taxLabel,
      fmt2(gst),
      fmt2(taxable + gst),
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['#', 'ITEM / DESCRIPTION', 'HSN/SAC', 'QTY', 'RATE', 'DISC', 'TAXABLE', 'GST RATE', 'GST', 'AMOUNT']],
    body: tableBody,
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
    columnStyles: {
      0: { cellWidth: 20, halign: 'center' },
      1: { cellWidth: 105 },
      2: { cellWidth: 42, halign: 'center' },
      3: { cellWidth: 24, halign: 'center' },
      4: { cellWidth: 55, halign: 'right' },
      5: { cellWidth: 47, halign: 'right' },
      6: { cellWidth: 58, halign: 'right' },
      7: { cellWidth: 40, halign: 'center' },
      8: { cellWidth: 52, halign: 'right' },
      9: { cellWidth: 68, halign: 'right' },
    },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = DARK;
      }
      if (data.section === 'body' && data.column.index === 9) {
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  // ── Summary box (right) ───────────────────────────────────────────────────
  y = ((doc as any).lastAutoTable?.finalY ?? y) + 15;

  const summaryWidth = 255;
  const summaryX = pageWidth - margin - summaryWidth;

  const summaryRates = [...new Set(credit.items.map((i) => i.taxPercent))].sort((a, b) => a - b).map((r) => `${r}%`).join(', ');
  const rows: [string, string, boolean?][] = [
    ['Gross Subtotal', `INR ${fmt2(totals.grossSubtotal)}`],
    ['Item Level Discounts (-)', `INR - ${fmt2(totals.totalDiscount)}`, true],
    ['Total Taxable Value', `INR ${fmt2(totals.subtotal)}`, true],
    [`Total GST${summaryRates ? ` (${summaryRates})` : ''}`, `INR ${fmt2(totals.totalTax)}`],
    ['Round Off Adjustment', `${credit.adjustment < 0 ? '-' : ''}INR ${fmt2(Math.abs(credit.adjustment))}`],
  ];

  const rowHeight = 20;
  const totalHeight = 27;
  const summaryHeight = rows.length * rowHeight + totalHeight;

  doc.setDrawColor(...BORDER).setLineWidth(0.6);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(summaryX, y, summaryWidth, summaryHeight, 5, 5, 'FD');

  rows.forEach(([label, value, bold], index) => {
    const rowY = y + index * rowHeight;
    if (index > 0) { doc.setDrawColor(...BORDER).setLineWidth(0.3); doc.line(summaryX, rowY, summaryX + summaryWidth, rowY); }
    drawText(doc, label, summaryX + 10, rowY + 13, { size: 7.7, color: bold ? DARK : TEXT, bold: !!bold });
    drawText(doc, value, summaryX + summaryWidth - 10, rowY + 13, { size: 7.7, color: DARK, align: 'right' });
  });

  const totalY = y + rows.length * rowHeight;
  doc.setFillColor(...LIGHT_BLUE);
  doc.rect(summaryX + 0.5, totalY, summaryWidth - 1, totalHeight - 0.5, 'F');
  doc.setDrawColor(...BORDER).setLineWidth(0.5);
  doc.line(summaryX, totalY, summaryX + summaryWidth, totalY);
  drawText(doc, 'Total Credit', summaryX + 10, totalY + 17, { size: 8.5, color: DARK, bold: true });
  drawText(doc, `INR ${fmt2(totals.grandTotal)}`, summaryX + summaryWidth - 10, totalY + 17, { size: 8.5, color: DARK, bold: true, align: 'right' });

  // ── Left: Notes ───────────────────────────────────────────────────────────
  let leftY = y + 2;
  const leftWidth = summaryX - margin - 14;
  if (credit.notes) {
    drawText(doc, 'NOTES', margin, leftY + 9, { size: 8, color: BLUE, bold: true });
    leftY += 23;
    const wrapped = doc.splitTextToSize(credit.notes, leftWidth);
    drawText(doc, wrapped.join('\n'), margin, leftY, { size: 7.5, color: TEXT });
    leftY += wrapped.length * 11 + 6;
  }

  // ── Total in Words + Authorized Signature ─────────────────────────────────
  y = Math.max(leftY + 8, y + summaryHeight) + 20;
  drawText(doc, 'TOTAL IN WORDS', margin, y, { size: 8, color: BLUE, bold: true });
  drawText(doc, numberToWords(totals.grandTotal), margin, y + 15, { size: 8.5, color: DARK, bold: true });

  const signatureX = pageWidth - margin - 135;
  doc.setDrawColor(...MUTED).setLineWidth(0.6);
  doc.line(signatureX, y + 10, pageWidth - margin, y + 10);
  drawText(doc, 'Authorized Signatory', (signatureX + pageWidth - margin) / 2, y + 25, { size: 7.5, color: MUTED, align: 'center' });

  // ── Footer ─────────────────────────────────────────────────────────────────
  const footerY = Math.min(pageHeight - 22, y + 72);
  doc.setDrawColor(...BORDER).setLineWidth(0.5);
  doc.line(margin, footerY - 18, pageWidth - margin, footerY - 18);
  drawText(
    doc,
    `Thank you for choosing ${org.displayName || org.companyName || 'Nido Tech'} as your corporate essentials partner!`,
    pageWidth / 2,
    footerY,
    { size: 8, color: BLUE, bold: true, align: 'center' },
  );

  doc.save(`${credit.creditNoteNumber}.pdf`);
}
