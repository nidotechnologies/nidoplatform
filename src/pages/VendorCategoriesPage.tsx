import { Plus, Settings, Eye, Edit2, Trash2, Download, ZapOff, Lock, Layers } from "lucide-react";

const MOCK_CATEGORIES = [
  { id: 1, name: "Computers", code: "COM", description: "Laptops, desktops, monitors...", workflow: "IT Service Approval", template: "Standard", vendors: 0, status: "Active" },
  { id: 2, name: "Networking", code: "NET", description: "Routers, switches, cables...", workflow: "IT Service Approval", template: "Standard", vendors: 0, status: "Active" },
  { id: 3, name: "Office Supplies", code: "OFS", description: "General office materials...", workflow: "No Approval Required", template: "Basic", vendors: 0, status: "Active" },
  { id: 4, name: "Furniture", code: "FUR", description: "Chairs, desks, cabinets...", workflow: "No Approval Required", template: "Basic", vendors: 0, status: "Active" },
  { id: 5, name: "Electrical", code: "ELC", description: "Cables, switches, lighting...", workflow: "No Approval Required", template: "Basic", vendors: 0, status: "Active" },
  { id: 6, name: "Cloud Software", code: "CLS", description: "SaaS and cloud-based tools...", workflow: "No Approval Required", template: "Premium", vendors: 0, status: "Active" },
  { id: 7, name: "Stationery", code: "STN", description: "Pens, notebooks, envelopes...", workflow: "No Approval Required", template: "Basic", vendors: 0, status: "Active" },
  { id: 8, name: "Pantry", code: "PAN", description: "Beverages, snacks, kitchen...", workflow: "No Approval Required", template: "Basic", vendors: 0, status: "Active" },
  { id: 9, name: "Cleaning Supplies", code: "CLN", description: "Detergents, disinfectants...", workflow: "No Approval Required", template: "Basic", vendors: 0, status: "Active" },
  { id: 10, name: "Medical Supplies", code: "MED", description: "First aid, PPE, sanitizers...", workflow: "Maintenance Approval", template: "Standard", vendors: 0, status: "Active" },
  { id: 11, name: "Services", code: "SRV", description: "IT, consulting, facility mgmt...", workflow: "No Approval Required", template: "Standard", vendors: 0, status: "Active" },
];

