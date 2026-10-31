"use client"

import { useState } from "react"
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  ShoppingCart,
  ClipboardCheck,
  ReceiptText,
  Headset,
  Layers,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import {
  addConfiguredOrderStatus,
  addOrderStatusParticular,
  deleteConfiguredOrderStatus,
  type ConfiguredOrderStatus,
  type StatusCategory,
  updateConfiguredOrderStatus,
  useOrderStatusConfig,
} from "@/lib/orderStatusStore"

const particularVisuals: Record<
  string,
  { icon: typeof ShoppingCart; iconClass: string }
> = {
  orders: { icon: ShoppingCart, iconClass: "text-blue-600 bg-blue-50" },
  "purchase-orders": { icon: ClipboardCheck, iconClass: "text-violet-600 bg-violet-50" },
  transactions: { icon: ReceiptText, iconClass: "text-emerald-600 bg-emerald-50" },
  support: { icon: Headset, iconClass: "text-amber-600 bg-amber-50" },
  other: { icon: Layers, iconClass: "text-slate-600 bg-slate-100" },
}

type OrderStatus = ConfiguredOrderStatus

const ALL_PARTICULARS = "all"
const ADD_PARTICULAR = "__add_particular__"

export default function OrderStatusesPage() {
  const config = useOrderStatusConfig()
  const particulars = config.particulars
  const statuses = config.statuses
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)

  const [selectedParticular, setSelectedParticular] = useState(ALL_PARTICULARS)
  const [category, setCategory] = useState<StatusCategory>("Orders")
  const [isAddingParticular, setIsAddingParticular] = useState(false)
  const [newParticularName, setNewParticularName] = useState("")
  const [particularError, setParticularError] = useState("")
  const [statusName, setStatusName] = useState("")
  const [description, setDescription] = useState("")
  const [sortOrder, setSortOrder] = useState("0")
  const [visible, setVisible] = useState(true)
  const [color, setColor] = useState("#3B82F6")

  const colors = [
    { name: "Blue", value: "#3B82F6" },
    { name: "Red", value: "#EF4444" },
    { name: "Green", value: "#10B981" },
    { name: "Yellow", value: "#EAB308" },
    { name: "Orange", value: "#F97316" },
    { name: "Purple", value: "#8B5CF6" },
    { name: "Pink", value: "#EC4899" },
    { name: "Rose", value: "#F43F5E" },
    { name: "Indigo", value: "#6366F1" },
    { name: "Teal", value: "#14B8A6" },
    { name: "Cyan", value: "#06B6D4" },
    { name: "Emerald", value: "#059669" },
    { name: "Amber", value: "#F59E0B" },
    { name: "Lime", value: "#84CC16" },
    { name: "Gray", value: "#6B7280" },
    { name: "Slate", value: "#64748B" },
    { name: "Black", value: "#111827" },
  ]

  const addParticular = () => {
    const name = newParticularName.trim()
    if (!name) {
      setParticularError("Enter a particular name.")
      return
    }

    const existing = particulars.find(
      (item) => item.value.toLowerCase() === name.toLowerCase()
    )
    if (existing) {
      setCategory(existing.value)
      setIsAddingParticular(false)
      setNewParticularName("")
      setParticularError("")
      return
    }

    addOrderStatusParticular({
      value: name,
      description: "Custom workflow particular",
      iconKey: "other",
    })
    setCategory(name)
    setSelectedParticular(name)
    setIsAddingParticular(false)
    setNewParticularName("")
    setParticularError("")
  }

  const handleParticularChange = (value: string) => {
    if (value === ADD_PARTICULAR) {
      setIsAddingParticular(true)
      setParticularError("")
      return
    }

    setCategory(value)
    setIsAddingParticular(false)
    setParticularError("")
  }

  const addStatus = () => {
    if (!statusName.trim()) return

    addConfiguredOrderStatus({
      category,
      color,
      name: statusName,
      description,
      sortOrder: Number(sortOrder),
      visible,
      default: false,
    })

    setSelectedParticular(category)
    setCategory(particulars[0]?.value ?? "Orders")
    setIsAddingParticular(false)
    setNewParticularName("")
    setStatusName("")
    setDescription("")
    setSortOrder("0")
    setVisible(true)
    setColor("#3B82F6")

    setOpen(false)
  }

  const deleteStatus = (id: number) => {
    deleteConfiguredOrderStatus(id)
  }

  const toggleVisible = (id: number) => {
    const status = statuses.find((item) => item.id === id)
    if (status) updateConfiguredOrderStatus(id, { visible: !status.visible })
  }

  const filteredStatuses = statuses.filter((status) =>
    `${status.name} ${status.description} ${status.category}`
      .toLowerCase()
      .includes(search.toLowerCase())
  )

  const visibleParticulars = particulars.filter(
    (particular) =>
      selectedParticular === ALL_PARTICULARS ||
      particular.value === selectedParticular
  )

  const groupedStatuses = visibleParticulars
    .map((group) => ({
      ...group,
      icon: particularVisuals[group.iconKey]?.icon || Layers,
      iconClass: particularVisuals[group.iconKey]?.iconClass || particularVisuals.other.iconClass,
      statuses: filteredStatuses
        .filter((status) => status.category === group.value)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    }))
    .filter((group) => !search.trim() || group.statuses.length > 0)

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Order Status
          </h1>

          <p className="text-muted-foreground">
            Manage and configure order status workflow
          </p>
        </div>

        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Status
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />

        <Input
          placeholder="Search statuses..."
          className="pl-10"
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
        />
      </div>

      <div>
        <p className="mb-3 text-sm font-semibold text-slate-700">Particulars</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {particulars.map((particular) => {
            const ParticularIcon = particularVisuals[particular.iconKey]?.icon || Layers
            const particularIconClass =
              particularVisuals[particular.iconKey]?.iconClass || particularVisuals.other.iconClass
            const count = statuses.filter((status) => status.category === particular.value).length

            return (
              <button
                key={particular.value}
                type="button"
                onClick={() => setSelectedParticular(particular.value)}
                className={`rounded-xl border p-3 text-left transition-all ${
                  selectedParticular === particular.value
                    ? "border-blue-500 bg-blue-50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50"
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${particularIconClass}`}>
                    <ParticularIcon className="h-4 w-4" />
                  </div>
                  <Badge variant="secondary">{count}</Badge>
                </div>
                <p className="truncate text-sm font-semibold text-slate-800">{particular.value}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{particular.description}</p>
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-5">
        {groupedStatuses.map((group) => {
          const GroupIcon = group.icon

          return (
            <Card key={group.value} className="overflow-hidden">
              <div className="flex items-center justify-between border-b bg-slate-50 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${group.iconClass}`}>
                    <GroupIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-800">{group.value}</h2>
                    <p className="text-xs text-muted-foreground">{group.description}</p>
                  </div>
                </div>
                <Badge variant="secondary">
                  {group.statuses.length} {group.statuses.length === 1 ? "status" : "statuses"}
                </Badge>
              </div>

              <CardContent className="p-0">
                {group.statuses.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                    No statuses in this particular yet. Use Add Status to create one.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px]">
                      <thead>
                        <tr className="border-b bg-white">
                          <th className="w-12"></th>
                          <th className="px-4 py-2 text-left">Color</th>
                          <th className="px-4 py-2 text-left">Status</th>
                          <th className="px-4 py-2 text-left">Description</th>
                          <th className="px-4 py-2 text-left">Sort</th>
                          <th className="px-4 py-2 text-left">Visible</th>
                          <th className="px-4 py-2 text-left">Default</th>
                          <th className="px-4 py-2 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.statuses.map((status) => (
                          <tr key={status.id} className="border-b last:border-0 hover:bg-slate-50/70">
                            <td className="px-4 py-4">
                              <GripVertical className="h-4 w-4 text-muted-foreground" />
                            </td>
                            <td className="px-4 py-4">
                              <div className="h-6 w-6 rounded" style={{ backgroundColor: status.color }} />
                            </td>
                            <td className="px-4 py-2 font-medium">{status.name}</td>
                            <td className="px-4 py-4 text-sm text-muted-foreground">{status.description}</td>
                            <td className="px-4 py-4">{status.sortOrder}</td>
                            <td className="px-4 py-4">
                              <Switch
                                checked={status.visible}
                                onCheckedChange={() => toggleVisible(status.id)}
                              />
                            </td>
                            <td className="px-4 py-4">
                              {status.default && <Badge>Default</Badge>}
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex justify-center gap-2">
                                <Button variant="ghost" size="icon" aria-label={`Edit ${status.name}`}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Delete ${status.name}`}
                                  onClick={() => deleteStatus(status.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}

        {groupedStatuses.length === 0 && (
          <Card>
            <CardContent className="px-5 py-10 text-center text-sm text-muted-foreground">
              No statuses match your search.
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Add Order Status
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div>
              <Label>Status Name</Label>
              <Input
                value={statusName}
                onChange={(e) =>
                  setStatusName(e.target.value)
                }
              />
            </div>

            <div>
              <Label>Particular</Label>
              <Select
                value={isAddingParticular ? ADD_PARTICULAR : category}
                onValueChange={handleParticularChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a particular" />
                </SelectTrigger>
                <SelectContent>
                  {particulars.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.value}
                    </SelectItem>
                  ))}
                  <SelectItem value={ADD_PARTICULAR}>+ Add new particular</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Choose which workflow this status belongs to.
              </p>

              {isAddingParticular && (
                <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/60 p-3">
                  <Label htmlFor="new-particular-name">New Particular Name</Label>
                  <div className="mt-2 flex gap-2">
                    <Input
                      id="new-particular-name"
                      value={newParticularName}
                      onChange={(event) => {
                        setNewParticularName(event.target.value)
                        setParticularError("")
                      }}
                      placeholder="e.g. Service Requests"
                      autoFocus
                    />
                    <Button type="button" onClick={addParticular}>
                      Add
                    </Button>
                  </div>
                  {particularError && (
                    <p className="mt-1.5 text-xs text-red-600">{particularError}</p>
                  )}
                </div>
              )}
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) =>
                  setDescription(e.target.value)
                }
              />
            </div>

            <div>
              <Label>Color</Label>

              <div className="flex gap-3">
                <input
                  type="color"
                  value={color}
                  onChange={(e) =>
                    setColor(e.target.value)
                  }
                />

                <Select
                  value={color}
                  onValueChange={setColor}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    {colors.map((item) => (
                      <SelectItem
                        key={item.value}
                        value={item.value}
                      >
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Sort Order</Label>
              <Input
                type="number"
                value={sortOrder}
                onChange={(e) =>
                  setSortOrder(e.target.value)
                }
              />
            </div>

            <div className="flex items-center justify-between border rounded-lg p-4">
              <Label>Visible</Label>

              <Switch
                checked={visible}
                onCheckedChange={setVisible}
              />
            </div>

            <div>
              <Label>Preview</Label>

              <div className="mt-2">
                <Badge
                  style={{
                    backgroundColor: color,
                    color: "white",
                  }}
                >
                  {statusName || "New Status"}
                </Badge>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>

            <Button onClick={addStatus}>
              Create Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}