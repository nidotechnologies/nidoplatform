import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Activity,
  BriefcaseBusiness,
  Check,
  Download,
  FileText,
  KeyRound,
  LockKeyhole,
  Plus,
  Pencil,
  Shield,
  ShieldCheck,
  Users,
  Upload,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionsMenu, ResetPasswordDialog } from "@/components/configuration/ManageUsersPanel";
import { getUsers, type NidoUser, NIDO_USERS_EVENT } from "@/lib/nidoUsersStore";
import {
  addUserDocuments,
  getUserDocuments,
  NIDO_USER_DOCUMENTS_EVENT,
  type NidoUserDocument,
} from "@/lib/nidoUserDocumentsStore";
import { getRolePermissions, MODULES, PERMISSIONS_EVENT } from "@/lib/permissionsStore";
import { useAuth } from "@/contexts/AuthContext";
import {
  addUserNote,
  getUserNotes,
  NIDO_USER_NOTES_EVENT,
  type NidoUserNote,
} from "@/lib/nidoUserNotesStore";

type DetailTab = "overview" | "documents" | "notes";

const tabs: { id: DetailTab; label: string; icon: typeof UserRound }[] = [
  { id: "overview", label: "Overview", icon: UserRound },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "notes", label: "Notes", icon: FileText },
];

const cardClass = "rounded-xl border border-border bg-card shadow-sm";
const labelClass = "text-xs text-muted-foreground";
const valueClass = "text-sm font-semibold text-foreground";

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function StatusBadge({ status }: { status: NidoUser["status"] }) {
  const styles = status === "Active"
    ? "border-green-200 bg-green-50 text-green-700"
    : status === "Suspended"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-slate-200 bg-slate-50 text-slate-600";
  return <Badge className={`rounded-full border px-2.5 py-1 ${styles}`}>{status}</Badge>;
}

