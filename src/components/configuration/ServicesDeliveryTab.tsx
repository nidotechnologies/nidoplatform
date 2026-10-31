import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Settings, Truck, MapPin, Users, Wrench, RotateCcw, Recycle, ArrowLeftRight } from 'lucide-react';

const serviceTypes = [
  { name: 'AMC (Annual Maintenance Contracts)', icon: Settings, items: ['Service Levels', 'Billing Cycles'] },
  { name: 'Repair & Diagnostics', icon: Wrench, items: ['Repair Queue Priority', 'Parts Integration'] },
  { name: 'Return & Replacement Logistics', icon: RotateCcw, items: ['RMA Process Rules', 'Return Shipping'] },
  { name: 'E-Waste & Recycling', icon: Recycle, items: ['Recycling Vendor Partnerships', 'Certificate of Destruction Options'] },
];

const regions = [
  { name: 'North America (NYC)', capacity: 100 },
  { name: 'EMEA (London)', capacity: 100 },
  { name: 'APAC (Singapore)', capacity: 100 },
];

export default function ServicesDeliveryTab() {
  const [courierEnabled, setCourierEnabled] = useState(true);
  const [fleetEnabled, setFleetEnabled] = useState(false);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Services We Deliver Updates</h2>

      <div>
        <h3 className="text-base font-medium mb-3">Manage Delivery Methods</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Truck size={20} className="text-primary" />
                  <span className="font-medium">Standard Courier</span>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Enable</Label>
                  <Switch checked={courierEnabled} onCheckedChange={setCourierEnabled} />
                </div>
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p className="flex items-center gap-1.5"><Settings size={14} /> Settings</p>
                <p className="flex items-center gap-1.5"><Switch checked={courierEnabled} /> Enable/Disable</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Truck size={20} className="text-primary" />
                  <span className="font-medium">Internal Logistics Fleet</span>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Disable</Label>
                  <Switch checked={fleetEnabled} onCheckedChange={setFleetEnabled} />
                </div>
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p className="flex items-center gap-1.5"><Settings size={14} /> Settings</p>
                <p className="flex items-center gap-1.5"><Switch checked={fleetEnabled} /> Enable/Disable Fleet</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <h3 className="text-base font-medium mb-3">Regional Service Centers</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {regions.map(r => (
            <Card key={r.name} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-4">
                <p className="font-medium text-sm">{r.name}</p>
                <p className="text-xs text-primary">Configure Logistics & Tech Team Assignments</p>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5"><MapPin size={12} /> Contact Points</p>
                  <p className="flex items-center gap-1.5"><Users size={12} /> Capacity: {r.capacity} events</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-base font-medium mb-3">Service Type Configurations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {serviceTypes.map(st => (
            <Card key={st.name} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <st.icon size={18} className="text-primary" />
                  <p className="font-medium text-sm">{st.name}</p>
                </div>
                <div className="space-y-1">
                  {st.items.map(item => (
                    <p key={item} className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Settings size={10} /> {item}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
