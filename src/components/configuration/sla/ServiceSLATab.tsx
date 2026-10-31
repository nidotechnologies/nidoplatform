import { useState } from "react";
import { Save, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { getServiceSLA, saveServiceSLA, ServiceSLACategory } from "@/lib/slaEngine";

export default function ServiceSLATab() {
  const [cats, setCats] = useState<ServiceSLACategory[]>(getServiceSLA);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<ServiceSLACategory | null>(null);

  function startEdit(c: ServiceSLACategory) { setEditing(c.id); setDraft({ ...c }); }
  function cancelEdit() { setEditing(null); setDraft(null); }
  function commitEdit() {
    if (!draft) return;
    setCats(cs => cs.map(c => c.id === draft.id ? draft : c));
    setEditing(null); setDraft(null);
  }
  function setD<K extends keyof ServiceSLACategory>(k: K, v: ServiceSLACategory[K]) {
    setDraft(d => d && ({ ...d, [k]: v }));
  }

  function handleSave() {
    saveServiceSLA(cats);
    toast({ title: "Service SLA saved" });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Service SLA Settings</h2>
          <p className="text-xs text-gray-500 mt-0.5">Configure response and resolution times per service category</p>
        </div>
        <Button onClick={handleSave} size="sm" className="gap-1.5"><Save size={14} /> Save Changes</Button>
      </div>

      <div className="space-y-3">
        {cats.map(c => {
          const isEditing = editing === c.id;
          return (
            <div key={c.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-gray-800">{c.category}</span>
                  <Switch checked={c.enabled} onCheckedChange={v => setCats(cs => cs.map(x => x.id === c.id ? { ...x, enabled: v } : x))} />
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

              <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-100">
                {[
                  { key: "firstResponseTimeHrs" as const, label: "First Response" },
                  { key: "resolutionTimeHrs" as const,    label: "Resolution" },
                  { key: "visitTimeHrs" as const,         label: "Visit Time" },
                  { key: "escalationTimeHrs" as const,    label: "Escalation" },
                  { key: "maxResolutionTimeHrs" as const, label: "Max Resolution" },
                ].map(({ key, label }) => (
                  <div key={key} className="bg-white p-3">
                    <p className="text-xs text-gray-400 mb-1">{label}</p>
                    {isEditing && draft ? (
                      <div className="flex items-center gap-1">
                        <Input type="number" min={0} value={draft[key] as number} onChange={e => setD(key, Number(e.target.value))} className="h-6 text-xs w-16 px-1" />
                        <span className="text-xs text-gray-400">h</span>
                      </div>
                    ) : (
                      <p className="text-sm font-semibold text-gray-800">{c[key]}<span className="text-xs text-gray-400 font-normal"> hrs</span></p>
                    )}
                  </div>
                ))}
                <div className="bg-white p-3">
                  <p className="text-xs text-gray-400 mb-1">Working Hours</p>
                  {isEditing && draft ? (
                    <Input value={draft.workingHours} onChange={e => setD("workingHours", e.target.value)} className="h-6 text-xs px-1" />
                  ) : (
                    <p className="text-sm font-semibold text-gray-800">{c.workingHours}</p>
                  )}
                </div>
                <div className="bg-white p-3">
                  <p className="text-xs text-gray-400 mb-1">Business Days</p>
                  {isEditing && draft ? (
                    <Input value={draft.businessHours} onChange={e => setD("businessHours", e.target.value)} className="h-6 text-xs px-1" />
                  ) : (
                    <p className="text-sm font-semibold text-gray-800">{c.businessHours}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
