import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadConfig } from './configService';
import { formatCurrency, getCurrencySymbol } from './formatters';
import { numberToWords } from './quotePdfGenerator';
import type { StoredQuote } from './quoteStore';
import { getCommercialTermsLines } from './productCommercialTerms';
import { DIGITAL_PRODUCT_HEADERS, getDocumentProductPresentation, isDigitalDocumentProduct } from './productDocumentRules';

export interface ReferenceDocumentOptions {
  title?: string;
  firstDateLabel?: string;
  secondDateLabel?: string;
  includeShippingGst?: boolean;
}

const BLUE: [number, number, number] = [31, 95, 190];
const DARK: [number, number, number] = [28, 39, 56];
const TEXT: [number, number, number] = [55, 62, 72];
const MUTED: [number, number, number] = [105, 112, 123];
const BORDER: [number, number, number] = [218, 222, 228];
const LIGHT_BLUE: [number, number, number] = [239, 246, 255];

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

function lines(value: string | undefined): string[] {
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

function drawCard(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  title: string,
  name: string,
  address: string,
  gstin?: string,
): number {
  const addressLines = lines(address);
  const cardHeight = Math.max(92, 54 + addressLines.length * 12 + (gstin ? 12 : 0));

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
  if (gstin) drawText(doc, `GSTIN: ${gstin}`, x + 13, cursor, { size: 8.5 });
  return cardHeight;
}

function drawSummary(
  doc: jsPDF,
  quote: StoredQuote,
  x: number,
  y: number,
  width: number,
  options: { includeShippingGst?: boolean } = {},
): number {
  const shipping = quote.shippingCharges ?? 0;
  const includeShippingGst = options.includeShippingGst ?? false;
  const shippingGst = includeShippingGst ? shipping * 0.18 : 0;
  const grossSubtotal = quote.lineItems.reduce((sum, item) => sum + item.qty * item.rate, 0);
  const discount = quote.lineItems.reduce((sum, item) => sum + item.discount, 0);
  const taxable = quote.lineItems.reduce(
    (sum, item) => sum + Math.max(0, item.qty * item.rate - item.discount),
    0,
  );
  const rates = [...new Set(quote.lineItems.map((item) => item.taxPercent))]
    .sort((a, b) => a - b)
    .map((rate) => `${rate}%`)
    .join(', ');

  const rows: Array<[string, string]> = [
    ['Gross Subtotal', money(grossSubtotal)],
    ['Item Level Discounts (-)', `${getCurrencySymbol(loadConfig())} - ${fmt2(discount)}`],
    ['Total Taxable Value', money(taxable)],
    [`Total GST${rates ? ` (${rates})` : ''}`, money(quote.totalTax)],
    ['Shipping & Handling Charges', money(shipping)],
    ...(includeShippingGst ? [['GST on Shipping (18%)', money(shippingGst)] as [string, string]] : []),
    ['Round Off Adjustment', `${quote.adjustment < 0 ? '-' : ''}${money(Math.abs(quote.adjustment))}`],
  ];

  const rowHeight = 20;
  const totalHeight = 27;
  const height = rows.length * rowHeight + totalHeight;

  doc.setDrawColor(...BORDER).setLineWidth(0.6);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, width, height, 5, 5, 'FD');

  rows.forEach(([label, value], index) => {
    const rowY = y + index * rowHeight;
    if (index > 0) {
      doc.setDrawColor(...BORDER).setLineWidth(0.3);
      doc.line(x, rowY, x + width, rowY);
    }
    drawText(doc, label, x + 10, rowY + 13, { size: 7.7, color: index === 1 || index === 2 ? DARK : TEXT, bold: index === 1 || index === 2 });
    drawText(doc, value, x + width - 10, rowY + 13, { size: 7.7, color: DARK, align: 'right' });
  });

  const totalY = y + rows.length * rowHeight;
  doc.setFillColor(...LIGHT_BLUE);
  doc.rect(x + 0.5, totalY, width - 1, totalHeight - 0.5, 'F');
  doc.setDrawColor(...BORDER).setLineWidth(0.5);
  doc.line(x, totalY, x + width, totalY);
  drawText(doc, 'Total Payable', x + 10, totalY + 17, { size: 8.5, color: DARK, bold: true });
   drawText(doc, money(quote.grandTotal), x + width - 10, totalY + 17, {
    size: 8.5,
    color: DARK,
    bold: true,
    align: 'right',
  });
  return height;
}

