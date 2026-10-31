import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { getTaxCategories, saveTaxCategories, type TaxCategory } from '@/lib/taxEngine';
import { useAuth } from '@/contexts/AuthContext';

const EMPTY: Omit<TaxCategory, 'id'> = {
  name: '', description: '', cgstPct: 9, sgstPct: 9, igstPct: 18, utgstPct: 9,
  isReverseCharge: false, isExempt: false, isZeroRated: false,
  applicableTo: 'Both', status: 'Active',
};

export default function TaxCategoriesTab() {
  const { user } = useAuth();
  const auditUser = user?.name || user?.email || 'System';
  const [categories, setCategories] = useState<TaxCategory[]>(getTaxCategories);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TaxCategory | null>(null);
  const [form, setForm] = useState<Omit<TaxCategory, 'id'>>(EMPTY);

  const refresh = () => setCategories(getTaxCategories());

  const openAdd = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (cat: TaxCategory) => { setEditing(cat); setForm({ ...cat }); setOpen(true); };

  const handleSave = () => {
    if (!form.name.trim()) { toast.error('Tax category name is required'); return; }
    const updated = editing
      ? categories.map(c => c.id === editing.id ? { ...form, id: editing.id } : c)
      : [...categories, { ...form, id: crypto.randomUUID() }];
    saveTaxCategories(updated, auditUser);
    setCategories(updated);
    setOpen(false);
    toast.success(editing ? 'Tax category updated' : 'Tax category created');
  };

  const handleDelete = (id: string) => {
    const updated = categories.filter(c => c.id !== id);
    saveTaxCategories(updated, auditUser);
    setCategories(updated);
    toast.success('Tax category deleted');
  };

  const toggleStatus = (id: string) => {
    const updated = categories.map(c =>
      c.id === id ? { ...c, status: c.status === 'Active' ? 'Inactive' : 'Active' as const } : c
    );
    saveTaxCategories(updated, auditUser);
    setCategories(updated);
  };

  const p = (k: keyof Omit<TaxCategory, 'id'>, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const active = categories.filter(c => c.status === 'Active').length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Categories', value: categories.length, color: 'text-blue-600 bg-blue-50' },
          { label: 'Active', value: active, color: 'text-green-600 bg-green-50' },
          { label: 'Inactive', value: categories.length - active, color: 'text-slate-600 bg-slate-50' },
          { label: 'Reverse Charge', value: categories.filter(c => c.isReverseCharge).length, color: 'text-orange-600 bg-orange-50' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4 text-center">
              <p className={`text-2xl font-bold ${s.color.split(' ')[0]}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-base">Tax Categories</CardTitle>
            </div>
            <Button size="sm" onClick={openAdd} className="gap-1.5"><Plus size={14} /> Add Category</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>CGST %</TableHead>
                <TableHead>SGST %</TableHead>
                <TableHead>IGST %</TableHead>
                <TableHead>Applies To</TableHead>
                <TableHead>Flags</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map(cat => (
                <TableRow key={cat.id}>
                  <TableCell>
                    <div className="font-medium">{cat.name}</div>
                    <div className="text-xs text-muted-foreground">{cat.description}</div>
                  </TableCell>
                  <TableCell>{cat.cgstPct}%</TableCell>
                  <TableCell>{cat.sgstPct}%</TableCell>
                  <TableCell>{cat.igstPct}%</TableCell>
                  <TableCell><Badge variant="outline">{cat.applicableTo}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {cat.isReverseCharge && <Badge className="bg-orange-100 text-orange-700 border-none text-xs">RC</Badge>}
                      {cat.isExempt && <Badge className="bg-slate-100 text-slate-600 border-none text-xs">Exempt</Badge>}
                      {cat.isZeroRated && <Badge className="bg-blue-100 text-blue-700 border-none text-xs">Zero</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <button onClick={() => toggleStatus(cat.id)}>
                      <Badge className={cat.status === 'Active' ? 'bg-green-100 text-green-700 border-none' : 'bg-slate-100 text-slate-500 border-none'}>
                        {cat.status}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(cat)}><Pencil size={14} /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(cat.id)}><Trash2 size={14} className="text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Tax Category' : 'Add Tax Category'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label>Category Name *</Label>
                <Input value={form.name} onChange={e => p('name', e.target.value)} placeholder="e.g., Standard GST 18%" />
              </div>
              <div>
                <Label>Description</Label>
                <Input value={form.description} onChange={e => p('description', e.target.value)} placeholder="Brief description" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>CGST %</Label><Input type="number" value={form.cgstPct} onChange={e => p('cgstPct', +e.target.value)} /></div>
              <div><Label>SGST %</Label><Input type="number" value={form.sgstPct} onChange={e => p('sgstPct', +e.target.value)} /></div>
              <div><Label>IGST %</Label><Input type="number" value={form.igstPct} onChange={e => p('igstPct', +e.target.value)} /></div>
              <div><Label>UTGST %</Label><Input type="number" value={form.utgstPct} onChange={e => p('utgstPct', +e.target.value)} /></div>
            </div>
            <div>
              <Label>Applicable To</Label>
              <Select value={form.applicableTo} onValueChange={v => p('applicableTo', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Product">Product</SelectItem>
                  <SelectItem value="Service">Service</SelectItem>
                  <SelectItem value="Both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-2"><Switch checked={form.isReverseCharge} onCheckedChange={v => p('isReverseCharge', v)} /><Label className="text-sm">Reverse Charge</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.isExempt} onCheckedChange={v => p('isExempt', v)} /><Label className="text-sm">Exempt</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.isZeroRated} onCheckedChange={v => p('isZeroRated', v)} /><Label className="text-sm">Zero Rated</Label></div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => p('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editing ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
