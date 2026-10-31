"use client"

import { useEffect, useState, type ChangeEvent } from "react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import {
  Search, Plus, Download, Upload, MoreVertical, Pencil, Trash2, FileText, Shield,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import ManageUsersPanel from "./ManageUsersPanel"
import AddEditRoleDialog from "./AddEditRoleDialog"
import RolePermissionsDialog from "./RolePermissionsDialog"
import {
  type NidoRole,
  getRoles, addRole, updateRole, deleteRole,
  getRoleUserCount, exportRolesCsv, exportRolesPdf,
  NIDO_ROLES_EVENT, NIDO_USERS_EVENT,
} from "@/lib/nidoUsersStore"
import {
  ACTIONS,
  getRolePermissions,
  isSuperAdmin,
  saveRolePermissions,
  type ModulePermissions,
} from "@/lib/permissionsStore"
import { ROLE_PERMISSION_MODULE_OPTIONS } from "@/lib/platformModuleCatalog"

const NIDO_PERMISSION_CSV_COLUMNS = [
  "role_name", "description", "status", "module_key", "module", "module_description",
  ...ACTIONS.map(action => action.key),
] as const

function csvEscape(value: string | boolean): string {
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let value = ""
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    const next = text[index + 1]
    if (character === '"' && quoted && next === '"') {
      value += '"'
      index += 1
    } else if (character === '"') {
      quoted = !quoted
    } else if (character === "," && !quoted) {
      row.push(value.trim())
      value = ""
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1
      row.push(value.trim())
      if (row.some(cell => cell.length > 0)) rows.push(row)
      row = []
      value = ""
    } else {
      value += character
    }
  }

  if (quoted) throw new Error("The CSV contains an unclosed quote.")
  if (value.length > 0 || row.length > 0) {
    row.push(value.trim())
    if (row.some(cell => cell.length > 0)) rows.push(row)
  }
  return rows
}

function parseCsvBoolean(value: string, rowNumber: number, column: string): boolean {
  const normalized = value.trim().toLowerCase()
  if (["true", "yes", "1"].includes(normalized)) return true
  if (["false", "no", "0", ""].includes(normalized)) return false
  throw new Error(`Row ${rowNumber}: ${column} must be true or false.`)
}

