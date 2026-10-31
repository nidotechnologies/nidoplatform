import { useState } from "react";
import { Save, Mail, MessageSquare, Bell, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { getEscalationRules, saveEscalationRules, EscalationLevel } from "@/lib/slaEngine";

const LEVEL_COLORS = ["bg-blue-50 border-blue-200","bg-amber-50 border-amber-200","bg-orange-50 border-orange-200","bg-red-50 border-red-200","bg-rose-50 border-rose-200"];
const LEVEL_BADGES = ["text-blue-700","text-amber-700","text-orange-700","text-red-700","text-rose-700"];

export default function EscalationRulesTab() {
  const [rules, setRules] = useState<EscalationLevel[]>(getEscalationRules);

  function update<K extends keyof EscalationLevel>(level: number, key: K, val: EscalationLevel[K]) {
    setRules(rs => rs.map(r => r.level === level ? { ...r, [key]: val } : r));
  }

  function handleSave() {
    saveEscalationRules(rules);
    toast({ title: "Escalation rules saved" });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Escalation Rules</h2>
          <p className="text-xs text-gray-500 mt-0.5">Configure escalation levels, notification channels and trigger times</p>
        </div>
        <Button onClick={handleSave} size="sm" className="gap-1.5"><Save size={14} /> Save Changes</Button>
      </div>

      <div className="space-y-3">
        {rules.map((r, idx) => (
          <div key={r.level} className={`border rounded-xl p-4 space-y-4 ${LEVEL_COLORS[idx]}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`font-bold text-sm ${LEVEL_BADGES[idx]}`}>{r.label}</span>
                <span className="text-sm text-gray-700 font-medium">→ {r.notifyRole}</span>
              </div>
              <Switch checked={r.enabled} onCheckedChange={v => update(r.level, "enabled", v)} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Notify Role</p>
                <Input value={r.notifyRole} onChange={e => update(r.level, "notifyRole", e.target.value)} className="h-7 text-xs bg-white" />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Trigger After (hrs)</p>
                <Input type="number" min={0} value={r.triggerAfterHrs} onChange={e => update(r.level, "triggerAfterHrs", Number(e.target.value))} className="h-7 text-xs bg-white w-24" />
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-2">Notification Channels</p>
              <div className="flex flex-wrap gap-3">
                {([
                  { key: "emailEnabled" as const,   Icon: Mail,           label: "Email" },
                  { key: "smsEnabled" as const,     Icon: MessageSquare,  label: "SMS" },
                  { key: "pushEnabled" as const,    Icon: Bell,           label: "Push" },
                  { key: "inAppEnabled" as const,   Icon: Monitor,        label: "In-App" },
                ] as const).map(({ key, Icon, label }) => (
                  <label key={key} className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer select-none">
                    <Switch checked={r[key]} onCheckedChange={v => update(r.level, key, v)} />
                    <Icon size={12} className="text-gray-400" />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
