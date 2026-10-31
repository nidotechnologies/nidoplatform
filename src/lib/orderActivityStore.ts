export type ActivityEventType = "activity" | "status-change";

export interface ActivityNote {
  id: string;
  author: string;
  initials?: string;
  color?: string;
  date: string;
  text: string;
  visibility: string;
  kind?: ActivityEventType;
}

const orderNotesKey = (orderId: string) => `nido_notes_${orderId}`;

function formatDate(date = new Date()): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }) + " " + date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getActivityActor(fallback = "System"): string {
  try {
    const session = JSON.parse(localStorage.getItem("nido_user") || "null");
    return session?.name || session?.email || fallback;
  } catch {
    return fallback;
  }
}

export function createActivityNote(
  text: string,
  options: {
    actor?: string;
    eventType?: ActivityEventType;
    visibility?: string;
    id?: string;
    date?: string;
  } = {},
): ActivityNote {
  const actor = options.actor?.trim() || getActivityActor();
  const initials = actor
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase() || "SY";
  return {
    id: options.id || `activity_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    author: actor,
    initials,
    color: options.eventType === "status-change" ? "#d97706" : "#6b7280",
    date: options.date || formatDate(),
    text,
    visibility: options.visibility || "Internal Note",
    kind: options.eventType || "activity",
  };
}

function readOrderNotes(orderId: string): ActivityNote[] {
  if (!orderId) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(orderNotesKey(orderId)) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendOrderActivity(
  orderId: string,
  text: string,
  options: Parameters<typeof createActivityNote>[1] = {},
): ActivityNote | null {
  if (!orderId || !text.trim()) return null;
  const note = createActivityNote(text, options);
  const notes = readOrderNotes(orderId);
  if (notes.some(existing => existing.id === note.id)) return note;
  try {
    localStorage.setItem(orderNotesKey(orderId), JSON.stringify([note, ...notes]));
    window.dispatchEvent(new CustomEvent("orderNotesUpdated", { detail: { orderId } }));
  } catch {
    // The business action should not fail because the optional audit trail
    // could not be written.
  }
  return note;
}

export function appendOrderActivityOnce(
  orderId: string,
  eventId: string,
  text: string,
  options: Parameters<typeof createActivityNote>[1] = {},
): ActivityNote | null {
  if (!orderId || !eventId) return null;
  const existing = readOrderNotes(orderId);
  if (existing.some(note => note.id === eventId)) return null;
  return appendOrderActivity(orderId, text, { ...options, id: eventId });
}

export function formatActivityDate(date = new Date()): string {
  return formatDate(date);
}