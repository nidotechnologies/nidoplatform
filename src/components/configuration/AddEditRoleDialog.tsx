"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import type { NidoRole } from "@/lib/nidoUsersStore"

interface AddEditRoleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  role: NidoRole | null
  onSave: (values: { department: string; name: string; description: string; status: "Active" | "Inactive" }) => void
}

export default function AddEditRoleDialog({ open, onOpenChange, role, onSave }: AddEditRoleDialogProps) {
  const [department, setDepartment] = useState("")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<"Active" | "Inactive">("Active")
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) {
      setDepartment(role?.department ?? "")
      setName(role?.name ?? "")
      setDescription(role?.description ?? "")
      setStatus(role?.status ?? "Active")
      setError("")
    }
  }, [open, role])

  const handleSubmit = () => {
    if (!name.trim()) {
      setError("Role name is required.")
      return
    }
    onSave({ department: department.trim(), name: name.trim(), description: description.trim(), status })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{role ? "Edit Role" : "Add Role"}</DialogTitle>
          <DialogDescription>
            {role ? "Update this role's name, description, and status." : "Define a new role that can be assigned to platform users."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-2 block text-sm font-medium">Department</Label>
            <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Finance" />
          </div>

          <div>
            <Label className="mb-2 block text-sm font-medium">Role Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Warehouse Manager" />
          </div>

          <div>
            <Label className="mb-2 block text-sm font-medium">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What can users with this role do?" />
          </div>

          <div>
            <Label className="mb-2 block text-sm font-medium">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as "Active" | "Inactive")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>{role ? "Save Changes" : "Add Role"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
