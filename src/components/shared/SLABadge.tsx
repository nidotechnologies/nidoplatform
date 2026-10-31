// Reusable SLA badge — shows live status + time remaining/over.
// Driven by slaUtils.computeSLAStatus(); no internal timers.

import { Clock, CheckCircle, XCircle, AlertTriangle, Minus } from "lucide-react";
import { SLAStatus, SLAState } from "@/lib/slaUtils";

const STATE_CONFIG: Record<SLAState, {
  bg: string; color: string; border: string; Icon: React.ElementType;
}> = {
  'on-track':  { bg: "#f0fdf4", color: "#166534", border: "#bbf7d0", Icon: Clock },
  'warning':   { bg: "#fffbeb", color: "#92400e", border: "#fcd34d", Icon: AlertTriangle },
  'breached':  { bg: "#fef2f2", color: "#991b1b", border: "#fecaca", Icon: XCircle },
  'sla-met':   { bg: "#f0fdf4", color: "#166534", border: "#bbf7d0", Icon: CheckCircle },
  'sla-missed':{ bg: "#fef2f2", color: "#991b1b", border: "#fecaca", Icon: XCircle },
  'unknown':   { bg: "#f9fafb", color: "#6b7280", border: "#e5e7eb", Icon: Minus },
};

interface Props {
  sla: SLAStatus;
  /** compact mode — icon + label only, no progress bar */
  compact?: boolean;
  /** class to apply to the outer element */
  className?: string;
}

export default function SLABadge({ sla, compact = false, className = "" }: Props) {
  const cfg = STATE_CONFIG[sla.state];
  const { Icon } = cfg;

  if (compact) {
    return (
      <span
        className={className}
        style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "3px 9px", borderRadius: 12, fontSize: 11.5, fontWeight: 500,
          background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
          whiteSpace: "nowrap",
        }}
      >
        <Icon size={11} />
        {sla.label}
      </span>
    );
  }

  return (
    <div
      className={className}
      style={{
        border: `1px solid ${cfg.border}`, borderRadius: 8, padding: "8px 12px",
        background: cfg.bg, minWidth: 160,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
        <Icon size={13} color={cfg.color} />
        <span style={{ fontSize: 12, fontWeight: 600, color: cfg.color }}>
          {STATE_LABEL[sla.state]}
        </span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: cfg.color, marginBottom: 4 }}>
        {sla.label}
      </div>
      {/* Progress bar */}
      <div style={{ height: 4, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
        <div
          style={{
            height: "100%", borderRadius: 4,
            width: `${Math.min(100, sla.pctUsed)}%`,
            background: cfg.color,
            transition: "width 0.3s",
          }}
        />
      </div>
      {sla.deadlineISO && sla.state !== 'sla-met' && sla.state !== 'sla-missed' && sla.state !== 'unknown' && (
        <div style={{ fontSize: 10.5, color: "#9ca3af", marginTop: 4 }}>
          Due: {new Date(sla.deadlineISO).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
        </div>
      )}
    </div>
  );
}

const STATE_LABEL: Record<SLAState, string> = {
  'on-track':   "On Track",
  'warning':    "Warning",
  'breached':   "SLA Breached",
  'sla-met':    "SLA Met",
  'sla-missed': "SLA Missed",
  'unknown':    "No SLA",
};
