import { useState } from "react";
import { toast } from "sonner";
import { Plus, Search, MoreVertical, Trash2, Edit2 } from "lucide-react";

const MOCK_CATEGORIES = [
  { id: "cat_001", name: "Computers", description: "Laptops, desktops, monitors and accessories" },
  { id: "cat_002", name: "Networking", description: "Routers, switches, access points and cables" },
  { id: "cat_003", name: "Office Supplies", description: "General office materials and desk accessories" },
  { id: "cat_004", name: "Furniture", description: "Chairs, desks, cabinets and storage units" },
  { id: "cat_005", name: "Electrical", description: "Cables, switches, lighting and power equipment" },
  { id: "cat_006", name: "Cloud Software", description: "SaaS, productivity and cloud-based tools" },
  { id: "cat_007", name: "Stationery", description: "Pens, notebooks, envelopes and writing materials" },
  { id: "cat_008", name: "Pantry", description: "Beverages, snacks and kitchen supplies" },
  { id: "cat_009", name: "Cleaning Supplies", description: "Detergents, disinfectants and janitorial items" },
  { id: "cat_010", name: "Medical Supplies", description: "First aid, PPE, medicines and sanitizers" },
  { id: "cat_011", name: "Services", description: "IT services, consulting and facility management" },
];

export default function CategoriesPage() {
  const [categories, setCategories] = useState(MOCK_CATEGORIES);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [editingId, setEditingId] = useState<string | null>(null);

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    if (!form.name) {
      toast.error("Please enter category name");
      return;
    }
    const newCategory = {
      id: `cat_${Date.now()}`,
      name: form.name,
      description: form.description,
    };
    setCategories([...categories, newCategory]);
    toast.success("Category created");
    setShowCreate(false);
    setForm({ name: "", description: "" });
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Delete this category?")) {
      setCategories(categories.filter((c) => c.id !== id));
      toast.success("Category deleted");
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-transparent border-b border-gray-200/70">
        <div className="w-full px-2 md:px-4 lg:px-4 md:px-6 py-2 md:py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Settings / Categories</p>
            <h1 className="text-2xl font-bold">Product Categories</h1>
          </div>
          <button
            onClick={() => {
              setShowCreate(true);
              setForm({ name: "", description: "" });
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus size={18} />
            Add Category
          </button>
        </div>
      </div>

      <div className="w-full px-2 md:px-6 py-8">
        <div className="mb-6 relative">
          <Search className="absolute left-3 top-3 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        <div className="grid gap-4">
          {filteredCategories.map((cat) => (
            <div
              key={cat.id}
              className="bg-white p-2 border rounded-lg hover:shadow-md transition-shadow flex items-center justify-between"
            >
              <div className="flex-1">
                <h3 className="font-semibold">{cat.name}</h3>
                <p className="text-sm text-gray-600">{cat.description}</p>
              </div>
              <button
                onClick={() => handleDelete(cat.id)}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-2 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Add Category</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-2 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  className="w-full px-2 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
