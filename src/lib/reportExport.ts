import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { ReportExportColumn, ReportExportData } from "@/contexts/ReportControlsContext";

export type ReportFileFormat = "CSV" | "Excel" | "PDF";

export interface ReportExportOptions {
  headerContext?: string[];
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function safeFileName(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "report";
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function csvValue(value: unknown): string {
  const text = cellText(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export function reportDataToCsv(
  columns: ReportExportColumn[],
  rows: ReportExportData["rows"],
  preamble: string[] = [],
): string {
  const header = columns.map((column) => csvValue(column.label)).join(",");
  const body = rows.map((row) => columns.map((column) => csvValue(row[column.key])).join(","));
  return [...preamble.map(csvValue), ...(preamble.length ? [""] : []), header, ...body].join("\r\n");
}

export function createReportExportAttachment(
  format: ReportFileFormat,
  title: string,
  columns: ReportExportColumn[],
  rows: ReportExportData["rows"],
  options: ReportExportOptions = {},
): { filename: string; content: string } {
  const name = safeFileName(title);
  const date = new Date().toISOString().slice(0, 10);
  const preamble = options.headerContext?.length ? [title, ...options.headerContext] : [];

  if (format === "CSV") {
    const content = bytesToBase64(new TextEncoder().encode(`\uFEFF${reportDataToCsv(columns, rows, preamble)}`));
    return { filename: `${name}-${date}.csv`, content };
  }

  if (format === "Excel") {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ...preamble.map((line) => [line]),
      ...(preamble.length ? [[]] : []),
      columns.map((column) => column.label),
      ...rows.map((row) => columns.map((column) => cellText(row[column.key]))),
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
    return {
      filename: `${name}-${date}.xlsx`,
      content: XLSX.write(workbook, { type: "base64", bookType: "xlsx" }),
    };
  }

  const pdf = new jsPDF({ orientation: columns.length > 6 ? "landscape" : "portrait" });
  let headerY = 16;
  pdf.setFontSize(14);
  const titleLines = pdf.splitTextToSize(title, pdf.internal.pageSize.getWidth() - 28);
  pdf.text(titleLines, 14, headerY);
  headerY += titleLines.length * 7;
  pdf.setFontSize(9);
  const contextLines = (options.headerContext ?? []).flatMap((line) =>
    pdf.splitTextToSize(line, pdf.internal.pageSize.getWidth() - 28),
  );
  if (contextLines.length) {
    pdf.text(contextLines, 14, headerY);
    headerY += contextLines.length * 5;
  }
  pdf.text(`Generated ${new Date().toLocaleString()}`, 14, headerY);
  autoTable(pdf, {
    startY: headerY + 6,
    head: [columns.map((column) => column.label)],
    body: rows.map((row) => columns.map((column) => cellText(row[column.key]))),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235] },
    margin: { left: 14, right: 14 },
  });
  return {
    filename: `${name}-${date}.pdf`,
    content: bytesToBase64(new Uint8Array(pdf.output("arraybuffer"))),
  };
}

export function downloadReportExport(
  format: ReportFileFormat,
  title: string,
  columns: ReportExportColumn[],
  rows: ReportExportData["rows"],
  options: ReportExportOptions = {},
) {
  const name = safeFileName(title);
  const date = new Date().toISOString().slice(0, 10);
  const preamble = options.headerContext?.length ? [title, ...options.headerContext] : [];

  if (format === "CSV") {
    downloadBlob(
      new Blob(["\uFEFF", reportDataToCsv(columns, rows, preamble)], { type: "text/csv;charset=utf-8" }),
      `${name}-${date}.csv`,
    );
    return;
  }

  if (format === "Excel") {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ...preamble.map((line) => [line]),
      ...(preamble.length ? [[]] : []),
      columns.map((column) => column.label),
      ...rows.map((row) => columns.map((column) => cellText(row[column.key]))),
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
    XLSX.writeFile(workbook, `${name}-${date}.xlsx`);
    return;
  }

  const pdf = new jsPDF({ orientation: columns.length > 6 ? "landscape" : "portrait" });
  let headerY = 16;
  pdf.setFontSize(14);
  const titleLines = pdf.splitTextToSize(title, pdf.internal.pageSize.getWidth() - 28);
  pdf.text(titleLines, 14, headerY);
  headerY += titleLines.length * 7;
  pdf.setFontSize(9);
  const contextLines = (options.headerContext ?? []).flatMap((line) =>
    pdf.splitTextToSize(line, pdf.internal.pageSize.getWidth() - 28),
  );
  if (contextLines.length) {
    pdf.text(contextLines, 14, headerY);
    headerY += contextLines.length * 5;
  }
  pdf.text(`Generated ${new Date().toLocaleString()}`, 14, headerY);
  autoTable(pdf, {
    startY: headerY + 6,
    head: [columns.map((column) => column.label)],
    body: rows.map((row) => columns.map((column) => cellText(row[column.key]))),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235] },
    margin: { left: 14, right: 14 },
  });
  pdf.save(`${name}-${date}.pdf`);
}
