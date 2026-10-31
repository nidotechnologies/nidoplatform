import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadConfig } from './configService';
import { formatCurrency, getCurrencySymbol } from './formatters';

// ── Colour palette (identical to invoicePdf.ts) ───────────────────────────────
const BLUE: [number, number, number] = [31, 95, 190];
const DARK: [number, number, number] = [28, 39, 56];
const TEXT: [number, number, number] = [55, 62, 72];
const MUTED: [number, number, number] = [105, 112, 123];
const BORDER: [number, number, number] = [218, 222, 228];
const LIGHT_BLUE: [number, number, number] = [239, 246, 255];
const ROSE: [number, number, number] = [200, 30, 60];

// ── Public type ───────────────────────────────────────────────────────────────
export interface ExpenseForPdf {
  id: string;
  date: string;
  expenseAccount: string;
  referenceNumber: string;
  vendorName: string;
  paidThrough: string;
  customerName: string;
  status: string;
  amount: number;
  expenseType: string;
  sac: string;
  gstTreatment: string;
  sourceOfSupply: string;
  destinationOfSupply: string;
  taxLabel: string;
  taxPercent: number;
  taxAmount: number;
  amountIs: string;
  invoiceNumber: string;
  notes: string;
  reverseCharge: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt2(value: number): string {
  return value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  options: { size?: number; color?: [number, number, number]; bold?: boolean; align?: 'left' | 'center' | 'right' } = {},
) {
  doc
    .setFont('helvetica', options.bold ? 'bold' : 'normal')
    .setFontSize(options.size ?? 8)
    .setTextColor(...(options.color ?? TEXT));
  doc.text(value, x, y, { align: options.align ?? 'left' });
}

function drawCard(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  title: string,
  name: string,
  lines: string[],
): number {
  const cardHeight = Math.max(88, 54 + lines.length * 12);
  doc.setDrawColor(...BORDER).setLineWidth(0.7);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, width, cardHeight, 5, 5, 'FD');
  drawText(doc, title.toUpperCase(), x + 13, y + 19, { size: 8, color: BLUE, bold: true });
  doc.setDrawColor(...BORDER).setLineWidth(0.5);
  doc.line(x + 13, y + 27, x + width - 13, y + 27);
  let cursor = y + 45;
  drawText(doc, name || '-', x + 13, cursor, { size: 9, color: DARK, bold: true });
  cursor += 13;
  lines.forEach((line) => {
    drawText(doc, line, x + 13, cursor, { size: 8.5 });
    cursor += 12;
  });
  return cardHeight;
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

// ── Main generator ─────────────────────────────────────────────────────────────
export async function generateExpensePdf(expense: ExpenseForPdf): Promise<void> {
  const org = loadConfig().organization;
  const brand = getBrandHeader(org.displayName, org.industry);
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 42;
  const contentWidth = pageWidth - margin * 2;

  // ── Logo / brand ─────────────────────────────────────────────────────────────
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

  // ── EXPENSE label + ref box (right) ─────────────────────────────────────────
  drawText(doc, 'EXPENSE', pageWidth - margin, 48, { size: 22, color: DARK, bold: true, align: 'right' });
  doc.setDrawColor(...BORDER).setLineWidth(0.6);
  doc.roundedRect(pageWidth - margin - 110, 61, 110, 28, 4, 4, 'S');
  drawText(doc, '#', pageWidth - margin - 98, 79, { size: 11, color: BLUE });
  drawText(doc, expense.referenceNumber || expense.id, pageWidth - margin - 10, 79, { size: 10, color: DARK, bold: true, align: 'right' });

  // ── Company address (left) ───────────────────────────────────────────────────
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

  // ── Expense meta (right) ─────────────────────────────────────────────────────
  let metaY = 112;
  drawText(doc, `Date: ${fmtDate(expense.date)}`, pageWidth - margin, metaY, { size: 8, color: TEXT, align: 'right' });
  metaY += 14;
  drawText(doc, `Account: ${expense.expenseAccount}`, pageWidth - margin, metaY, { size: 8, color: TEXT, align: 'right' });
  metaY += 14;
  drawText(doc, `Paid Through: ${expense.paidThrough}`, pageWidth - margin, metaY, { size: 8, color: TEXT, align: 'right' });
  metaY += 14;
  drawText(doc, `Status: ${expense.status}`, pageWidth - margin, metaY, { size: 8, color: TEXT, align: 'right' });

  // ── Vendor / Customer cards ──────────────────────────────────────────────────
  let y = Math.max(companyY + 14, 170);
  const cardGap = 12;
  const cardWidth = (contentWidth - cardGap) / 2;

  const vendorLines: string[] = [];
  if (expense.gstTreatment) vendorLines.push(`GST Treatment: ${expense.gstTreatment}`);
  if (expense.invoiceNumber) vendorLines.push(`Invoice #: ${expense.invoiceNumber}`);

  const customerLines: string[] = [];
  if (expense.sourceOfSupply) customerLines.push(`Source: ${expense.sourceOfSupply}`);
  if (expense.destinationOfSupply) customerLines.push(`Destination: ${expense.destinationOfSupply}`);

  const cardH = Math.max(
    drawCard(doc, margin, y, cardWidth, 'Paid To (Vendor)', expense.vendorName === '-' ? '' : expense.vendorName, vendorLines),
    drawCard(doc, margin + cardWidth + cardGap, y, cardWidth, 'Customer', expense.customerName === '-' ? '' : expense.customerName, customerLines),
  );
  y += cardH + 16;

  // ── Expense breakdown table ──────────────────────────────────────────────────
  const baseAmount = expense.amountIs === 'Tax Inclusive'
    ? expense.amount - expense.taxAmount
    : expense.amount;
  const totalAmount = expense.amountIs === 'Tax Inclusive'
    ? expense.amount
    : expense.amount + expense.taxAmount;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['EXPENSE ACCOUNT', 'EXPENSE TYPE', 'HSN/SAC', 'AMOUNT (BASE)', `TAX (${expense.taxPercent}%)`, 'TOTAL AMOUNT']],
    body: [[
      expense.expenseAccount,
      expense.expenseType || 'Services',
      expense.sac || '-',
      money(baseAmount),
      money(expense.taxAmount),
      money(totalAmount),
    ]],
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
      fontSize: 6.5,
      halign: 'center',
    },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right', fontStyle: 'bold' },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 14;

  // ── Summary box (right-aligned) ──────────────────────────────────────────────
  const summaryWidth = 255;
  const summaryX = margin + contentWidth - summaryWidth;
  const rows: [string, string][] = [
    ['Base Amount', money(baseAmount)],
    [`Tax (${expense.taxLabel || `GST ${expense.taxPercent}%`}) — ${expense.amountIs}`, money(expense.taxAmount)],
  ];
  const rowH = 20;
  const totalH = 27;
  const summaryH = rows.length * rowH + totalH;

  doc.setDrawColor(...BORDER).setLineWidth(0.6);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(summaryX, y, summaryWidth, summaryH, 5, 5, 'FD');
  rows.forEach(([label, value], i) => {
    const rowY = y + i * rowH;
    if (i > 0) { doc.setDrawColor(...BORDER).setLineWidth(0.3); doc.line(summaryX, rowY, summaryX + summaryWidth, rowY); }
    drawText(doc, label, summaryX + 10, rowY + 13, { size: 7.7, color: TEXT });
    drawText(doc, value, summaryX + summaryWidth - 10, rowY + 13, { size: 7.7, color: DARK, align: 'right' });
  });
  const totalY = y + rows.length * rowH;
  doc.setFillColor(...LIGHT_BLUE);
  doc.rect(summaryX + 0.5, totalY, summaryWidth - 1, totalH - 0.5, 'F');
  doc.setDrawColor(...BORDER).setLineWidth(0.5);
  doc.line(summaryX, totalY, summaryX + summaryWidth, totalY);
  drawText(doc, 'Total Expense', summaryX + 10, totalY + 17, { size: 8.5, color: DARK, bold: true });
  drawText(doc, money(totalAmount), summaryX + summaryWidth - 10, totalY + 17, { size: 8.5, color: DARK, bold: true, align: 'right' });

  // Amount in words (left of summary)
  const wordsWidth = summaryX - margin - 12;
  if (wordsWidth > 60) {
    drawText(doc, 'Total Expense (in words)', margin, y + 13, { size: 7, color: MUTED });
    const words = numberToWordsINR(totalAmount);
    const wrappedWords = doc.splitTextToSize(words, wordsWidth);
    drawText(doc, wrappedWords[0] || words, margin, y + 27, { size: 8, color: DARK });
  }

  y += summaryH + 18;

  // ── Journal table ─────────────────────────────────────────────────────────────
  drawText(doc, 'JOURNAL ENTRY', margin, y + 2, { size: 8, color: BLUE, bold: true });
  y += 12;
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['ACCOUNT', `DEBIT (${getCurrencySymbol(loadConfig())})`, `CREDIT (${getCurrencySymbol(loadConfig())})`]],
    body: [
      [expense.expenseAccount, fmt2(expense.amount - expense.taxAmount), '0.00'],
      [expense.paidThrough, '0.00', fmt2(expense.amount)],
      ['Input SGST', fmt2(expense.taxAmount / 2), '0.00'],
      ['Input CGST', fmt2(expense.taxAmount / 2), '0.00'],
      ['Total', fmt2(expense.amount), fmt2(expense.amount)],
    ],
    theme: 'grid',
    tableWidth: contentWidth,
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      textColor: TEXT,
      lineColor: BORDER,
      lineWidth: 0.35,
      cellPadding: { top: 6, bottom: 6, left: 8, right: 8 },
    },
    headStyles: { fillColor: [248, 250, 252], textColor: DARK, fontStyle: 'bold', fontSize: 7 },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
    didParseCell: (data) => {
      if (data.row.index === 4) { data.cell.styles.fontStyle = 'bold'; data.cell.styles.textColor = DARK; }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 14;

  // ── Notes ─────────────────────────────────────────────────────────────────────
  if (expense.notes) {
    drawText(doc, 'NOTES', margin, y, { size: 7.5, color: MUTED, bold: true });
    y += 11;
    const wrapped = doc.splitTextToSize(expense.notes, contentWidth);
    wrapped.forEach((line: string) => {
      drawText(doc, line, margin, y, { size: 8, color: TEXT });
      y += 12;
    });
    y += 4;
  }

  // ── Footer ────────────────────────────────────────────────────────────────────
  const footerY = pageHeight - 30;
  doc.setDrawColor(...BORDER).setLineWidth(0.5);
  doc.line(margin, footerY - 8, pageWidth - margin, footerY - 8);
  drawText(doc, 'Thank you for your business!', pageWidth / 2, footerY + 4, { size: 8, color: BLUE, bold: true, align: 'center' });

  // ── Download ──────────────────────────────────────────────────────────────────
  const filename = `Expense-${expense.referenceNumber || expense.id}.pdf`;
  doc.save(filename);
}

