import { useEffect, useRef, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  getGlobalCategoryRules,
  saveGlobalCategoryRules,
  type CategoryPricingRule,
} from "@/lib/priceEngineStore";
import { getMasterCatalogCategories } from "@/lib/catalogStore";

function loadCatalogCategories(): string[] {
  return getMasterCatalogCategories();
}

const ADD_NEW_SENTINEL = "__ADD_NEW__";

function emptyRule(category: string): CategoryPricingRule {
  return {
    id: `cat-rule-${Date.now()}`,
    category,
    marginPct: 0,
    bufferPct: 0,
  };
}

function CategorySelect({
  value,
  onChange,
  usedCategories,
  categories,
  onNewCategory,
}: {
  value: string;
  onChange: (value: string) => void;
  usedCategories: Set<string>;
  categories: string[];
  onNewCategory: (category: string) => void;
}) {
  const [addingNew, setAddingNew] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const available = categories.filter((category) => !usedCategories.has(category) || category === value);

  const commitNew = () => {
    const category = newCategory.trim();
    if (!category) return;
    onNewCategory(category);
    onChange(category);
    setNewCategory("");
    setAddingNew(false);
  };

  if (addingNew) {
    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          autoFocus
          value={newCategory}
          onChange={(event) => setNewCategory(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") commitNew();
            if (event.key === "Escape") setAddingNew(false);
          }}
          placeholder="Category name"
          className="h-8 w-36 bg-white text-xs"
        />
        <button type="button" onClick={commitNew} className="p-0.5 text-blue-600" title="Confirm">
          <Check size={14} />
        </button>
        <button type="button" onClick={() => setAddingNew(false)} className="p-0.5 text-gray-400" title="Cancel">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(event) => {
        if (event.target.value === ADD_NEW_SENTINEL) {
          setAddingNew(true);
        } else {
          onChange(event.target.value);
        }
      }}
      className="h-8 w-44 rounded border border-gray-300 bg-white px-2 text-xs"
    >
      {available.map((category) => (
        <option key={category} value={category}>{category}</option>
      ))}
      <option disabled>──────────────</option>
      <option value={ADD_NEW_SENTINEL}>+ Add new category</option>
    </select>
  );
}

