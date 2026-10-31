// Tracks which SLA alerts the user has already dismissed so they don't
// reappear on the next scan cycle unless the SLA state changes.

const KEY = "nido_sla_dismissed_alerts";

export function getDismissedAlerts(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function dismissAlert(key: string): void {
  try {
    const set = getDismissedAlerts();
    set.add(key);
    localStorage.setItem(KEY, JSON.stringify([...set]));
  } catch {
    // ignore
  }
}

export function dismissAlerts(keys: string[]): void {
  try {
    const set = getDismissedAlerts();
    keys.forEach(k => set.add(k));
    localStorage.setItem(KEY, JSON.stringify([...set]));
  } catch {
    // ignore
  }
}

/** Remove a dismissed key (e.g. when item is resolved so it can re-alert if it re-opens) */
export function undismissAlert(key: string): void {
  try {
    const set = getDismissedAlerts();
    set.delete(key);
    localStorage.setItem(KEY, JSON.stringify([...set]));
  } catch {
    // ignore
  }
}
