import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  getProductCategoryTaxMap, saveProductCategoryTaxMap,
  getHsnCodes, getTaxCategories, type ProductCategoryTaxMap,
} from '@/lib/taxEngine';
import { getCatalogProducts } from '@/lib/catalogStore';

function getMasterCategories(): string[] {
  const cats = new Set(getCatalogProducts().map(p => p.category).filter(Boolean));
  return [...cats].sort((a, b) => a.localeCompare(b));
}

const EMPTY: Omit<ProductCategoryTaxMap, 'id'> = {
  productCategory: '', defaultHsnCode: '', taxCategoryId: 'tc-1',
  gstRate: 18, cgstPct: 9, sgstPct: 9, igstPct: 18,
  taxInclusive: false, isReverseCharge: false, isExempt: false, priority: 1,
};

// Sentinel used in Radix <Select> to represent "no HSN code selected".
// Radix does not support empty-string values, so we map '' <-> '__none__'.
const HSN_NONE = '__none__';

export default function ProductCategoryTaxTab() {
  const { user } = useAuth();
  const auditUser = user?.name || user?.email || 'System';
  const [maps, setMaps] = useState<ProductCategoryTaxMap[]>(getProductCategoryTaxMap);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProductCategoryTaxMap | null>(null);
  const [form, setForm] = useState<Omit<ProductCategoryTaxMap, 'id'>>(EMPTY);
  const [masterCategories, setMasterCategories] = useState<string[]>(getMasterCategories);
  const categories = getTaxCategories();
  const hsnCodes = getHsnCodes();

  // Re-derive categories whenever master catalog changes
  useEffect(() => {
    const refresh = () => setMasterCategories(getMasterCategories());
    window.addEventListener('catalogUpdated', refresh);
    return () => window.removeEventListener('catalogUpdated', refresh);
  }, []);

  const openAdd = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (m: ProductCategoryTaxMap) => { setEditing(m); setForm({ ...m }); setOpen(true); };

  // When a product category is selected, auto-match HSN code + tax rules from the HSN table
  const onProductCategoryChange = (category: string) => {
    const matchedHsn = hsnCodes.find(
      h => h.status === 'Active' && h.productCategory.toLowerCase() === category.toLowerCase()
    );
    if (matchedHsn) {
      const taxCat = categories.find(c => c.id === matchedHsn.taxCategoryId);
      setForm(f => ({
        ...f,
        productCategory: category,
        defaultHsnCode: matchedHsn.code,
        taxCategoryId: matchedHsn.taxCategoryId,
        gstRate: matchedHsn.gstRate,
        cgstPct: taxCat?.cgstPct ?? matchedHsn.gstRate / 2,
        sgstPct: taxCat?.sgstPct ?? matchedHsn.gstRate / 2,
        igstPct: taxCat?.igstPct ?? matchedHsn.gstRate,
        isReverseCharge: taxCat?.isReverseCharge ?? f.isReverseCharge,
        isExempt: taxCat?.isExempt ?? f.isExempt,
      }));
    } else {
      setForm(f => ({ ...f, productCategory: category }));
    }
  };

  // When tax category changes, auto-fill rates
  const onCategoryChange = (id: string) => {
    const cat = categories.find(c => c.id === id);
    if (cat) {
      setForm(f => ({
        ...f, taxCategoryId: id,
        gstRate: cat.igstPct, cgstPct: cat.cgstPct, sgstPct: cat.sgstPct, igstPct: cat.igstPct,
        isReverseCharge: cat.isReverseCharge, isExempt: cat.isExempt,
      }));
    } else {
      setForm(f => ({ ...f, taxCategoryId: id }));
    }
  };

  const handleSave = () => {
    if (!form.productCategory.trim()) { toast.error('Product category is required'); return; }
    const updated = editing
      ? maps.map(m => m.id === editing.id ? { ...form, id: editing.id } : m)
      : [...maps, { ...form, id: crypto.randomUUID() }];
    saveProductCategoryTaxMap(updated, auditUser);
    setMaps(updated);
    setOpen(false);
    toast.success(editing ? 'Mapping updated' : 'Category tax mapping added');
  };

  const handleDelete = (id: string) => {
    const updated = maps.filter(m => m.id !== id);
    saveProductCategoryTaxMap(updated, auditUser);
    setMaps(updated);
    toast.success('Mapping deleted');
  };

  const p = (k: keyof Omit<ProductCategoryTaxMap, 'id'>, v: unknown) =>
    setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Layers className="w-5 h-5 text-blue-600" />
        <div>
          <h2 className="text-lg font-semibold">Product Category Tax Mapping</h2>
          <p className="text-sm text-muted-foreground">
            Define default tax rules per product category — every product automatically inherits these rules
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <strong>How it works:</strong> When a product's category matches a row below, the Tax Engine uses that row's
        tax rates automatically. HSN code mapping takes priority over category mapping. A vendor/client override
        takes priority over both.
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Category → Tax Rules</CardTitle>
            <Button size="sm" onClick={openAdd} className="gap-1.5"><Plus size={14} /> Add Mapping</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Category</TableHead>
                <TableHead>Default HSN</TableHead>
                <TableHead>Tax Category</TableHead>
                <TableHead>CGST</TableHead>
                <TableHead>SGST</TableHead>
                <TableHead>IGST</TableHead>
                <TableHead>Inclusive</TableHead>
                <TableHead>Flags</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {maps.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.productCategory}</TableCell>
                  <TableCell className="font-mono text-sm">{m.defaultHsnCode || '—'}</TableCell>
                  <TableCell className="text-sm">{categories.find(c => c.id === m.taxCategoryId)?.name || m.taxCategoryId}</TableCell>
                  <TableCell>{m.cgstPct}%</TableCell>
                  <TableCell>{m.sgstPct}%</TableCell>
                  <TableCell>{m.igstPct}%</TableCell>
                  <TableCell>
                    <Badge className={m.taxInclusive ? 'bg-blue-100 text-blue-700 border-none' : 'bg-slate-100 text-slate-600 border-none'}>
                      {m.taxInclusive ? 'Yes' : 'No'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {m.isReverseCharge && <Badge className="bg-orange-100 text-orange-700 border-none text-xs">RC</Badge>}
                      {m.isExempt && <Badge className="bg-slate-100 text-slate-600 border-none text-xs">Exempt</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>{m.priority}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil size={14} /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)}><Trash2 size={14} className="text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {maps.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    No category mappings yet — add one to enable category-based tax calculation
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Category Tax Mapping' : 'Add Category Tax Mapping'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Product Category *</Label>
              {masterCategories.length > 0 ? (
                <Select
                  value={form.productCategory || '__pick__'}
                  onValueChange={v => onProductCategoryChange(v === '__pick__' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category from Master Catalog…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__pick__" disabled>Select a category…</SelectItem>
                    {masterCategories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="space-y-1">
                  <Input
                    placeholder="Type a product category name…"
                    value={form.productCategory}
                    onChange={e => setForm(f => ({ ...f, productCategory: e.target.value }))}
                  />
                  <p className="text-xs text-amber-600">
                    No categories in Master Catalog yet — type a category name manually.
                  </p>
                </div>
              )}
            </div>
            <div>
              <Label>Default HSN Code</Label>
              <Select
                value={form.defaultHsnCode === '' ? HSN_NONE : form.defaultHsnCode}
                onValueChange={v => p('defaultHsnCode', v === HSN_NONE ? '' : v)}
              >
                <SelectTrigger><SelectValue placeholder="Select HSN code…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={HSN_NONE}>None</SelectItem>
                  {hsnCodes.filter(h => h.status === 'Active').map(h => (
                    <SelectItem key={h.id} value={h.code}>{h.code} — {h.description}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tax Category</Label>
              <Select value={form.taxCategoryId} onValueChange={onCategoryChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.filter(c => c.status === 'Active').map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>CGST %</Label><Input type="number" step="0.5" value={form.cgstPct} onChange={e => p('cgstPct', +e.target.value)} /></div>
              <div><Label>SGST %</Label><Input type="number" step="0.5" value={form.sgstPct} onChange={e => p('sgstPct', +e.target.value)} /></div>
              <div><Label>IGST %</Label><Input type="number" step="0.5" value={form.igstPct} onChange={e => p('igstPct', +e.target.value)} /></div>
            </div>
            <div><Label>Priority (lower = higher priority)</Label><Input type="number" min={1} value={form.priority} onChange={e => p('priority', +e.target.value)} /></div>
            <div className="grid grid-cols-3 gap-4 pt-1">
              <div className="flex items-center gap-2"><Switch checked={form.taxInclusive} onCheckedChange={v => p('taxInclusive', v)} /><Label className="text-sm">Tax Inclusive</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.isReverseCharge} onCheckedChange={v => p('isReverseCharge', v)} /><Label className="text-sm">Reverse Charge</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.isExempt} onCheckedChange={v => p('isExempt', v)} /><Label className="text-sm">Exempt</Label></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editing ? 'Update' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
