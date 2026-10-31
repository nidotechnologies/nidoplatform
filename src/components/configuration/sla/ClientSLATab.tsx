import { useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { getClientSLA, saveClientSLA, ClientSLATier } from "@/lib/slaEngine";

const TIER_COLORS: Record<string, string> = {
  Standard:   "bg-blue-50 border-blue-200 text-blue-700",
  Premium:    "bg-purple-50 border-purple-200 text-purple-700",
  Enterprise: "bg-amber-50 border-amber-200 text-amber-700",
};

const FIELDS: { key: keyof ClientSLATier; label: string }[] = [
  { key: "requestResponseTime",      label: "Request Response Time (hrs)" },
  { key: "quoteDeliveryTime",        label: "Quote Delivery Time (hrs)" },
  { key: "orderProcessingTime",      label: "Order Processing Time (hrs)" },
  { key: "invoiceGenerationTime",    label: "Invoice Generation Time (hrs)" },
  { key: "contractProcessingTime",   label: "Contract Processing Time (hrs)" },
  { key: "serviceResponseTime",      label: "Service Response Time (hrs)" },
  { key: "ticketResolutionTime",     label: "Ticket Resolution Time (hrs)" },
  { key: "accountManagerResponseTime", label: "Account Manager Response (hrs)" },
];

export default function ClientSLATab() {
  const [tiers, setTiers] = useState<ClientSLATier[]>(getClientSLA);

  function updateTier(id: string, key: keyof ClientSLATier, val: number | boolean) {
    setTiers(ts => ts.map(t => t.id === id ? { ...t, [key]: val } : t));
  }

  function handleSave() {
    saveClientSLA(tiers);
    toast({ title: "Client SLA saved", description: "Tier settings updated successfully." });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Client SLA Settings</h2>
          <p className="text-xs text-gray-500 mt-0.5">Configure SLA commitments per client tier</p>
        </div>
        <Button onClick={handleSave} size="sm" className="gap-1.5"><Save size={14} /> Save Changes</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {tiers.map(tier => (
          <div key={tier.id} className={`border rounded-xl p-4 space-y-3 ${TIER_COLORS[tier.name]}`}>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm">{tier.name} SLA</span>
              <Switch checked={tier.enabled} onCheckedChange={v => updateTier(tier.id, "enabled", v)} />
            </div>
            <div className="space-y-2.5">
              {FIELDS.map(({ key, label }) => (
                <div key={key}>
                  <label className="text-xs text-gray-600 mb-0.5 block">{label}</label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={0}
                      value={tier[key] as number}
                      onChange={e => updateTier(tier.id, key, Number(e.target.value))}
                      className="h-7 text-xs bg-white border-gray-300 w-24"
                    />
                    <span className="text-xs text-gray-400">hrs</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
