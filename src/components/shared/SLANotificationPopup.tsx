// SLA notification bell — renders inline inside the TopBar.
// The dropdown panel opens DOWNWARD from the trigger button.

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, X, AlertTriangle, XCircle, ArrowRight, CheckCheck } from "lucide-react";
import { useSLAAlerts, type SLAAlert } from "@/hooks/useSLAAlerts";
import { dismissAlert, dismissAlerts } from "@/lib/slaAlertStore";

const TYPE_LABEL: Record<string, string> = { order: "Order", po: "PO", ticket: "Ticket" };
const TYPE_COLOR: Record<string, { bg: string; color: string }> = {
  order:  { bg: "#eff6ff", color: "#1d4ed8" },
  po:     { bg: "#faf5ff", color: "#7c3aed" },
  ticket: { bg: "#fef3c7", color: "#92400e" },
};

function AlertCard({ alert, onDismiss }: { alert: SLAAlert; onDismiss: () => void }) {
  const navigate = useNavigate();
  const isBreached = alert.sla.state === "breached";
  const borderColor = isBreached ? "#ef4444" : "#f59e0b";
  const bgColor     = isBreached ? "#fef2f2" : "#fffbeb";
  const textColor   = isBreached ? "#991b1b" : "#92400e";
  const Icon = isBreached ? XCircle : AlertTriangle;
  const tc = TYPE_COLOR[alert.type];

  return (
    <div style={{
      borderLeft: `3px solid ${borderColor}`,
      background: bgColor,
      borderRadius: "0 8px 8px 0",
      padding: "10px 12px",
      marginBottom: 8,
      position: "relative",
    }}>
      <button
        onClick={onDismiss}
        title="Dismiss"
        style={{
          position: "absolute", top: 8, right: 8,
          background: "none", border: "none", cursor: "pointer",
          color: "#9ca3af", padding: 2, display: "flex", alignItems: "center",
        }}
      >
        <X size={13} />
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
        <Icon size={13} color={borderColor} />
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 8,
          background: tc.bg, color: tc.color, letterSpacing: 0.3,
        }}>
          {TYPE_LABEL[alert.type]}
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "#111827" }}>{alert.id}</span>
        <span style={{ fontSize: 11, color: "#6b7280", marginLeft: "auto", paddingRight: 20 }}>
          {alert.status}
        </span>
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: textColor, marginBottom: 3 }}>
        {isBreached ? `⏰ ${alert.sla.label} SLA` : `⚡ ${alert.sla.label}`}
      </div>
      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 7 }}>
        {isBreached
          ? "SLA deadline has passed"
          : `Warning — ${Math.round(alert.sla.pctUsed)}% of SLA window used`}
      </div>

      <div style={{ height: 3, background: "#e5e7eb", borderRadius: 2, overflow: "hidden", marginBottom: 7 }}>
        <div style={{
          height: "100%", borderRadius: 2,
          width: `${Math.min(100, alert.sla.pctUsed)}%`,
          background: borderColor,
        }} />
      </div>

      <button
        onClick={() => { navigate(alert.href); onDismiss(); }}
        style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          fontSize: 11.5, fontWeight: 600, color: isBreached ? "#dc2626" : "#d97706",
          background: "none", border: "none", cursor: "pointer", padding: 0,
        }}
      >
        View {TYPE_LABEL[alert.type]} <ArrowRight size={11} />
      </button>
    </div>
  );
}

