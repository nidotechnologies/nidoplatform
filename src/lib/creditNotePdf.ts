import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadConfig } from './configService';
import { numberToWords } from './quotePdfGenerator';

// ── Colour palette — exactly identical to invoicePdf.ts ─────────────────────
const BLUE: [number, number, number] = [31, 95, 190];
const DARK: [number, number, number] = [28, 39, 56];
const TEXT: [number, number, number] = [55, 62, 72];
const MUTED: [number, number, number] = [105, 112, 123];
const BORDER: [number, number, number] = [218, 222, 228];
const LIGHT_BLUE: [number, number, number] = [239, 246, 255];

export interface CreditNoteItem {
  itemName: string;
  account: string;
  description: string;
  hsnSac: string;
  quantity: number;
  rate: number;
  discount: number;
  taxRate: number;
}

export interface CreditNotePdfData {
  creditNoteNumber: string;
  referenceNumber: string;
  customerName: string;
  customerAddress: string;
  customerGstin: string;
  invoiceNumber: string;
  invoiceDate: string;
  issueDate: string;
  reason: string;
  placeOfSupply: string;
  status: string;
  item: CreditNoteItem;
  shippingCharges: number;
  adjustment: number;
  subtotal: number;
  total: number;
  creditsRemaining: number;
  totalInWords: string;
  notes: string;
  terms: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt2(value: number): string {
  return value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(value: string): string {
  if (!value) return '';
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

// ── Main generator ─────────────────────────────────────────────────────────────
export async function generateCreditNotePdf(note: CreditNotePdfData): Promise<string> {
  const org = loadConfig().organization;
  const brand = getBrandHeader(org.displayName, org.industry);

  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 42;
  const contentWidth = pageWidth - margin * 2;

  // ── Logo ──────────────────────────────────────────────────────────────────
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

  // ── CREDIT NOTE label + number box (right) ────────────────────────────────
  drawText(doc, 'CREDIT NOTE', pageWidth - margin, 48, { size: 20, color: DARK, bold: true, align: 'right' });
  doc.setDrawColor(...BORDER).setLineWidth(0.6);
  doc.roundedRect(pageWidth - margin - 130, 61, 130, 28, 4, 4, 'S');
  drawText(doc, '#', pageWidth - margin - 119, 79, { size: 11, color: BLUE });
  drawText(doc, note.creditNoteNumber, pageWidth - margin - 10, 79, { size: 10, color: DARK, bold: true, align: 'right' });

  // Draft watermark
  if (note.status === 'draft') {
    drawText(doc, 'DRAFT', margin + 8, 92, { size: 7.5, color: [180, 130, 0], bold: true });
  }

  // ── Company address (left) ────────────────────────────────────────────────
  const companyLines = [
    org.companyName || org.displayName,
    ...splitLines(org.registeredAddress || org.billingAddress),
    [org.phone && `Phone: ${org.phone}`, org.email && `Email: ${org.email}`].filter(Boolean).join(' | '),
    org.gstNumber ? `GSTIN: ${org.gstNumber}` : '',
  ].filter(Boolean);
  let companyY = 102;
  companyLines.forEach((line, i) => {
    drawText(doc, line, margin + 8, companyY, { size: i === 0 ? 8.5 : 7.5, color: i === 0 ? DARK : TEXT, bold: i === 0 });
    companyY += 11;
  });

  // ── Dates (right) ─────────────────────────────────────────────────────────
  let dateY = 112;
  drawText(doc, `Credit Date: ${fmtDate(note.issueDate)}`, pageWidth - margin, dateY, { size: 8, color: TEXT, align: 'right' });
  dateY += 14;
  drawText(doc, `Ref#: ${note.referenceNumber}`, pageWidth - margin, dateY, { size: 8, color: TEXT, align: 'right' });
  if (note.invoiceNumber) {
    dateY += 14;
    drawText(doc, `Invoice#: ${note.invoiceNumber}`, pageWidth - margin, dateY, { size: 8, color: TEXT, align: 'right' });
    dateY += 14;
    drawText(doc, `Invoice Date: ${fmtDate(note.invoiceDate)}`, pageWidth - margin, dateY, { size: 8, color: TEXT, align: 'right' });
  }
  if (note.reason) {
    dateY += 14;
    drawText(doc, `Reason: ${note.reason}`, pageWidth - margin, dateY, { size: 8, color: TEXT, align: 'right' });
  }

  // ── Bill To card ──────────────────────────────────────────────────────────
  let y = Math.max(companyY + 12, 175);
  const addressLines = splitLines(note.customerAddress);
  const extraLines: string[] = [];
  if (note.customerGstin) extraLines.push(`GSTIN: ${note.customerGstin}`);
  if (note.placeOfSupply) extraLines.push(`Place of Supply: ${note.placeOfSupply}`);
  const totalLines = addressLines.length + extraLines.length;
  const cardHeight = Math.max(92, 54 + totalLines * 12);
  const cardWidth = contentWidth * 0.52;

  doc.setDrawColor(...BORDER).setLineWidth(0.7);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, y, cardWidth, cardHeight, 5, 5, 'FD');
  drawText(doc, 'BILL TO', margin + 13, y + 19, { size: 8, color: BLUE, bold: true });
  doc.setDrawColor(...BORDER).setLineWidth(0.5);
  doc.line(margin + 13, y + 27, margin + cardWidth - 13, y + 27);
  let cursor = y + 48;
  drawText(doc, note.customerName, margin + 13, cursor, { size: 9, color: DARK, bold: true });
  cursor += 13;
  addressLines.forEach((line) => { drawText(doc, line, margin + 13, cursor, { size: 8.5 }); cursor += 12; });
  extraLines.forEach((line) => { drawText(doc, line, margin + 13, cursor, { size: 8.5 }); cursor += 12; });

  // Credits Remaining box (right of Bill To)
  const crX = margin + cardWidth + 12;
  const crWidth = contentWidth - cardWidth - 12;
  doc.setDrawColor(...BORDER).setLineWidth(0.7);
  doc.setFillColor(...LIGHT_BLUE);
  doc.roundedRect(crX, y, crWidth, cardHeight, 5, 5, 'FD');
  drawText(doc, 'CREDITS REMAINING', crX + 13, y + 19, { size: 7.5, color: BLUE, bold: true });
  doc.setDrawColor(...BORDER).setLineWidth(0.5);
  doc.line(crX + 13, y + 27, crX + crWidth - 13, y + 27);
  drawText(doc, `INR ${fmt2(note.creditsRemaining)}`, crX + crWidth / 2, y + 60, { size: 18, color: DARK, bold: true, align: 'center' });

  y += cardHeight + 18;

  // ── Line items table ──────────────────────────────────────────────────────
  const base = Math.max(0, note.item.quantity * note.item.rate - note.item.discount);
  const taxAmt = base * (note.item.taxRate / 100);
  const tableBody = [[
    '1',
    note.item.itemName + (note.item.description ? `\n${note.item.description}` : ''),
    note.item.hsnSac || '—',
    fmt2(note.item.quantity),
    fmt2(note.item.rate),
    fmt2(note.item.discount),
    fmt2(base),
    `${note.item.taxRate}%`,
    fmt2(taxAmt),
    fmt2(base + taxAmt),
  ]];

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
    headStyles: { fillColor: [248, 250, 252], textColor: DARK, fontStyle: 'bold', fontSize: 6.3, halign: 'center' },
    columnStyles: {
      0: { cellWidth: 20, halign: 'center' },
      1: { cellWidth: 105 },
      2: { cellWidth: 42, halign: 'center' },
      3: { cellWidth: 24, halign: 'center' },
      4: { cellWidth: 50, halign: 'right' },
      5: { cellWidth: 42, halign: 'right' },
      6: { cellWidth: 55, halign: 'right' },
      7: { cellWidth: 38, halign: 'center' },
      8: { cellWidth: 46, halign: 'right' },
      9: { cellWidth: 63, halign: 'right' },
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
  y = ((doc as any).lastAutoTable?.finalY ?? y) + 18;
  const sumWidth = 240;
  const sumX = pageWidth - margin - sumWidth;
  const sumRows: Array<[string, string, boolean?]> = [
    ['Sub Total', `INR ${fmt2(note.subtotal)}`],
    ['Shipping Charges', `INR ${fmt2(note.shippingCharges)}`],
    ['Adjustment', `INR ${fmt2(note.adjustment)}`],
  ];
  const rowH = 20;
  const totalH = 27;
  const sumHeight = sumRows.length * rowH + totalH;

  doc.setDrawColor(...BORDER).setLineWidth(0.6);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(sumX, y, sumWidth, sumHeight, 5, 5, 'FD');

  sumRows.forEach(([label, value], i) => {
    const rowY = y + i * rowH;
    if (i > 0) { doc.setDrawColor(...BORDER).setLineWidth(0.3); doc.line(sumX, rowY, sumX + sumWidth, rowY); }
    drawText(doc, label, sumX + 10, rowY + 13, { size: 7.7, color: TEXT });
    drawText(doc, value, sumX + sumWidth - 10, rowY + 13, { size: 7.7, color: DARK, align: 'right' });
  });

  const totalRowY = y + sumRows.length * rowH;
  doc.setFillColor(...LIGHT_BLUE);
  doc.rect(sumX + 0.5, totalRowY, sumWidth - 1, totalH - 0.5, 'F');
  doc.setDrawColor(...BORDER).setLineWidth(0.5);
  doc.line(sumX, totalRowY, sumX + sumWidth, totalRowY);
  drawText(doc, 'Total', sumX + 10, totalRowY + 17, { size: 8.5, color: DARK, bold: true });
  drawText(doc, `INR ${fmt2(note.total)}`, sumX + sumWidth - 10, totalRowY + 17, { size: 8.5, color: DARK, bold: true, align: 'right' });

  // Credits Remaining row below
  const crRowY = totalRowY + totalH + 4;
  doc.setDrawColor(...BORDER).setLineWidth(0.6);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(sumX, crRowY, sumWidth, 26, 3, 3, 'FD');
  drawText(doc, 'Credits Remaining', sumX + 10, crRowY + 16, { size: 8, color: BLUE, bold: true });
  drawText(doc, `INR ${fmt2(note.creditsRemaining)}`, sumX + sumWidth - 10, crRowY + 16, { size: 8, color: BLUE, bold: true, align: 'right' });

  // ── Left: Terms + Notes ───────────────────────────────────────────────────
  let leftY = y + 2;
  const leftWidth = sumX - margin - 14;

  if (note.notes) {
    drawText(doc, 'CUSTOMER NOTES', margin, leftY + 9, { size: 8, color: BLUE, bold: true });
    leftY += 23;
    note.notes.split('\n').filter(Boolean).forEach((line) => {
      const wrapped = doc.splitTextToSize(line, leftWidth);
      drawText(doc, wrapped.join('\n'), margin, leftY, { size: 7.5, color: TEXT });
      leftY += wrapped.length * 11 + 4;
    });
    leftY += 6;
  }

  if (note.terms) {
    if (note.notes) { doc.setDrawColor(...BORDER).setLineWidth(0.4); doc.line(margin, leftY, sumX - 14, leftY); leftY += 14; }
    drawText(doc, 'TERMS & CONDITIONS', margin, leftY, { size: 8, color: BLUE, bold: true });
    leftY += 14;
    note.terms.split('\n').filter(Boolean).forEach((term, i) => {
      const wrapped = doc.splitTextToSize(`${i + 1}. ${term}`, leftWidth);
      drawText(doc, wrapped.join('\n'), margin, leftY, { size: 7.5, color: TEXT });
      leftY += wrapped.length * 11 + 4;
    });
  }

  // ── Total in Words + Signature ────────────────────────────────────────────
  y = Math.max(leftY + 8, y + sumHeight + crRowY - (y + sumRows.length * rowH + totalH) + 50) + 18;
  drawText(doc, 'TOTAL IN WORDS', margin, y, { size: 8, color: BLUE, bold: true });
  drawText(doc, numberToWords(note.total), margin, y + 15, { size: 8.5, color: DARK, bold: true });

  const sigX = pageWidth - margin - 135;
  doc.setDrawColor(...MUTED).setLineWidth(0.6);
  doc.line(sigX, y + 10, pageWidth - margin, y + 10);
  drawText(doc, 'Authorized Signatory', (sigX + pageWidth - margin) / 2, y + 25, { size: 7.5, color: MUTED, align: 'center' });

  // ── Footer ────────────────────────────────────────────────────────────────
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

  return doc.output('datauristring');
}

export async function downloadCreditNotePdf(note: CreditNotePdfData, filename?: string): Promise<void> {
  const dataUri = await generateCreditNotePdf(note);
  const link = document.createElement('a');
  link.href = dataUri;
  link.download = filename ?? `${note.creditNoteNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