export default function GlobalCategoryPricingPanel() {
  const [rules, setRules] = useState<CategoryPricingRule[]>(() => getGlobalCategoryRules());
  const [catalogCategories, setCatalogCategories] = useState<string[]>(loadCatalogCategories);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CategoryPricingRule | null>(null);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    const refresh = () => setCatalogCategories(loadCatalogCategories());
    window.addEventListener("catalogUpdated", refresh);
    return () => window.removeEventListener("catalogUpdated", refresh);
  }, []);

  const persist = (next: CategoryPricingRule[]) => {
    setRules(next);
    saveGlobalCategoryRules(next);
  };

  const allCategories = Array.from(new Set([
    ...catalogCategories,
    ...customCategories,
    ...rules.map((rule) => rule.category),
  ])).sort();
  const usedCategories = new Set(rules.map((rule) => rule.category));

  const startAdd = () => {
    const firstCategory = allCategories.find((category) => !usedCategories.has(category)) ?? allCategories[0] ?? "";
    const nextDraft = emptyRule(firstCategory);
    setDraft(nextDraft);
    setEditingId(nextDraft.id);
    setIsNew(true);
  };

  const startEdit = (rule: CategoryPricingRule) => {
    setDraft({ ...rule });
    setEditingId(rule.id);
    setIsNew(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
    setIsNew(false);
  };

  const saveDraft = () => {
    if (!draft || !draft.category.trim()) return;
    persist(isNew ? [...rules, draft] : rules.map((rule) => rule.id === draft.id ? draft : rule));
    cancelEdit();
  };

  const removeRule = (id: string) => persist(rules.filter((rule) => rule.id !== id));

  return (
    <div className="border border-gray-300 rounded-lg p-4">
      <h2 className="mb-1 text-xs font-bold uppercase text-blue-700">Centralized Category Profit Rules</h2>
      <p className="mb-4 text-xs text-gray-500">
        These rules are configured once and apply to all clients. The margin and buffer are added to each client&apos;s
        own Profit Margin for products in the selected category.
      </p>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Category</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Margin %</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Buffer %</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => {
              const editing = editingId === rule.id && draft;
              if (editing) {
                return (
                  <tr key={rule.id} className="border-b border-gray-100 bg-blue-50/30">
                    <td className="px-3 py-2">
                      <CategorySelect
                        value={draft.category}
                        onChange={(category) => setDraft({ ...draft, category })}
                        usedCategories={new Set([...usedCategories].filter((category) => category !== rule.category))}
                        categories={allCategories}
                        onNewCategory={(category) => {
                          setCustomCategories((current) => current.includes(category) ? current : [...current, category]);
                          setDraft({ ...draft, category });
                        }}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={draft.marginPct || ""}
                        onChange={(event) => setDraft({ ...draft, marginPct: Math.min(100, Math.max(0, parseFloat(event.target.value) || 0)) })}
                        className="h-8 w-20 bg-white text-xs"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={draft.bufferPct || ""}
                        onChange={(event) => setDraft({ ...draft, bufferPct: Math.min(100, Math.max(0, parseFloat(event.target.value) || 0)) })}
                        className="h-8 w-20 bg-white text-xs"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3 text-xs">
                        <button type="button" onClick={saveDraft} className="font-medium text-blue-600 hover:underline">Save</button>
                        <button type="button" onClick={cancelEdit} className="text-gray-400"><X size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={rule.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-3 py-2 font-medium text-gray-800">{rule.category}</td>
                  <td className="px-3 py-2 text-gray-700">{rule.marginPct}%</td>
                  <td className="px-3 py-2 text-gray-500">+{rule.bufferPct}%</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-3 text-xs">
                      <button type="button" onClick={() => startEdit(rule)} className="flex items-center gap-1 font-medium text-blue-600 hover:underline">
                        <Pencil size={11} /> Edit
                      </button>
                      <button type="button" onClick={() => removeRule(rule.id)} className="flex items-center gap-1 font-medium text-red-500 hover:underline">
                        <Trash2 size={11} /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {isNew && draft && (
              <tr className="border-b border-gray-100 bg-blue-50/30">
                <td className="px-3 py-2">
                  <CategorySelect
                    value={draft.category}
                    onChange={(category) => setDraft({ ...draft, category })}
                    usedCategories={usedCategories}
                    categories={allCategories}
                    onNewCategory={(category) => {
                      setCustomCategories((current) => current.includes(category) ? current : [...current, category]);
                      setDraft({ ...draft, category });
                    }}
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={draft.marginPct || ""}
                    onChange={(event) => setDraft({ ...draft, marginPct: Math.min(100, Math.max(0, parseFloat(event.target.value) || 0)) })}
                    className="h-8 w-20 bg-white text-xs"
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={draft.bufferPct || ""}
                    onChange={(event) => setDraft({ ...draft, bufferPct: Math.min(100, Math.max(0, parseFloat(event.target.value) || 0)) })}
                    className="h-8 w-20 bg-white text-xs"
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-3 text-xs">
                    <button type="button" onClick={saveDraft} className="font-medium text-blue-600 hover:underline">Save</button>
                    <button type="button" onClick={cancelEdit} className="text-gray-400"><X size={14} /></button>
                  </div>
                </td>
              </tr>
            )}
            {rules.length === 0 && !isNew && (
              <tr>
                <td colSpan={4} className="px-3 py-3 text-center text-xs text-gray-400">
                  No centralized category rules configured yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!isNew && (
        <Button variant="outline" size="sm" className="mt-3 h-8 gap-1.5 text-xs" onClick={startAdd}>
          <Plus size={13} /> Add Category Rule
        </Button>
      )}
    </div>
  );
}