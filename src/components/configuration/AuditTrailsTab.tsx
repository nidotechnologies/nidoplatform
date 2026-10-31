import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Search, FileDown, Filter } from 'lucide-react';

const auditEntries = [
  { id: 'AUD-001', action: 'Role Permission Changed', module: 'Configuration', user: 'System Admin', timestamp: '2026-03-27 14:30', details: 'Changed Procurement Manager permissions', status: 'Logged' },
  { id: 'AUD-002', action: 'User Created', module: 'User Management', user: 'Admin', timestamp: '2026-03-26 10:15', details: 'New user vendor@apex.com created', status: 'Logged' },
  { id: 'AUD-003', action: 'Tax Rate Updated', module: 'Tax Settings', user: 'Finance Admin', timestamp: '2026-03-25 16:45', details: 'IGST rate updated from 18% to 12%', status: 'Logged' },
  { id: 'AUD-004', action: 'Order Status Changed', module: 'Orders', user: 'PM', timestamp: '2026-03-25 09:20', details: 'Order #2498563 status changed to Shipped', status: 'Logged' },
  { id: 'AUD-005', action: 'Client Onboarded', module: 'Clients', user: 'Account Manager', timestamp: '2026-03-24 11:00', details: 'EuroTech Partners registered as new client', status: 'Logged' },
  { id: 'AUD-006', action: 'Vendor Approved', module: 'Vendors', user: 'Admin', timestamp: '2026-03-24 08:30', details: 'HP Direct vendor status set to Approved', status: 'Logged' },
  { id: 'AUD-007', action: 'Catalog Item Deleted', module: 'Catalog', user: 'Rehul Verma', timestamp: '2026-03-23 15:35', details: 'Item PRN-3215 removed from catalog', status: 'Logged' },
];

export default function AuditTrailsTab() {
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const modules = [...new Set(auditEntries.map(e => e.module))];
  const filtered = auditEntries.filter(e => {
    if (moduleFilter !== 'all' && e.module !== moduleFilter) return false;
    if (search && !e.details.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Audit Trails</h2>
          <p className="text-sm text-muted-foreground">Compliance & change history</p>
        </div>
        <Button variant="outline" className="gap-1.5"><FileDown size={14} /> Export Report</Button>
      </div>

      <div className="flex items-center gap-3">
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="All Modules" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modules</SelectItem>
            {modules.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
          <Input className="pl-8 h-8 w-48 text-xs" placeholder="Search audit entries..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Audit ID</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(entry => (
                <TableRow key={entry.id}>
                  <TableCell className="font-mono text-xs">{entry.id}</TableCell>
                  <TableCell className="font-medium text-sm">{entry.action}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{entry.module}</Badge></TableCell>
                  <TableCell className="text-sm">{entry.user}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{entry.timestamp}</TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">{entry.details}</TableCell>
                  <TableCell><Badge className="bg-success text-success-foreground border-none text-xs">{entry.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground mt-3">Showing {filtered.length} of {auditEntries.length} entries</p>
        </CardContent>
      </Card>
    </div>
  );
}
