import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadConfig } from './configService';
import { formatCurrency, getCurrencySymbol } from './formatters';
import { numberToWords } from './quotePdfGenerator';
import { getDocumentProductPresentation, isDigitalDocumentProduct } from './productDocumentRules';

// ── Colour palette (identical to invoicePdf) ──────────────────────────────────
const BLUE: [number, number, number] = [31, 95, 190];
const DARK: [number, number, number] = [28, 39, 56];
const TEXT: [number, number, number] = [55, 62, 72];
const MUTED: [number, number, number] = [105, 112, 123];
const BORDER: [number, number, number] = [218, 222, 228];
const LIGHT_BLUE: [number, number, number] = [239, 246, 255];

// ── Types ─────────────────────────────────────────────────────────────────────
export interface BillForPdf {
  billNumber: string;
  orderNumber?: string;
  referenceNumber?: string;
  vendorName: string;
  vendorAddress: string;
  billDate: string;
  dueDate: string;
  paymentTerms: string;
  notes?: string;
  paymentMade: number;
  adjustment: number;
  items: {
    id: string;
    itemDetails: string;
    account: string;
    quantity: number;
    rate: number;
    discount: number;
    taxPercent: number;
    productType?: string;
    physicalType?: string;
    fulfillmentType?: string;
    commercialTerms?: {
      productType?: string;
      pricingModel?: string;
      leadTimePrimary?: string;
      leadTimeSecondary?: string;
    };
  }[];
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

function getBillTotals(bill: BillForPdf) {
  const subtotal = bill.items.reduce((sum, item) => {
    const base = item.quantity * item.rate;
    const discountAmount = (base * item.discount) / 100;
    return sum + (base - discountAmount);
  }, 0);
  const tax = bill.items.reduce((sum, item) => {
    const base = item.quantity * item.rate;
    const discountAmount = (base * item.discount) / 100;
    const taxable = base - discountAmount;
    return sum + (taxable * item.taxPercent) / 100;
  }, 0);
  const total = subtotal + tax + bill.adjustment;
  return { subtotal, tax, cgst: tax / 2, sgst: tax / 2, total };
}

// ── Main generator ─────────────────────────────────────────────────────────────
export async function generateBillPdf(bill: BillForPdf): Promise<void> {
  const org = loadConfig().organization;
  const brandHeader = getBrandHeader(org.displayName, org.industry);
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 42;
  const contentWidth = pageWidth - margin * 2;
  const totals = getBillTotals(bill);
  const balanceDue = Math.max(totals.total - bill.paymentMade, 0);

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

  // ── BILL label + number box (right) ────────────────────────────────────
  drawText(doc, 'BILL', pageWidth - margin, 48, { size: 22, color: DARK, bold: true, align: 'right' });
  doc.setDrawColor(...BORDER).setLineWidth(0.6);
  doc.roundedRect(pageWidth - margin - 102, 61, 102, 28, 4, 4, 'S');
  drawText(doc, '#', pageWidth - margin - 91, 79, { size: 11, color: BLUE });
  drawText(doc, bill.billNumber, pageWidth - margin - 10, 79, { size: 10, color: DARK, bold: true, align: 'right' });

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

  // ── Dates + References (right) ────────────────────────────────────────
  let dateY = 112;
  drawText(doc, `Bill Date: ${bill.billDate}`, pageWidth - margin, dateY, { size: 8, color: TEXT, align: 'right' });
  dateY += 14;
  drawText(doc, `Due Date: ${bill.dueDate}`, pageWidth - margin, dateY, { size: 8, color: TEXT, align: 'right' });
  dateY += 14;
  drawText(doc, `Payment Terms: ${bill.paymentTerms}`, pageWidth - margin, dateY, { size: 8, color: TEXT, align: 'right' });
  if (bill.orderNumber) {
    dateY += 14;
    drawText(doc, `Order #: ${bill.orderNumber}`, pageWidth - margin, dateY, { size: 8, color: TEXT, align: 'right' });
  }
  if (bill.referenceNumber) {
    dateY += 14;
    drawText(doc, `Reference #: ${bill.referenceNumber}`, pageWidth - margin, dateY, { size: 8, color: TEXT, align: 'right' });
  }

  // ── Balance Due highlight box ────────────────────────────────────────────
  const balanceBoxY = dateY + 18;
  doc.setFillColor(...LIGHT_BLUE);
  doc.roundedRect(pageWidth - margin - 140, balanceBoxY, 140, 32, 4, 4, 'F');
  drawText(doc, 'Balance Due', pageWidth - margin - 10, balanceBoxY + 11, { size: 7, color: MUTED, align: 'right' });
  drawText(doc, money(balanceDue), pageWidth - margin - 10, balanceBoxY + 25, { size: 11, color: DARK, bold: true, align: 'right' });

  // ── Bill From card ─────────────────────────────────────────────────────────
  let y = Math.max(companyY + 12, 164);
  const cardGap = 12;
  const cardWidth = (contentWidth - cardGap) / 2;

  // Bill From card (left)
  const addressLines = splitLines(bill.vendorAddress);
  const cardHeight = Math.max(92, 54 + addressLines.length * 12);

  doc.setDrawColor(...BORDER).setLineWidth(0.7);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, y, cardWidth, cardHeight, 5, 5, 'FD');
  drawText(doc, 'BILL FROM', margin + 13, y + 19, { size: 8, color: BLUE, bold: true });
  doc.setDrawColor(...BORDER).setLineWidth(0.5);
  doc.line(margin + 13, y + 27, margin + cardWidth - 13, y + 27);
  let cursor = y + 48;
  drawText(doc, bill.vendorName, margin + 13, cursor, { size: 9, color: DARK, bold: true });
  cursor += 13;
  addressLines.forEach((line) => {
    drawText(doc, line, margin + 13, cursor, { size: 8.5 });
    cursor += 12;
  });

