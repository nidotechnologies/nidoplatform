import { useState } from "react";
import { Save, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { getBusinessCalendar, saveBusinessCalendar, BusinessCalendar, Holiday } from "@/lib/slaEngine";

const ALL_DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const TIMEZONES = ["Asia/Kolkata","Asia/Dubai","Asia/Singapore","Europe/London","Europe/Berlin","America/New_York","America/Los_Angeles","UTC"];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <h3 className="font-semibold text-gray-800 text-sm border-b border-gray-100 pb-2">{title}</h3>
      {children}
    </div>
  );
}

export default function BusinessCalendarTab() {
  const [cal, setCal] = useState<BusinessCalendar>(getBusinessCalendar);
  const [newHoliday, setNewHoliday] = useState<Omit<Holiday,"id">>({ date: "", name: "", type: "National" });

  function set<K extends keyof BusinessCalendar>(k: K, v: BusinessCalendar[K]) {
    setCal(c => ({ ...c, [k]: v }));
  }

  function toggleDay(day: string) {
    setCal(c => ({
      ...c,
      workingDays: c.workingDays.includes(day)
        ? c.workingDays.filter(d => d !== day)
        : [...c.workingDays, day],
    }));
  }

  function addHoliday() {
    if (!newHoliday.date || !newHoliday.name) return;
    const h: Holiday = { ...newHoliday, id: `h-${Date.now()}` };
    setCal(c => ({ ...c, holidays: [...c.holidays, h].sort((a, b) => a.date.localeCompare(b.date)) }));
    setNewHoliday({ date: "", name: "", type: "National" });
  }

  function removeHoliday(id: string) {
    setCal(c => ({ ...c, holidays: c.holidays.filter(h => h.id !== id) }));
  }

  function handleSave() {
    saveBusinessCalendar(cal);
    toast({ title: "Business calendar saved" });
  }

  const HOLIDAY_COLORS: Record<string, string> = {
    National: "bg-blue-50 text-blue-700 border-blue-200",
    Regional: "bg-green-50 text-green-700 border-green-200",
    Custom:   "bg-purple-50 text-purple-700 border-purple-200",
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Business Calendar</h2>
          <p className="text-xs text-gray-500 mt-0.5">All SLA timers respect this calendar — set working days, hours and holidays</p>
        </div>
        <Button onClick={handleSave} size="sm" className="gap-1.5"><Save size={14} /> Save Changes</Button>
      </div>

      <Section title="Timezone & Shift">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Timezone</Label>
            <Select value={cal.timezone} onValueChange={v => set("timezone", v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIMEZONES.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Shift Timings</Label>
            <Input value={cal.shiftTimings} onChange={e => set("shiftTimings", e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Weekend Rule</Label>
            <Select value={cal.weekendRule} onValueChange={v => set("weekendRule", v as BusinessCalendar["weekendRule"])}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Saturday-Sunday">Saturday–Sunday</SelectItem>
                <SelectItem value="Sunday Only">Sunday Only</SelectItem>
                <SelectItem value="Custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Section>

      <Section title="Working Days">
        <div className="flex flex-wrap gap-2">
          {ALL_DAYS.map(day => (
            <button
              key={day}
              onClick={() => toggleDay(day)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                cal.workingDays.includes(day)
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
              }`}
            >
              {day.slice(0, 3)}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Working Hours">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Start Time</Label>
            <Input type="time" value={cal.workStartTime} onChange={e => set("workStartTime", e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">End Time</Label>
            <Input type="time" value={cal.workEndTime} onChange={e => set("workEndTime", e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Lunch Break Start</Label>
            <Input type="time" value={cal.lunchBreakStart} onChange={e => set("lunchBreakStart", e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Lunch Break End</Label>
            <Input type="time" value={cal.lunchBreakEnd} onChange={e => set("lunchBreakEnd", e.target.value)} className="h-8 text-sm" />
          </div>
        </div>
      </Section>

      <Section title="Holidays">
        <div className="flex flex-wrap gap-2 mb-3">
          {cal.holidays.map(h => (
            <div key={h.id} className={`flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5 text-xs font-medium ${HOLIDAY_COLORS[h.type]}`}>
              <span>{new Date(h.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
              <span>·</span>
              <span>{h.name}</span>
              <Badge className={`text-[10px] px-1 py-0 ${HOLIDAY_COLORS[h.type]}`}>{h.type}</Badge>
              <button onClick={() => removeHoliday(h.id)} className="ml-1 text-gray-400 hover:text-red-500"><Trash2 size={11} /></button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 items-end border-t border-gray-100 pt-3">
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">Date</Label>
            <Input type="date" value={newHoliday.date} onChange={e => setNewHoliday(h => ({ ...h, date: e.target.value }))} className="h-8 text-sm w-36" />
          </div>
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">Name</Label>
            <Input value={newHoliday.name} onChange={e => setNewHoliday(h => ({ ...h, name: e.target.value }))} className="h-8 text-sm w-40" placeholder="Holiday name" />
          </div>
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">Type</Label>
            <Select value={newHoliday.type} onValueChange={v => setNewHoliday(h => ({ ...h, type: v as Holiday["type"] }))}>
              <SelectTrigger className="h-8 text-sm w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="National">National</SelectItem>
                <SelectItem value="Regional">Regional</SelectItem>
                <SelectItem value="Custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" variant="outline" onClick={addHoliday} className="h-8 gap-1.5"><Plus size={13} /> Add</Button>
        </div>
      </Section>
    </div>
  );
}
