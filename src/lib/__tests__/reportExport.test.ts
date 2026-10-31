import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { createReportExportAttachment, reportDataToCsv } from "@/lib/reportExport";

describe("report export headers", () => {
  it("adds the selected entity to CSV report headers", () => {
    const csv = reportDataToCsv(
      [{ key: "clientName", label: "Client Name" }],
      [{ clientName: "Acme Industries" }],
      ["Client Contracts Report — Acme Industries", "Client: Acme Industries"],
    );

    expect(csv.split("\r\n").slice(0, 4)).toEqual([
      "Client Contracts Report — Acme Industries",
      "Client: Acme Industries",
      "",
      "Client Name",
    ]);
  });

  it("adds the selected entity to downloaded Excel report headers", () => {
    const attachment = createReportExportAttachment(
      "Excel",
      "Client Contracts Report — Acme Industries",
      [{ key: "clientName", label: "Client Name" }],
      [{ clientName: "Acme Industries" }],
      { headerContext: ["Client: Acme Industries"] },
    );
    const workbook = XLSX.read(attachment.content, { type: "base64" });
    const sheet = workbook.Sheets.Report;

    expect(sheet.A1?.v).toBe("Client Contracts Report — Acme Industries");
    expect(sheet.A2?.v).toBe("Client: Acme Industries");
    expect(sheet.A4?.v).toBe("Client Name");
    expect(sheet.A5?.v).toBe("Acme Industries");
  });
});
