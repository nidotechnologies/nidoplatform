// ─── SLA Runtime Utilities ────────────────────────────────────────────────────
// Compute live SLA status from a start date + configured target hours.
// Used by every module that displays SLA timers.

export type SLAState = 'on-track' | 'warning' | 'breached' | 'sla-met' | 'sla-missed' | 'unknown';

export interface SLAStatus {
  state: SLAState;
  hoursElapsed: number;
  hoursRemaining: number;
  pctUsed: number;       // 0-100 — how much of the SLA window has elapsed
  label: string;         // human-readable: "4h 30m left", "2h over SLA", etc.
  deadlineISO: string;   // ISO string of when the SLA expires
}

function formatHours(hrs: number): string {
  const h = Math.floor(Math.abs(hrs));
  const m = Math.round((Math.abs(hrs) - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Parse a loose date string (e.g. "Jan 15, 2026", "2026-01-15", ISO) into a Date.
 * Falls back to null on failure.
 */
export function parseLooseDate(raw: string | null | undefined, timeStr?: string): Date | null {
  if (!raw) return null;
  try {
    // Already ISO-ish (2026-01-15 or 2026-01-15T...)
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      const base = timeStr ? `${raw}T${to24(timeStr)}` : raw;
      const d = new Date(base);
      return isNaN(d.getTime()) ? null : d;
    }
    // Formatted like "Jan 15, 2026"
    const withTime = timeStr ? `${raw} ${timeStr}` : raw;
    const d = new Date(withTime);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function to24(timeStr: string): string {
  // Convert "9:30 AM" → "09:30:00"
  try {
    const [time, ampm] = timeStr.trim().split(' ');
    let [h, m] = time.split(':').map(Number);
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}:00`;
  } catch {
    return '00:00:00';
  }
}

/**
 * Core computation.
 * @param start  — when the workflow/ticket/order started (Date or parseable string)
 * @param targetHrs — SLA target window in hours (from slaEngine)
 * @param isCompleted — true if the item is in a terminal state (Delivered, Resolved, etc.)
 */
export function computeSLAStatus(
  start: Date | string | null | undefined,
  targetHrs: number,
  isCompleted = false,
): SLAStatus {
  const unknown: SLAStatus = { state: 'unknown', hoursElapsed: 0, hoursRemaining: targetHrs, pctUsed: 0, label: '—', deadlineISO: '' };

  if (!start || targetHrs <= 0) return unknown;

  const startDate = start instanceof Date ? start : parseLooseDate(start as string);
  if (!startDate || isNaN(startDate.getTime())) return unknown;

  const now = new Date();
  const deadlineDate = new Date(startDate.getTime() + targetHrs * 3600 * 1000);
  const hoursElapsed = (now.getTime() - startDate.getTime()) / 3600000;
  const hoursRemaining = targetHrs - hoursElapsed;
  const pctUsed = Math.min(100, Math.max(0, (hoursElapsed / targetHrs) * 100));

  if (isCompleted) {
    const met = hoursElapsed <= targetHrs;
    return {
      state: met ? 'sla-met' : 'sla-missed',
      hoursElapsed, hoursRemaining, pctUsed,
      label: met ? `Met SLA (${formatHours(hoursElapsed)} / ${targetHrs}h)` : `SLA Missed (+${formatHours(-hoursRemaining)})`,
      deadlineISO: deadlineDate.toISOString(),
    };
  }

  if (hoursRemaining < 0) {
    return { state: 'breached', hoursElapsed, hoursRemaining, pctUsed: 100, label: `${formatHours(-hoursRemaining)} over`, deadlineISO: deadlineDate.toISOString() };
  }
  if (pctUsed >= 80) {
    return { state: 'warning', hoursElapsed, hoursRemaining, pctUsed, label: `${formatHours(hoursRemaining)} left`, deadlineISO: deadlineDate.toISOString() };
  }
  return { state: 'on-track', hoursElapsed, hoursRemaining, pctUsed, label: `${formatHours(hoursRemaining)} left`, deadlineISO: deadlineDate.toISOString() };
}