export default function VendorCategoriesPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="bg-transparent border-b border-border">
        <div className="px-3 sm:px-4 md:px-6 lg:px-8 py-2 md:py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Configuration / Vendor Categories</p>
            <h1 className="text-2xl font-bold text-foreground">Vendor Categories</h1>
          </div>
          <div className="flex gap-3">
            <button className="px-4 py-2 border border-border rounded-lg hover:bg-muted flex items-center gap-2 text-sm font-medium text-foreground">
              <Download size={18} />
              Export
            </button>
            <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-2 text-sm font-medium">
              <Plus size={18} />
              Add Category
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 py-8">
        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-3">
          <select className="px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground">
            <option>All Vendors</option>
          </select>
          <select className="px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground">
            <option>All Workflows</option>
          </select>
          <select className="px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground">
            <option>All SLA Templates</option>
          </select>
          <input type="text" placeholder="Search" className="flex-1 px-2 py-2 border border-border rounded-lg text-sm bg-background text-foreground placeholder:text-muted-foreground" />
        </div>

        {/* Table */}
        <div className="bg-card rounded-lg border border-border overflow-hidden mb-8">
          <div className="overflow-x-auto min-w-0">
            <table className="w-full table-auto">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-3 sm:px-4 py-2 text-left text-xs font-semibold text-muted-foreground">CATEGORY NAME</th>
                  <th className="hidden md:table-cell px-2 py-2 text-left text-xs font-semibold text-muted-foreground">VENDOR CODE</th>
                  <th className="px-3 sm:px-4 md:px-6 lg:px-8 py-2 md:py-4 text-left text-xs font-semibold text-muted-foreground">DESCRIPTION</th>
                  <th className="px-3 sm:px-4 md:px-6 lg:px-8 py-2 md:py-4 text-left text-xs font-semibold text-muted-foreground">APPROVAL WORKFLOW</th>
                  <th className="px-3 sm:px-4 md:px-6 lg:px-8 py-2 md:py-4 text-left text-xs font-semibold text-muted-foreground">DEFAULT SLA TEMPLATE</th>
                  <th className="px-3 sm:px-4 md:px-6 lg:px-8 py-2 md:py-4 text-left text-xs font-semibold text-muted-foreground">ACTIVE VENDORS</th>
                  <th className="px-3 sm:px-4 md:px-6 lg:px-8 py-2 md:py-4 text-left text-xs font-semibold text-muted-foreground">STATUS</th>
                  <th className="px-3 sm:px-4 md:px-6 lg:px-8 py-2 md:py-4 text-center text-xs font-semibold text-muted-foreground">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_CATEGORIES.map((cat) => (
                  <tr key={cat.id} className="border-b border-border hover:bg-muted/30">
                    <td className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-foreground">{cat.name}</td>
                    <td className="hidden md:table-cell px-2 py-2 text-xs sm:text-sm text-foreground">{cat.code}</td>
                    <td className="hidden lg:table-cell px-2 py-2 text-xs sm:text-sm text-muted-foreground">{cat.description}</td>
                    <td className="hidden xl:table-cell px-2 py-2 text-xs sm:text-sm text-foreground">{cat.workflow}</td>
                    <td className="hidden xl:table-cell px-2 py-2 text-xs sm:text-sm text-foreground">{cat.template}</td>
                    <td className="hidden sm:table-cell px-2 py-2 text-xs sm:text-sm text-center text-foreground">{cat.vendors}</td>
                    <td className="px-3 sm:px-4 py-2 text-xs sm:text-sm">
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        {cat.status}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button className="p-1 hover:bg-muted rounded text-foreground">
                          <Edit2 size={14} />
                        </button>
                        <button className="p-1 hover:bg-muted rounded text-red-600">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-3 sm:px-4 py-2 border-t border-border text-xs sm:text-sm text-muted-foreground">
            1 — 5 of 5
          </div>
        </div>

        {/* Category Settings */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">Category Settings</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
            <div className="bg-card p-2 sm:p-6 rounded-lg border border-border hover:shadow-lg transition-shadow cursor-pointer">
              <div className="flex items-center gap-3 mb-2">
                <Settings size={18} className="text-primary" />
                <h3 className="font-semibold text-sm sm:text-base text-foreground">Manage Approval Paths</h3>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">Configure category-specific approval workflows.</p>
            </div>
            <div className="bg-card p-2 sm:p-6 rounded-lg border border-border hover:shadow-lg transition-shadow cursor-pointer">
              <div className="flex items-center gap-3 mb-2">
                <Lock size={18} className="text-green-600" />
                <h3 className="font-semibold text-sm sm:text-base text-foreground">Role Hierarchy & Permissions</h3>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">Set roles and permissions for vendor categories.</p>
            </div>
            <div className="bg-card p-2 sm:p-6 rounded-lg border border-border hover:shadow-lg transition-shadow cursor-pointer">
              <div className="flex items-center gap-3 mb-2">
                <ZapOff size={18} className="text-purple-600" />
                <h3 className="font-semibold text-sm sm:text-base text-foreground">Auto Assignment Logic</h3>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">Define auto vendor assignment rules.</p>
            </div>
            <div className="bg-card p-2 sm:p-6 rounded-lg border border-border hover:shadow-lg transition-shadow cursor-pointer">
              <div className="flex items-center gap-3 mb-2">
                <Layers size={18} className="text-orange-600" />
                <h3 className="font-semibold text-sm sm:text-base text-foreground">Category Settings</h3>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">Edit/manage products by vendors.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
