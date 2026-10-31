import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Plus, Save, Pencil, Tag, Percent } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const pricingRules = [
  { id: '1', name: 'Volume Discount - 50+ units', type: 'Volume', discount: '10%', minQty: 50, status: 'Active' },
  { id: '2', name: 'Volume Discount - 100+ units', type: 'Volume', discount: '15%', minQty: 100, status: 'Active' },
  { id: '3', name: 'Seasonal Offer - Q4', type: 'Seasonal', discount: '5%', minQty: 0, status: 'Active' },
  { id: '4', name: 'Loyalty Discount', type: 'Loyalty', discount: '3%', minQty: 0, status: 'Inactive' },
  { id: '5', name: 'Bulk Enterprise', type: 'Volume', discount: '20%', minQty: 500, status: 'Active' },
];

export default function PricingDiscountsTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Pricing & Discounts</h2>
          <p className="text-sm text-muted-foreground">Volume pricing & discount rules</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Cancel</Button>
          <Button className="gap-1.5" onClick={() => toast({ title: 'Saved' })}><Save size={14} /> Save</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Tag size={20} className="text-primary" /></div>
          <div><p className="font-bold text-lg">{pricingRules.length}</p><p className="text-xs text-muted-foreground">Total Rules</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center"><Percent size={20} className="text-success" /></div>
          <div><p className="font-bold text-lg">{pricingRules.filter(r => r.status === 'Active').length}</p><p className="text-xs text-muted-foreground">Active Rules</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center"><Tag size={20} className="text-warning" /></div>
          <div><p className="font-bold text-lg">{pricingRules.filter(r => r.type === 'Volume').length}</p><p className="text-xs text-muted-foreground">Volume Discounts</p></div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Discount Rules</CardTitle>
            <Button size="sm" className="gap-1.5"><Plus size={14} /> Add Rule</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Min Qty</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pricingRules.map(rule => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell><Badge variant="outline">{rule.type}</Badge></TableCell>
                  <TableCell className="text-primary font-semibold">{rule.discount}</TableCell>
                  <TableCell>{rule.minQty || '—'}</TableCell>
                  <TableCell><Badge className={`${rule.status === 'Active' ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'} border-none`}>{rule.status}</Badge></TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="icon"><Pencil size={14} /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
