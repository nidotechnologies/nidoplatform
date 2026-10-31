import { ShieldAlert, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export default function ImpersonationBanner() {
  const { isImpersonating, impersonationSession, endImpersonation } = useAuth();
  const navigate = useNavigate();
  if (!isImpersonating || !impersonationSession) return null;
  const exit = () => {
    endImpersonation();
    navigate("/clients", { replace: true });
  };
  return (
    <div className="sticky top-0 z-[60] flex items-center justify-between gap-3 bg-amber-50 border-b border-amber-300 px-4 py-2 text-xs text-amber-950 shadow-sm">
      <div className="flex items-center gap-2 min-w-0">
        <ShieldAlert size={16} className="shrink-0 text-amber-600" />
        <span className="font-semibold">IMPERSONATION MODE</span>
        <span className="truncate">
          Viewing NIDO as <b>{impersonationSession.impersonatedUser.name}</b> · {impersonationSession.impersonatedUser.clientName}
        </span>
        <span className="hidden lg:inline text-amber-800/80">
          Original account: <b>{impersonationSession.originalUser.name}</b>
        </span>
        <span className="hidden md:inline rounded-full bg-amber-200 px-2 py-0.5 font-medium">VIEW ONLY</span>
      </div>
      <button onClick={exit} className="shrink-0 inline-flex items-center gap-1 rounded-md bg-amber-700 px-2.5 py-1.5 font-semibold text-white hover:bg-amber-800">
        <X size={13} /> Exit Impersonation
      </button>
    </div>
  );
}