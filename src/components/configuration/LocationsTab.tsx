import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, MapPin, Pencil, Building2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const defaultLocations = [
  { id: '1', name: 'Bangalore HQ', type: 'Office', address: 'Electronic City, Bangalore', city: 'Bangalore', state: 'Karnataka', country: 'India', status: 'Active' },
  { id: '2', name: 'Mumbai Warehouse', type: 'Warehouse', address: 'Andheri East, Mumbai', city: 'Mumbai', state: 'Maharashtra', country: 'India', status: 'Active' },
  { id: '3', name: 'Delhi Office', type: 'Office', address: 'Connaught Place, New Delhi', city: 'New Delhi', state: 'Delhi', country: 'India', status: 'Active' },
  { id: '4', name: 'Chennai Service Center', type: 'Service Center', address: 'OMR Road, Chennai', city: 'Chennai', state: 'Tamil Nadu', country: 'India', status: 'Inactive' },
];

export default function LocationsTab() {
  const [locations] = useState(defaultLocations);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Locations</h2>
          <p className="text-sm text-muted-foreground">Manage office & warehouse sites</p>
        </div>
        <Button className="gap-1.5" onClick={() => setDialogOpen(true)}><Plus size={14} /> Add Location</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Building2 size={20} className="text-primary" /></div>
          <div><p className="font-bold text-lg">{locations.filter(l => l.type === 'Office').length}</p><p className="text-xs text-muted-foreground">Offices</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center"><MapPin size={20} className="text-warning" /></div>
          <div><p className="font-bold text-lg">{locations.filter(l => l.type === 'Warehouse').length}</p><p className="text-xs text-muted-foreground">Warehouses</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center"><MapPin size={20} className="text-success" /></div>
          <div><p className="font-bold text-lg">{locations.filter(l => l.status === 'Active').length}</p><p className="text-xs text-muted-foreground">Active Sites</p></div>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Location Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>City</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.map(loc => (
                <TableRow key={loc.id}>
                  <TableCell className="font-medium">{loc.name}</TableCell>
                  <TableCell><Badge variant="outline">{loc.type}</Badge></TableCell>
                  <TableCell className="text-sm">{loc.address}</TableCell>
                  <TableCell className="text-sm">{loc.city}</TableCell>
                  <TableCell className="text-sm">{loc.state}</TableCell>
                  <TableCell><Badge className={`${loc.status === 'Active' ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'} border-none`}>{loc.status}</Badge></TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="icon"><Pencil size={14} /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Location</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Location Name</Label><Input placeholder="e.g., Bangalore HQ" /></div>
            <div><Label>Type</Label>
              <Select defaultValue="Office">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Office">Office</SelectItem>
                  <SelectItem value="Warehouse">Warehouse</SelectItem>
                  <SelectItem value="Service Center">Service Center</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Address</Label><Input placeholder="Full address" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>City</Label><Input placeholder="City" /></div>
              <div><Label>State</Label><Input placeholder="State" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => { setDialogOpen(false); toast({ title: 'Location Added' }); }}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
