import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Save, Plus, Bell, Mail, MessageSquare, Smartphone } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const notificationRules = [
  { id: 1, event: 'Order Created', email: true, sms: false, inApp: true, recipient: 'Admin, PM' },
  { id: 2, event: 'Order Approved', email: true, sms: true, inApp: true, recipient: 'Requester, Admin' },
  { id: 3, event: 'Order Shipped', email: true, sms: true, inApp: true, recipient: 'Requester, Client' },
  { id: 4, event: 'Payment Received', email: true, sms: false, inApp: true, recipient: 'Finance, Admin' },
  { id: 5, event: 'SLA Breach Warning', email: true, sms: true, inApp: true, recipient: 'Manager, Admin' },
  { id: 6, event: 'Vendor Onboarded', email: true, sms: false, inApp: true, recipient: 'Procurement' },
  { id: 7, event: 'Low Stock Alert', email: true, sms: false, inApp: true, recipient: 'Inventory Manager' },
];

export default function NotificationsTab() {
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [inAppEnabled, setInAppEnabled] = useState(true);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Notifications</h2>
          <p className="text-sm text-muted-foreground">Configure email, SMS & in-app alert rules</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Cancel</Button>
          <Button className="gap-1.5" onClick={() => toast({ title: 'Saved' })}><Save size={14} /> Save</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Mail size={20} className="text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Email Notifications</p>
                <p className="text-xs text-muted-foreground">Send alerts via email</p>
              </div>
            </div>
            <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <Smartphone size={20} className="text-success" />
              </div>
              <div>
                <p className="font-medium text-sm">SMS Notifications</p>
                <p className="text-xs text-muted-foreground">Send SMS alerts</p>
              </div>
            </div>
            <Switch checked={smsEnabled} onCheckedChange={setSmsEnabled} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <Bell size={20} className="text-warning" />
              </div>
              <div>
                <p className="font-medium text-sm">In-App Alerts</p>
                <p className="text-xs text-muted-foreground">Push notifications</p>
              </div>
            </div>
            <Switch checked={inAppEnabled} onCheckedChange={setInAppEnabled} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Notification Rules</CardTitle>
            <Button size="sm" className="gap-1.5"><Plus size={14} /> Add Rule</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead className="text-center">Email</TableHead>
                <TableHead className="text-center">SMS</TableHead>
                <TableHead className="text-center">In-App</TableHead>
                <TableHead>Recipients</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notificationRules.map(rule => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium text-sm">{rule.event}</TableCell>
                  <TableCell className="text-center"><Switch defaultChecked={rule.email} /></TableCell>
                  <TableCell className="text-center"><Switch defaultChecked={rule.sms} /></TableCell>
                  <TableCell className="text-center"><Switch defaultChecked={rule.inApp} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{rule.recipient}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
