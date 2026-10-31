import { useReportShellContext } from "@/contexts/ReportShellContext";
import ReportModuleNav from "@/components/reports/ReportModuleNav";

export default function ReportShell({ children, title, subtitle }: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  const { inline } = useReportShellContext();
  // When rendered inline inside ReportsPage, the Reports page already shows
  // its module navigation tiles. Do not add another navigation layer there.
  if (inline) {
    return <div className="space-y-5">{children}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Match the main Reports page: show the full module cards above the
          selected report. The application Sidebar remains the only sidebar. */}
      <ReportModuleNav />

      <div className="bg-white border border-gray-100 rounded-lg shadow-sm overflow-hidden">
        {/* Page header */}
        <div className="px-6 py-4 border-b border-gray-100">
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>

        {/* Report body */}
        <div className="p-6 bg-gray-50/50">
          {children}
        </div>
      </div>
    </div>
  );
}
