import { useState, type FormEvent } from "react";
import { Archive, CalendarDays, FileText, MoreVertical, Pencil, Plus, X } from "lucide-react";

export interface VendorContractListRecord {
  id: string;
  name: string;
  type: string;
  startDate: string;
  endDate: string;
  value: string;
  paymentTerms: string;
  status: string;
}

export interface VendorContractBasics {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

interface VendorContractsListProps {
  vendorName: string;
  contracts: VendorContractListRecord[];
  showArchived: boolean;
  onCreate: (contract: VendorContractBasics) => void;
  onOpen: (contractId: string) => void;
  onEdit: (contractId: string) => void;
  onArchive: (contractId: string) => void;
  onToggleArchived: () => void;
}

function suggestedContractId(contracts: VendorContractListRecord[]): string {
  const prefix = `CT-${new Date().getFullYear()}-`;
  const highest = contracts.reduce((value, contract) => {
    if (!contract.id.startsWith(prefix)) return value;
    const number = Number(contract.id.slice(prefix.length));
    return Number.isFinite(number) ? Math.max(value, number) : value;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(3, "0")}`;
}

export default function VendorContractsList({
  vendorName,
  contracts,
  showArchived,
  onCreate,
  onOpen,
  onEdit,
  onArchive,
  onToggleArchived,
}: VendorContractsListProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [contractId, setContractId] = useState("");
  const [contractName, setContractName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");
  const visibleContracts = contracts.filter(contract =>
    showArchived ? contract.status === "Archived" : contract.status !== "Archived"
  );
  const archivedCount = contracts.filter(contract => contract.status === "Archived").length;
  const activeCount = contracts.length - archivedCount;

  const openCreateDialog = () => {
    setMenuOpen(false);
    setContractId(suggestedContractId(contracts));
    setContractName("");
    setStartDate("");
    setEndDate("");
    setError("");
    setDialogOpen(true);
  };

  const submitCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const id = contractId.trim();
    const name = contractName.trim();
    if (!id || !name) {
      setError("Enter a contract ID and contract name.");
      return;
    }
    if (contracts.some(contract => contract.id.toLowerCase() === id.toLowerCase())) {
      setError("A contract with this ID already exists for this vendor.");
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      setError("The end date must be on or after the start date.");
      return;
    }
    onCreate({ id, name, startDate, endDate });
    setDialogOpen(false);
  };

  return (
    <section
      className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-5"
      aria-label={`${vendorName} contracts`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            {showArchived ? "Archived Contracts" : "Contracts"}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {visibleContracts.length} contract{visibleContracts.length === 1 ? "" : "s"} for {vendorName}
          </p>
        </div>
        <div className="relative">
          <button
            type="button"
            aria-label="Vendor contract list actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(open => !open)}
            className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          >
            <MoreVertical size={18} />
          </button>
          {menuOpen && (
            <div role="menu" className="absolute right-0 z-20 mt-1 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              <button
                type="button"
                role="menuitem"
                onClick={openCreateDialog}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                <Plus size={15} className="text-gray-400" />
                Add Contract
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onToggleArchived();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                {showArchived ? `Active Contracts (${activeCount})` : `Archived Contracts (${archivedCount})`}
              </button>
            </div>
          )}
        </div>
      </div>

      {visibleContracts.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-gray-300 bg-gray-50 px-5 py-12 text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            {showArchived ? <Archive size={21} /> : <FileText size={21} />}
          </div>
          <h3 className="text-sm font-semibold text-gray-900">
            {showArchived ? "No archived contracts" : "No contracts yet"}
          </h3>
          <p className="mt-1 max-w-sm text-sm text-gray-500">
            {showArchived
              ? "Archived vendor contracts will appear here and open in read-only mode."
              : "Add a contract to record its terms, contacts, renewal information, and reminders."}
          </p>
          {!showArchived && (
            <button
              type="button"
              onClick={openCreateDialog}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
            >
              <Plus size={15} />
              Add your first contract
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className={`w-full ${showArchived ? "min-w-[740px]" : "min-w-[900px]"} border-collapse text-left`}>
            <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Contract ID</th>
                <th className="px-4 py-3">Contract name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Start date</th>
                <th className="px-4 py-3">End date</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Status</th>
                {!showArchived && <th className="px-4 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleContracts.map(contract => (
                <tr key={`${contract.id}`} className="bg-white hover:bg-blue-50/40">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onOpen(contract.id)}
                      className="font-semibold text-blue-700 hover:underline"
                    >
                      {contract.id}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{contract.name || "Untitled contract"}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{contract.type || "—"}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays size={14} className="text-gray-400" />
                      {contract.startDate || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{contract.endDate || "—"}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{contract.value || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${contract.status === "Archived" ? "bg-gray-100 text-gray-600" : "bg-green-100 text-green-700"}`}>
                      {contract.status || "Active"}
                    </span>
                  </td>
                  {!showArchived && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={`Edit ${contract.id}`}
                          onClick={() => onEdit(contract.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1.5 text-xs font-medium text-gray-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        >
                          <Pencil size={13} />
                          Edit
                        </button>
                        <button
                          type="button"
                          aria-label={`Archive ${contract.id}`}
                          onClick={() => onArchive(contract.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1.5 text-xs font-medium text-gray-700 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                        >
                          <Archive size={13} />
                          Archive
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialogOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-950/45 p-4"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setDialogOpen(false);
          }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-vendor-contract-title"
            onSubmit={submitCreate}
            className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 id="add-vendor-contract-title" className="text-lg font-semibold text-gray-900">Add Contract</h2>
                <p className="mt-1 text-sm text-gray-500">Create the record, then fill in its vendor contract details.</p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setDialogOpen(false)} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm font-medium text-gray-700">
                Contract ID
                <input
                  autoFocus
                  required
                  value={contractId}
                  onChange={event => setContractId(event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium text-gray-700">
                Contract name
                <input
                  required
                  value={contractName}
                  onChange={event => setContractName(event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="e.g. Hardware Supply Agreement"
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium text-gray-700">
                Start date
                <input
                  type="date"
                  value={startDate}
                  onChange={event => setStartDate(event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium text-gray-700">
                End date
                <input
                  type="date"
                  value={endDate}
                  onChange={event => setEndDate(event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </div>
            {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setDialogOpen(false)} className="rounded-md border border-gray-300 px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" className="rounded-md bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                Create Contract
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