// ── Recurring Expense PDF ──────────────────────────────────────────────────────
export interface RecurringExpenseProfileForPdf {
  id: string;
  profileName: string;
  expenseAccount: string;
  vendorName: string;
  frequency: string;
  lastExpenseDate: string;
  nextExpenseDate: string;
  status: string;
  amount: number;
  paidThrough: string;
  startDate: string;
  endDate: string;
  neverExpires: boolean;
  taxLabel: string;
  amountIs: string;
  notes: string;
  customerName: string;
  billable: boolean;
  gstTreatment: string;
  history: { id: string; timestamp: string; message: string; by: string }[];
}

export async function generateRecurringExpensePdf(profile: RecurringExpenseProfileForPdf): Promise<void> {
  const org = loadConfig().organization;
  const brand = getBrandHeader(org.displayName, org.industry);
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 42;
  const contentWidth = pageWidth - margin * 2;

  // Logo / brand
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

  // RECURRING EXPENSE label + status box (right)
  drawText(doc, 'RECURRING EXPENSE', pageWidth - margin, 48, { size: 16, color: DARK, bold: true, align: 'right' });
  doc.setDrawColor(...BORDER).setLineWidth(0.6);
  doc.roundedRect(pageWidth - margin - 110, 61, 110, 28, 4, 4, 'S');
  const statusColor: [number, number, number] = profile.status === 'ACTIVE' ? [5, 150, 105] : [100, 100, 100];
  drawText(doc, profile.status, pageWidth - margin - 10, 79, { size: 9, color: statusColor, bold: true, align: 'right' });

  // Company address
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

  // Profile meta (right)
  let metaY = 112;
  drawText(doc, `Frequency: ${profile.frequency}`, pageWidth - margin, metaY, { size: 8, color: TEXT, align: 'right' });
  metaY += 14;
  drawText(doc, `Start: ${fmtDate(profile.startDate)}`, pageWidth - margin, metaY, { size: 8, color: TEXT, align: 'right' });
  metaY += 14;
  const endsText = profile.neverExpires ? 'Never Expires' : `Ends: ${fmtDate(profile.endDate || '')}`;
  drawText(doc, endsText, pageWidth - margin, metaY, { size: 8, color: TEXT, align: 'right' });
  metaY += 14;
  drawText(doc, `Next Expense: ${fmtDate(profile.nextExpenseDate)}`, pageWidth - margin, metaY, { size: 8, color: TEXT, align: 'right' });

  // Profile name banner
  let y = Math.max(companyY + 14, 175);
  doc.setFillColor(...LIGHT_BLUE);
  doc.roundedRect(margin, y, contentWidth, 42, 6, 6, 'F');
  drawText(doc, profile.profileName, margin + 16, y + 26, { size: 13, color: DARK, bold: true });
  y += 58;

  // Vendor & Customer cards
  const cardGap = 12;
  const cardWidth = (contentWidth - cardGap) / 2;
  const vendorLines: string[] = [];
  if (profile.gstTreatment) vendorLines.push(`GST Treatment: ${profile.gstTreatment}`);
  const customerLines: string[] = [];
  if (profile.billable) customerLines.push('Billable: Yes');

  const cardH = Math.max(
    drawCard(doc, margin, y, cardWidth, 'Vendor', profile.vendorName === '-' ? '' : profile.vendorName, vendorLines),
    drawCard(doc, margin + cardWidth + cardGap, y, cardWidth, 'Customer', profile.customerName === '-' ? '' : profile.customerName, customerLines),
  );
  y += cardH + 16;

  // Expense breakdown table
  const taxPercent = Number(profile.taxLabel.replace(/\D/g, '')) || 0;
  const taxAmount = profile.amountIs === 'Tax Inclusive'
    ? Math.round((profile.amount - profile.amount / (1 + taxPercent / 100)) * 100) / 100
    : Math.round(((profile.amount * taxPercent) / 100) * 100) / 100;
  const baseAmount = profile.amountIs === 'Tax Inclusive' ? profile.amount - taxAmount : profile.amount;
  const totalAmount = profile.amountIs === 'Tax Inclusive' ? profile.amount : profile.amount + taxAmount;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['EXPENSE ACCOUNT', 'FREQUENCY', 'PAID THROUGH', 'AMOUNT (BASE)', `TAX (${taxPercent}%)`, 'TOTAL AMOUNT']],
    body: [[
      profile.expenseAccount,
      profile.frequency,
      profile.paidThrough,
      money(baseAmount),
      money(taxAmount),
      money(totalAmount),
    ]],
    theme: 'grid',
    tableWidth: contentWidth,
    styles: { font: 'helvetica', fontSize: 7.5, textColor: TEXT, lineColor: BORDER, lineWidth: 0.35, cellPadding: { top: 7, bottom: 7, left: 4, right: 4 }, valign: 'middle' },
    headStyles: { fillColor: [248, 250, 252], textColor: DARK, fontStyle: 'bold', fontSize: 6.5, halign: 'center' },
    columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' } },
  });
  y = (doc as any).lastAutoTable.finalY + 14;

  // Summary box
  const summaryWidth = 255;
  const summaryX = margin + contentWidth - summaryWidth;
  const rows: [string, string][] = [
    ['Base Amount', money(baseAmount)],
    [`Tax (${profile.taxLabel || `GST ${taxPercent}%`}) — ${profile.amountIs}`, money(taxAmount)],
  ];
  const rowH = 20;
  const totalH = 27;
  const summaryH = rows.length * rowH + totalH;
  doc.setDrawColor(...BORDER).setLineWidth(0.6);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(summaryX, y, summaryWidth, summaryH, 5, 5, 'FD');
  rows.forEach(([label, value], i) => {
    const rowY = y + i * rowH;
    if (i > 0) { doc.setDrawColor(...BORDER).setLineWidth(0.3); doc.line(summaryX, rowY, summaryX + summaryWidth, rowY); }
    drawText(doc, label, summaryX + 10, rowY + 13, { size: 7.7, color: TEXT });
    drawText(doc, value, summaryX + summaryWidth - 10, rowY + 13, { size: 7.7, color: DARK, align: 'right' });
  });
  const totalY = y + rows.length * rowH;
  doc.setFillColor(...LIGHT_BLUE);
  doc.rect(summaryX + 0.5, totalY, summaryWidth - 1, totalH - 0.5, 'F');
  doc.setDrawColor(...BORDER).setLineWidth(0.5);
  doc.line(summaryX, totalY, summaryX + summaryWidth, totalY);
  drawText(doc, 'Amount per Cycle', summaryX + 10, totalY + 17, { size: 8.5, color: DARK, bold: true });
  drawText(doc, money(totalAmount), summaryX + summaryWidth - 10, totalY + 17, { size: 8.5, color: DARK, bold: true, align: 'right' });
  y += summaryH + 18;

  // Notes
  if (profile.notes && profile.notes !== '-') {
    drawText(doc, 'NOTES', margin, y, { size: 7.5, color: MUTED, bold: true });
    y += 11;
    const wrapped = doc.splitTextToSize(profile.notes, contentWidth);
    wrapped.forEach((line: string) => { drawText(doc, line, margin, y, { size: 8, color: TEXT }); y += 12; });
    y += 4;
  }

  // History table
  if (profile.history.length > 0) {
    if (y > pageHeight - 140) { doc.addPage(); y = margin + 20; }
    drawText(doc, 'HISTORY', margin, y + 2, { size: 8, color: BLUE, bold: true });
    y += 12;
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['DATE & TIME', 'EVENT', 'BY']],
      body: profile.history.map((h) => [
        `${new Date(h.timestamp).toLocaleDateString()} ${new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        h.message,
        h.by,
      ]),
      theme: 'grid',
      tableWidth: contentWidth,
      styles: { font: 'helvetica', fontSize: 7.5, textColor: TEXT, lineColor: BORDER, lineWidth: 0.35, cellPadding: { top: 5, bottom: 5, left: 8, right: 8 } },
      headStyles: { fillColor: [248, 250, 252], textColor: DARK, fontStyle: 'bold', fontSize: 7 },
      columnStyles: { 0: { cellWidth: 110 }, 2: { cellWidth: 90 } },
    });
    y = (doc as any).lastAutoTable.finalY + 14;
  }

  // Footer
  const footerY = pageHeight - 30;
  doc.setDrawColor(...BORDER).setLineWidth(0.5);
  doc.line(margin, footerY - 8, pageWidth - margin, footerY - 8);
  drawText(doc, 'Thank you for your business!', pageWidth / 2, footerY + 4, { size: 8, color: BLUE, bold: true, align: 'center' });

  doc.save(`RecurringExpense-${profile.profileName.replace(/\s+/g, '-')}.pdf`);
}

// Simple INR number-to-words helper
function numberToWordsINR(amount: number): string {
  const n = Math.round(amount);
  if (n === 0) return 'Zero Rupees Only';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  function two(n: number): string {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
  }
  function convert(n: number): string {
    if (n === 0) return '';
    if (n < 100) return two(n);
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + two(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  }
  return convert(n) + ' Rupees Only';
}
