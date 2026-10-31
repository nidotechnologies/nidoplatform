import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadConfig } from './configService';
import { formatCurrency } from './formatters';
import { numberToWords } from './quotePdfGenerator';
import type { PaymentReceipt } from './paymentReceiptStore';
import { isDigitalOnlyType } from './productTypeRules';

// ── Colour palette (identical to invoicePdf) ─────────────────────────────────
const BLUE: [number, number, number] = [31, 95, 190];
const DARK: [number, number, number] = [28, 39, 56];
const TEXT: [number, number, number] = [55, 62, 72];
const MUTED: [number, number, number] = [105, 112, 123];
const BORDER: [number, number, number] = [218, 222, 228];
const LIGHT_BLUE: [number, number, number] = [239, 246, 255];

// ── Helpers (identical to invoicePdf) ────────────────────────────────────────
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

/**
 * Draws a rounded info card — same style as invoicePdf drawCard.
 * Returns the card height so the caller can advance `y`.
 */
function drawCard(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  title: string,
  name: string,
  lines: string[] = [],
): number {
  const cardHeight = Math.max(80, 54 + lines.length * 12);

  doc.setDrawColor(...BORDER).setLineWidth(0.7);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, width, cardHeight, 5, 5, 'FD');

  drawText(doc, title.toUpperCase(), x + 13, y + 19, { size: 8, color: BLUE, bold: true });
  doc.setDrawColor(...BORDER).setLineWidth(0.5);
  doc.line(x + 13, y + 27, x + width - 13, y + 27);

  let cursor = y + 48;
  drawText(doc, name, x + 13, cursor, { size: 9, color: DARK, bold: true });
  cursor += 13;
  lines.forEach((line) => {
    drawText(doc, line, x + 13, cursor, { size: 8.5 });
    cursor += 12;
  });
  return cardHeight;
}

/**
 * Draws the payment summary box (right side) — mirrors invoice drawSummary.
 * Returns the box height.
 */
function drawSummary(
  doc: jsPDF,
  receipt: PaymentReceipt,
  x: number,
  y: number,
  width: number,
): number {
  const amount = receipt.amountReceived;
  const bankCharges = Number(receipt.bankCharges ?? 0);
  const total = amount + bankCharges;

  const rows: Array<[string, string, boolean?]> = [
    ['Amount Received', money(amount)],
    ...(bankCharges > 0 ? [['Bank Charges', money(bankCharges)] as [string, string]] : []),
    ['Tax Deducted', receipt.taxDeducted === 'tds' ? 'TDS (Income Tax)' : 'No Tax Deducted', true],
    ['Payment Mode', receipt.paymentMode || '—'],
    ['Deposit To', receipt.depositTo || '—'],
  ];

  const rowHeight = 20;
  const totalRowHeight = 27;
  const height = rows.length * rowHeight + totalRowHeight;

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
  doc.rect(x + 0.5, totalY, width - 1, totalRowHeight - 0.5, 'F');
  doc.setDrawColor(...BORDER).setLineWidth(0.5);
  doc.line(x, totalY, x + width, totalY);
  drawText(doc, 'Total Received', x + 10, totalY + 17, { size: 8.5, color: DARK, bold: true });
  drawText(doc, money(total), x + width - 10, totalY + 17, {
    size: 8.5,
    color: DARK,
    bold: true,
    align: 'right',
  });
  return height;
}