function SummaryCard({
  icon,
  tone,
  value,
  label,
  detail,
}: {
  icon: React.ReactNode;
  tone: string;
  value: string;
  label: string;
  detail: string;
}) {
  return (
    <div className={`${cardClass} min-h-[132px] p-5`}>
      <div className={`mb-4 flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}>{icon}</div>
      <div className="text-xl font-bold text-foreground">{value}</div>
      <div className="mt-1 text-sm font-medium text-foreground">{label}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function EmptyTab({ label }: { label: string }) {
  return (
    <div className={`${cardClass} flex min-h-48 items-center justify-center p-8`}>
      <div className="text-center">
        <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
        <p className="text-sm font-medium text-foreground">No {label.toLowerCase()} available</p>
        <p className="mt-1 text-xs text-muted-foreground">Information will appear here when it is added.</p>
      </div>
    </div>
  );
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error(`Unable to read ${file.name}.`));
    };
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function createDocumentId() {
  return `document-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createNoteId() {
  return `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function NidoUserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<NidoUser[]>(() => getUsers());
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [documents, setDocuments] = useState<NidoUserDocument[]>([]);
  const [documentsError, setDocumentsError] = useState("");
  const [uploadingDocuments, setUploadingDocuments] = useState(false);
  const [notes, setNotes] = useState<NidoUserNote[]>([]);
  const [noteText, setNoteText] = useState("");
  const [notesError, setNotesError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = () => setUsers(getUsers());

  useEffect(() => {
    window.addEventListener(NIDO_USERS_EVENT, refresh);
    window.addEventListener(PERMISSIONS_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(NIDO_USERS_EVENT, refresh);
      window.removeEventListener(PERMISSIONS_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    const refreshDocuments = () => {
      if (userId) setDocuments(getUserDocuments(userId));
    };
    refreshDocuments();
    window.addEventListener(NIDO_USER_DOCUMENTS_EVENT, refreshDocuments);
    window.addEventListener("storage", refreshDocuments);
    return () => {
      window.removeEventListener(NIDO_USER_DOCUMENTS_EVENT, refreshDocuments);
      window.removeEventListener("storage", refreshDocuments);
    };
  }, [userId]);

  useEffect(() => {
    const refreshNotes = () => {
      if (userId) setNotes(getUserNotes(userId));
    };
    refreshNotes();
    window.addEventListener(NIDO_USER_NOTES_EVENT, refreshNotes);
    window.addEventListener("storage", refreshNotes);
    return () => {
      window.removeEventListener(NIDO_USER_NOTES_EVENT, refreshNotes);
      window.removeEventListener("storage", refreshNotes);
    };
  }, [userId]);

  const selectedUser = users.find((candidate) => candidate.id === userId);
  const permissions = useMemo(
    () => selectedUser ? getRolePermissions(selectedUser.role) : {},
    [selectedUser],
  );
  const grantedPermissions = MODULES.filter((module) => {
    const entry = permissions[module.key];
    return entry && Object.values(entry).some(Boolean);
  }).length;
  const accessLevel = selectedUser?.role === "System Owner" ? "Full Access" : `${grantedPermissions} Modules`;

  if (!selectedUser) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className={`${cardClass} max-w-md p-8 text-center`}>
          <h1 className="text-h2">User not found</h1>
          <p className="mt-2 text-body-sm text-muted-foreground">This employee may have been removed from NIDO Users.</p>
          <Button className="mt-5" onClick={() => navigate("/configuration/nido-users?tab=users")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Users
          </Button>
        </div>
      </div>
    );
  }

  const initials = selectedUser.name.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "?";
  const activity = [
    ...(selectedUser.loginHistory ?? []).slice(-3).reverse().map((entry) => ({
      action: entry.result === "success" ? "LOGIN" : "LOGIN ATTEMPT",
      by: selectedUser.name,
      details: entry.result === "success" ? "Logged in to the system" : `Sign-in attempt: ${entry.result.replaceAll("_", " ")}`,
      date: new Date(entry.timestamp).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
    })),
    { action: "PROFILE UPDATED", by: "System", details: "User details saved", date: formatDate(selectedUser.updatedAt) },
    { action: "ACCOUNT CREATED", by: "System", details: "User account created", date: formatDate(selectedUser.createdAt) },
  ];

  const handleDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;

    setUploadingDocuments(true);
    setDocumentsError("");
    try {
      const uploadedAt = new Date().toISOString();
      const newDocuments = await Promise.all(
        files.map(async (file): Promise<NidoUserDocument> => ({
          id: createDocumentId(),
          userId: selectedUser.id,
          name: file.name,
          type: file.type || "application/octet-stream",
          sizeBytes: file.size,
          dataUrl: await readFileAsDataUrl(file),
          uploadedAt,
        })),
      );
      addUserDocuments(selectedUser.id, newDocuments);
      setDocuments(getUserDocuments(selectedUser.id));
    } catch (error) {
      setDocumentsError(
        error instanceof DOMException && error.name === "QuotaExceededError"
          ? "These files are too large to store in this browser. Try uploading smaller files."
          : error instanceof Error
            ? error.message
            : "Unable to upload the selected documents.",
      );
    } finally {
      setUploadingDocuments(false);
    }
  };

  const downloadDocument = (document: NidoUserDocument) => {
    const link = window.document.createElement("a");
    link.href = document.dataUrl;
    link.download = document.name;
    link.click();
  };

  const handleAddNote = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = noteText.trim();
    if (!text || !selectedUser) {
      setNotesError(text ? "Unable to add this note." : "Enter a note before adding it.");
      return;
    }

    const note: NidoUserNote = {
      id: createNoteId(),
      userId: selectedUser.id,
      text,
      author: currentUser?.name || currentUser?.email || "NIDO Admin",
      createdAt: new Date().toISOString(),
    };
    addUserNote(selectedUser.id, note);
    setNotes(getUserNotes(selectedUser.id));
    setNoteText("");
    setNotesError("");
  };

  return (
    <div className="min-h-screen bg-background px-3 py-4 sm:px-5 md:px-6 md:py-6">
      <div className="mx-auto max-w-[1440px] space-y-4">
        <div className={`${cardClass} flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5`}>
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/configuration/nido-users?tab=users")} aria-label="Back to NIDO users">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-xl font-bold text-blue-600">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-h1 truncate">{selectedUser.name}</h1>
                <StatusBadge status={selectedUser.status} />
              </div>
              <p className="mt-1 text-body-sm text-muted-foreground">
                {selectedUser.employeeId || "No employee ID"} <span className="mx-1">•</span> {selectedUser.role || "No role assigned"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => navigate(`/configuration/nido-users/users/${encodeURIComponent(selectedUser.id)}/edit`)}
            >
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </Button>
            <Button variant="outline" onClick={() => setResetPasswordOpen(true)}>
              <LockKeyhole className="mr-2 h-4 w-4" /> Reset Password
            </Button>
            <ActionsMenu
              user={selectedUser}
              onEdit={() => navigate(`/configuration/nido-users/users/${encodeURIComponent(selectedUser.id)}/edit`)}
              onRefresh={refresh}
            />
          </div>
        </div>

        <div className="overflow-x-auto border-b border-border">
          <div className="flex min-w-max gap-1">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                  activeTab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "overview" && (
          <>
            <section className={`${cardClass} p-5 sm:p-6`}>
              <h2 className="text-h3 mb-5">Employee Information</h2>
              <div className="grid gap-6 md:grid-cols-[112px_1fr]">
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-100 text-4xl font-semibold text-blue-600">{initials}</div>
                  <div className="mt-3 w-full">
                    <div className={labelClass}>Designation</div>
                    <div className={`${valueClass} mt-1 break-words`}>{selectedUser.designation || selectedUser.jobTitle || "—"}</div>
                  </div>
                </div>
                <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ["Full Name", selectedUser.name],
                    ["Employee ID", selectedUser.employeeId || "—"],
                    ["Email", selectedUser.email || "—"],
                    ["Phone", selectedUser.phone || "—"],
                    ["Role", selectedUser.role || "—"],
                    ["Department", selectedUser.department || "—"],
                    ["Job Title", selectedUser.jobTitle || "—"],
                    ["Reporting Manager", selectedUser.reportingManager || "—"],
                    ["Date of Joining", formatDate(selectedUser.dateOfJoining || selectedUser.createdAt)],
                    ["Password", selectedUser.password ? "••••••••" : "Not set"],
                    ["Last Login", selectedUser.lastLogin || "Never"],
                    ["Status", <StatusBadge key="status" status={selectedUser.status} />],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="border-b border-border pb-3 last:border-0">
                      <div className={labelClass}>{label}</div>
                      <div className={`${valueClass} mt-2 break-words`}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-h3 mb-4">Role &amp; Access Summary</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryCard icon={<ShieldCheck className="h-5 w-5 text-blue-600" />} tone="bg-blue-50" value="1" label="Primary Role" detail={selectedUser.role || "Not assigned"} />
                <SummaryCard icon={<Users className="h-5 w-5 text-purple-600" />} tone="bg-purple-50" value={selectedUser.department || "All"} label="Department Access" detail={selectedUser.role === "System Owner" ? "All Departments" : selectedUser.department || "Assigned department"} />
                <SummaryCard icon={<KeyRound className="h-5 w-5 text-green-600" />} tone="bg-green-50" value={accessLevel} label="System Access Level" detail="Role-based access" />
                <SummaryCard icon={<BriefcaseBusiness className="h-5 w-5 text-amber-600" />} tone="bg-amber-50" value={String(grantedPermissions || 0)} label="Permissions" detail="Modules granted" />
              </div>
            </section>

            <section className={`${cardClass} overflow-hidden`}>
              <div className="border-b border-border p-5">
                <h2 className="text-h3">Recent Activity</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px]">
                  <thead className="bg-muted/40">
                    <tr>
                      {["Action", "Performed By", "Details", "Date & Time"].map((heading) => <th key={heading} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{heading}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {activity.map((entry) => (
                      <tr key={entry.action} className="border-t border-border">
                        <td className="px-5 py-3"><span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">{entry.action}</span></td>
                        <td className="px-5 py-3 text-sm">{entry.by}</td>
                        <td className="px-5 py-3 text-sm text-muted-foreground">{entry.details}</td>
                        <td className="px-5 py-3 text-sm text-muted-foreground">{entry.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" className="flex w-full items-center justify-center gap-2 border-t border-border py-4 text-sm font-semibold text-primary hover:bg-muted/30">
                View all activity logs <span>→</span>
              </button>
            </section>
          </>
        )}

        {activeTab === "documents" && (
          <section className={`${cardClass} overflow-hidden`}>
            <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div>
                <h2 className="text-h3">Documents</h2>
                <p className="mt-1 text-body-sm text-muted-foreground">
                  Upload and download documents for {selectedUser.name}.
                </p>
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleDocumentUpload}
                />
                <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingDocuments}>
                  <Upload className="mr-2 h-4 w-4" />
                  {uploadingDocuments ? "Uploading…" : "Add Documents"}
                </Button>
              </div>
            </div>
            {documentsError && (
              <p className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">{documentsError}</p>
            )}
            {documents.length === 0 ? (
              <div className="flex min-h-48 items-center justify-center p-8">
                <div className="text-center">
                  <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
                  <p className="text-sm font-medium text-foreground">No documents uploaded</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Select one or more files to add them to this employee&apos;s profile.
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {documents.map((document) => (
                  <div key={document.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground" title={document.name}>{document.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatFileSize(document.sizeBytes)} · Added {formatDate(document.uploadedAt)}
                        </p>
                      </div>
                    </div>
                    <Button type="button" variant="outline" onClick={() => downloadDocument(document)}>
                      <Download className="mr-2 h-4 w-4" /> Download
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
        {activeTab === "notes" && (
          <section className={`${cardClass} overflow-hidden`}>
            <div className="border-b border-border p-5 sm:p-6">
              <h2 className="text-h3">Notes</h2>
              <p className="mt-1 text-body-sm text-muted-foreground">
                Add notes about {selectedUser.name}. Notes are saved to this employee&apos;s profile.
              </p>
            </div>

            <form onSubmit={handleAddNote} className="border-b border-border p-5 sm:p-6">
              <label htmlFor="nido-user-note" className="mb-2 block text-sm font-semibold text-foreground">
                Add Note
              </label>
              <textarea
                id="nido-user-note"
                value={noteText}
                onChange={(event) => {
                  setNoteText(event.target.value);
                  if (notesError) setNotesError("");
                }}
                placeholder="Write a note about this employee..."
                rows={4}
                maxLength={2000}
                className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-muted-foreground">
                  {noteText.length}/2000 characters
                  {notesError && <span className="ml-3 text-red-600">{notesError}</span>}
                </div>
                <Button type="submit" disabled={!noteText.trim()}>
                  <Plus className="mr-2 h-4 w-4" /> Add Note
                </Button>
              </div>
            </form>

            {notes.length === 0 ? (
              <div className="flex min-h-48 items-center justify-center p-8">
                <div className="text-center">
                  <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
                  <p className="text-sm font-medium text-foreground">No notes added</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Add the first note using the form above.
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notes.map((note) => (
                  <article key={note.id} className="p-5 sm:p-6">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{note.text}</p>
                      <time
                        dateTime={note.createdAt}
                        className="shrink-0 text-xs text-muted-foreground sm:pl-5"
                      >
                        {new Date(note.createdAt).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </time>
                    </div>
                    <p className="mt-3 text-xs font-medium text-muted-foreground">Added by {note.author}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
      <ResetPasswordDialog user={selectedUser} open={resetPasswordOpen} onOpenChange={setResetPasswordOpen} />
    </div>
  );
}