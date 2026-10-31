"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import {
  getClients as getStoredClients,
  saveClients as saveStoredClients,
  getArchivedClients,
  saveArchivedClients,
  isSharedClient,
  CLIENT_IMPORT_HEADERS,
  clientFromImportRow,
  clientToImportValues,
  parseClientCsv,
  type StoredClient,
  type ArchivedClient,
} from "@/lib/clientStore"
import {
  activateClientPortal,
  generatePortalCredentials,
  isClientProvisioned,
  type ProvisionResult,
} from "@/lib/portalUserStore"
import {
  Users, Building2, ChevronDown, ChevronRight, X, Mail, MapPin, Calendar,
  Archive, MoreVertical, CheckCircle, Clock, XCircle, Edit,
  Plus, Download, Upload, FileDown, Zap, Copy, Check,
  IndianRupee, Star, FileText,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

type ClientStatus = "active" | "pending" | "inactive"

const statusColors: Record<string, string> = {
  active:   "bg-emerald-100 text-emerald-700",
  pending:  "bg-blue-100 text-blue-700",
  inactive: "bg-gray-100 text-gray-500",
  archived: "bg-red-100 text-red-600",
}

const tierColors: Record<string, string> = {
  Premium:         "bg-amber-100 text-amber-700",
  "Premium Clients": "bg-amber-100 text-amber-700",
  Standard:        "bg-blue-100 text-blue-700",
  "Standard Clients": "bg-blue-100 text-blue-700",
  Basic:           "bg-gray-100 text-gray-600",
  "Medium Clients": "bg-gray-100 text-gray-600",
}

function formatBalance(val: any): string {
  const num = parseFloat(val)
  if (!val || isNaN(num) || num === 0) return "—"
  const lakh = num / 100000
  return lakh >= 100 ? `₹${(lakh / 100).toFixed(1)} Cr` : `₹${lakh.toFixed(1)} L`
}

function formatContractDate(value?: string): string {
  if (!value) return "—"
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${className}`}>
      {children}
    </span>
  )
}

// ── Row Actions Menu ───────────────────────────────────────────────────────
function RowActionsMenu({ client, onEdit, onArchive, onSetStatus, onProvision, provisioned }: {
  client: StoredClient
  onEdit: () => void
  onArchive: () => void
  onSetStatus: (s: ClientStatus) => void
  onProvision: () => void
  provisioned: boolean
}) {
  const [open, setOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setStatusOpen(false) }
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  const statuses: { label: ClientStatus; icon: React.ReactNode; color: string }[] = [
    { label: "active",   icon: <CheckCircle className="w-3.5 h-3.5" />, color: "text-emerald-600" },
    { label: "pending",  icon: <Clock       className="w-3.5 h-3.5" />, color: "text-blue-600"    },
    { label: "inactive", icon: <XCircle     className="w-3.5 h-3.5" />, color: "text-gray-500"    },
  ]

  return (
    <div ref={ref} className="relative flex justify-center">
      <button
        onClick={() => { setOpen(p => !p); setStatusOpen(false) }}
        className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <MoreVertical className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-xl border border-gray-100 z-50 py-1">
          {isSharedClient(client.id) ? (
            <div className="px-3 py-2 text-xs text-gray-500">
              Shared demo client · read only
            </div>
          ) : (
            <>
              <button
                onClick={() => { onEdit(); setOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors text-left"
              >
                <Edit className="w-3.5 h-3.5 opacity-60" /> Edit Client
              </button>

              {/* Set Status submenu */}
              <div className="relative">
                <button
                  onClick={() => setStatusOpen(p => !p)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 opacity-60" /> Set Status
                  </span>
                  <ChevronDown className={`w-3 h-3 opacity-40 transition-transform ${statusOpen ? "rotate-180" : ""}`} />
                </button>
                {statusOpen && (
                  <div className="absolute right-full top-0 mr-1 w-40 bg-white rounded-xl shadow-xl border border-gray-100 z-50 py-1">
                    {statuses.map(s => (
                      <button
                        key={s.label}
                        onClick={() => { onSetStatus(s.label); setOpen(false); setStatusOpen(false) }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 transition-colors text-left capitalize ${s.color} ${client.status === s.label ? "font-bold" : ""}`}
                      >
                        {s.icon} {s.label} {client.status === s.label && <span className="ml-auto opacity-50">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Provision Portal */}
          <button
            onClick={() => { onProvision(); setOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-purple-700 hover:bg-purple-50 transition-colors text-left"
          >
            <Zap className="w-3.5 h-3.5 opacity-70" />
            {provisioned ? "Re-provision Portal" : "Provision Portal"}
          </button>

          {!isSharedClient(client.id) && (
            <>
              <div className="border-t border-gray-100 my-0.5" />
              <button
                onClick={() => { onArchive(); setOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors text-left"
              >
                <Archive className="w-3.5 h-3.5 opacity-70" /> Archive Client
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Client Overview Popup ──────────────────────────────────────────────────
function ClientOverviewPopup({
  client,
  onClose,
  onViewFullProfile,
}: {
  client: StoredClient
  onClose: () => void
  onViewFullProfile?: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-2" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex items-start justify-between">
          <div>
            <p className="text-blue-200 text-xs font-medium mb-1">{client.id}</p>
            <h2 className="text-white text-xl font-semibold">{client.name}</h2>
            <p className="text-blue-200 text-sm mt-0.5">{client.category || "—"} · {client.billingCity || "—"}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1"><X className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
          {[
            { label: "Tier",   value: client.tier   || "—", icon: <Star        className="w-4 h-4 text-amber-400" /> },
            { label: "Status", value: client.status || "—", icon: <CheckCircle className="w-4 h-4 text-emerald-500" /> },
            { label: "Category", value: client.category ? client.category.split(" ")[0] : "—", icon: <Building2 className="w-4 h-4 text-blue-500" /> },
          ].map(s => (
            <div key={s.label} className="flex flex-col items-center py-3 gap-1">
              {s.icon}
              <p className="text-sm font-bold text-gray-800 capitalize">{s.value}</p>
              <p className="text-xs text-gray-400">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="p-4 grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Contact</h3>
            {[
              { icon: <Users  className="w-3.5 h-3.5 text-blue-400" />, v: client.rep },
              { icon: <Mail   className="w-3.5 h-3.5 text-blue-400" />, v: client.email },
              { icon: <MapPin className="w-3.5 h-3.5 text-blue-400" />, v: [client.billingCity, client.billingState].filter(Boolean).join(", ") || client.billingAddress },
            ].map((r, i) => r.v ? (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-0.5 flex-shrink-0">{r.icon}</span>
                <p className="text-sm text-gray-700 break-all">{r.v}</p>
              </div>
            ) : null)}
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Details</h3>
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-0.5">Opening Balance</p>
              <p className="text-base font-bold text-gray-800">{formatBalance(client.openingBalance)}</p>
            </div>
            {(client.contractStartDate || client.contractEndDate) && (
              <div className="flex items-center gap-2 mt-1">
                <Calendar className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Contract</p>
                  <p className="text-sm font-medium text-gray-700">
                    {client.contractStartDate || "—"} → {client.contractEndDate || "—"}
                  </p>
                </div>
              </div>
            )}
            <Badge className={statusColors[(client.status || "").toLowerCase()] || "bg-gray-100 text-gray-500"}>
              {client.status || "unknown"}
            </Badge>
          </div>
        </div>
        {onViewFullProfile && (
          <div className="px-4 py-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onViewFullProfile}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              View Full Profile <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Archived Modal ─────────────────────────────────────────────────────────
function ArchivedModal({ clients, onClose, onClientClick }: {
  clients: ArchivedClient[]; onClose: () => void; onClientClick: (c: ArchivedClient) => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-2" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Archived Clients</h2>
            <p className="text-xs text-gray-400 mt-0.5">{clients.length} {clients.length === 1 ? "client" : "clients"} · Read only</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-auto flex-1">
          {clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Archive className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">No archived clients yet</p>
            </div>
          ) : (
            <table className="w-full table-fixed text-xs">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-100">
                <tr>
                  {["Client ID", "Client Name", "Category", "Representative", "Tier", "City", "Archived On"].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {clients.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-3">
                      <button onClick={() => onClientClick(c)} className="text-blue-600 font-bold hover:underline text-xs">{c.id}</button>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs flex-shrink-0">
                          {c.name?.[0]?.toUpperCase() || "?"}
                        </div>
                        <span className="font-medium text-gray-800 truncate">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-gray-500 truncate">{c.category || "—"}</td>
                    <td className="px-3 py-3 text-gray-500 truncate">{c.rep || "—"}</td>
                    <td className="px-3 py-3 text-gray-500">{c.tier || "—"}</td>
                    <td className="px-3 py-3 text-gray-500">{c.billingCity || "—"}</td>
                    <td className="px-3 py-3 text-gray-500">{c.archivedOn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex-shrink-0">
          <p className="text-xs text-gray-400">This list is read-only. No actions can be performed on archived clients.</p>
        </div>
      </div>
    </div>
  )
}

type ProvisionFlow = ProvisionResult & {
  clientId: string
  clientName: string
  isReprovision: boolean
}

// ── Provision Credentials Dialog ───────────────────────────────────────────
function ProvisionDialog({
  result,
  onClose,
  onDone,
}: {
  result: ProvisionFlow
  onClose: () => void
  onDone: () => void
}) {
  const [copiedField, setCopiedField] = useState<"email" | "password" | null>(null)
  const copy = (text: string, field: "email" | "password") => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <div className="flex justify-between items-start mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <Zap size={20} className="text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                {result.isReprovision ? "Portal Credentials Re-generated" : "Portal Credentials Generated"}
              </h2>
              <p className="text-xs text-gray-500">{result.clientName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-5">
           <p className="text-sm text-purple-800 font-medium">Credentials are ready for review.</p>
           <p className="text-xs text-purple-700 mt-1">Portal access will remain inactive until you confirm access in the next step.</p>
        </div>
        <div className="space-y-3 mb-6">
          {([["Login Email", result.email, "email"], ["Temporary Password", result.password, "password"]] as const).map(([label, val, field]) => (
            <div key={field} className="border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <div className="flex items-center justify-between gap-3">
                <code className="text-sm font-mono text-gray-900 break-all">{val}</code>
                <button onClick={() => copy(val, field)} className="shrink-0 p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors">
                  {copiedField === field ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5">
          <p className="text-xs text-amber-800"><strong>Important:</strong> Save these credentials now — the password cannot be recovered later.</p>
        </div>
         <Button className="w-full" onClick={onDone}>Done</Button>
      </div>
    </div>
  )
}

function ConfirmPortalAccessDialog({
  result,
  onCancel,
  onConfirm,
}: {
  result: ProvisionFlow
  onCancel: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState("")
  const requiresReason = result.isReprovision

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <div className="flex justify-between items-start mb-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {requiresReason ? "Confirm Portal Re-provisioning" : "Confirm Client Portal Access"}
            </h2>
            <p className="text-xs text-gray-500 mt-1">{result.clientName}</p>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
          <p className="text-sm text-amber-900 font-medium">
            {requiresReason
              ? "The existing portal credentials will be replaced only after confirmation."
              : "This will give the client admin access to the client portal."}
          </p>
          <p className="text-xs text-amber-800 mt-1">
            Username: <span className="font-mono">{result.email}</span>
          </p>
        </div>

        {requiresReason && (
          <div className="mb-5">
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Reason for re-provisioning <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder="Enter why the portal credentials are being re-provisioned"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400"
            />
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button
            className="flex-1"
            disabled={requiresReason && !reason.trim()}
            onClick={() => onConfirm(reason)}
          >
            Confirm &amp; Give Access
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function ClientsPageUI() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const userScope = user?.id || user?.email || "anonymous"

  const [clients, setClientsState] = useState<StoredClient[]>(() => getStoredClients())
  const [archivedClients, setArchivedClientsState] = useState<ArchivedClient[]>(() => getArchivedClients())
  const [overviewClient, setOverviewClient] = useState<StoredClient | null>(null)
  const [archivedOverview, setArchivedOverview] = useState<ArchivedClient | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [provisionResult, setProvisionResult] = useState<ProvisionFlow | null>(null)
  const [provisionConfirmation, setProvisionConfirmation] = useState<ProvisionFlow | null>(null)

  // Tile filter
  const [activeFilter, setActiveFilter] = useState("All")
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 10

  const persistClients = (list: StoredClient[]) => { setClientsState(list); saveStoredClients(list) }
  const persistArchived = (list: ArchivedClient[]) => { setArchivedClientsState(list); saveArchivedClients(list) }

  useEffect(() => {
    setClientsState(getStoredClients())
    setArchivedClientsState(getArchivedClients())
    const onUpdate = () => setClientsState(getStoredClients())
    const onStorage = (event: StorageEvent) => {
      if (event.key?.startsWith("nido_clients_v3:") || event.key?.startsWith("nido_clients_archived_v2:")) {
        setClientsState(getStoredClients())
        setArchivedClientsState(getArchivedClients())
      }
    }
    window.addEventListener("nidoClientsUpdated", onUpdate)
    window.addEventListener("storage", onStorage)
    return () => {
      window.removeEventListener("nidoClientsUpdated", onUpdate)
      window.removeEventListener("storage", onStorage)
    }
  }, [userScope])

  // Stats computed from real data — each tile is a filter key
  const stats = useMemo(() => [
    { label: "Total Clients",   filterKey: "All",      value: clients.length,                                                            color: "text-gray-900",  icon: <Building2 className="text-gray-400"  /> },
    { label: "Active Clients",  filterKey: "Active",   value: clients.filter(c => (c.status || "").toLowerCase() === "active").length,   color: "text-green-600", icon: <Users     className="text-green-400" /> },
    { label: "Pending",         filterKey: "Pending",  value: clients.filter(c => (c.status || "").toLowerCase() === "pending").length,  color: "text-blue-600",  icon: <Clock     className="text-blue-400"  /> },
    { label: "Inactive",        filterKey: "Inactive", value: clients.filter(c => (c.status || "").toLowerCase() === "inactive").length, color: "text-gray-500",  icon: <XCircle   className="text-gray-400"  /> },
    { label: "Premium Clients", filterKey: "Premium",  value: clients.filter(c => (c.tier   || "").toLowerCase().startsWith("premium")).length,  color: "text-amber-600", icon: <Star      className="text-amber-400" /> },
  ], [clients])

  // Filtering + pagination
  const filtered = useMemo(() => {
    switch (activeFilter) {
      case "Active":   return clients.filter(c => (c.status || "").toLowerCase() === "active")
      case "Pending":  return clients.filter(c => (c.status || "").toLowerCase() === "pending")
      case "Inactive": return clients.filter(c => (c.status || "").toLowerCase() === "inactive")
      case "Premium":  return clients.filter(c => (c.tier   || "").toLowerCase().startsWith("premium"))
      default:         return clients
    }
  }, [clients, activeFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const safePage   = Math.min(currentPage, totalPages)
  const paged      = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE)

  const handleTileClick = (filterKey: string) => {
    setActiveFilter(prev => prev === filterKey ? "All" : filterKey)
    setCurrentPage(1)
  }

  // Actions
  const archiveClient = (client: StoredClient) => {
    persistClients(clients.filter(c => c.id !== client.id))
    persistArchived([...archivedClients, { ...client, status: "archived", archivedOn: new Date().toISOString().split("T")[0] }])
  }

  const setClientStatus = (id: string, status: ClientStatus) => {
    persistClients(clients.map(c => c.id === id ? { ...c, status } : c))
  }

  const handleProvision = (c: StoredClient) => {
    setProvisionResult({
      ...generatePortalCredentials(c.id, c.name),
      clientId: c.id,
      clientName: c.name,
      isReprovision: isClientProvisioned(c.id),
    })
  }

  const confirmProvision = (flow: ProvisionFlow, reason: string) => {
    activateClientPortal(flow.clientId, flow.clientName, flow, reason)
    setProvisionConfirmation(null)
  }

  const handleExport = () => {
    const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`
    const header = CLIENT_IMPORT_HEADERS.map(escapeCsv).join(",")
    const rows = clients.map(c => clientToImportValues(c).map(escapeCsv).join(","))
    const csv = [header, ...rows].join("\r\n")
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" })
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "clients-export.csv"
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  const handleDownloadTemplate = () => {
    const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`
    const header = CLIENT_IMPORT_HEADERS.map(escapeCsv).join(",")
    const template = `${header}\r\n`
    const blob = new Blob([`\uFEFF${template}`], { type: "text/csv;charset=utf-8;" })
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "client-template.csv"
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  const handleBulkImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
         const csv = e.target?.result as string
         const rows = parseClientCsv(csv)
        const maxId = clients.length > 0 ? Math.max(...clients.map(c => parseInt(c.id.replace("CI-", "")) || 0)) : 0
         const newClients: StoredClient[] = rows.map((row, index) =>
           clientFromImportRow(
             row,
             `CI-${String(maxId + index + 1).padStart(5, "0")}`,
           ),
         )
         const existingIds = new Set(clients.map(c => c.id))
         const uniqueClients = newClients.filter(c => {
           if (existingIds.has(c.id)) return false
           existingIds.add(c.id)
           return true
         })
         persistClients([...clients, ...uniqueClients])
        setShowBulkImport(false)
         alert(`${uniqueClients.length} client(s) imported successfully.`)
       } catch { alert("Error parsing CSV file. Please check the format.") }
    }
    reader.readAsText(file)
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-transparent border-b border-gray-200/70">
        <div className="w-full px-2 py-3 flex justify-between items-center">
          <div>
            <p className="text-xs text-gray-500">Clients / Client List</p>
            <h1 className="text-2xl font-bold">Clients</h1>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="rounded-full">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/clients/add")}>
                <Plus     className="h-4 w-4 mr-2" /> Add Client
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" /> Export Clients
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onClick={() => setShowBulkImport(true)}>
                <Upload   className="h-4 w-4 mr-2" /> Bulk Import
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onClick={handleDownloadTemplate}>
                <FileDown className="h-4 w-4 mr-2" /> Download Template
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onClick={() => setShowArchived(true)}>
                <Archive  className="h-4 w-4 mr-2" /> Archived Clients ({archivedClients.length})
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="w-full px-2 py-2">
        {/* Stats — 5 tiles, each acts as a filter */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
          {stats.map(s => {
            const isActive = activeFilter === s.filterKey
            return (
              <Card
                key={s.label}
                onClick={() => handleTileClick(s.filterKey)}
                className={`cursor-pointer transition-all hover:shadow-md ${isActive ? "ring-2 ring-blue-500 shadow-md" : ""}`}
              >
                <CardContent className="p-2 flex justify-between items-start">
                  <div>
                    <p className="text-xs text-gray-500">{s.label}</p>
                    <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                  </div>
                  {s.icon}
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Table Card */}
        <Card>
          <CardContent className="p-0">
            {/* Active filter indicator */}
            {activeFilter !== "All" && (
              <div className="flex items-center gap-2 px-3 py-2 border-b bg-blue-50">
                <span className="text-xs text-blue-700 font-medium">Filtered: {activeFilter}</span>
                <span className="text-xs text-gray-400">·</span>
                <span className="text-xs text-gray-500">{filtered.length} of {clients.length} clients</span>
                <button onClick={() => { setActiveFilter("All"); setCurrentPage(1) }} className="ml-auto text-xs text-blue-600 hover:text-blue-800 font-medium">Clear ✕</button>
              </div>
            )}

            <table className="w-full table-fixed">
              <colgroup>
                <col style={{ width: "8%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "10%" }} />
                 <col style={{ width: "10%" }} />
                 <col style={{ width: "7%" }} />
              </colgroup>
              <thead>
                <tr className="bg-gray-50 border-b text-xs text-gray-600">
                  <th className="px-3 py-3 text-left">Client ID</th>
                  <th className="px-3 py-3 text-left">Client Name</th>
                  <th className="px-3 py-3 text-left">Category</th>
                  <th className="px-3 py-3 text-left">Representative</th>
                  <th className="px-3 py-3 text-left">Tier</th>
                  <th className="px-3 py-3 text-left">City</th>
                  <th className="px-3 py-3 text-left">Status</th>
                  <th className="px-3 py-3 text-left whitespace-nowrap">Contract Start</th>
                  <th className="px-3 py-3 text-left whitespace-nowrap">Contract End</th>
                  <th className="px-3 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-16 text-gray-400">
                      <div className="flex flex-col items-center gap-2">
                        <Building2 className="w-8 h-8 opacity-30" />
                        <p className="text-sm">No clients match the current filters</p>
                      </div>
                    </td>
                  </tr>
                ) : paged.map(c => (
                  <tr key={c.id} className="border-b hover:bg-gray-50 transition-colors">
                    {/* Client ID */}
                    <td
                      className="px-3 py-3 text-blue-600 font-medium cursor-pointer hover:underline text-sm truncate"
                      onClick={() => navigate(`/clients/${c.id}`)}
                    >
                      {c.id}
                    </td>

                    {/* Client Name + email */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs flex-shrink-0">
                          {c.name?.[0]?.toUpperCase() || "?"}
                        </div>
                        <div className="min-w-0">
                          <p
                            className="font-medium text-gray-800 text-sm leading-tight truncate cursor-pointer hover:underline"
                            onClick={() => navigate(`/clients/${c.id}`)}
                          >
                            {c.name}
                          </p>
                          <p className="text-xs text-gray-400 leading-tight truncate">{c.email || ""}</p>
                        </div>
                      </div>
                    </td>

                    {/* Category pill */}
                    <td className="px-3 py-3">
                      {c.category
                        ? <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-medium truncate block max-w-full">{c.category}</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>

                    {/* Representative + phone */}
                    <td className="px-3 py-3">
                      <p className="text-sm text-gray-700 font-medium leading-tight truncate">{c.rep || "—"}</p>
                      <p className="text-xs text-gray-400 leading-tight truncate">{c.phone || ""}</p>
                    </td>

                    {/* Tier */}
                    <td className="px-3 py-3">
                      {c.tier
                        ? <Badge className={tierColors[c.tier] || "bg-gray-100 text-gray-600"}>{c.tier}</Badge>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>

                    {/* City */}
                    <td className="px-3 py-3 text-sm text-gray-600 truncate">{c.billingCity || "—"}</td>

                    {/* Status badge */}
                    <td className="px-3 py-3">
                      <Badge className={statusColors[(c.status || "").toLowerCase()] || "bg-gray-100 text-gray-500"}>
                        {c.status || "unknown"}
                      </Badge>
                    </td>

                    {/* Contract dates */}
                    <td className="px-3 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {formatContractDate(c.contractStartDate)}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {formatContractDate(c.contractEndDate)}
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-3 text-center">
                      <RowActionsMenu
                        client={c}
                        onEdit={() => navigate(`/clients/${c.id}/edit`)}
                        onArchive={() => archiveClient(c)}
                        onSetStatus={s => setClientStatus(c.id, s)}
                        onProvision={() => handleProvision(c)}
                        provisioned={isClientProvisioned(c.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="px-3 py-3 flex items-center justify-between text-sm text-gray-600 border-t">
              <span>
                {filtered.length === 0
                  ? "0 clients"
                  : `${(safePage - 1) * ITEMS_PER_PAGE + 1}–${Math.min(safePage * ITEMS_PER_PAGE, filtered.length)} of ${filtered.length} clients`}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="p-1.5 rounded border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >←</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`w-8 h-8 rounded border text-xs font-medium transition-colors ${p === safePage ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 hover:bg-gray-50"}`}
                  >{p}</button>
                ))}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="p-1.5 rounded border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >→</button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Client Overview Popup */}
      {overviewClient && (
        <ClientOverviewPopup
          client={overviewClient}
          onClose={() => setOverviewClient(null)}
          onViewFullProfile={() => {
            setOverviewClient(null)
            navigate(`/clients/${overviewClient.id}/contracts`)
          }}
        />
      )}

      {/* Archived Modal */}
      {showArchived && (
        <ArchivedModal
          clients={archivedClients}
          onClose={() => setShowArchived(false)}
          onClientClick={c => { setArchivedOverview(c); setShowArchived(false) }}
        />
      )}

      {/* Archived client overview */}
      {archivedOverview && <ClientOverviewPopup client={archivedOverview} onClose={() => setArchivedOverview(null)} />}

      {/* Provision Dialog */}
      {provisionResult && (
        <ProvisionDialog
          result={provisionResult}
          onClose={() => setProvisionResult(null)}
          onDone={() => {
            setProvisionConfirmation(provisionResult)
            setProvisionResult(null)
          }}
        />
      )}
      {provisionConfirmation && (
        <ConfirmPortalAccessDialog
          result={provisionConfirmation}
          onCancel={() => setProvisionConfirmation(null)}
          onConfirm={(reason) => confirmProvision(provisionConfirmation, reason)}
        />
      )}

      {/* Bulk Import Modal */}
      {showBulkImport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Bulk Import Clients</h2>
              <button onClick={() => setShowBulkImport(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 cursor-pointer hover:border-gray-400 transition-colors">
                <Upload className="h-8 w-8 text-gray-400 mb-2" />
                <span className="text-sm text-gray-600">Click to upload CSV</span>
                <span className="text-xs text-gray-500 mt-1">Use the template for correct format</span>
                <input type="file" accept=".csv" onChange={handleBulkImport} className="hidden" />
              </label>
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-xs text-blue-700"><strong>Note:</strong> Duplicate Client IDs are skipped. New clients are saved immediately.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button onClick={() => setShowBulkImport(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
