import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadConfig } from './configService';
import { formatCurrency } from './formatters';

// ── Colour palette (identical to invoicePdf) ──────────────────────────────────
const BLUE: [number, number, number] = [31, 95, 190];
const DARK: [number, number, number] = [28, 39, 56];
const TEXT: [number, number, number] = [55, 62, 72];
const MUTED: [number, number, number] = [105, 112, 123];
const BORDER: [number, number, number] = [218, 222, 228];
const LIGHT_BLUE: [number, number, number] = [239, 246, 255];

// ── Types ─────────────────────────────────────────────────────────────────────
export interface PaymentMadeForPdf {
  paymentNumber: string;
  date: string;
  vendorName: string;
  mode: string;
  paidThrough: string;
  referenceNumber?: string;
  notes?: string;
  amount: number;
  unusedAmount: number;
  type: string;
  billNumber?: string;
  allocations: { billId: string; amount: number }[];
}

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

function fmtDate(value: string): string {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
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

// ── Main generator ─────────────────────────────────────────────────────────────
export async function downloadPaymentMadePdf(payment: PaymentMadeForPdf): Promise<void> {
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

  // ── PAYMENT MADE label + number box (right) ───────────────────────────────
  drawText(doc, 'PAYMENT MADE', pageWidth - margin, 48, { size: 22, color: DARK, bold: true, align: 'right' });
  doc.setDrawColor(...BORDER).setLineWidth(0.6);
  doc.roundedRect(pageWidth - margin - 130, 61, 130, 28, 4, 4, 'S');
  drawText(doc, '#', pageWidth - margin - 119, 79, { size: 11, color: BLUE });
  drawText(doc, payment.paymentNumber, pageWidth - margin - 10, 79, { size: 10, color: DARK, bold: true, align: 'right' });

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

  // ── Payment meta (right) ──────────────────────────────────────────────────
  let dateY = 112;
  drawText(doc, `Payment Date: ${fmtDate(payment.date)}`, pageWidth - margin, dateY, { size: 8, color: TEXT, align: 'right' });
  dateY += 14;
  drawText(doc, `Payment Mode: ${payment.mode}`, pageWidth - margin, dateY, { size: 8, color: TEXT, align: 'right' });
  dateY += 14;
  drawText(doc, `Paid Through: ${payment.paidThrough}`, pageWidth - margin, dateY, { size: 8, color: TEXT, align: 'right' });
  if (payment.referenceNumber) {
    dateY += 14;
    drawText(doc, `Reference #: ${payment.referenceNumber}`, pageWidth - margin, dateY, { size: 8, color: TEXT, align: 'right' });
  }
  dateY += 14;
  drawText(doc, `Type: ${payment.type}`, pageWidth - margin, dateY, { size: 8, color: TEXT, align: 'right' });

  // ── Amount Paid highlight box ─────────────────────────────────────────────
  const balanceBoxY = dateY + 18;
  doc.setFillColor(...LIGHT_BLUE);
  doc.roundedRect(pageWidth - margin - 140, balanceBoxY, 140, 32, 4, 4, 'F');
  drawText(doc, 'Amount Paid', pageWidth - margin - 10, balanceBoxY + 11, { size: 7, color: MUTED, align: 'right' });
  drawText(doc, money(payment.amount), pageWidth - margin - 10, balanceBoxY + 25, { size: 11, color: DARK, bold: true, align: 'right' });

  // ── Cards: Paid To (left) + Payment Summary (right) ──────────────────────
  let y = Math.max(companyY + 12, 164);
  const cardGap = 12;
  const cardWidth = (contentWidth - cardGap) / 2;

  // Paid To card (left)
  const paidToLines: string[] = [];
  const paidToCardHeight = Math.max(92, 54 + paidToLines.length * 12 + 12);

  doc.setDrawColor(...BORDER).setLineWidth(0.7);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, y, cardWidth, paidToCardHeight, 5, 5, 'FD');
  drawText(doc, 'PAID TO', margin + 13, y + 19, { size: 8, color: BLUE, bold: true });
  doc.setDrawColor(...BORDER).setLineWidth(0.5);
  doc.line(margin + 13, y + 27, margin + cardWidth - 13, y + 27);
  drawText(doc, payment.vendorName, margin + 13, y + 48, { size: 9, color: DARK, bold: true });

  // Payment Summary card (right)
  const summaryCardX = margin + cardWidth + cardGap;
  const usedAmount = payment.allocations.reduce((s, a) => s + a.amount, 0);
  const summaryRows: [string, string, boolean?][] = [
    ['Amount Paid', money(payment.amount)],
    ['Used for Payments', money(usedAmount)],
    ['Unused Amount', money(payment.unusedAmount), true],
  ];
  const summaryCardHeight = Math.max(92, 54 + summaryRows.length * 14);

  doc.setDrawColor(...BORDER).setLineWidth(0.7);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(summaryCardX, y, cardWidth, summaryCardHeight, 5, 5, 'FD');
  drawText(doc, 'PAYMENT SUMMARY', summaryCardX + 13, y + 19, { size: 8, color: BLUE, bold: true });
  doc.setDrawColor(...BORDER).setLineWidth(0.5);
  doc.line(summaryCardX + 13, y + 27, summaryCardX + cardWidth - 13, y + 27);
  let summaryRowY = y + 42;
  summaryRows.forEach(([label, value, isBold]) => {
    drawText(doc, label, summaryCardX + 13, summaryRowY, { size: 7.7, color: isBold ? DARK : TEXT, bold: !!isBold });
    drawText(doc, value, summaryCardX + cardWidth - 13, summaryRowY, { size: 7.7, color: DARK, bold: !!isBold, align: 'right' });
    summaryRowY += 14;
  });

  y += Math.max(paidToCardHeight, summaryCardHeight) + 16;

  // ── Payment For table ─────────────────────────────────────────────────────
  const tableBody: string[][] =
    payment.allocations.length === 0
      ? [['—', 'Advance payment — no bill linked', money(payment.amount)]]
      : payment.allocations.map((a, i) => [
          String(i + 1),
          payment.billNumber || a.billId || '—',
          payment.referenceNumber || '—',
          money(a.amount),
        ]);

  const hasAllocations = payment.allocations.length > 0;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [hasAllocations
      ? ['#', 'BILL #', 'REFERENCE #', 'AMOUNT']
      : ['#', 'DESCRIPTION', 'AMOUNT']],
    body: tableBody,
    theme: 'grid',
    tableWidth: contentWidth,
    styles: {
      font: 'helvetica',
      fontSize: 8,
      textColor: TEXT,
      lineColor: BORDER,
      lineWidth: 0.35,
      cellPadding: { top: 8, bottom: 8, left: 6, right: 6 },
      valign: 'middle',
    },
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: DARK,
      fontStyle: 'bold',
      fontSize: 7,
      halign: 'center',
    },
    columnStyles: hasAllocations
      ? {
          0: { cellWidth: 30, halign: 'center' },
          1: { cellWidth: 160, fontStyle: 'bold', textColor: DARK },
          2: { cellWidth: 'auto' },
          3: { cellWidth: 130, halign: 'right', fontStyle: 'bold', textColor: DARK },
        }
      : {
          0: { cellWidth: 30, halign: 'center' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 130, halign: 'right', fontStyle: 'bold', textColor: DARK },
        },
  });

  // ── Final summary box (right-aligned) ─────────────────────────────────────
  y = ((doc as any).lastAutoTable?.finalY ?? y) + 15;
  const boxWidth = 220;
  const boxX = pageWidth - margin - boxWidth;
  const finalRows: [string, string, boolean?][] = [
    ['Amount Paid', money(payment.amount)],
    ['Used for Payments', money(usedAmount)],
    ['Unused Amount', money(payment.unusedAmount), true],
  ];
  const rowH = 20;
  const totalH = finalRows.length * rowH + 4;
  doc.setDrawColor(...BORDER).setLineWidth(0.6);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(boxX, y, boxWidth, totalH, 5, 5, 'FD');
  finalRows.forEach(([label, value, isBold], index) => {
    const rowY = y + index * rowH;
    if (index > 0) {
      doc.setDrawColor(...BORDER).setLineWidth(0.3);
      doc.line(boxX, rowY, boxX + boxWidth, rowY);
    }
    if (isBold) {
      doc.setFillColor(...LIGHT_BLUE);
      doc.rect(boxX + 0.5, rowY, boxWidth - 1, rowH - 0.5, 'F');
    }
    drawText(doc, label, boxX + 10, rowY + 13, { size: 7.7, color: isBold ? DARK : TEXT, bold: !!isBold });
    drawText(doc, value, boxX + boxWidth - 10, rowY + 13, { size: 7.7, color: DARK, bold: !!isBold, align: 'right' });
  });

  // ── Notes (left) ─────────────────────────────────────────────────────────
  if (payment.notes) {
    const leftWidth = boxX - margin - 14;
    let leftY = y + 2;
    drawText(doc, 'NOTES', margin, leftY + 9, { size: 8, color: BLUE, bold: true });
    leftY += 23;
    const wrapped = doc.splitTextToSize(payment.notes, leftWidth);
    drawText(doc, wrapped.join('\n'), margin, leftY, { size: 7.5, color: TEXT });
  }

  // ── Authorized Signature ──────────────────────────────────────────────────
  y = y + totalH + 20;
  const signatureX = pageWidth - margin - 135;
  doc.setDrawColor(...MUTED).setLineWidth(0.6);
  doc.line(signatureX, y + 10, pageWidth - margin, y + 10);
  drawText(doc, 'Authorized Signatory', (signatureX + pageWidth - margin) / 2, y + 25, {
    size: 7.5,
    color: MUTED,
    align: 'center',
  });

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

  doc.save(`${payment.paymentNumber}.pdf`);
}
