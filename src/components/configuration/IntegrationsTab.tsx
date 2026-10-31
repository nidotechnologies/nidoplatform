import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plug, Cloud, CreditCard, Mail, FileText, Package } from 'lucide-react';

const integrations = [
  { name: 'Tally ERP', desc: 'Accounting & financial data sync', icon: FileText, connected: true, category: 'Accounting' },
  { name: 'Razorpay', desc: 'Payment gateway integration', icon: CreditCard, connected: true, category: 'Payments' },
  { name: 'AWS S3', desc: 'Cloud storage for documents', icon: Cloud, connected: true, category: 'Storage' },
  { name: 'SendGrid', desc: 'Email delivery service', icon: Mail, connected: false, category: 'Communication' },
  { name: 'Shiprocket', desc: 'Shipping & logistics tracking', icon: Package, connected: false, category: 'Logistics' },
  { name: 'Zoho CRM', desc: 'Customer relationship management', icon: Plug, connected: false, category: 'CRM' },
];

export default function IntegrationsTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Integrations</h2>
          <p className="text-sm text-muted-foreground">Third-party system connectors</p>
        </div>
        <Button className="gap-1.5"><Plug size={14} /> Browse Integrations</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrations.map(int => (
          <Card key={int.name} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <int.icon size={20} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{int.name}</p>
                    <p className="text-xs text-muted-foreground">{int.desc}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs">{int.category}</Badge>
                <div className="flex items-center gap-2">
                  <Badge className={`${int.connected ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'} border-none text-xs`}>
                    {int.connected ? 'Connected' : 'Not Connected'}
                  </Badge>
                  <Switch defaultChecked={int.connected} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
