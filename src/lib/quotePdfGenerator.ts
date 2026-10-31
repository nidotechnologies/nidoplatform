  // ── Quotation PDF Generator ───────────────────────────────────────────────────
  // Generates an "ESTIMATE" PDF matching the reference format.
  // Logo is read from configService so it updates automatically when changed.

  import jsPDF from 'jspdf';
  import autoTable from 'jspdf-autotable';
  import { loadConfig } from './configService';
  import type { StoredQuote } from './quoteStore';

  // ── Number to Words (Indian format) ──────────────────────────────────────────
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function twoDigits(n: number): string {
    if (n < 20) return ones[n];
    return (tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')).trim();
  }

  function threeDigits(n: number): string {
    if (n < 100) return twoDigits(n);
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + twoDigits(n % 100) : '');
  }

  export function numberToWords(amount: number): string {
    const rupees = Math.floor(amount);
    const paise = Math.round((amount - rupees) * 100);

    if (rupees === 0 && paise === 0) return 'Zero Rupees Only';

    let words = '';
    if (rupees > 0) {
      const crore = Math.floor(rupees / 10000000);
      const lakh = Math.floor((rupees % 10000000) / 100000);
      const thousand = Math.floor((rupees % 100000) / 1000);
      const rest = rupees % 1000;

      if (crore) words += threeDigits(crore) + ' Crore ';
      if (lakh) words += twoDigits(lakh) + ' Lakh ';
      if (thousand) words += twoDigits(thousand) + ' Thousand ';
      if (rest) words += threeDigits(rest) + ' ';

      words = 'Indian Rupee ' + words.trim();
    }
    if (paise > 0) {
      words += (rupees > 0 ? ' and ' : '') + twoDigits(paise) + ' Paise';
    }
    return (words + ' Only').trim();
  }

  // ── Detect image format from data URL ────────────────────────────────────────
  function detectImageFormat(dataUrl: string): string {
    if (dataUrl.includes('image/png'))  return 'PNG';
    if (dataUrl.includes('image/jpeg') || dataUrl.includes('image/jpg')) return 'JPEG';
    if (dataUrl.includes('image/gif'))  return 'GIF';
    if (dataUrl.includes('image/webp')) return 'WEBP';
    if (dataUrl.includes('image/bmp'))  return 'BMP';
    return 'PNG'; // safe default
  }

  // ── Load image as base64 ──────────────────────────────────────────────────────
  async function loadImageAsBase64(url: string): Promise<string | null> {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  // ── Format date DD/MM/YYYY ────────────────────────────────────────────────────
  function fmtDate(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  function fmt2(n: number): string {
    return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // ── Ensure there's enough vertical space on the current page ─────────────────
  // Returns the updated y; adds a new page if needed.
  function ensureSpace(doc: jsPDF, y: number, needed: number, margin: number): number {
    const pageH = doc.internal.pageSize.getHeight();
    if (y + needed > pageH - margin) {
      doc.addPage();
      return margin;
    }
    return y;
  }

  // ── Main generator ────────────────────────────────────────────────────────────
  export async function generateQuotePdfBase64(quote: StoredQuote): Promise<string> {
    const config = loadConfig();
    const org = config.organization;

    const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
    const W = doc.internal.pageSize.getWidth();   // 595
    const margin = 40;
    const contentW = W - margin * 2;
    let y = margin;

    // ── HEADER ─────────────────────────────────────────────────────────────────
    // Left side: logo symbol + display name + industry (stacked beside logo)
    const logoUrl = org.logoUrl;
    const logoSize = 42;
    const logoTextGap = 10;
    let logoLoaded = false;

    if (logoUrl) {
      try {
        let imgData = logoUrl;
        // Remote URLs: fetch and convert to base64 first
        if (logoUrl.startsWith('http')) {
          const b64 = await loadImageAsBase64(logoUrl);
          imgData = b64 || '';
        }
        if (imgData) {
          const fmt = detectImageFormat(imgData);
          doc.addImage(imgData, fmt, margin, y, logoSize, logoSize);
          logoLoaded = true;
        }
      } catch {
        logoLoaded = false;
      }
    }

    // Display name + industry sit right of the logo symbol
    const nameX = logoLoaded ? margin + logoSize + logoTextGap : margin;
    const nameBaseY = y + (logoLoaded ? logoSize * 0.38 : 0);

    doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(20, 20, 20);
    doc.text(org.displayName || org.companyName || 'Company', nameX, nameBaseY + 10);

    if (org.industry) {
      doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(100, 100, 100);
      doc.text(org.industry, nameX, nameBaseY + 23);
    }

    // Right side: full company legal name + address + GSTIN
    const rightX = W - margin;
    let rightY = y + 12;

    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(30, 30, 30);
    doc.text(org.companyName || org.displayName || '', rightX, rightY, { align: 'right' });
    rightY += 13;

    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(70, 70, 70);
    const addrLines = (org.registeredAddress || org.billingAddress || '')
      .split(/[,\n]/).map((s: string) => s.trim()).filter(Boolean);
    for (const line of addrLines.slice(0, 4)) {
      doc.text(line, rightX, rightY, { align: 'right' });
      rightY += 11;
    }
    if (org.gstNumber) {
      doc.text(`GSTIN: ${org.gstNumber}`, rightX, rightY, { align: 'right' });
      rightY += 11;
    }
    if (org.phone) {
      doc.text(`Ph: ${org.phone}`, rightX, rightY, { align: 'right' });
      rightY += 11;
    }

    y = Math.max(y + logoSize + 10, rightY + 6);

    // Separator line
    doc.setDrawColor(180, 180, 180).setLineWidth(0.8);
    doc.line(margin, y, W - margin, y);
    y += 14;

    // ESTIMATE title
    doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(30, 30, 30);
    doc.text('ESTIMATE', W / 2, y, { align: 'center' });
    y += 26;

    // ── BILL TO / ESTIMATE INFO ────────────────────────────────────────────────
    const colMid = margin + contentW * 0.52;

    // Capture starting Y for estimate info box alignment
    const billToStartY = y;

    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(90, 90, 90);
    doc.text('Bill To', margin, y);
    y += 13;

    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(20, 20, 20);
    doc.text(quote.clientName || '', margin, y);
    y += 13;

    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(60, 60, 60);
    const billLines = (quote.billingAddress || '').split(/[,\n]/).map((s: string) => s.trim()).filter(Boolean);
    for (const line of billLines.slice(0, 4)) {
      doc.text(line, margin, y);
      y += 11;
    }
    if (quote.clientGstin) {
      doc.text(`GSTIN: ${quote.clientGstin}`, margin, y);
      y += 11;
    }

    // Estimate info box (right side, aligned to bill-to top)
    const estBoxW = contentW * 0.42;
    const estBoxX = colMid;
    const estRowH = 22;
    const estRows: [string, string][] = [
      ['Estimate #', quote.quoteNumber],
      ['Estimate Date', fmtDate(quote.quoteDate)],
      ...(quote.validTill ? [['Valid Till', fmtDate(quote.validTill)] as [string, string]] : []),
    ];
    const estBoxH = estRows.length * estRowH;

    doc.setDrawColor(190, 190, 190).setLineWidth(0.5);
    doc.rect(estBoxX, billToStartY, estBoxW, estBoxH);

    estRows.forEach((row, i) => {
      const rowY = billToStartY + i * estRowH;
      if (i > 0) doc.line(estBoxX, rowY, estBoxX + estBoxW, rowY);
      const midXv = estBoxX + estBoxW * 0.5;
      doc.line(midXv, rowY, midXv, rowY + estRowH);

      doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(80, 80, 80);
      doc.text(row[0], estBoxX + 6, rowY + estRowH - 7);
      doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(20, 20, 20);
      doc.text(row[1], estBoxX + estBoxW - 6, rowY + estRowH - 7, { align: 'right' });
    });

    y += 10;

    // Ship To
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(90, 90, 90);
    doc.text('Ship To', margin, y);
    y += 13;

    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(60, 60, 60);
    const shipLines = (quote.shippingAddress || quote.billingAddress || '')
      .split(/[,\n]/).map((s: string) => s.trim()).filter(Boolean);
    for (const line of shipLines.slice(0, 4)) {
      doc.text(line, margin, y);
      y += 11;
    }
    if (quote.clientGstin) {
      doc.text(`GSTIN: ${quote.clientGstin}`, margin, y);
      y += 11;
    }

    y += 8;

    // Place of Supply
    if (quote.placeOfSupply) {
      doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(40, 40, 40);
      doc.text(`Place Of Supply: ${quote.placeOfSupply}`, margin, y);
      y += 16;
    }

    // ── LINE ITEMS TABLE ────────────────────────────────────────────────────────
    const tableBody = quote.lineItems.map((item, i) => {
      const taxable = Math.max(0, item.qty * item.rate - item.discount);
      const gst = taxable * (item.taxPercent / 100);
      const amt = taxable + gst;
      const cellContent = item.description ? `${item.name}\n${item.description}` : item.name;
      return [
        i + 1,
        cellContent,
        item.hsnSac || '',
        `${item.qty}`,
        fmt2(item.rate),
        fmt2(item.discount),
        fmt2(taxable),
        `${item.taxPercent}%`,
        fmt2(gst),
        fmt2(amt),
      ];
    });

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [[
        'Sl.No',
        'ITEM / DESCRIPTION',
        'HSN/SAC',
        'QTY',
        'RATE (₹)',
        'DISC (₹)',
        'TAXABLE (₹)',
        'GST RATE',
        'GST (₹)',
        'AMOUNT (₹)',
      ]],
      body: tableBody,
      headStyles: {
        fillColor: [240, 240, 240],
        textColor: [30, 30, 30],
        fontStyle: 'bold',
        fontSize: 6.5,
        cellPadding: { top: 7, bottom: 7, left: 3, right: 3 },
      },
      bodyStyles: {
        fontSize: 7.5,
        cellPadding: { top: 7, bottom: 7, left: 3, right: 3 },
        textColor: [40, 40, 40],
        valign: 'top',
      },
      columnStyles: {
        0: { cellWidth: 25, halign: 'center' },
        1: { cellWidth: 111 },
        2: { cellWidth: 44, halign: 'center' },
        3: { cellWidth: 25, halign: 'center' },
        4: { cellWidth: 51, halign: 'right' },
        5: { cellWidth: 48, halign: 'right' },
        6: { cellWidth: 60, halign: 'right' },
        7: { cellWidth: 43, halign: 'center' },
        8: { cellWidth: 50, halign: 'right' },
        9: { cellWidth: 57, halign: 'right' },
      },
      // Parse the item name and description separately while keeping the
      // built-in text hidden so the two lines can use the reference styling.
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 1) {
          const raw = String(data.cell.raw ?? '');
          const parts = raw.split('\n');
          const descriptionLines = parts.length > 1
            ? doc.splitTextToSize(parts.slice(1).join(' '), data.cell.width - 12)
            : [];
          data.cell.text = [parts[0], ...descriptionLines];
          // Make autoTable's built-in text invisible; we draw manually in didDrawCell
          (data.cell.styles as any).textColor = [255, 255, 255];
        }
      },
      didDrawCell(data) {
        if (data.section === 'body' && data.column.index === 1) {
          const raw = String(data.cell.raw ?? '');
          const parts = raw.split('\n');
          const px = data.cell.x + 6;
          const py = data.cell.y + data.cell.padding('top') + 7;

          // Item name — bold, dark
          doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(30, 30, 30);
          doc.text(parts[0], px, py);

          // Description — normal, gray, wrapped below the item name
          if (parts.length > 1 && parts.slice(1).join(' ').trim()) {
            const descriptionLines = doc.splitTextToSize(
              parts.slice(1).join(' '),
              data.cell.width - 12,
            );
            doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(110, 110, 110);
            doc.text(descriptionLines, px, py + 11);
          }
        }
      },
      alternateRowStyles: { fillColor: [255, 255, 255] },
      tableLineColor: [200, 200, 200],
      tableLineWidth: 0.3,
      showHead: 'everyPage',
    });

    y = (doc as any).lastAutoTable.finalY + 12;

    // ── TOTALS SECTION ─────────────────────────────────────────────────────────
    const summaryW = 220;
    const summaryX = W - margin - summaryW;

    const summaryRows: [string, string][] = [
      ['Sub Total', `\u20B9${fmt2(quote.subtotal)}`],
      ...quote.gstSlabs.flatMap(slab => [
        [`CGST (${slab.rate / 2}%)`, `\u20B9${fmt2(slab.cgst)}`],
        [`SGST (${slab.rate / 2}%)`, `\u20B9${fmt2(slab.sgst)}`],
      ]),
    ];

    if (summaryRows.length === 1) {
      summaryRows.push(['CGST (9%)', '\u20B90.00'], ['SGST (9%)', '\u20B90.00']);
    }

    const rowH = 22;
    const totalRowH = 24;
    const boxH = summaryRows.length * rowH + totalRowH;

    // Ensure totals box fits on current page
    y = ensureSpace(doc, y, boxH + 60, margin);

    const sy = y;

    // Outer border for whole summary block
    doc.setDrawColor(200, 200, 200).setLineWidth(0.4);
    doc.rect(summaryX, sy, summaryW, boxH);

    summaryRows.forEach((row, i) => {
      const rowY = sy + i * rowH;
      // Row separator (after each row except last summary row — total has its own border)
      doc.setDrawColor(210, 210, 210).setLineWidth(0.3);
      doc.line(summaryX, rowY + rowH, summaryX + summaryW, rowY + rowH);

      doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(80, 80, 80);
      doc.text(row[0], summaryX + 8, rowY + rowH - 7);
      doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(30, 30, 30);
      doc.text(row[1], summaryX + summaryW - 8, rowY + rowH - 7, { align: 'right' });
    });

    // Total row — shaded background
    const totalRowY = sy + summaryRows.length * rowH;
    doc.setFillColor(235, 235, 235);
    doc.rect(summaryX, totalRowY, summaryW, totalRowH, 'F');
    doc.setDrawColor(180, 180, 180).setLineWidth(0.5);
    doc.line(summaryX, totalRowY, summaryX + summaryW, totalRowY);

    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(20, 20, 20);
    doc.text('Total', summaryX + 8, totalRowY + totalRowH - 8);
    doc.text(`\u20B9${fmt2(quote.grandTotal)}`, summaryX + summaryW - 8, totalRowY + totalRowH - 8, { align: 'right' });

    y = sy + boxH + 14;

    // Total in words
    y = ensureSpace(doc, y, 30, margin);
    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(50, 50, 50);
    doc.text('Total In Words:', margin, y);
    doc.setFont('helvetica', 'bolditalic').setFontSize(9).setTextColor(30, 30, 30);
    const wordsText = numberToWords(quote.grandTotal);
    const wordLines = doc.splitTextToSize(wordsText, contentW - 95);
    doc.text(wordLines, margin + 90, y);
    y += wordLines.length * 13 + 18;

    // ── TERMS & CONDITIONS ─────────────────────────────────────────────────────
    if (quote.termsConditions) {
      y = ensureSpace(doc, y, 40, margin);
      doc.setDrawColor(200, 200, 200).setLineWidth(0.5);
      doc.line(margin, y, W - margin, y);
      y += 14;

      doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(30, 30, 30);
      doc.text('Terms & Conditions', margin, y);
      y += 14;

      doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(60, 60, 60);
      const termLines = quote.termsConditions.split('\n').filter(Boolean);
      termLines.forEach((line, i) => {
        const wrapped = doc.splitTextToSize(`${i + 1}. ${line}`, contentW);
        y = ensureSpace(doc, y, wrapped.length * 12 + 4, margin);
        doc.text(wrapped, margin, y);
        y += wrapped.length * 12;
      });
      y += 10;
    }

    // Customer notes
    if (quote.customerNotes) {
      y = ensureSpace(doc, y, 30, margin);
      doc.setFont('helvetica', 'italic').setFontSize(9).setTextColor(80, 80, 80);
      const noteLines = doc.splitTextToSize(quote.customerNotes, contentW);
      doc.text(noteLines, margin, y);
      y += noteLines.length * 12 + 12;
    }

    // Authorized Signature
    y = ensureSpace(doc, y, 36, margin);
    y += 20;
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(40, 40, 40);
    doc.text('Authorized Signature', margin, y);
    doc.setDrawColor(80, 80, 80).setLineWidth(0.6);
    doc.line(margin + 110, y, margin + 270, y);

    // Page numbers on every page
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(150, 150, 150);
      doc.text(`Page ${p} of ${totalPages}`, W - margin, pageH - 16, { align: 'right' });
    }

    return doc.output('datauristring');
  }

  export async function downloadQuotePdf(quote: StoredQuote): Promise<void> {
    const dataUri = await generateQuotePdfBase64(quote);
    const link = document.createElement('a');
    link.href = dataUri;
    link.download = `${quote.quoteNumber}.pdf`;
    link.click();
  }