// ── Main generator ─────────────────────────────────────────────────────────────
export async function generateReceiptPdfBase64(receipt: PaymentReceipt): Promise<string> {
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

  // ── PAYMENT RECEIPT label + number box (right) ────────────────────────────
  drawText(doc, 'PAYMENT RECEIPT', pageWidth - margin, 48, { size: 18, color: DARK, bold: true, align: 'right' });
  doc.setDrawColor(...BORDER).setLineWidth(0.6);
  doc.roundedRect(pageWidth - margin - 122, 61, 122, 28, 4, 4, 'S');
  drawText(doc, '#', pageWidth - margin - 111, 79, { size: 11, color: BLUE });
  drawText(doc, receipt.paymentNumber, pageWidth - margin - 10, 79, { size: 10, color: DARK, bold: true, align: 'right' });

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

  // ── Receipt meta (right) ──────────────────────────────────────────────────
  let dateY = 112;
  drawText(doc, `Payment Date: ${fmtDate(receipt.paymentDate)}`, pageWidth - margin, dateY, { size: 8, color: TEXT, align: 'right' });
  if (receipt.invoiceNumber) {
    dateY += 14;
    drawText(doc, `Invoice Reference: ${receipt.invoiceNumber}`, pageWidth - margin, dateY, { size: 8, color: TEXT, align: 'right' });
  }
  if (receipt.reference) {
    dateY += 14;
    drawText(doc, `Ref / Txn ID: ${receipt.reference}`, pageWidth - margin, dateY, { size: 8, color: TEXT, align: 'right' });
  }
  if (receipt.placeOfSupply) {
    dateY += 14;
    drawText(doc, `Place of Supply: ${receipt.placeOfSupply}`, pageWidth - margin, dateY, { size: 8, color: TEXT, align: 'right' });
  }

  // ── Received From / Payment Details cards ────────────────────────────────
  let y = Math.max(companyY + 12, 164);
  const cardGap = 12;
  const cardWidth = (contentWidth - cardGap) / 2;

  const receivedFromLines: string[] = [];
  if (receipt.placeOfSupply) receivedFromLines.push(`Place of Supply: ${receipt.placeOfSupply}`);
  if (receipt.descriptionOfSupply) receivedFromLines.push(`Description: ${receipt.descriptionOfSupply}`);

  const paymentDetailLines: string[] = [
    `Mode: ${receipt.paymentMode || '—'}`,
    `Deposit To: ${receipt.depositTo || '—'}`,
    receipt.reference ? `Ref / Txn ID: ${receipt.reference}` : '',
    receipt.taxDeducted === 'tds' ? 'Tax Deducted: TDS (Income Tax)' : 'Tax Deducted: None',
    receipt.productType && receipt.productType !== 'Mixed Products' ? `Product Type: ${receipt.productType}` : '',
    receipt.usersLicenses !== undefined ? `Users / Licenses: ${receipt.usersLicenses}` : '',
    receipt.tenureBilling ? `Tenure / Billing: ${receipt.tenureBilling}` : '',
    receipt.provisioningTime ? `Provisioning Time: ${receipt.provisioningTime}` : '',
  ].filter(Boolean);

  const cardHeight = Math.max(
    drawCard(doc, margin, y, cardWidth, 'Received From', receipt.customerName, receivedFromLines),
    drawCard(doc, margin + cardWidth + cardGap, y, cardWidth, 'Payment Details', receipt.paymentNumber, paymentDetailLines),
  );
  y += cardHeight + 16;

  // ── Receipt details table ─────────────────────────────────────────────────
  const bankCharges = Number(receipt.bankCharges ?? 0);
  const isDigitalReceipt = isDigitalOnlyType(receipt.productType || '');
  const tableBody: string[][] = [
    isDigitalReceipt
      ? [
          '1',
          receipt.descriptionOfSupply || 'Payment received against invoice',
          receipt.invoiceNumber || '—',
          String(receipt.usersLicenses ?? '—'),
          receipt.tenureBilling || '—',
          receipt.provisioningTime || '—',
          money(receipt.amountReceived),
        ]
      : [
          '1',
          receipt.descriptionOfSupply || 'Payment received against invoice',
          receipt.invoiceNumber || '—',
          receipt.paymentMode,
          receipt.taxDeducted === 'tds' ? 'TDS (Income Tax)' : 'No Tax',
          money(receipt.amountReceived),
        ],
  ];
  if (bankCharges > 0) {
    tableBody.push(isDigitalReceipt
      ? ['2', 'Bank Charges', '—', '—', '—', '—', money(bankCharges)]
      : ['2', 'Bank Charges', '—', '—', '—', money(bankCharges)]);
  }

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [isDigitalReceipt
      ? ['#', 'DESCRIPTION', 'INVOICE REF', 'USERS / LICENSES', 'TENURE / BILLING', 'PROVISIONING TIME', 'AMOUNT']
      : ['#', 'DESCRIPTION', 'INVOICE REF', 'PAYMENT MODE', 'TAX', 'AMOUNT']],
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
      1: { cellWidth: 148 },
      2: { cellWidth: 78, halign: 'center' },
      3: { cellWidth: 80, halign: 'center' },
      4: { cellWidth: 70, halign: 'center' },
      5: { cellWidth: 80, halign: 'right' },
    },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = DARK;
      }
      if (data.section === 'body' && data.column.index === 5) {
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  const physicalProducts = (receipt.productDetails || []).filter((item) => !item.digital);
  const digitalProducts = (receipt.productDetails || []).filter((item) => item.digital);
  if (physicalProducts.length > 0 && digitalProducts.length > 0) {
    let productsY = ((doc as any).lastAutoTable?.finalY ?? y) + 10;
    const productTableStyles = {
      theme: 'grid' as const,
      tableWidth: contentWidth,
      styles: {
        font: 'helvetica',
        fontSize: 7.5,
        textColor: TEXT,
        lineColor: BORDER,
        lineWidth: 0.35,
        cellPadding: { top: 6, bottom: 6, left: 4, right: 4 },
        valign: 'middle' as const,
      },
      headStyles: {
        fillColor: [248, 250, 252] as [number, number, number],
        textColor: DARK,
        fontStyle: 'bold' as const,
        fontSize: 6.3,
        halign: 'center' as const,
      },
    };

    drawText(doc, 'PHYSICAL PRODUCTS', margin, productsY + 8, { size: 8, color: BLUE, bold: true });
    productsY += 13;
    autoTable(doc, {
      ...productTableStyles,
      startY: productsY,
      margin: { left: margin, right: margin },
      head: [['#', 'ITEM / DESCRIPTION', 'QTY', 'RATE', 'INVOICE VALUE']],
      body: physicalProducts.map((item, index) => [
        String(index + 1), item.description, String(item.quantity), money(item.unitPrice), money(item.invoiceValue),
      ]),
      columnStyles: {
        0: { cellWidth: 20, halign: 'center' },
        1: { cellWidth: 235 },
        2: { cellWidth: 55, halign: 'center' },
        3: { cellWidth: 75, halign: 'right' },
        4: { cellWidth: 90, halign: 'right' },
      },
    });

    productsY = ((doc as any).lastAutoTable?.finalY ?? productsY) + 10;
    drawText(doc, 'DIGITAL PRODUCTS', margin, productsY + 8, { size: 8, color: BLUE, bold: true });
    productsY += 13;
    autoTable(doc, {
      ...productTableStyles,
      startY: productsY,
      margin: { left: margin, right: margin },
      head: [['#', 'ITEM / DESCRIPTION', 'USERS / LICENSES', 'TENURE / BILLING', 'PROVISIONING TIME', 'INVOICE VALUE']],
      body: digitalProducts.map((item, index) => [
        String(index + 1), item.description, String(item.quantity), item.tenureBilling || '—',
        item.provisioningTime || '—', money(item.invoiceValue),
      ]),
      columnStyles: {
        0: { cellWidth: 20, halign: 'center' },
        1: { cellWidth: 130 },
        2: { cellWidth: 70, halign: 'center' },
        3: { cellWidth: 78, halign: 'center' },
        4: { cellWidth: 88, halign: 'center' },
        5: { cellWidth: 88, halign: 'right' },
      },
    });
  }

  // ── Summary box (right) + Notes (left) ───────────────────────────────────
  y = ((doc as any).lastAutoTable?.finalY ?? y) + 15;
  const summaryWidth = 255;
  const summaryX = pageWidth - margin - summaryWidth;
  const summaryHeight = drawSummary(doc, receipt, summaryX, y, summaryWidth);

  // Left side: notes / terms
  let leftY = y + 2;
  const leftWidth = summaryX - margin - 14;

  if (receipt.note) {
    drawText(doc, 'NOTES', margin, leftY + 9, { size: 8, color: BLUE, bold: true });
    leftY += 23;
    const wrapped = doc.splitTextToSize(receipt.note, leftWidth);
    drawText(doc, wrapped.join('\n'), margin, leftY, { size: 7.5, color: TEXT });
    leftY += wrapped.length * 11 + 10;
  }

  // ── Total in Words + Authorized Signature ─────────────────────────────────
  y = Math.max(leftY + 8, y + summaryHeight) + 20;
  drawText(doc, 'TOTAL IN WORDS', margin, y, { size: 8, color: BLUE, bold: true });
  const totalAmount = receipt.amountReceived + Number(receipt.bankCharges ?? 0);
  drawText(doc, numberToWords(totalAmount), margin, y + 15, { size: 8.5, color: DARK, bold: true });

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

  return doc.output('datauristring');
}

export async function downloadReceiptPdf(receipt: PaymentReceipt, filename?: string): Promise<void> {
  const dataUri = await generateReceiptPdfBase64(receipt);
  const link = document.createElement('a');
  link.href = dataUri;
  link.download = filename ?? `${receipt.paymentNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
