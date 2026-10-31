"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tag, FileText, ArrowUpDown, Save } from "lucide-react"

export default function AddOrderStatusModal() {
  const [statusName, setStatusName] = useState("")
  const [description, setDescription] = useState("")
  const [sortOrder, setSortOrder] = useState("0")
  const [visible, setVisible] = useState(true)
  const [color, setColor] = useState("#3B82F6")

  const colors = [
    { name: "Blue", value: "#3B82F6" },
    { name: "Sky Blue", value: "#0EA5E9" },
    { name: "Indigo", value: "#6366F1" },
    { name: "Purple", value: "#8B5CF6" },
    { name: "Violet", value: "#7C3AED" },
    { name: "Pink", value: "#EC4899" },
    { name: "Rose", value: "#F43F5E" },
    { name: "Red", value: "#EF4444" },
    { name: "Orange", value: "#F97316" },
    { name: "Amber", value: "#F59E0B" },
    { name: "Yellow", value: "#EAB308" },
    { name: "Lime", value: "#84CC16" },
    { name: "Green", value: "#22C55E" },
    { name: "Emerald", value: "#10B981" },
    { name: "Teal", value: "#14B8A6" },
    { name: "Cyan", value: "#06B6D4" },
    { name: "Slate", value: "#64748B" },
    { name: "Gray", value: "#6B7280" },
    { name: "Zinc", value: "#71717A" },
    { name: "Neutral", value: "#737373" },
    { name: "Stone", value: "#78716C" },
    { name: "Brown", value: "#92400E" },
    { name: "Black", value: "#000000" },
    { name: "White", value: "#FFFFFF" },
  ]

  const selectedColor =
    colors.find((c) => c.value === color) || colors[0]

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Dialog open={true}>
        <DialogContent className="max-w-5xl rounded-3xl border-0 shadow-2xl">
          <DialogHeader className="pb-6 border-b">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
                <Tag className="h-7 w-7 text-blue-600" />
              </div>

              <div>
                <DialogTitle className="text-4xl font-bold">
                  Add Order Status
                </DialogTitle>
                <p className="mt-1 text-muted-foreground">
                  Create a new order status for your workflow
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="grid gap-2 py-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <Label className="mb-2 block">
                  Status Name <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Tag className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-10 h-14 rounded-xl"
                    placeholder="Enter status name"
                    value={statusName}
                    onChange={(e) => setStatusName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label className="mb-2 block">
                  Color <span className="text-red-500">*</span>
                </Label>

                <div className="flex gap-3">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-14 w-20 cursor-pointer rounded-xl border"
                  />

                  <Select value={color} onValueChange={setColor}>
                    <SelectTrigger className="h-14 rounded-xl flex-1">
                      <SelectValue>
                        <div className="flex items-center gap-3">
                          <div
                            className="h-5 w-5 rounded-full border"
                            style={{
                              backgroundColor:
                                selectedColor.value,
                            }}
                          />
                          {selectedColor.name}
                        </div>
                      </SelectValue>
                    </SelectTrigger>

                    <SelectContent className="max-h-72">
                      {colors.map((item) => (
                        <SelectItem
                          key={item.value}
                          value={item.value}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="h-4 w-4 rounded-full border"
                              style={{
                                backgroundColor: item.value,
                              }}
                            />
                            {item.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div>
              <Label className="mb-2 block">
                Description
              </Label>

              <div className="relative">
                <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />

                <Textarea
                  rows={5}
                  className="pl-10 rounded-xl"
                  placeholder="Enter status description"
                  value={description}
                  onChange={(e) =>
                    setDescription(e.target.value)
                  }
                />
              </div>
            </div>

            <div>
              <Label className="mb-2 block">
                Sort Order <span className="text-red-500">*</span>
              </Label>

              <div className="relative">
                <ArrowUpDown className="absolute left-3 top-4 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  className="pl-10 h-14 rounded-xl"
                  value={sortOrder}
                  onChange={(e) =>
                    setSortOrder(e.target.value)
                  }
                />
              </div>

              <p className="mt-2 text-sm text-muted-foreground">
                Lower numbers appear first in the workflow
              </p>
            </div>

            <div className="flex items-start gap-3 rounded-xl border p-4">
              <Switch
                checked={visible}
                onCheckedChange={setVisible}
              />

              <div>
                <p className="font-medium">Visible</p>
                <p className="text-sm text-muted-foreground">
                  This status will be visible in the order
                  workflow
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t pt-6">
            <Button variant="outline" size="lg">
              Cancel
            </Button>

            <Button
              size="lg"
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Save className="mr-2 h-4 w-4" />
              Create Status
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}