import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import type { PriceSlab } from '@/lib/priceEngineStore';
import { getMasterCatalogCategories } from '@/lib/catalogStore';

/** Always "All Products" first, then live categories from master catalog. */
function buildApplyToOptions(): string[] {
  return ['All Products', ...getMasterCatalogCategories()];
}

function emptySlab(): PriceSlab {
  return {
    id: `slab-${Date.now()}`,
    name: '',
    minQty: 0,
    maxQty: 0,
    discountPct: 0,
    applyTo: '',
    status: 'Active',
  };
}

export default function ClientPriceSlabsPanel({
  clientId,
  slabs,
  onChange,
}: {
  clientId: string;
  slabs: PriceSlab[];
  onChange: (slabs: PriceSlab[]) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [originalSlab, setOriginalSlab] = useState<PriceSlab | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [applyToOptions, setApplyToOptions] = useState<string[]>(buildApplyToOptions);
  const draft = slabs.find((slab) => slab.id === editingId) ?? null;

  // Re-build options whenever master catalog changes
  useEffect(() => {
    const handler = () => setApplyToOptions(buildApplyToOptions());
    window.addEventListener('catalogUpdated', handler);
    return () => window.removeEventListener('catalogUpdated', handler);
  }, []);

  useEffect(() => {
    setEditingId(null);
    setOriginalSlab(null);
    setIsNew(false);
  }, [clientId]);

  const updateSlab = (id: string, patch: Partial<PriceSlab>) =>
    onChange(slabs.map((slab) => slab.id === id ? { ...slab, ...patch } : slab));

  const startAdd = () => {
    const slab = emptySlab();
    onChange([...slabs, slab]);
    setEditingId(slab.id);
    setOriginalSlab(null);
    setIsNew(true);
  };

  const startEdit = (slab: PriceSlab) => {
    setOriginalSlab({ ...slab });
    setEditingId(slab.id);
    setIsNew(false);
  };

  const cancelEdit = () => {
    if (isNew && editingId) {
      onChange(slabs.filter((slab) => slab.id !== editingId));
    } else if (originalSlab) {
      onChange(slabs.map((slab) => slab.id === originalSlab.id ? originalSlab : slab));
    }
    setEditingId(null);
    setOriginalSlab(null);
    setIsNew(false);
  };

  const finishEdit = () => {
    setEditingId(null);
    setOriginalSlab(null);
    setIsNew(false);
  };

  const saveDraft = () => {
    if (!draft) return;
    if (
      !draft.name.trim()
      || draft.minQty < 1
      || draft.maxQty < draft.minQty
      || draft.discountPct <= 0
      || !draft.applyTo
    ) {
      return;
    }
    finishEdit();
  };

  const removeSlab = (id: string) => onChange(slabs.filter((slab) => slab.id !== id));

  const toggleStatus = (id: string) =>
    onChange(slabs.map((slab) => (
      slab.id === id
        ? { ...slab, status: slab.status === 'Active' ? 'Inactive' : 'Active' }
        : slab
    )));

  return (
    <div className="mt-6">
      <div className="bg-blue-50 border border-blue-100 rounded-lg px-2 py-2 mb-4">
        <p className="text-sm text-gray-700">
          <span className="font-semibold text-gray-900">Price Slabs:</span> Define volume-based pricing tiers that
          apply discounts based on order quantity across all products or specific categories.
        </p>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-2 py-2.5 font-semibold text-gray-600">Slab Name</th>
              <th className="text-left px-2 py-2.5 font-semibold text-gray-600">Min Qty</th>
              <th className="text-left px-2 py-2.5 font-semibold text-gray-600">Max Qty</th>
              <th className="text-left px-2 py-2.5 font-semibold text-gray-600">Discount %</th>
              <th className="text-left px-2 py-2.5 font-semibold text-gray-600">Apply To</th>
              <th className="text-left px-2 py-2.5 font-semibold text-gray-600">Status</th>
              <th className="text-left px-2 py-2.5 font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {slabs.map((slab) => {
              const editing = editingId === slab.id && draft;
              if (editing) {
                return (
                  <tr key={slab.id} className="border-b border-gray-100 last:border-0 bg-blue-50/30">
                    <td className="px-4 py-2">
                      <Input
                        value={draft.name}
                        onChange={(e) => updateSlab(draft.id, { name: e.target.value })}
                        placeholder="Slab name"
                        className="h-8 text-xs bg-white"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        type="number"
                        value={draft.minQty || ""}
                        onChange={(e) => updateSlab(draft.id, { minQty: parseInt(e.target.value) || 0 })}
                        className="h-8 text-xs w-20 bg-white"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        type="number"
                        value={draft.maxQty || ""}
                        onChange={(e) => updateSlab(draft.id, { maxQty: parseInt(e.target.value) || 0 })}
                        className="h-8 text-xs w-20 bg-white"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        type="number"
                        value={draft.discountPct || ""}
                        onChange={(e) => updateSlab(draft.id, { discountPct: parseFloat(e.target.value) || 0 })}
                        className="h-8 text-xs w-20 bg-white"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={draft.applyTo}
                        onChange={(e) => updateSlab(draft.id, { applyTo: e.target.value })}
                        className="h-8 text-xs border border-gray-300 rounded px-2 bg-white"
                      >
                          <option value="">Select category</option>
                        {applyToOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs text-gray-400">{draft.status}</span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        <button onClick={saveDraft} className="text-blue-600 hover:underline text-xs font-medium">Done</button>
                        <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600">
                          <X size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={slab.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-2 text-gray-800 font-medium">{slab.name}</td>
                  <td className="px-4 py-2 text-gray-600">{slab.minQty}</td>
                  <td className="px-4 py-2 text-gray-600">{slab.maxQty}</td>
                  <td className="px-4 py-3">
                    <span className={slab.discountPct > 0 ? 'text-green-600 font-medium' : 'text-gray-500'}>
                      {slab.discountPct}%
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-500">{slab.applyTo}</td>
                  <td className="px-4 py-3">
                    <button
              onClick={() => toggleStatus(slab.id)}
                      className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${
                        slab.status === 'Active'
                          ? 'bg-green-50 text-green-600 border-green-200'
                          : 'bg-gray-100 text-gray-400 border-gray-200'
                      }`}
                    >
                      {slab.status}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 text-xs">
                      <button onClick={() => startEdit(slab)} className="text-blue-600 hover:underline font-medium">Edit</button>
                      <button onClick={() => removeSlab(slab.id)} className="text-red-500 hover:underline font-medium">Delete</button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {isNew && draft && (
              <tr className="border-b border-gray-100 last:border-0 bg-blue-50/30">
                <td className="px-4 py-2">
                  <Input
                    autoFocus
                    value={draft.name}
                    onChange={(e) => updateSlab(draft.id, { name: e.target.value })}
                    placeholder="Slab name"
                    className="h-8 text-xs bg-white"
                  />
                </td>
                <td className="px-4 py-2">
                  <Input
                    type="number"
                    value={draft.minQty || ""}
                    onChange={(e) => updateSlab(draft.id, { minQty: parseInt(e.target.value) || 0 })}
                    className="h-8 text-xs w-20 bg-white"
                  />
                </td>
                <td className="px-4 py-2">
                  <Input
                    type="number"
                    value={draft.maxQty || ""}
                    onChange={(e) => updateSlab(draft.id, { maxQty: parseInt(e.target.value) || 0 })}
                    className="h-8 text-xs w-20 bg-white"
                  />
                </td>
                <td className="px-4 py-2">
                  <Input
                    type="number"
                    value={draft.discountPct || ""}
                    onChange={(e) => updateSlab(draft.id, { discountPct: parseFloat(e.target.value) || 0 })}
                    className="h-8 text-xs w-20 bg-white"
                  />
                </td>
                <td className="px-4 py-2">
                  <select
                    value={draft.applyTo}
                    onChange={(e) => updateSlab(draft.id, { applyTo: e.target.value })}
                    className="h-8 text-xs border border-gray-300 rounded px-2 bg-white"
                  >
                      <option value="">Select category</option>
                    {applyToOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <span className="text-xs text-gray-400">Active</span>
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-3">
                    <button onClick={saveDraft} className="text-blue-600 hover:underline text-xs font-medium">Done</button>
                    <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600">
                      <X size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {slabs.length === 0 && !isNew && (
              <tr>
                <td colSpan={7} className="px-4 py-2 text-center text-xs text-gray-400">
                  No price slabs configured yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!isNew && (
        <Button
          variant="outline"
          size="sm"
          className="mt-3 h-8 text-xs gap-1.5"
          onClick={startAdd}
        >
          <Plus size={13} /> Add Price Slab
        </Button>
      )}
    </div>
  );
}
