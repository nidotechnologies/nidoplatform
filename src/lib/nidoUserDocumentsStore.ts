export interface NidoUserDocument {
  id: string;
  userId: string;
  name: string;
  type: string;
  sizeBytes: number;
  dataUrl: string;
  uploadedAt: string;
}

const DOCUMENTS_KEY = "nido_user_documents";
export const NIDO_USER_DOCUMENTS_EVENT = "nidoUserDocumentsUpdated";

type DocumentsByUser = Record<string, NidoUserDocument[]>;

function getAllDocuments(): DocumentsByUser {
  try {
    const raw = localStorage.getItem(DOCUMENTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DocumentsByUser;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function getUserDocuments(userId: string): NidoUserDocument[] {
  return getAllDocuments()[userId] ?? [];
}

export function saveUserDocuments(userId: string, documents: NidoUserDocument[]): void {
  const allDocuments = getAllDocuments();
  allDocuments[userId] = documents;
  localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(allDocuments));
  window.dispatchEvent(new Event(NIDO_USER_DOCUMENTS_EVENT));
}

export function addUserDocuments(userId: string, documents: NidoUserDocument[]): void {
  saveUserDocuments(userId, [...getUserDocuments(userId), ...documents]);
}
