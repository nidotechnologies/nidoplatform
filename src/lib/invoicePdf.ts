import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadConfig } from './configService';
import { formatCurrency, getCurrencySymbol } from './formatters';
import { numberToWords } from './quotePdfGenerator';
import type { StoredInvoice } from './invoiceStore';
import { getCommercialTermsLines } from './productCommercialTerms';
import { getDocumentProductPresentation, isDigitalDocumentProduct } from './productDocumentRules';

// ── Colour palette (identical to referenceQuotePdfGenerator) ─────────────────
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
  const config = loadConfig();
  const formatted = formatCurrency(value, config);
  const symbol = getCurrencySymbol(config);
  return formatted.startsWith(symbol)
    ? formatted.slice(symbol.length).trimStart()
    : formatted;
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
 * Draws a rounded card with a title, name, address, and optional extra lines.
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

function drawSummary(
  doc: jsPDF,
  invoice: StoredInvoice,
  x: number,
  y: number,
  width: number,
): number {
  const grossSubtotal = invoice.grossSubtotal ?? invoice.subtotal;
  const totalDiscount = invoice.totalDiscount ?? 0;
  const taxableSubtotal = invoice.subtotal;
  const shipping = invoice.shippingCharges ?? 0;
  const adjustment = invoice.adjustment ?? 0;

  const rates = [...new Set(invoice.lineItems.map((item) => item.taxPercent))]
    .sort((a, b) => a - b)
    .map((rate) => `${rate}%`)
    .join(', ');

  const rows: Array<[string, string, boolean?]> = [
    ['Gross Subtotal', money(grossSubtotal)],
    ['Item Level Discounts (-)', `${adjustment < 0 ? '-' : ''}${money(totalDiscount)}`, true],
    ['Total Taxable Value', money(taxableSubtotal), true],
    [`Total GST${rates ? ` (${rates})` : ''}`, money(invoice.totalTax)],
    ['Shipping & Handling Charges', money(shipping)],
    [`Round Off Adjustment`, `${adjustment < 0 ? '-' : ''}${money(Math.abs(adjustment))}`],
  ];

  const body = [
    ...rows.map(([label, value, bold]) => [label, value, Boolean(bold)]),
    ['Total Payable', money(invoice.grandTotal), true],
  ];

  autoTable(doc, {
    startY: y,
    margin: {
      left: x,
      right: doc.internal.pageSize.getWidth() - x - width,
    },
    tableWidth: width,
    body: body.map(([label, value]) => [label, value]),
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      textColor: TEXT,
      lineColor: BORDER,
      lineWidth: 0.35,
      cellPadding: { top: 5, bottom: 5, left: 10, right: 10 },
      minCellHeight: 20,
      valign: 'middle',
      overflow: 'linebreak',
    },
    columnStyles: {
      0: { cellWidth: 155, halign: 'left' },
      1: { cellWidth: 100, halign: 'right' },
    },
    didParseCell(data) {
      if (data.section !== 'body') return;
      const isTotal = data.row.index === body.length - 1;
      const isEmphasized = isTotal || data.row.index === 1 || data.row.index === 2;
      if (isEmphasized) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = DARK;
      }
      if (isTotal) {
        data.cell.styles.fillColor = LIGHT_BLUE;
      }
    },
  });

  return ((doc as any).lastAutoTable?.finalY ?? y) - y;
}

