import { useState } from "react";
import { Save, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { getApprovalSLA, saveApprovalSLA, ApprovalSLAConfig } from "@/lib/slaEngine";

export default function ApprovalSLATab() {
  const [configs, setConfigs] = useState<ApprovalSLAConfig[]>(getApprovalSLA);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<ApprovalSLAConfig | null>(null);

  function startEdit(c: ApprovalSLAConfig) { setEditing(c.id); setDraft({ ...c }); }
  function cancelEdit() { setEditing(null); setDraft(null); }
  function commitEdit() {
    if (!draft) return;
    setConfigs(cs => cs.map(c => c.id === draft.id ? draft : c));
    setEditing(null); setDraft(null);
  }
  function setD<K extends keyof ApprovalSLAConfig>(k: K, v: ApprovalSLAConfig[K]) {
    setDraft(d => d && ({ ...d, [k]: v }));
  }
  function toggleEnabled(id: string) {
    setConfigs(cs => cs.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c));
  }

  function handleSave() {
    saveApprovalSLA(configs);
    toast({ title: "Approval SLA saved" });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Approval SLA Settings</h2>
          <p className="text-xs text-gray-500 mt-0.5">Configure response times, escalation levels and auto-actions per approval type</p>
        </div>
        <Button onClick={handleSave} size="sm" className="gap-1.5"><Save size={14} /> Save Changes</Button>
      </div>

      <div className="space-y-3">
        {configs.map(c => {
          const isEditing = editing === c.id;
          const row = isEditing && draft ? draft : c;
          return (
            <div key={c.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-sm text-gray-800">{c.approvalType}</span>
                  <Switch checked={row.enabled} onCheckedChange={() => toggleEnabled(c.id)} />
                </div>
                <div className="flex gap-1">
                  {isEditing ? (
                    <>
                      <button onClick={commitEdit} className="p-1.5 rounded text-green-600 hover:bg-green-50"><Check size={14} /></button>
                      <button onClick={cancelEdit} className="p-1.5 rounded text-red-500 hover:bg-red-50"><X size={14} /></button>
                    </>
                  ) : (
                    <button onClick={() => startEdit(c)} className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50"><Pencil size={14} /></button>
                  )}
                </div>
              </div>

              <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { key: "responseTimeHrs" as const,     label: "Response Time (hrs)" },
                  { key: "approvalDeadlineHrs" as const, label: "Approval Deadline (hrs)" },
                  { key: "reminderIntervalHrs" as const, label: "Reminder Interval (hrs)" },
                  { key: "escalationLevel1Hrs" as const, label: "Escalation L1 (hrs)" },
                  { key: "escalationLevel2Hrs" as const, label: "Escalation L2 (hrs)" },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <p className="text-xs text-gray-400 mb-1">{label}</p>
                    {isEditing && draft ? (
                      <Input type="number" min={0} value={draft[key] as number} onChange={e => setD(key, Number(e.target.value))} className="h-7 text-xs w-20" />
                    ) : (
                      <p className="text-sm font-semibold text-gray-800">{c[key]}</p>
                    )}
                  </div>
                ))}

                <div>
                  <p className="text-xs text-gray-400 mb-1">Auto Escalation</p>
                  <Switch checked={row.autoEscalation} onCheckedChange={v => isEditing ? setD("autoEscalation", v) : setConfigs(cs => cs.map(x => x.id === c.id ? { ...x, autoEscalation: v } : x))} />
                </div>

                <div>
                  <p className="text-xs text-gray-400 mb-1">Auto Approval</p>
                  <div className="flex items-center gap-2">
                    <Switch checked={row.autoApproval} onCheckedChange={v => isEditing ? setD("autoApproval", v) : setConfigs(cs => cs.map(x => x.id === c.id ? { ...x, autoApproval: v } : x))} />
                    {row.autoApproval && (
                      <span className="text-xs text-gray-500">after
                        {isEditing && draft
                          ? <Input type="number" min={0} value={draft.autoApprovalAfterHrs} onChange={e => setD("autoApprovalAfterHrs", Number(e.target.value))} className="inline-block ml-1 h-6 text-xs w-14 px-1" />
                          : <span className="font-semibold ml-1">{c.autoApprovalAfterHrs}</span>
                        } hrs</span>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-400 mb-1">Auto Rejection</p>
                  <div className="flex items-center gap-2">
                    <Switch checked={row.autoRejection} onCheckedChange={v => isEditing ? setD("autoRejection", v) : setConfigs(cs => cs.map(x => x.id === c.id ? { ...x, autoRejection: v } : x))} />
                    {row.autoRejection && (
                      <span className="text-xs text-gray-500">after
                        {isEditing && draft
                          ? <Input type="number" min={0} value={draft.autoRejectionAfterHrs} onChange={e => setD("autoRejectionAfterHrs", Number(e.target.value))} className="inline-block ml-1 h-6 text-xs w-14 px-1" />
                          : <span className="font-semibold ml-1">{c.autoRejectionAfterHrs}</span>
                        } hrs</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
