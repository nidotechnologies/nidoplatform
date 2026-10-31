import { useState } from "react";
import { FileText, FileSpreadsheet, Printer, Mail, CalendarClock, RefreshCw, Download, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useReportExportData } from "@/contexts/ReportControlsContext";
import { downloadReportExport } from "@/lib/reportExport";

interface ExportBarProps {
  reportTitle?: string;
  onRefresh?: () => void;
}

export default function ExportBar({ reportTitle = "Report", onRefresh }: ExportBarProps) {
  const exportData = useReportExportData();
  const [showSchedule, setShowSchedule] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const scheduleKey = `nido_report_schedule_v1:${reportTitle}`;
  const [frequency, setFrequency] = useState(() => localStorage.getItem(`${scheduleKey}:frequency`) || "Weekly");
  const [scheduleTime, setScheduleTime] = useState(() => localStorage.getItem(`${scheduleKey}:time`) || "08:00");
  const [email, setEmail] = useState("");
  const data = exportData?.rows ? exportData : { title: reportTitle, columns: [], rows: [] };
  const columns = data.columns;
  const rows = data.rows;

  const exportFile = (format: "PDF" | "Excel" | "CSV") => {
    if (!columns.length) {
      toast({ title: "Report data is not ready", description: "Wait for the report table to load, then export again." });
      return;
    }
    downloadReportExport(format, reportTitle, columns, rows);
    toast({ title: `${format} report downloaded`, description: `${rows.length} rows exported from ${reportTitle}.` });
  };

  const saveSchedule = () => {
    try {
      localStorage.setItem(`${scheduleKey}:frequency`, frequency);
      localStorage.setItem(`${scheduleKey}:time`, scheduleTime);
      toast({
        title: "Schedule preferences saved",
        description: `${reportTitle} is set to ${frequency.toLowerCase()} at ${scheduleTime}. Automatic delivery requires a configured scheduler.`,
      });
      setShowSchedule(false);
    } catch {
      toast({ title: "Could not save schedule", description: "Browser storage is unavailable." });
    }
  };

  const prepareEmail = (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;
    if (columns.length) downloadReportExport("CSV", reportTitle, columns, rows);
    const subject = encodeURIComponent(`${reportTitle} report`);
    const body = encodeURIComponent(
      `Please find the exported ${reportTitle} report attached.\n\n${rows.length} rows were included. The CSV file was downloaded so you can attach it to this email.`,
    );
    window.location.href = `mailto:${encodeURIComponent(email.trim())}?subject=${subject}&body=${body}`;
    setShowEmail(false);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => exportFile("PDF")}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <FileText className="w-3.5 h-3.5 text-red-500" /> PDF
      </button>
      <button
        onClick={() => exportFile("Excel")}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <FileSpreadsheet className="w-3.5 h-3.5 text-green-600" /> Excel
      </button>
      <button
        onClick={() => exportFile("CSV")}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Download className="w-3.5 h-3.5 text-blue-500" /> CSV
      </button>
      <button
        onClick={() => window.print()}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Printer className="w-3.5 h-3.5 text-gray-500" /> Print
      </button>
      <button
        onClick={() => setShowEmail(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Mail className="w-3.5 h-3.5 text-blue-500" /> Email
      </button>
      <button
        onClick={() => setShowSchedule(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <CalendarClock className="w-3.5 h-3.5 text-purple-500" /> Schedule
      </button>
      <button
        onClick={() => {
          onRefresh?.();
          window.dispatchEvent(new Event("nidoReportRefresh"));
          toast({ title: "Report refreshed", description: "The latest saved module data has been loaded." });
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors ml-auto"
      >
        <RefreshCw className="w-3.5 h-3.5" /> Refresh
      </button>

      {(showSchedule || showEmail) && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4" onClick={() => { setShowSchedule(false); setShowEmail(false); }}>
          <section className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">{showSchedule ? "Schedule report" : "Email report"}</h2>
                <p className="mt-1 text-xs text-gray-500">{reportTitle}</p>
              </div>
              <button aria-label="Close" onClick={() => { setShowSchedule(false); setShowEmail(false); }} className="rounded p-1 text-gray-400 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            {showSchedule ? (
              <div className="space-y-4">
                <label className="block text-xs font-medium text-gray-700">
                  Frequency
                  <select value={frequency} onChange={(event) => setFrequency(event.target.value)} className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                    {["Daily", "Weekly", "Monthly", "Quarterly"].map((value) => <option key={value}>{value}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-medium text-gray-700">
                  Run time
                  <input type="time" value={scheduleTime} onChange={(event) => setScheduleTime(event.target.value)} className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                </label>
                <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                  This saves the schedule preference in this browser. Automatic recurring runs and email delivery need a server-side scheduler.
                </p>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowSchedule(false)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600">Cancel</button>
                  <button onClick={saveSchedule} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">Save schedule</button>
                </div>
              </div>
            ) : (
              <form onSubmit={prepareEmail} className="space-y-4">
                <label className="block text-xs font-medium text-gray-700">
                  Recipient email
                  <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                </label>
                <p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
                  A CSV copy will download, then your email app will open with a draft. Attach the downloaded file before sending.
                </p>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowEmail(false)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600">Cancel</button>
                  <button type="submit" className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">Prepare email</button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
