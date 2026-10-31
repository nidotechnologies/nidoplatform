import { createContext, useContext } from "react";

interface ReportShellContextValue {
  /** When true, ReportShell renders children directly without its sidebar/layout wrapper */
  inline: boolean;
}

const ReportShellContext = createContext<ReportShellContextValue>({ inline: false });

export const useReportShellContext = () => useContext(ReportShellContext);

export default ReportShellContext;