  // Summary mini-card (right)
  const summaryCardX = margin + cardWidth + cardGap;
  doc.setDrawColor(...BORDER).setLineWidth(0.7);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(summaryCardX, y, cardWidth, cardHeight, 5, 5, 'FD');
  drawText(doc, 'PAYMENT SUMMARY', summaryCardX + 13, y + 19, { size: 8, color: BLUE, bold: true });
  doc.setDrawColor(...BORDER).setLineWidth(0.5);
  doc.line(summaryCardX + 13, y + 27, summaryCardX + cardWidth - 13, y + 27);
  const summaryRows: [string, string][] = [
    ['Sub Total', money(totals.subtotal)],
    ['SGST (9%)', money(totals.sgst)],
    ['CGST (9%)', money(totals.cgst)],
    bill.adjustment !== 0 ? ['Adjustment', `${bill.adjustment < 0 ? '-' : ''}${money(Math.abs(bill.adjustment))}`] : ['', ''],
    ['Payment Made (-)', money(bill.paymentMade)],
    ['Balance Due', money(balanceDue)],
  ].filter(([l]) => l);
  let summaryRowY = y + 42;
  summaryRows.forEach(([label, value], idx) => {
    const isLast = idx === summaryRows.length - 1;
    drawText(doc, label, summaryCardX + 13, summaryRowY, { size: 7.7, color: isLast ? DARK : TEXT, bold: isLast });
    drawText(doc, value, summaryCardX + cardWidth - 13, summaryRowY, { size: 7.7, color: DARK, bold: isLast, align: 'right' });
    summaryRowY += 12;
  });

  y += cardHeight + 16;

