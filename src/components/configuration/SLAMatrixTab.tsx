import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Save, Pencil } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const defaultSLAs = [
  { id: '1', name: 'Critical', responseTime: '1 hour', resolutionTime: '4 hours', escalationLevel: 'L3', penalty: '5% per hour', status: 'Active' },
  { id: '2', name: 'High', responseTime: '2 hours', resolutionTime: '8 hours', escalationLevel: 'L2', penalty: '2% per hour', status: 'Active' },
  { id: '3', name: 'Medium', responseTime: '4 hours', resolutionTime: '24 hours', escalationLevel: 'L1', penalty: '1% per day', status: 'Active' },
  { id: '4', name: 'Low', responseTime: '8 hours', resolutionTime: '48 hours', escalationLevel: 'None', penalty: 'None', status: 'Active' },
];

export default function SLAMatrixTab() {
  const [slas] = useState(defaultSLAs);

  const getPriorityColor = (name: string) => {
    switch (name) {
      case 'Critical': return 'bg-destructive text-destructive-foreground';
      case 'High': return 'bg-warning text-warning-foreground';
      case 'Medium': return 'bg-info text-info-foreground';
      case 'Low': return 'bg-success text-success-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">SLA Matrix</h2>
          <p className="text-sm text-muted-foreground">Service level targets & escalation rules</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Cancel</Button>
          <Button className="gap-1.5" onClick={() => toast({ title: 'Saved' })}><Save size={14} /> Save</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">SLA Definitions</CardTitle>
            <Button size="sm" className="gap-1.5"><Plus size={14} /> Add SLA</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Priority</TableHead>
                <TableHead>Response Time</TableHead>
                <TableHead>Resolution Time</TableHead>
                <TableHead>Escalation Level</TableHead>
                <TableHead>Penalty</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slas.map(sla => (
                <TableRow key={sla.id}>
                  <TableCell><Badge className={`${getPriorityColor(sla.name)} border-none`}>{sla.name}</Badge></TableCell>
                  <TableCell className="text-sm">{sla.responseTime}</TableCell>
                  <TableCell className="text-sm">{sla.resolutionTime}</TableCell>
                  <TableCell className="text-sm">{sla.escalationLevel}</TableCell>
                  <TableCell className="text-sm">{sla.penalty}</TableCell>
                  <TableCell><Badge className="bg-success text-success-foreground border-none">{sla.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon"><Pencil size={14} /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