export default function NidoUsersPage() {
  const [searchParams, setSearchParams]         = useSearchParams()
  const initialTab = searchParams.get("tab") === "users" ? "users" : "roles"
  const [activeTab, setActiveTabState]          = useState(initialTab)
  const setActiveTab = (tab: string) => {
    setActiveTabState(tab)
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set("tab", tab)
      return next
    }, { replace: true })
  }
  const [searchRole, setSearchRole]             = useState("")
  const [roles, setRoles]                       = useState<NidoRole[]>([])
  const [roleDialogOpen, setRoleDialogOpen]     = useState(false)
  const [editingRole, setEditingRole]           = useState<NidoRole | null>(null)
  const [permDialogOpen, setPermDialogOpen]     = useState(false)
  const [permRole, setPermRole]                 = useState<NidoRole | null>(null)
  const [showRoleActionsMenu, setShowRoleActionsMenu] = useState(false)
  const [, forceRefresh]                        = useState(0)
  const [currentRolePage, setCurrentRolePage]   = useState(1)
  const rolePageSize = 10

  const refreshRoles = () => { setRoles(getRoles()); forceRefresh(n => n + 1); }

  useEffect(() => {
    const tab = searchParams.get("tab") === "users" ? "users" : "roles"
    setActiveTabState(tab)
  }, [searchParams])

  useEffect(() => {
    refreshRoles()
    const handler = () => refreshRoles()
    window.addEventListener(NIDO_ROLES_EVENT, handler)
    window.addEventListener(NIDO_USERS_EVENT, handler)
    return () => {
      window.removeEventListener(NIDO_ROLES_EVENT, handler)
      window.removeEventListener(NIDO_USERS_EVENT, handler)
    }
  }, [])

  const filteredRoles = roles.filter(r =>
    r.department.toLowerCase().includes(searchRole.toLowerCase()) ||
    r.name.toLowerCase().includes(searchRole.toLowerCase())
  )
  const totalRolePages = Math.max(1, Math.ceil(filteredRoles.length / rolePageSize))
  const paginatedRoles = filteredRoles.slice(
    (currentRolePage - 1) * rolePageSize,
    currentRolePage * rolePageSize,
  )

  useEffect(() => {
    setCurrentRolePage(1)
  }, [searchRole])

  useEffect(() => {
    setCurrentRolePage(page => Math.min(page, totalRolePages))
  }, [totalRolePages])

  const handleAddRole = () => { setEditingRole(null); setRoleDialogOpen(true); }
  const handleEditRole = (role: NidoRole) => { setEditingRole(role); setRoleDialogOpen(true); }

  const handleSaveRole = (values: { department: string; name: string; description: string; status: "Active" | "Inactive" }) => {
    if (editingRole) {
      updateRole(editingRole.id, values)
      toast.success("Role updated", { description: `"${values.name}" has been saved.` })
    } else {
      addRole(values)
      toast.success("Role added", { description: `"${values.name}" is now available to assign to users.` })
    }
    refreshRoles()
  }

  const handleDeleteRole = (role: NidoRole) => {
    const assigned = getRoleUserCount(role.name)
    if (assigned > 0) {
      toast.error("Can't delete role", { description: `${assigned} user(s) still have this role. Reassign them first.` })
      return
    }
    if (!window.confirm(`Delete the role "${role.name}"? This cannot be undone.`)) return
    deleteRole(role.id)
    toast.success("Role deleted")
    refreshRoles()
  }

  const handleOpenPermissions = (role: NidoRole) => {
    setPermRole(role)
    setPermDialogOpen(true)
  }

  const downloadNidoPermissionsTemplate = () => {
    setShowRoleActionsMenu(false)
    const header = NIDO_PERMISSION_CSV_COLUMNS.map(csvEscape).join(",")
    const rows = ROLE_PERMISSION_MODULE_OPTIONS.map(module => [
      "New NIDO Role",
      "Replace with your role description",
      "Active",
      module.key,
      module.label,
      module.description,
      ...ACTIONS.map(() => false),
    ].map(csvEscape).join(","))
    const blob = new Blob([[header, ...rows].join("\r\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "nido-role-permissions-template.csv"
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const exportNidoPermissionsCsv = () => {
    setShowRoleActionsMenu(false)
    if (!filteredRoles.length) {
      toast.info("Nothing to export")
      return
    }
    const header = NIDO_PERMISSION_CSV_COLUMNS.map(csvEscape).join(",")
    const rows = filteredRoles.flatMap(role => {
      const storedPermissions = getRolePermissions(role.name)
      return ROLE_PERMISSION_MODULE_OPTIONS.map(module => [
        role.name,
        role.description,
        role.status,
        module.key,
        module.label,
        module.description,
        ...ACTIONS.map(action => Boolean(isSuperAdmin(role.name) || storedPermissions[module.key]?.[action.key])),
      ].map(csvEscape).join(","))
    })
    const blob = new Blob([[header, ...rows].join("\r\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "nido-role-permissions.csv"
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    toast.success("Role permissions exported")
  }

  const handleNidoBulkUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    setShowRoleActionsMenu(false)
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    try {
      const rows = parseCsv(await file.text())
      if (rows.length < 2) throw new Error("The CSV must contain a header and at least one permission row.")

      const header = rows[0].map(cell => cell.replace(/^\uFEFF/, "").toLowerCase())
      const missingColumns = NIDO_PERMISSION_CSV_COLUMNS.filter(column => !header.includes(column))
      if (missingColumns.length > 0) throw new Error(`Missing CSV columns: ${missingColumns.join(", ")}.`)
      const columnIndex = Object.fromEntries(header.map((column, index) => [column, index])) as Record<string, number>
      const moduleByKey = new Map(ROLE_PERMISSION_MODULE_OPTIONS.map(module => [module.key.toLowerCase(), module]))
      const moduleByLabel = new Map(ROLE_PERMISSION_MODULE_OPTIONS.map(module => [module.label.toLowerCase(), module]))
      const imported = new Map<string, {
        name: string
        description: string
        status: "Active" | "Inactive"
        permissions: Record<string, ModulePermissions>
      }>()

      rows.slice(1).forEach((cells, index) => {
        const rowNumber = index + 2
        const roleName = cells[columnIndex.role_name]?.trim()
        const moduleValue = (cells[columnIndex.module_key] || cells[columnIndex.module] || "").trim().toLowerCase()
        const module = moduleByKey.get(moduleValue) || moduleByLabel.get(moduleValue)
        if (!roleName) throw new Error(`Row ${rowNumber}: role_name is required.`)
        if (!module) throw new Error(`Row ${rowNumber}: module_key or module is not a valid platform module.`)
        if (roleName.toLowerCase() === "system owner") {
          throw new Error("System Owner cannot be changed through bulk upload.")
        }

        const rawStatus = (cells[columnIndex.status] || "Active").trim().toLowerCase()
        if (rawStatus !== "active" && rawStatus !== "inactive") {
          throw new Error(`Row ${rowNumber}: status must be Active or Inactive.`)
        }
        const roleKey = roleName.toLowerCase()
        const current = imported.get(roleKey) || {
          name: roleName,
          description: cells[columnIndex.description]?.trim() || "",
          status: rawStatus === "active" ? "Active" : "Inactive",
          permissions: {},
        }
        if (current.permissions[module.key]) {
          throw new Error(`Row ${rowNumber}: duplicate permission row for ${roleName} and ${module.label}.`)
        }
        const permissions: ModulePermissions = {}
        ACTIONS.forEach(action => {
          permissions[action.key] = parseCsvBoolean(
            cells[columnIndex[action.key]] || "",
            rowNumber,
            action.key,
          )
        })
        current.description = cells[columnIndex.description]?.trim() || current.description
        current.status = rawStatus === "active" ? "Active" : "Inactive"
        current.permissions[module.key] = permissions
        imported.set(roleKey, current)
      })

      const existingByName = new Map(roles.map(role => [role.name.toLowerCase(), role]))
      const importedRoles = Array.from(imported.values())
      const updateCount = importedRoles.filter(role => existingByName.has(role.name.toLowerCase())).length
      const createCount = importedRoles.length - updateCount
      if (!window.confirm(
        `Import ${importedRoles.length} role${importedRoles.length === 1 ? "" : "s"} (${createCount} new, ${updateCount} updated)? Existing role permissions will be replaced by the CSV values.`,
      )) return

      importedRoles.forEach(incoming => {
        const existing = existingByName.get(incoming.name.toLowerCase())
        if (existing) {
          updateRole(existing.id, {
            name: incoming.name,
            description: incoming.description,
            status: incoming.status,
          })
        } else {
          addRole({
            department: "",
            name: incoming.name,
            description: incoming.description,
            status: incoming.status,
          })
        }
        saveRolePermissions(incoming.name, incoming.permissions)
      })
      refreshRoles()
      toast.success(`Imported ${importedRoles.length} role${importedRoles.length === 1 ? "" : "s"} successfully`)
    } catch (error) {
      toast.error("Could not import CSV", {
        description: error instanceof Error ? error.message : "Please check the file format.",
      })
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full px-3 sm:px-4 md:px-6 py-2 md:py-6 space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nido-Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage roles, permissions, and platform users</p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="h-12 bg-background border border-border rounded-lg p-1">
            <TabsTrigger value="roles" className="px-6 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600">
              User Roles
            </TabsTrigger>
            <TabsTrigger value="users" className="px-6 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600">
              Add / Manage Users
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* USER ROLES TAB */}
        {activeTab === "roles" && (
          <>
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div className="relative w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search roles..."
                      className="pl-10"
                      value={searchRole}
                      onChange={e => setSearchRole(e.target.value)}
                    />
                  </div>
                  <div className="relative">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowRoleActionsMenu(open => !open)}
                      aria-label="Role and permission actions"
                      aria-expanded={showRoleActionsMenu}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                    {showRoleActionsMenu && (
                      <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-border bg-background p-1.5 shadow-xl">
                        <button
                          type="button"
                          onClick={() => { setShowRoleActionsMenu(false); handleAddRole(); }}
                          className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          <Plus className="mr-2 inline h-4 w-4" /> Add Role
                        </button>
                        <button
                          type="button"
                          onClick={downloadNidoPermissionsTemplate}
                          className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          <Download className="mr-2 inline h-4 w-4" /> Download Template
                        </button>
                        <button
                          type="button"
                          onClick={exportNidoPermissionsCsv}
                          className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          <Download className="mr-2 inline h-4 w-4" /> Export Permissions CSV
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowRoleActionsMenu(false)
                            if (!filteredRoles.length) {
                              toast.info("Nothing to export")
                              return
                            }
                            exportRolesCsv(filteredRoles)
                            toast.success("Roles CSV exported")
                          }}
                          className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          <Download className="mr-2 inline h-4 w-4" /> Export Roles CSV
                        </button>
                        <label className="block w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm hover:bg-muted">
                          <Upload className="mr-2 inline h-4 w-4" /> Bulk Upload CSV
                          <input
                            type="file"
                            accept=".csv,text/csv"
                            onChange={handleNidoBulkUpload}
                            className="sr-only"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setShowRoleActionsMenu(false)
                            if (!filteredRoles.length) {
                              toast.info("Nothing to export")
                              return
                            }
                            exportRolesPdf(filteredRoles)
                            toast.success("PDF exported")
                          }}
                          className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          <FileText className="mr-2 inline h-4 w-4" /> Export PDF
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div>
              <h2 className="text-lg font-semibold">User Roles</h2>
              <p className="text-sm text-muted-foreground">Define roles and configure their module permissions.</p>
            </div>

            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Department</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Role Name</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Assigned Users</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRoles.map(role => (
                      <tr key={role.id} className="border-b border-border hover:bg-muted/30">
                         <td className="px-6 py-4 text-sm">{role.department || "—"}</td>
                         <td className="px-6 py-4">
                          <button className="font-medium text-blue-600 hover:underline" onClick={() => handleEditRole(role)}>
                            {role.name}
                          </button>
                          {isSuperAdmin(role.name) && (
                            <Badge className="ml-2 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
                              Super Admin
                            </Badge>
                          )}
                        </td>
                        <td className="px-6 py-3 text-sm">{role.description}</td>
                        <td className="px-6 py-4">
                          <Badge className={role.status === "Active"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-muted text-muted-foreground"}>
                            {role.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-sm">{getRoleUserCount(role.name)} Users</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenPermissions(role)}
                              title="Configure permissions for this role"
                            >
                              <Shield className="mr-1.5 h-3.5 w-3.5 text-blue-500" />
                              Permissions
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleEditRole(role)}>
                              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleDeleteRole(role)}>
                              <Trash2 className="h-3.5 w-3.5 text-red-500" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredRoles.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-sm text-muted-foreground">
                          No roles match your search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    {filteredRoles.length === 0
                      ? "Showing 0 roles"
                      : `Showing ${(currentRolePage - 1) * rolePageSize + 1}–${Math.min(currentRolePage * rolePageSize, filteredRoles.length)} of ${filteredRoles.length} matching roles (${roles.length} total)`}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentRolePage === 1}
                      onClick={() => setCurrentRolePage(page => Math.max(1, page - 1))}
                    >
                      Previous
                    </Button>
                    <span className="min-w-20 text-center">Page {currentRolePage} of {totalRolePages}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentRolePage >= totalRolePages}
                      onClick={() => setCurrentRolePage(page => Math.min(totalRolePages, page + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* MANAGE USERS TAB */}
        {activeTab === "users" && <ManageUsersPanel />}
      </div>

      <AddEditRoleDialog
        open={roleDialogOpen}
        onOpenChange={setRoleDialogOpen}
        role={editingRole}
        onSave={handleSaveRole}
      />

      <RolePermissionsDialog
        open={permDialogOpen}
        onOpenChange={setPermDialogOpen}
        role={permRole}
      />
    </div>
  )
}