  // ── Line items tables ─────────────────────────────────────────────────────
  const physicalItems = bill.items.filter((item) => !isDigitalDocumentProduct(item));
  const digitalItems = bill.items.filter((item) => isDigitalDocumentProduct(item));
  const renderItemsTable = (items: typeof bill.items, digital: boolean, startY: number) => {
    const tableBody = items.map((item, index) => {
      const base = item.quantity * item.rate;
      const discountAmount = (base * item.discount) / 100;
      const taxable = base - discountAmount;
      const gst = (taxable * item.taxPercent) / 100;
      if (!digital) {
        return [
          String(index + 1), item.itemDetails || '—', item.account || '—',
          item.quantity.toFixed(2), fmt2(item.rate),
          item.discount > 0 ? `${item.discount}%` : '—',
          fmt2(taxable), `${item.taxPercent}%`, fmt2(gst), fmt2(taxable + gst),
        ];
      }
      const presentation = getDocumentProductPresentation(item, { quantity: item.quantity });
      return [
        String(index + 1), item.itemDetails || '—', item.account || '—',
        item.quantity.toFixed(2), presentation.tenureBilling, presentation.provisioningTime,
        fmt2(taxable), `${item.taxPercent}%`, fmt2(gst), fmt2(taxable + gst),
      ];
    });

    autoTable(doc, {
      startY,
      margin: { left: margin, right: margin },
      head: [digital
        ? ['#', 'ITEM / DESCRIPTION', 'ACCOUNT', 'USERS / LICENSES', 'TENURE / BILLING', 'PROVISIONING TIME', 'TAXABLE', 'GST RATE', 'GST', 'AMOUNT']
        : ['#', 'ITEM / DESCRIPTION', 'ACCOUNT', 'QTY', 'RATE', 'DISC', 'TAXABLE', 'GST RATE', 'GST', 'AMOUNT']],
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
      columnStyles: digital
        ? {
            0: { cellWidth: 20, halign: 'center' }, 1: { cellWidth: 104 },
            2: { cellWidth: 58 }, 3: { cellWidth: 42, halign: 'center' },
            4: { cellWidth: 56, halign: 'center' }, 5: { cellWidth: 45, halign: 'center' },
            6: { cellWidth: 48, halign: 'right' }, 7: { cellWidth: 36, halign: 'center' },
            8: { cellWidth: 45, halign: 'right' }, 9: { cellWidth: 58, halign: 'right' },
          }
        : {
            0: { cellWidth: 20, halign: 'center' }, 1: { cellWidth: 110 },
            2: { cellWidth: 65 }, 3: { cellWidth: 28, halign: 'center' },
            4: { cellWidth: 50, halign: 'right' }, 5: { cellWidth: 35, halign: 'center' },
            6: { cellWidth: 55, halign: 'right' }, 7: { cellWidth: 38, halign: 'center' },
            8: { cellWidth: 48, halign: 'right' }, 9: { cellWidth: 62, halign: 'right' },
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
    return (doc as any).lastAutoTable?.finalY ?? startY;
  };

  let lastTableY = y;
  if (physicalItems.length > 0) lastTableY = renderItemsTable(physicalItems, false, lastTableY);
  if (digitalItems.length > 0) lastTableY = renderItemsTable(digitalItems, true, lastTableY + (physicalItems.length > 0 ? 10 : 0));

  // ── Final summary (right-aligned) ─────────────────────────────────────────
  y = lastTableY + 15;
  const boxWidth = 220;
  const boxX = pageWidth - margin - boxWidth;
  const finalRows: [string, string, boolean?][] = [
    ['Sub Total', money(totals.subtotal)],
    ['SGST (9%)', money(totals.sgst)],
    ['CGST (9%)', money(totals.cgst)],
    ...(bill.adjustment !== 0 ? [['Adjustment', `${bill.adjustment < 0 ? '-' : ''}${money(Math.abs(bill.adjustment))}`] as [string, string]] : []),
    ['Payment Made (-)', money(bill.paymentMade), false],
    ['Balance Due', money(balanceDue), true],
  ];
  const rowH = 19;
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
  if (bill.notes) {
    let leftY = y + 2;
    const leftWidth = boxX - margin - 14;
    drawText(doc, 'NOTES', margin, leftY + 9, { size: 8, color: BLUE, bold: true });
    leftY += 23;
    const wrapped = doc.splitTextToSize(bill.notes, leftWidth);
    drawText(doc, wrapped.join('\n'), margin, leftY, { size: 7.5, color: TEXT });
  }

  // ── Total in Words + Authorized Signature ────────────────────────────────
  y = y + totalH + 20;
  drawText(doc, 'TOTAL IN WORDS', margin, y, { size: 8, color: BLUE, bold: true });
  drawText(doc, numberToWords(totals.total), margin, y + 15, { size: 8.5, color: DARK, bold: true });

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

  doc.save(`Bill-${bill.billNumber}.pdf`);
}