// ── Main generator ─────────────────────────────────────────────────────────────
export async function generateInvoicePdfBase64(invoice: StoredInvoice): Promise<string> {
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

  // ── INVOICE label + number box (right) ────────────────────────────────────
  drawText(
    doc,
    invoice.status === 'Proforma Invoice' ? 'PROFORMA INVOICE' : 'INVOICE',
    pageWidth - margin,
    48,
    { size: invoice.status === 'Proforma Invoice' ? 17 : 22, color: DARK, bold: true, align: 'right' },
  );

  // Keep the complete number together in the box. Proforma numbers are longer
  // (`#PRO INV - 2026000001`) than regular invoice numbers, so a fixed-width
  // box can clip or push the number outside its border.
  const visibleInvoiceNumber = `#${invoice.invoiceNumber.replace(/^#\s*/, '')}`;
  doc.setFont('helvetica', 'bold').setFontSize(10);
  const numberWidth = doc.getTextWidth(visibleInvoiceNumber);
  const numberBoxWidth = Math.max(102, numberWidth + 20);
  const numberBoxRight = pageWidth - margin;
  doc.setDrawColor(...BORDER).setLineWidth(0.6);
  doc.roundedRect(numberBoxRight - numberBoxWidth, 61, numberBoxWidth, 28, 4, 4, 'S');
  drawText(doc, visibleInvoiceNumber, numberBoxRight - 10, 79, { size: 10, color: DARK, bold: true, align: 'right' });

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

  // ── Dates + PO Reference + Place of Supply (right) ───────────────────────
  let dateY = 112;
  drawText(doc, `Invoice Date: ${fmtDate(invoice.invoiceDate)}`, pageWidth - margin, dateY, { size: 8, color: TEXT, align: 'right' });
  dateY += 14;
  drawText(doc, `Due Date: ${fmtDate(invoice.dueDate)}`, pageWidth - margin, dateY, { size: 8, color: TEXT, align: 'right' });
  if (invoice.poReference) {
    dateY += 14;
    drawText(doc, `PO Reference: ${invoice.poReference}`, pageWidth - margin, dateY, { size: 8, color: TEXT, align: 'right' });
  }
  if (invoice.placeOfSupply) {
    dateY += 14;
    drawText(doc, `Place of Supply: ${invoice.placeOfSupply}`, pageWidth - margin, dateY, { size: 8, color: TEXT, align: 'right' });
  }

  // ── Bill To / Ship To cards ───────────────────────────────────────────────
  let y = Math.max(companyY + 12, 164);
  const cardGap = 12;
  const cardWidth = (contentWidth - cardGap) / 2;

  const billToExtras: string[] = [];
  if (invoice.clientGstin) billToExtras.push(`GSTIN: ${invoice.clientGstin}`);
  if (invoice.clientContact) billToExtras.push(`Contact: ${invoice.clientContact}`);

  const shipToExtras: string[] = [];
  if (invoice.shippingStateCode) shipToExtras.push(`State Code: ${invoice.shippingStateCode}`);
  if (invoice.shippingAttn) shipToExtras.push(`Attn: ${invoice.shippingAttn}`);

  const cardHeight = Math.max(
    drawCard(doc, margin, y, cardWidth, 'Billed To', invoice.clientName, invoice.billingAddress, billToExtras),
    drawCard(doc, margin + cardWidth + cardGap, y, cardWidth, 'Shipped To', invoice.clientName, invoice.shippingAddress || invoice.billingAddress, shipToExtras),
  );
  y += cardHeight + 16;

  // ── Line items tables ─────────────────────────────────────────────────────
  // Physical rows retain the established financial-document layout. Digital
  // rows use the same commercial terminology as Vendor Products and do not
  // expose the physical unit-rate column.
  const physicalItems = invoice.lineItems
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !isDigitalDocumentProduct(item));
  const digitalItems = invoice.lineItems
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => isDigitalDocumentProduct(item));

  const renderLineTable = (
    rows: { item: StoredInvoice['lineItems'][number]; index: number }[],
    digital: boolean,
    startY: number,
  ) => {
    const body = rows.map(({ item, index }) => {
      const disc = item.discount ?? 0;
      const taxable = Math.max(0, item.quantity * item.rate - disc);
      const gst = taxable * (item.taxPercent / 100);
      const taxRateLabel = item.taxType ? `${item.taxPercent}%\n${item.taxType}` : `${item.taxPercent}%`;
      const description =
        (item.subOrderId ? `Sub Order ID: ${item.subOrderId}\n` : '') +
        item.description + (item.itemDetails ? `\n${item.itemDetails}` : '') +
        (item.commercialTerms ? `\n${getCommercialTermsLines(item.commercialTerms).join('\n')}` : '');

      if (!digital) {
        return [
          String(index + 1), description, item.hsnSac || '', String(item.quantity),
          fmt2(item.rate), fmt2(disc), fmt2(taxable), taxRateLabel, fmt2(gst), fmt2(taxable + gst),
        ];
      }

      const presentation = getDocumentProductPresentation(item, { quantity: item.quantity });
      return [
        String(index + 1), description, item.hsnSac || '', String(item.quantity),
        presentation.tenureBilling, presentation.provisioningTime, fmt2(taxable),
        taxRateLabel, fmt2(gst), fmt2(taxable + gst),
      ];
    });

    autoTable(doc, {
      startY,
      margin: { left: margin, right: margin },
      head: [digital
        ? ['#', 'ITEM / DESCRIPTION', 'HSN/SAC', 'USERS / LICENSES', 'TENURE / BILLING', 'PROVISIONING TIME', 'TAXABLE', 'GST RATE', 'GST', 'AMOUNT']
        : ['#', 'ITEM / DESCRIPTION', 'HSN/SAC', 'QTY', 'RATE', 'DISC', 'TAXABLE', 'GST RATE', 'GST', 'AMOUNT']],
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
            0: { cellWidth: 20, halign: 'center' }, 1: { cellWidth: 98 },
            2: { cellWidth: 38, halign: 'center' }, 3: { cellWidth: 42, halign: 'center' },
            4: { cellWidth: 52, halign: 'center' }, 5: { cellWidth: 48, halign: 'center' },
            6: { cellWidth: 52, halign: 'right' }, 7: { cellWidth: 38, halign: 'center' },
            8: { cellWidth: 48, halign: 'right' }, 9: { cellWidth: 62, halign: 'right' },
          }
        : {
            0: { cellWidth: 20, halign: 'center' }, 1: { cellWidth: 105 },
            2: { cellWidth: 42, halign: 'center' }, 3: { cellWidth: 24, halign: 'center' },
            4: { cellWidth: 55, halign: 'right' }, 5: { cellWidth: 47, halign: 'right' },
            6: { cellWidth: 58, halign: 'right' }, 7: { cellWidth: 40, halign: 'center' },
            8: { cellWidth: 52, halign: 'right' }, 9: { cellWidth: 68, halign: 'right' },
          },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = DARK;
        }
        if (data.section === 'body' && data.column.index === (digital ? 9 : 9)) {
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });
    return (doc as any).lastAutoTable?.finalY ?? startY;
  };

  let lastTableY = y;
  if (physicalItems.length > 0) {
    lastTableY = renderLineTable(physicalItems, false, lastTableY);
  }
  if (digitalItems.length > 0) {
    lastTableY = renderLineTable(digitalItems, true, lastTableY + (physicalItems.length > 0 ? 10 : 0));
  }

  // ── Summary box (right) + Left text blocks ────────────────────────────────
  y = lastTableY + 15;
  const summaryWidth = 255;
  const summaryX = pageWidth - margin - summaryWidth;
  const summaryHeight = drawSummary(doc, invoice, summaryX, y, summaryWidth);

  // Left side: Terms & Conditions then Bank Remittance
  let leftY = y + 2;
  const leftWidth = summaryX - margin - 14;

  if (invoice.termsConditions) {
    drawText(doc, 'TERMS & CONDITIONS', margin, leftY + 9, { size: 8, color: BLUE, bold: true });
    leftY += 23;
    invoice.termsConditions.split('\n').filter(Boolean).forEach((term, index) => {
      const wrapped = doc.splitTextToSize(`${index + 1}. ${term}`, leftWidth);
      drawText(doc, wrapped.join('\n'), margin, leftY, { size: 7.5, color: TEXT });
      leftY += wrapped.length * 11 + 4;
    });
    leftY += 6;
  }

  const hasBankDetails = invoice.bankName || invoice.bankAccountName || invoice.bankAccountNo;
  if (hasBankDetails) {
    if (invoice.termsConditions) {
      doc.setDrawColor(...BORDER).setLineWidth(0.4);
      doc.line(margin, leftY, summaryX - 14, leftY);
      leftY += 14;
    }
    drawText(doc, 'BANK REMITTANCE DETAILS', margin, leftY, { size: 8, color: BLUE, bold: true });
    leftY += 14;
    if (invoice.bankName) {
      drawText(doc, `Bank Name: ${invoice.bankName}`, margin, leftY, { size: 7.5, color: TEXT });
      leftY += 12;
    }
    if (invoice.bankAccountName) {
      drawText(doc, `Account Name: ${invoice.bankAccountName}`, margin, leftY, { size: 7.5, color: TEXT });
      leftY += 12;
    }
    if (invoice.bankAccountNo || invoice.bankIfsc) {
      const parts = [
        invoice.bankAccountNo && `Account No: ${invoice.bankAccountNo}`,
        invoice.bankIfsc && `IFSC Code: ${invoice.bankIfsc}`,
      ].filter(Boolean).join(' | ');
      drawText(doc, parts, margin, leftY, { size: 7.5, color: TEXT });
      leftY += 12;
    }
    if (invoice.bankBranch) {
      drawText(doc, `Branch: ${invoice.bankBranch}`, margin, leftY, { size: 7.5, color: TEXT });
      leftY += 12;
    }
  }

  // ── Total in Words + Authorized Signature ────────────────────────────────
  y = Math.max(leftY + 8, y + summaryHeight) + 20;
  drawText(doc, 'TOTAL IN WORDS', margin, y, { size: 8, color: BLUE, bold: true });
  drawText(doc, numberToWords(invoice.grandTotal), margin, y + 15, { size: 8.5, color: DARK, bold: true });

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

export async function downloadInvoicePdf(invoice: StoredInvoice): Promise<void> {
  const dataUri = await generateInvoicePdfBase64(invoice);
  const link = document.createElement('a');
  link.href = dataUri;
  link.download = `${invoice.invoiceNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
