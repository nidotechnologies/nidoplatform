import { useState } from "react";
import { Save, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { getProcurementSLA, saveProcurementSLA, ProcurementSLAStage } from "@/lib/slaEngine";

export default function ProcurementSLATab() {
  const [stages, setStages] = useState<ProcurementSLAStage[]>(getProcurementSLA);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProcurementSLAStage | null>(null);

  function startEdit(s: ProcurementSLAStage) {
    setEditing(s.id);
    setDraft({ ...s });
  }

  function cancelEdit() { setEditing(null); setDraft(null); }

  function commitEdit() {
    if (!draft) return;
    setStages(ss => ss.map(s => s.id === draft.id ? draft : s));
    setEditing(null);
    setDraft(null);
  }

  function toggleEnabled(id: string) {
    setStages(ss => ss.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  }

  function handleSave() {
    saveProcurementSLA(stages);
    toast({ title: "Procurement SLA saved" });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Procurement SLA Settings</h2>
          <p className="text-xs text-gray-500 mt-0.5">Define target, warning and breach thresholds for each procurement stage</p>
        </div>
        <Button onClick={handleSave} size="sm" className="gap-1.5"><Save size={14} /> Save Changes</Button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Stage</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Target (hrs)</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Warning (hrs)</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Breach (hrs)</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Escalation Rule</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Active</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Edit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {stages.map((s, idx) => {
              const isEditing = editing === s.id;
              const row = isEditing && draft ? draft : s;
              return (
                <tr key={s.id} className={`${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"} hover:bg-blue-50/30 transition-colors`}>
                  <td className="px-4 py-3 font-medium text-gray-800 text-xs whitespace-nowrap">{s.stage}</td>
                  {isEditing && draft ? (
                    <>
                      <td className="px-4 py-3"><Input type="number" min={0} value={draft.targetTimeHrs} onChange={e => setDraft(d => d && ({ ...d, targetTimeHrs: Number(e.target.value) }))} className="h-7 text-xs w-20" /></td>
                      <td className="px-4 py-3"><Input type="number" min={0} value={draft.warningThresholdHrs} onChange={e => setDraft(d => d && ({ ...d, warningThresholdHrs: Number(e.target.value) }))} className="h-7 text-xs w-20" /></td>
                      <td className="px-4 py-3"><Input type="number" min={0} value={draft.breachThresholdHrs} onChange={e => setDraft(d => d && ({ ...d, breachThresholdHrs: Number(e.target.value) }))} className="h-7 text-xs w-20" /></td>
                      <td className="px-4 py-3"><Input value={draft.escalationRule} onChange={e => setDraft(d => d && ({ ...d, escalationRule: e.target.value }))} className="h-7 text-xs w-40" /></td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-gray-700 text-xs">{s.targetTimeHrs}</td>
                      <td className="px-4 py-3 text-xs"><Badge className="bg-amber-50 text-amber-700 border-amber-200 font-normal">{s.warningThresholdHrs} hrs</Badge></td>
                      <td className="px-4 py-3 text-xs"><Badge className="bg-red-50 text-red-700 border-red-200 font-normal">{s.breachThresholdHrs} hrs</Badge></td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{s.escalationRule}</td>
                    </>
                  )}
                  <td className="px-4 py-3 text-center">
                    <Switch checked={row.enabled} onCheckedChange={() => toggleEnabled(s.id)} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isEditing ? (
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={commitEdit} className="p-1 rounded text-green-600 hover:bg-green-50"><Check size={14} /></button>
                        <button onClick={cancelEdit} className="p-1 rounded text-red-500 hover:bg-red-50"><X size={14} /></button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(s)} className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50"><Pencil size={13} /></button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