export default function SLANotificationPopup() {
  const { alerts, rescan } = useSLAAlerts();
  const [open, setOpen]           = useState(false);
  const [localAlerts, setLocalAlerts] = useState<SLAAlert[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setLocalAlerts(alerts); }, [alerts]);

  // Auto-open once when new alerts arrive
  const prevCountRef = useRef(0);
  useEffect(() => {
    if (alerts.length > prevCountRef.current && !open) setOpen(true);
    prevCountRef.current = alerts.length;
  }, [alerts.length, open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleDismiss = (alert: SLAAlert) => {
    dismissAlert(alert.key);
    setLocalAlerts(prev => prev.filter(a => a.key !== alert.key));
  };

  const handleDismissAll = () => {
    dismissAlerts(localAlerts.map(a => a.key));
    setLocalAlerts([]);
    setOpen(false);
  };

  const breachedCount = localAlerts.filter(a => a.sla.state === "breached").length;
  const warningCount  = localAlerts.filter(a => a.sla.state === "warning").length;
  const totalCount    = localAlerts.length;
  const badgeColor    = breachedCount > 0 ? "#ef4444" : "#f59e0b";

  return (
    /* Inline wrapper — position:relative so the panel anchors to this button */
    <div ref={wrapperRef} style={{ position: "relative" }}>

      {/* Bell trigger — styled to match the TopBar icon buttons */}
      <button
        onClick={() => { rescan(); setOpen(v => !v); }}
        title={totalCount > 0 ? `${totalCount} SLA alert${totalCount > 1 ? "s" : ""}` : "SLA Alerts — all clear"}
        className="relative p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
      >
        <Bell size={20} />
        {/* Red dot when there are alerts */}
        {totalCount > 0 && (
          <span style={{
            position: "absolute", top: 4, right: 4,
            background: badgeColor,
            color: "#fff", borderRadius: 10, fontSize: 9,
            padding: "0px 4px", fontWeight: 700,
            border: "1.5px solid white",
            minWidth: 16, textAlign: "center",
            lineHeight: "14px",
          }}>
            {totalCount}
          </span>
        )}
      </button>

      {/* Dropdown panel — opens DOWNWARD, aligned to the right of the button */}
      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 8px)",
          right: 0,
          width: 340,
          maxHeight: 480,
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          zIndex: 9999,
        }}>
          {/* Panel header */}
          <div style={{
            padding: "12px 16px", borderBottom: "1px solid #f3f4f6",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "#fafafa", flexShrink: 0,
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#111827", display: "flex", alignItems: "center", gap: 6 }}>
                <Bell size={14} /> SLA Alerts
                {totalCount > 0 && (
                  <span style={{ background: badgeColor, color: "#fff", borderRadius: 10, fontSize: 11, padding: "1px 6px", fontWeight: 700 }}>
                    {totalCount}
                  </span>
                )}
              </div>
              {totalCount > 0 && (
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                  {breachedCount > 0 && <span style={{ color: "#dc2626", fontWeight: 600 }}>{breachedCount} breached</span>}
                  {breachedCount > 0 && warningCount > 0 && " · "}
                  {warningCount > 0 && <span style={{ color: "#d97706", fontWeight: 600 }}>{warningCount} warning</span>}
                </div>
              )}
            </div>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
              <X size={16} />
            </button>
          </div>

          {/* Content */}
          {totalCount > 0 ? (
            <>
              <div style={{ overflowY: "auto", padding: "10px 12px", flex: 1 }}>
                {localAlerts.map(alert => (
                  <AlertCard key={alert.key} alert={alert} onDismiss={() => handleDismiss(alert)} />
                ))}
              </div>
              <div style={{ padding: "10px 14px", borderTop: "1px solid #f3f4f6", flexShrink: 0 }}>
                <button
                  onClick={handleDismissAll}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, width: "100%",
                    padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: 8,
                    background: "#f9fafb", cursor: "pointer", fontSize: 12.5,
                    fontWeight: 600, color: "#374151", fontFamily: "inherit", justifyContent: "center",
                  }}
                >
                  <CheckCheck size={13} /> Dismiss All
                </button>
              </div>
            </>
          ) : (
            <div style={{ padding: "24px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
              <div style={{ fontWeight: 600, fontSize: 13.5, color: "#111827" }}>All SLAs on track</div>
              <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>No warnings or breaches right now.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