export async function generateReferenceQuotePdfBase64(
  quote: StoredQuote,
  options: ReferenceDocumentOptions = {},
): Promise<string> {
  const org = loadConfig().organization;
  const brandHeader = getBrandHeader(org.displayName, org.industry);
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 42;
  const contentWidth = pageWidth - margin * 2;

  // Header: keep the reference estimate's left brand block and right estimate block.
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

  drawText(doc, options.title || 'ESTIMATE', pageWidth - margin, 48, { size: 22, color: DARK, bold: true, align: 'right' });
  doc.setDrawColor(...BORDER).setLineWidth(0.6);
  doc.roundedRect(pageWidth - margin - 102, 61, 102, 28, 4, 4, 'S');
   drawText(doc, '#', pageWidth - margin - 91, 79, { size: 11, color: BLUE });
  drawText(doc, quote.quoteNumber, pageWidth - margin - 10, 79, { size: 10, color: DARK, bold: true, align: 'right' });

  const companyLines = [
    org.companyName || org.displayName,
    ...lines(org.registeredAddress || org.billingAddress),
    [org.phone && `Phone: ${org.phone}`, org.email && `Email: ${org.email}`].filter(Boolean).join(' | '),
    org.gstNumber ? `GSTIN: ${org.gstNumber}` : '',
  ].filter(Boolean);
  let companyY = 102;
  companyLines.forEach((line, index) => {
    drawText(doc, line, margin + 8, companyY, { size: index === 0 ? 8.5 : 7.5, color: index === 0 ? DARK : TEXT, bold: index === 0 });
    companyY += 11;
  });

  drawText(doc, `${options.firstDateLabel || 'Estimate Date'}: ${fmtDate(quote.quoteDate)}`, pageWidth - margin, 112, { size: 8, color: TEXT, align: 'right' });
  drawText(doc, `${options.secondDateLabel || 'Valid Till'}: ${fmtDate(quote.validTill)}`, pageWidth - margin, 126, { size: 8, color: TEXT, align: 'right' });
  if (quote.placeOfSupply) {
    drawText(doc, `Place of Supply: ${quote.placeOfSupply}`, pageWidth - margin, 140, { size: 8, color: TEXT, align: 'right' });
  }

  let y = Math.max(companyY + 12, 158);
  const cardGap = 12;
  const cardWidth = (contentWidth - cardGap) / 2;
  const cardHeight = Math.max(
    drawCard(doc, margin, y, cardWidth, 'Bill To', quote.clientName, quote.billingAddress, quote.clientGstin),
    drawCard(doc, margin + cardWidth + cardGap, y, cardWidth, 'Ship To', quote.clientName, quote.shippingAddress || quote.billingAddress),
  );
  y += cardHeight + 16;

  const isDigitalQuote = quote.lineItems.length > 0 && quote.lineItems.every((item) => isDigitalDocumentProduct(item));
  const tableBody = quote.lineItems.map((item, index) => {
    const taxable = Math.max(0, item.qty * item.rate - item.discount);
    const gst = taxable * (item.taxPercent / 100);
    if (isDigitalQuote) {
      const presentation = getDocumentProductPresentation(item, { quantity: item.qty });
      return [
        String(index + 1),
        item.name,
        (item.description || '') +
          (item.commercialTerms ? `\nPricing Model: ${presentation.pricingModel}\n${DIGITAL_PRODUCT_HEADERS.tenure}: ${presentation.tenureBilling}\n${DIGITAL_PRODUCT_HEADERS.provisioning}: ${presentation.provisioningTime}` : ''),
        item.hsnSac || '',
        String(item.qty),
        presentation.tenureBilling,
        fmt2(taxable),
        `${item.taxPercent}%`,
        fmt2(gst),
        fmt2(taxable + gst),
      ];
    }
    return [
      String(index + 1),
      item.name,
      (item.description || '') +
        (item.commercialTerms ? `\n${getCommercialTermsLines(item.commercialTerms).join('\n')}` : ''),
      item.hsnSac || '',
      String(item.qty),
      fmt2(item.rate),
      fmt2(item.discount),
      fmt2(taxable),
      `${item.taxPercent}%`,
      fmt2(gst),
      fmt2(taxable + gst),
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [[
      'SL.NO',
      'ITEM / DESCRIPTION',
      'HSN/SAC',
      ...(isDigitalQuote
        ? ['USERS / LICENSES', 'TENURE / BILLING']
        : ['QTY', `RATE (${getCurrencySymbol(loadConfig())})`, `DISC (${getCurrencySymbol(loadConfig())})`]),
      `TAXABLE (${getCurrencySymbol(loadConfig())})`,
      'GST RATE',
      `GST (${getCurrencySymbol(loadConfig())})`,
      `AMOUNT (${getCurrencySymbol(loadConfig())})`,
    ]],
    body: tableBody.map((row) => isDigitalQuote
      ? [row[0], `${row[1]}${row[2] ? `\n${row[2]}` : ''}`, row[3], row[4], row[5], row[6], row[7], row[8], row[9]]
      : [row[0], `${row[1]}${row[2] ? `\n${row[2]}` : ''}`, row[3], row[4], row[5], row[6], row[7], row[8], row[9], row[10]]),
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
    columnStyles: isDigitalQuote
      ? {
          0: { cellWidth: 28, halign: 'center' }, 1: { cellWidth: 110, fontStyle: 'bold' },
          2: { cellWidth: 40, halign: 'center' }, 3: { cellWidth: 27, halign: 'center' },
          4: { cellWidth: 55, halign: 'center' }, 5: { cellWidth: 62, halign: 'center' },
          6: { cellWidth: 61, halign: 'right' }, 7: { cellWidth: 42, halign: 'center' },
          8: { cellWidth: 67, halign: 'right', fontStyle: 'bold' },
        }
      : {
          0: { cellWidth: 28, halign: 'center' }, 1: { cellWidth: 90, fontStyle: 'bold' },
          2: { cellWidth: 40, halign: 'center' }, 3: { cellWidth: 27, halign: 'center' },
          4: { cellWidth: 53, halign: 'right' }, 5: { cellWidth: 50, halign: 'right' },
          6: { cellWidth: 61, halign: 'right' }, 7: { cellWidth: 42, halign: 'center' },
          8: { cellWidth: 53, halign: 'right' }, 9: { cellWidth: 67, halign: 'right', fontStyle: 'bold' },
        },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = DARK;
      }
    },
  });

  y = ((doc as any).lastAutoTable?.finalY ?? y) + 15;
  const summaryWidth = 250;
  const summaryX = pageWidth - margin - summaryWidth;
  const summaryHeight = drawSummary(doc, quote, summaryX, y, summaryWidth, options);

  let leftY = y + 2;
  const leftWidth = summaryX - margin - 16;
  if (quote.customerNotes) {
     drawText(doc, 'NOTES', margin, leftY + 9, { size: 8, color: BLUE, bold: true });
    leftY += 23;
    quote.customerNotes.split('\n').filter(Boolean).forEach((note, index) => {
      const wrapped = doc.splitTextToSize(`${index + 1}. ${note}`, leftWidth);
      drawText(doc, wrapped.join('\n'), margin, leftY, { size: 7.5, color: TEXT });
      leftY += wrapped.length * 11 + 5;
    });
    leftY += 4;
  }
  if (quote.termsConditions) {
    doc.setDrawColor(...BORDER).setLineWidth(0.5);
    doc.line(margin, leftY, summaryX - 16, leftY);
    leftY += 17;
     drawText(doc, 'TERMS & CONDITIONS', margin, leftY, { size: 8, color: BLUE, bold: true });
    leftY += 16;
    quote.termsConditions.split('\n').filter(Boolean).forEach((term, index) => {
      const wrapped = doc.splitTextToSize(`${index + 1}. ${term}`, leftWidth);
      drawText(doc, wrapped.join('\n'), margin, leftY, { size: 7.5, color: TEXT });
      leftY += wrapped.length * 11 + 5;
    });
  }

  y = Math.max(leftY, y + summaryHeight) + 25;
  drawText(doc, 'Total In Words', margin, y, { size: 8, color: BLUE, bold: true });
  drawText(doc, numberToWords(quote.grandTotal), margin, y + 15, { size: 8.5, color: DARK, bold: true });

  const signatureX = pageWidth - margin - 135;
  doc.setDrawColor(...MUTED).setLineWidth(0.6);
  doc.line(signatureX, y + 10, pageWidth - margin, y + 10);
  drawText(doc, 'Authorized Signature', (signatureX + pageWidth - margin) / 2, y + 25, { size: 7.5, color: MUTED, align: 'center' });

  const footerY = Math.min(pageHeight - 22, y + 78);
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

export async function downloadReferenceQuotePdf(quote: StoredQuote): Promise<void> {
  const dataUri = await generateReferenceQuotePdfBase64(quote);
  const link = document.createElement('a');
  link.href = dataUri;
  link.download = `${quote.quoteNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}