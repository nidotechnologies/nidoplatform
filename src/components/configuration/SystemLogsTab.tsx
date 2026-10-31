import React, { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Filter, FileDown, Search, ChevronDown, LayoutGrid, List } from 'lucide-react';

export default function SystemLogsTab() {
  const { systemLogs } = useData();
  const [moduleFilter, setModuleFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [view, setView] = useState<'table' | 'grid'>('table');

  const modules = [...new Set(systemLogs.map(l => l.module))];
  const users = [...new Set(systemLogs.map(l => l.performedBy))];
  const actions = [...new Set(systemLogs.map(l => l.actionType))];

  const filtered = systemLogs.filter(l => {
    if (moduleFilter !== 'all' && l.module !== moduleFilter) return false;
    if (userFilter !== 'all' && l.performedBy !== userFilter) return false;
    if (actionFilter !== 'all' && l.actionType !== actionFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">System Logs</h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setView('grid')}><LayoutGrid size={16} /></Button>
          <Button variant="ghost" size="icon" onClick={() => setView('table')}><List size={16} /></Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-1.5"><Filter size={14} /> Filter <ChevronDown size={12} /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem><FileDown size={14} className="mr-2" /> Export to Excel</DropdownMenuItem>
              <DropdownMenuItem><FileDown size={14} className="mr-2" /> Export to PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Module" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Module</SelectItem>{modules.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={userFilter} onValueChange={setUserFilter}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="All Users" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Users</SelectItem>{users.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Action Type" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Actions</SelectItem>{actions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground">01-Apr-2024 to 30-Apr-2024</div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Log ID</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Action Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Performed By</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ref ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(log => (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-xs">{log.id}</TableCell>
                  <TableCell>
                    <span className="text-sm font-medium">{log.module}</span>
                  </TableCell>
                  <TableCell><span className="text-primary text-sm">{log.actionType}</span></TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">{log.description}</TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium">{log.performedBy}</p>
                      <p className="text-xs text-muted-foreground">{log.performedByRole}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">{log.dateTime}</TableCell>
                  <TableCell>
                    <Badge className={`${log.status === 'Success' ? 'bg-success text-success-foreground' : 'bg-destructive text-destructive-foreground'} border-none`}>
                      {log.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono">{log.referenceId}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
