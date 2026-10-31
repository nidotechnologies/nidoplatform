import React from 'react';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Users, FolderOpen, Globe, Plus, Search, Pencil, FileText, CheckCircle } from 'lucide-react';

export default function ClientAdditionTab() {
  const { clientRules } = useData();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Configuration &gt; Client Addition</p>
          <h2 className="text-xl font-semibold">Client Addition</h2>
          <p className="text-sm text-muted-foreground">Manage client onboarding and configurations.</p>
        </div>
        <Button className="gap-1.5"><Plus size={14} /> Add Tax</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="pt-4 flex items-start gap-3">
            <Users size={24} className="text-primary mt-0.5" />
            <div>
              <p className="font-bold text-lg">62 <span className="text-sm font-normal">Clients</span></p>
              <p className="text-sm text-primary">Onboarding Status</p>
              <p className="text-xs text-primary hover:underline cursor-pointer">View Clients &gt;</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="pt-4 flex items-start gap-3">
            <FolderOpen size={24} className="text-primary mt-0.5" />
            <div>
              <p className="font-bold text-lg">11 <span className="text-sm font-normal">Categories</span></p>
              <p className="text-sm text-primary">Client Categories</p>
              <p className="text-xs text-primary hover:underline cursor-pointer">Manage Categories &gt;</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="pt-4 flex items-start gap-3">
            <Globe size={24} className="text-primary mt-0.5" />
            <div>
              <p className="font-bold text-lg">Client Portal</p>
              <p className="text-sm text-muted-foreground">Configure Events</p>
              <p className="text-xs text-primary hover:underline cursor-pointer">Manage Portal &gt;</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Client Addition Rules</CardTitle>
            <div className="flex items-center gap-2">
              <Select defaultValue="all"><SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="All Onboarding" /></SelectTrigger><SelectContent><SelectItem value="all">All Onboarding</SelectItem></SelectContent></Select>
              <Select defaultValue="all"><SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="All Account Rules" /></SelectTrigger><SelectContent><SelectItem value="all">All Account Rules</SelectItem></SelectContent></Select>
              <Select defaultValue="all"><SelectTrigger className="h-8 w-28 text-xs"><SelectValue placeholder="All Statuses" /></SelectTrigger><SelectContent><SelectItem value="all">All Statuses</SelectItem></SelectContent></Select>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" size={12} />
                <Input className="pl-7 h-8 w-36 text-xs" placeholder="Search taxes..." />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Rule Name</TableHead>
                <TableHead>Onboarding</TableHead>
                <TableHead>Account Rules</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientRules.map(rule => (
                <TableRow key={rule.id}>
                  <TableCell className="text-xs text-muted-foreground">{rule.ruleId}</TableCell>
                  <TableCell className="font-medium text-sm">{rule.ruleName}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5 text-sm">
                      <CheckCircle size={14} className="text-success" /> {rule.onboarding}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {[FileText, Users, FolderOpen].map((Icon, i) => <Icon key={i} size={14} className="text-primary" />)}
                    </div>
                  </TableCell>
                  <TableCell><Badge className="bg-success text-success-foreground border-none">{rule.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm"><Pencil size={12} className="mr-1" /> Edit</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Client Portals</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 border border-border rounded-lg hover:bg-accent/50 cursor-pointer">
              <p className="text-sm font-medium">Client Portal Configuration</p>
              <p className="text-xs text-muted-foreground">Configure client portals and permissions.</p>
            </div>
            <div className="p-3 border border-border rounded-lg hover:bg-accent/50 cursor-pointer">
              <p className="text-sm font-medium">Client Information Form</p>
              <p className="text-xs text-muted-foreground">Manage client onboarding form template.</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Onboarding & Defaults</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 border border-border rounded-lg hover:bg-accent/50 cursor-pointer">
              <p className="text-sm font-medium">Onboarding Workflow</p>
              <p className="text-xs text-muted-foreground">Configure default onboarding process.</p>
            </div>
            <div className="p-3 border border-border rounded-lg hover:bg-accent/50 cursor-pointer">
              <p className="text-sm font-medium">Account Rules</p>
              <p className="text-xs text-muted-foreground">Manage default account rules &gt;</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 border border-border rounded-lg hover:bg-accent/50 cursor-pointer">
              <p className="text-sm font-medium">Add Client</p>
              <p className="text-xs text-muted-foreground">Manually add a new client.</p>
            </div>
            <div className="p-3 border border-border rounded-lg hover:bg-accent/50 cursor-pointer">
              <p className="text-sm font-medium">Client Import Template</p>
              <p className="text-xs text-muted-foreground">Import clients via COY template.</p>
            </div>
            <div className="p-3 border border-border rounded-lg hover:bg-accent/50 cursor-pointer">
              <p className="text-sm font-medium">Assign Account Manager</p>
              <p className="text-xs text-muted-foreground">Assign managers to new clients.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
