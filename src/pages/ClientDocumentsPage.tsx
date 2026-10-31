import { useState, useRef, useEffect } from "react";
import {
  FileText, MoreVertical, FilePlus, Download, Archive,
  X, Upload, ArrowLeft,
} from "lucide-react";
import { getClientDocuments, saveClientDocument, type ClientDocumentRecord } from "@/lib/clientDataStore";

type Doc = {
  id: string;
  clientId?: string;
  name: string;
  type: string;
  size: string;
  uploadedBy: string;
  uploadedOn: string;
  fileData?: string;
};

const INITIAL_DOCS: Doc[] = [
  { id: 1, name: "Service Agreement 2026.pdf", type: "PDF", size: "1.2 MB", uploadedBy: "Nitin Shetty", uploadedOn: "Jun 10, 2026" },
  { id: 2, name: "Purchase Order #PO-0043.pdf", type: "PDF", size: "840 KB", uploadedBy: "Admin", uploadedOn: "Jun 5, 2026" },
  { id: 3, name: "NDA_NitinSupplies.docx", type: "DOCX", size: "320 KB", uploadedBy: "Admin", uploadedOn: "May 28, 2026" },
  { id: 4, name: "Hardware Inventory List.xlsx", type: "XLSX", size: "2.1 MB", uploadedBy: "Nitin Shetty", uploadedOn: "May 15, 2026" },
  { id: 5, name: "Contract Renewal Terms.pdf", type: "PDF", size: "560 KB", uploadedBy: "Admin", uploadedOn: "Apr 30, 2026" },
];

function typeColor(type: string) {
  if (type === "PDF") return "bg-red-50 text-red-600";
  if (type === "DOCX") return "bg-blue-50 text-blue-600";
  if (type === "XLSX") return "bg-green-50 text-green-600";
  return "bg-gray-100 text-gray-600";
}

function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    function listener(e: MouseEvent) {
      if (!ref.current || ref.current.contains(e.target as Node)) return;
      handler();
    }
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, [ref, handler]);
}

