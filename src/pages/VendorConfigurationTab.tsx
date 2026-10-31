import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import {
  getVendorCommonSettings,
  saveVendorCommonSettings,
  type VendorCommonSettings,
  type ChargeItem,
} from '@/lib/priceEngineStore';

export default function VendorConfigurationTab({ vendorId }: { vendorId: string }) {
  const [settings, setSettings] = useState<VendorCommonSettings>(() => getVendorCommonSettings(vendorId));

  useEffect(() => {
    setSettings(getVendorCommonSettings(vendorId));
  }, [vendorId]);

  const updateSetting = (field: 'logisticsPct' | 'handlingPct', value: number) => {
    const next = { ...settings, [field]: value };
    setSettings(next);
    saveVendorCommonSettings(vendorId, next);
  };

  const persistCharges = (extraCharges: ChargeItem[]) => {
    const next = { ...settings, extraCharges };
    setSettings(next);
    saveVendorCommonSettings(vendorId, next);
  };

  const addCharge = () => {
    const charge: ChargeItem = { id: `chg-${Date.now()}`, name: '', value: 0 };
    persistCharges([...settings.extraCharges, charge]);
  };

  const updateCharge = (id: string, patch: Partial<ChargeItem>) => {
    persistCharges(settings.extraCharges.map(c => (c.id === id ? { ...c, ...patch } : c)));
  };

  const removeCharge = (id: string) => {
    persistCharges(settings.extraCharges.filter(c => c.id !== id));
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <h2 className="text-sm font-bold text-gray-800 uppercase mb-1">Pricing Charges (This Vendor Only)</h2>
      <p className="text-xs text-gray-500 mb-4">
        Base price, MOQ, lead time and stock are pulled automatically from this vendor's product listing.
        Logistics, handling and any extra charges configured here apply only to this vendor's landed cost
        calculation in the Price Engine. Tax rates are applied automatically from Tax Settings.
      </p>

      <div className="grid grid-cols-2 gap-2 max-w-xl">
        <div>
          <Label className="text-xs text-gray-600">Logistics Cost (% of Base Price)</Label>
          <div className="flex items-center gap-1 mt-1">
            <Input type="number" value={settings.logisticsPct}
              onChange={e => updateSetting('logisticsPct', parseFloat(e.target.value) || 0)}
              className="h-8 text-xs" />
            <span className="text-gray-400 text-xs">%</span>
          </div>
        </div>
        <div>
          <Label className="text-xs text-gray-600">Handling Charges (% of Base Price)</Label>
          <div className="flex items-center gap-1 mt-1">
            <Input type="number" value={settings.handlingPct}
              onChange={e => updateSetting('handlingPct', parseFloat(e.target.value) || 0)}
              className="h-8 text-xs" />
            <span className="text-gray-400 text-xs">%</span>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs text-gray-600">Additional Charges (% of Base Price)</Label>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addCharge}>
            <Plus size={12} /> Add New
          </Button>
        </div>
        {settings.extraCharges.length === 0 ? (
          <p className="text-xs text-gray-400">No additional charges configured.</p>
        ) : (
          <div className="space-y-2 max-w-xl">
            {settings.extraCharges.map(c => (
              <div key={c.id} className="flex items-center gap-2">
                <Input placeholder="Charge name" value={c.name}
                  onChange={e => updateCharge(c.id, { name: e.target.value })} className="h-8 text-xs flex-1" />
                <div className="flex items-center gap-1">
                  <Input type="number" value={c.value}
                    onChange={e => updateCharge(c.id, { value: parseFloat(e.target.value) || 0 })}
                    className="h-8 text-xs w-28" />
                  <span className="text-gray-400 text-xs">%</span>
                </div>
                <button onClick={() => removeCharge(c.id)} className="text-red-500 hover:text-red-700">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
