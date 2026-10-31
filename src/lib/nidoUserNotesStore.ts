export interface NidoUserNote {
  id: string;
  userId: string;
  text: string;
  author: string;
  createdAt: string;
}

const NOTES_KEY = "nido_user_notes";
export const NIDO_USER_NOTES_EVENT = "nidoUserNotesUpdated";

type NotesByUser = Record<string, NidoUserNote[]>;

function getAllNotes(): NotesByUser {
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as NotesByUser;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function getUserNotes(userId: string): NidoUserNote[] {
  return getAllNotes()[userId] ?? [];
}

export function addUserNote(userId: string, note: NidoUserNote): void {
  const allNotes = getAllNotes();
  allNotes[userId] = [note, ...(allNotes[userId] ?? [])];
  localStorage.setItem(NOTES_KEY, JSON.stringify(allNotes));
  window.dispatchEvent(new Event(NIDO_USER_NOTES_EVENT));
}