function DropdownMenu({
  items,
  onClose,
}: {
  items: { label: string; icon: React.ReactNode; danger?: boolean; onClick?: () => void }[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, onClose);
  return (
    <div
      ref={ref}
      className="absolute z-50 top-8 right-0 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[170px]"
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => { item.onClick?.(); onClose(); }}
          className={`w-full flex items-center gap-2.5 px-2 py-2.5 text-sm hover:bg-gray-50 transition-colors ${
            item.danger ? "text-red-500" : "text-gray-700"
          }`}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}

function AddDocumentModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (doc: Omit<Doc, "id">, file: File | null) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("PDF");
  const [uploadedBy, setUploadedBy] = useState("Admin");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd(
      {
        name: name.trim() + (name.includes(".") ? "" : `.${type.toLowerCase()}`),
        type,
        size: file ? `${(file.size / 1024).toFixed(0)} KB` : "—",
        uploadedBy,
        uploadedOn: today,
      },
      file,
    );
    onClose();
  }

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setFile(picked);
    setName(picked.name);
    const ext = picked.name.split(".").pop()?.toUpperCase();
    if (ext === "PDF" || ext === "DOCX" || ext === "XLSX") setType(ext);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-2 py-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <FilePlus size={18} className="text-blue-500" />
            <h2 className="text-sm font-semibold text-gray-900">Add Document</h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-xl p-2 flex flex-col items-center gap-2 cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
          >
            <Upload size={22} className="text-gray-400" />
            {file ? (
              <p className="text-xs text-blue-600 font-medium">{file.name}</p>
            ) : (
              <>
                <p className="text-xs font-medium text-gray-700">Click to upload a file</p>
                <p className="text-xs text-gray-400">PDF, DOCX, XLSX supported</p>
              </>
            )}
            <input ref={fileInputRef} type="file" accept=".pdf,.docx,.xlsx" className="hidden" onChange={handleFilePick} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Document Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Service Agreement 2026"
              className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition bg-white"
              >
                <option>PDF</option>
                <option>DOCX</option>
                <option>XLSX</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Uploaded By</label>
              <select
                value={uploadedBy}
                onChange={(e) => setUploadedBy(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition bg-white"
              >
                <option>Admin</option>
                <option>Nitin Shetty</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 rounded-lg bg-blue-600 text-sm text-white font-medium hover:bg-blue-700 transition-colors"
            >
              Add Document
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DocsTable({
  docs,
  readOnly,
  fileStore,
  onArchive,
  onRowMenuOpen,
  rowMenuOpen,
}: {
  docs: Doc[];
  readOnly?: boolean;
  fileStore: Map<string, File>;
  onArchive?: (id: number) => void;
  onRowMenuOpen?: (id: number | null) => void;
  rowMenuOpen?: number | null;
}) {
  function handleDownload(doc: Doc) {
    const stored = fileStore.get(doc.id);
    if (stored) {
      const url = URL.createObjectURL(stored);
      const a = document.createElement("a");
      a.href = url;
      a.download = stored.name;
      a.click();
      URL.revokeObjectURL(url);
    } else if (doc.fileData) {
      const a = document.createElement("a");
      a.href = doc.fileData;
      a.download = doc.name;
      a.click();
    } else {
      const content = [
        `Document: ${doc.name}`,
        `Type: ${doc.type}`,
        `Size: ${doc.size}`,
        `Uploaded By: ${doc.uploadedBy}`,
        `Uploaded On: ${doc.uploadedOn}`,
        "",
        "This is a placeholder download. Attach a real file via Add Document to download the original.",
      ].join("\n");
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.name.replace(/\.[^.]+$/, "") + ".txt";
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  if (docs.length === 0) {
    return (
      <div className="border border-gray-200 rounded-xl py-16 flex flex-col items-center gap-2 text-center">
        <FileText size={28} className="text-gray-300" />
        <p className="text-sm text-gray-400">{readOnly ? "No archived documents." : "No documents yet."}</p>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-2 py-2 text-xs font-medium text-gray-500">Name</th>
            <th className="text-left px-2 py-2 text-xs font-medium text-gray-500">Type</th>
            <th className="text-left px-2 py-2 text-xs font-medium text-gray-500">Size</th>
            <th className="text-left px-2 py-2 text-xs font-medium text-gray-500">Uploaded By</th>
            <th className="text-left px-2 py-2 text-xs font-medium text-gray-500">Uploaded On</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {docs.map((doc) => (
            <tr key={doc.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-gray-100">
                    <FileText size={14} className="text-gray-500" />
                  </div>
                  <span className="text-gray-800 font-medium text-xs">{doc.name}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${typeColor(doc.type)}`}>{doc.type}</span>
              </td>
              <td className="px-4 py-2 text-xs text-gray-500">{doc.size}</td>
              <td className="px-4 py-2 text-xs text-gray-500">{doc.uploadedBy}</td>
              <td className="px-4 py-2 text-xs text-gray-500">{doc.uploadedOn}</td>
              <td className="px-4 py-3">
                <div className="relative flex justify-end">
                  {!readOnly && (
                    <>
                      <button
                        onClick={() => onRowMenuOpen?.(rowMenuOpen === doc.id ? null : doc.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        <MoreVertical size={14} />
                      </button>
                      {rowMenuOpen === doc.id && (
                        <DropdownMenu
                          items={[
                            {
                              label: "Download",
                              icon: <Download size={15} />,
                              onClick: () => handleDownload(doc),
                            },
                            {
                              label: "Archive",
                              icon: <Archive size={15} />,
                              danger: true,
                              onClick: () => onArchive?.(doc.id),
                            },
                          ]}
                          onClose={() => onRowMenuOpen?.(null)}
                        />
                      )}
                    </>
                  )}
                  {readOnly && (
                    <button
                      onClick={() => handleDownload(doc)}
                      title="Download"
                      className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <Download size={14} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ClientDocumentsPage({ clientId }: { clientId: string }) {
  const [storedDocs, setStoredDocs] = useState<ClientDocumentRecord[]>(() => getClientDocuments(clientId));
  const docs = storedDocs.filter((doc) => !doc.archived);
  const archivedDocs = storedDocs.filter((doc) => doc.archived);
  const [view, setView] = useState<"active" | "archived">("active");
  const [pageMenuOpen, setPageMenuOpen] = useState(false);
  const [rowMenuOpen, setRowMenuOpen] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const fileStoreRef = useRef<Map<string, File>>(new Map());
  const pageMenuRef = useRef<HTMLDivElement>(null);
  useClickOutside(pageMenuRef, () => setPageMenuOpen(false));
  useEffect(() => {
    const reload = () => setStoredDocs(getClientDocuments(clientId));
    window.addEventListener("nidoClientDataUpdated", reload);
    return () => window.removeEventListener("nidoClientDataUpdated", reload);
  }, [clientId]);

  function handleArchive(id: number) {
    const doc = docs.find((d) => d.id === String(id));
    if (!doc) return;
    const next = { ...doc, archived: true };
    saveClientDocument(next);
    setStoredDocs(getClientDocuments(clientId));
  }

  async function handleAdd(newDoc: Omit<Doc, "id">, file: File | null) {
    const id = String(Date.now());
    if (file) fileStoreRef.current.set(id, file);
    let fileData: string | undefined;
    if (file) {
      fileData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
    }
    saveClientDocument({ id, clientId, ...newDoc, fileData });
    setStoredDocs(getClientDocuments(clientId));
  }

  function handleExport() {
    const list = view === "active" ? docs : archivedDocs;
    const header = "Name,Type,Size,Uploaded By,Uploaded On";
    const rows = list.map((d) =>
      [d.name, d.type, d.size, d.uploadedBy, d.uploadedOn]
        .map((v) => `"${v.replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `documents-${view}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const pageMenuItems = [
    {
      label: "Add Document",
      icon: <FilePlus size={15} />,
      onClick: () => setShowAddModal(true),
    },
    {
      label: "Export Documents List",
      icon: <Download size={15} />,
      onClick: handleExport,
    },
    {
      label: `Archived Documents${archivedDocs.length > 0 ? ` (${archivedDocs.length})` : ""}`,
      icon: <Archive size={15} />,
      onClick: () => setView("archived"),
    },
  ];

  const currentDocs = view === "active" ? docs : archivedDocs;

  return (
    <>
      {showAddModal && (
        <AddDocumentModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAdd}
        />
      )}

      <div className="p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            {view === "archived" && (
              <button
                onClick={() => setView("active")}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
              >
                <ArrowLeft size={14} />
              </button>
            )}
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                {view === "active" ? "Documents" : "Archived Documents"}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {view === "active"
                  ? `${docs.length} file${docs.length !== 1 ? "s" : ""} uploaded`
                  : `${archivedDocs.length} archived file${archivedDocs.length !== 1 ? "s" : ""} — read only`}
              </p>
            </div>
          </div>

          <div className="relative" ref={pageMenuRef}>
            <button
              onClick={() => setPageMenuOpen((o) => !o)}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
            >
              <MoreVertical size={16} />
            </button>
            {pageMenuOpen && (
              <DropdownMenu
                items={pageMenuItems}
                onClose={() => setPageMenuOpen(false)}
              />
            )}
          </div>
        </div>

        {view === "archived" && archivedDocs.length > 0 && (
          <div className="mb-4 flex items-center gap-2 px-2 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <Archive size={13} className="text-amber-500 shrink-0" />
            <p className="text-xs text-amber-700">Archived documents are read-only. Use the download icon to save a copy.</p>
          </div>
        )}

        <DocsTable
          docs={currentDocs}
          readOnly={view === "archived"}
          fileStore={fileStoreRef.current}
          onArchive={handleArchive}
          onRowMenuOpen={setRowMenuOpen}
          rowMenuOpen={rowMenuOpen}
        />
      </div>
    </>
  );
}
