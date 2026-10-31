import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, Search, Hash } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  getHsnCodes, saveHsnCodes, getSacCodes, saveSacCodes,
  getTaxCategories, type HsnCode, type SacCode,
} from '@/lib/taxEngine';

const EMPTY_HSN: Omit<HsnCode, 'id'> = { code: '', description: '', gstRate: 18, taxCategoryId: 'tc-1', productCategory: '', status: 'Active' };
const EMPTY_SAC: Omit<SacCode, 'id'> = { code: '', description: '', gstRate: 18, taxCategoryId: 'tc-9', serviceCategory: '', status: 'Active' };

function HsnTable() {
  const { user } = useAuth();
  const auditUser = user?.name || user?.email || 'System';
  const [codes, setCodes] = useState<HsnCode[]>(getHsnCodes);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<HsnCode | null>(null);
  const [form, setForm] = useState<Omit<HsnCode, 'id'>>(EMPTY_HSN);
  const categories = getTaxCategories();

  const filtered = codes.filter(c =>
    c.code.toLowerCase().includes(search.toLowerCase()) ||
    c.description.toLowerCase().includes(search.toLowerCase()) ||
    c.productCategory.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => { setEditing(null); setForm(EMPTY_HSN); setOpen(true); };
  const openEdit = (c: HsnCode) => { setEditing(c); setForm({ ...c }); setOpen(true); };

  const handleSave = () => {
    if (!form.code.trim()) { toast.error('HSN code is required'); return; }
    const updated = editing
      ? codes.map(c => c.id === editing.id ? { ...form, id: editing.id } : c)
      : [...codes, { ...form, id: crypto.randomUUID() }];
    saveHsnCodes(updated, auditUser);
    setCodes(updated);
    setOpen(false);
    toast.success(editing ? 'HSN code updated' : 'HSN code added');
  };

  const handleDelete = (id: string) => {
    const updated = codes.filter(c => c.id !== id);
    saveHsnCodes(updated, auditUser);
    setCodes(updated);
    toast.success('HSN code deleted');
  };

  const p = (k: keyof Omit<HsnCode, 'id'>, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">HSN Code Master</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2 w-4 h-4 text-muted-foreground" />
                <Input className="pl-8 h-8 w-48" placeholder="Search codes…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Button size="sm" onClick={openAdd} className="gap-1.5"><Plus size={14} /> Add HSN</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>HSN Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>GST Rate</TableHead>
                <TableHead>Tax Category</TableHead>
                <TableHead>Product Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono font-semibold">{c.code}</TableCell>
                  <TableCell className="max-w-xs text-sm">{c.description}</TableCell>
                  <TableCell><Badge variant="outline">{c.gstRate}%</Badge></TableCell>
                  <TableCell className="text-sm">{categories.find(cat => cat.id === c.taxCategoryId)?.name || c.taxCategoryId}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.productCategory}</TableCell>
                  <TableCell>
                    <Badge className={c.status === 'Active' ? 'bg-green-100 text-green-700 border-none' : 'bg-slate-100 text-slate-500 border-none'}>
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil size={14} /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash2 size={14} className="text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No HSN codes found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit HSN Code' : 'Add HSN Code'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>HSN Code *</Label><Input value={form.code} onChange={e => p('code', e.target.value)} placeholder="e.g., 8471" /></div>
              <div><Label>GST Rate %</Label><Input type="number" value={form.gstRate} onChange={e => p('gstRate', +e.target.value)} /></div>
            </div>
            <div><Label>Description</Label><Input value={form.description} onChange={e => p('description', e.target.value)} /></div>
            <div><Label>Product Category</Label><Input value={form.productCategory} onChange={e => p('productCategory', e.target.value)} placeholder="e.g., Computers & Laptops" /></div>
            <div>
              <Label>Tax Category</Label>
              <Select value={form.taxCategoryId} onValueChange={v => p('taxCategoryId', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{categories.filter(c => c.status === 'Active').map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => p('status', v as 'Active' | 'Inactive')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editing ? 'Update' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SacTable() {
  const { user } = useAuth();
  const auditUser = user?.name || user?.email || 'System';
  const [codes, setCodes] = useState<SacCode[]>(getSacCodes);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SacCode | null>(null);
  const [form, setForm] = useState<Omit<SacCode, 'id'>>(EMPTY_SAC);
  const categories = getTaxCategories();

  const filtered = codes.filter(c =>
    c.code.toLowerCase().includes(search.toLowerCase()) ||
    c.description.toLowerCase().includes(search.toLowerCase()) ||
    c.serviceCategory.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => { setEditing(null); setForm(EMPTY_SAC); setOpen(true); };
  const openEdit = (c: SacCode) => { setEditing(c); setForm({ ...c }); setOpen(true); };

  const handleSave = () => {
    if (!form.code.trim()) { toast.error('SAC code is required'); return; }
    const updated = editing
      ? codes.map(c => c.id === editing.id ? { ...form, id: editing.id } : c)
      : [...codes, { ...form, id: crypto.randomUUID() }];
    saveSacCodes(updated, auditUser);
    setCodes(updated);
    setOpen(false);
    toast.success(editing ? 'SAC code updated' : 'SAC code added');
  };

  const handleDelete = (id: string) => {
    const updated = codes.filter(c => c.id !== id);
    saveSacCodes(updated, auditUser);
    setCodes(updated);
    toast.success('SAC code deleted');
  };

  const p = (k: keyof Omit<SacCode, 'id'>, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">SAC Code Master</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2 w-4 h-4 text-muted-foreground" />
                <Input className="pl-8 h-8 w-48" placeholder="Search codes…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Button size="sm" onClick={openAdd} className="gap-1.5"><Plus size={14} /> Add SAC</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SAC Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>GST Rate</TableHead>
                <TableHead>Tax Category</TableHead>
                <TableHead>Service Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono font-semibold">{c.code}</TableCell>
                  <TableCell className="max-w-xs text-sm">{c.description}</TableCell>
                  <TableCell><Badge variant="outline">{c.gstRate}%</Badge></TableCell>
                  <TableCell className="text-sm">{categories.find(cat => cat.id === c.taxCategoryId)?.name || c.taxCategoryId}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.serviceCategory}</TableCell>
                  <TableCell>
                    <Badge className={c.status === 'Active' ? 'bg-green-100 text-green-700 border-none' : 'bg-slate-100 text-slate-500 border-none'}>
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil size={14} /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash2 size={14} className="text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No SAC codes found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit SAC Code' : 'Add SAC Code'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>SAC Code *</Label><Input value={form.code} onChange={e => p('code', e.target.value)} placeholder="e.g., 998315" /></div>
              <div><Label>GST Rate %</Label><Input type="number" value={form.gstRate} onChange={e => p('gstRate', +e.target.value)} /></div>
            </div>
            <div><Label>Description</Label><Input value={form.description} onChange={e => p('description', e.target.value)} /></div>
            <div><Label>Service Category</Label><Input value={form.serviceCategory} onChange={e => p('serviceCategory', e.target.value)} placeholder="e.g., AMC Services" /></div>
            <div>
              <Label>Tax Category</Label>
              <Select value={form.taxCategoryId} onValueChange={v => p('taxCategoryId', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{categories.filter(c => c.status === 'Active').map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => p('status', v as 'Active' | 'Inactive')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editing ? 'Update' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function HsnSacTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Hash className="w-5 h-5 text-blue-600" />
        <div>
          <h2 className="text-lg font-semibold">HSN / SAC Code Management</h2>
          <p className="text-sm text-muted-foreground">Products and services inherit tax rules based on their assigned HSN/SAC code</p>
        </div>
      </div>
      <Tabs defaultValue="hsn">
        <TabsList>
          <TabsTrigger value="hsn">HSN Codes (Products)</TabsTrigger>
          <TabsTrigger value="sac">SAC Codes (Services)</TabsTrigger>
        </TabsList>
        <TabsContent value="hsn" className="mt-4"><HsnTable /></TabsContent>
        <TabsContent value="sac" className="mt-4"><SacTable /></TabsContent>
      </Tabs>
    </div>
  );
}
