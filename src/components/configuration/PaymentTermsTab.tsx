import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Save, Pencil, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const defaultTerms = [
  { id: '1', name: 'NET 15', days: 15, discount: 2, discountDays: 5, isDefault: true },
  { id: '2', name: 'NET 30', days: 30, discount: 1.5, discountDays: 10, isDefault: false },
  { id: '3', name: 'NET 45', days: 45, discount: 1, discountDays: 15, isDefault: false },
  { id: '4', name: 'NET 60', days: 60, discount: 0, discountDays: 0, isDefault: false },
  { id: '5', name: 'Due on Receipt', days: 0, discount: 0, discountDays: 0, isDefault: false },
];

export default function PaymentTermsTab() {
  const [terms, setTerms] = useState(defaultTerms);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', days: 0, discount: 0, discountDays: 0 });

  const handleAdd = () => {
    if (!form.name) return;
    setTerms(prev => [...prev, { ...form, id: crypto.randomUUID(), isDefault: false }]);
    setDialogOpen(false);
    toast({ title: 'Added', description: `${form.name} payment term created` });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Payment Terms</h2>
          <p className="text-sm text-muted-foreground">Net days, early payment discounts</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Cancel</Button>
          <Button className="gap-1.5" onClick={() => toast({ title: 'Saved' })}><Save size={14} /> Save</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Payment Terms</CardTitle>
            <Button size="sm" className="gap-1.5" onClick={() => { setForm({ name: '', days: 0, discount: 0, discountDays: 0 }); setDialogOpen(true); }}><Plus size={14} /> Add Term</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Term Name</TableHead>
                <TableHead>Net Days</TableHead>
                <TableHead>Early Payment Discount</TableHead>
                <TableHead>Discount Window (Days)</TableHead>
                <TableHead>Default</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {terms.map(term => (
                <TableRow key={term.id}>
                  <TableCell className="font-medium">{term.name}</TableCell>
                  <TableCell>{term.days || '—'}</TableCell>
                  <TableCell>{term.discount ? `${term.discount}%` : '—'}</TableCell>
                  <TableCell>{term.discountDays || '—'}</TableCell>
                  <TableCell>{term.isDefault ? <Badge variant="secondary">Default</Badge> : '—'}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon"><Pencil size={14} /></Button>
                    <Button variant="ghost" size="icon"><Trash2 size={14} className="text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Payment Term</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Term Name</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g., NET 30" /></div>
            <div><Label>Net Days</Label><Input type="number" value={form.days} onChange={e => setForm(p => ({ ...p, days: Number(e.target.value) }))} /></div>
            <div><Label>Early Payment Discount (%)</Label><Input type="number" value={form.discount} onChange={e => setForm(p => ({ ...p, discount: Number(e.target.value) }))} /></div>
            <div><Label>Discount Window (Days)</Label><Input type="number" value={form.discountDays} onChange={e => setForm(p => ({ ...p, discountDays: Number(e.target.value) }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
