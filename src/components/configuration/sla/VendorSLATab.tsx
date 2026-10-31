import { useState } from "react";
import { Save, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { getVendorSLA, saveVendorSLA, VendorSLASettings } from "@/lib/slaEngine";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <h3 className="font-semibold text-gray-800 text-sm border-b border-gray-100 pb-2">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-4 items-center">
      <Label className="text-sm text-gray-600 col-span-1">{label}</Label>
      <div className="col-span-2">{children}</div>
    </div>
  );
}

function HrsInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Input type="number" min={0} value={value} onChange={e => onChange(Number(e.target.value))} className="w-28 h-8 text-sm" />
      <span className="text-xs text-gray-400">hrs</span>
    </div>
  );
}

export default function VendorSLATab() {
  const [form, setForm] = useState<VendorSLASettings>(getVendorSLA);

  function set<K extends keyof VendorSLASettings>(key: K, val: VendorSLASettings[K]) {
    setForm(f => ({ ...f, [key]: val }));
  }

  function handleSave() {
    saveVendorSLA(form);
    toast({ title: "Vendor SLA saved", description: "Settings updated successfully." });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Vendor SLA Settings</h2>
          <p className="text-xs text-gray-500 mt-0.5">Configure performance commitments and penalty rules for vendors</p>
        </div>
        <Button onClick={handleSave} size="sm" className="gap-1.5"><Save size={14} /> Save Changes</Button>
      </div>

      <Section title="General">
        <Row label="Enable Vendor SLA">
          <Switch checked={form.enabled} onCheckedChange={v => set("enabled", v)} />
        </Row>
        <Row label="SLA Name">
          <Input value={form.slaName} onChange={e => set("slaName", e.target.value)} className="h-8 text-sm" />
        </Row>
        <Row label="SLA Code">
          <Input value={form.slaCode} onChange={e => set("slaCode", e.target.value)} className="h-8 text-sm" />
        </Row>
        <Row label="Description">
          <Input value={form.description} onChange={e => set("description", e.target.value)} className="h-8 text-sm" />
        </Row>
        <Row label="Status">
          <Select value={form.status} onValueChange={v => set("status", v as VendorSLASettings["status"])}>
            <SelectTrigger className="h-8 text-sm w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </Row>
      </Section>

      <Section title="Procurement Commitments (hours)">
        <Row label="RFQ Response Time"><HrsInput value={form.rfqResponseTime} onChange={v => set("rfqResponseTime", v)} /></Row>
        <Row label="Quote Submission Time"><HrsInput value={form.quoteSubmissionTime} onChange={v => set("quoteSubmissionTime", v)} /></Row>
        <Row label="Order Acceptance Time"><HrsInput value={form.orderAcceptanceTime} onChange={v => set("orderAcceptanceTime", v)} /></Row>
        <Row label="Order Confirmation Time"><HrsInput value={form.orderConfirmationTime} onChange={v => set("orderConfirmationTime", v)} /></Row>
        <Row label="Dispatch Time"><HrsInput value={form.dispatchTime} onChange={v => set("dispatchTime", v)} /></Row>
        <Row label="Delivery Time"><HrsInput value={form.deliveryTime} onChange={v => set("deliveryTime", v)} /></Row>
        <Row label="Installation Time"><HrsInput value={form.installationTime} onChange={v => set("installationTime", v)} /></Row>
        <Row label="Warranty Response Time"><HrsInput value={form.warrantyResponseTime} onChange={v => set("warrantyResponseTime", v)} /></Row>
      </Section>

      <Section title="Performance Targets">
        <Row label="On-Time Delivery %">
          <div className="flex items-center gap-2">
            <Input type="number" min={0} max={100} value={form.onTimeDeliveryPct} onChange={e => set("onTimeDeliveryPct", Number(e.target.value))} className="w-28 h-8 text-sm" />
            <span className="text-xs text-gray-400">%</span>
          </div>
        </Row>
        <Row label="Order Fulfilment %">
          <div className="flex items-center gap-2">
            <Input type="number" min={0} max={100} value={form.orderFulfilmentPct} onChange={e => set("orderFulfilmentPct", Number(e.target.value))} className="w-28 h-8 text-sm" />
            <span className="text-xs text-gray-400">%</span>
          </div>
        </Row>
        <Row label="Acceptance Rate %">
          <div className="flex items-center gap-2">
            <Input type="number" min={0} max={100} value={form.acceptanceRatePct} onChange={e => set("acceptanceRatePct", Number(e.target.value))} className="w-28 h-8 text-sm" />
            <span className="text-xs text-gray-400">%</span>
          </div>
        </Row>
        <Row label="Cancellation Rate %">
          <div className="flex items-center gap-2">
            <Input type="number" min={0} max={100} value={form.cancellationRatePct} onChange={e => set("cancellationRatePct", Number(e.target.value))} className="w-28 h-8 text-sm" />
            <span className="text-xs text-gray-400">%</span>
          </div>
        </Row>
        <Row label="Return Processing Time"><HrsInput value={form.returnProcessingTime} onChange={v => set("returnProcessingTime", v)} /></Row>
        <Row label="Complaint Resolution Time"><HrsInput value={form.complaintResolutionTime} onChange={v => set("complaintResolutionTime", v)} /></Row>
      </Section>

      <Section title="Penalty Rules">
        <Row label="Late Delivery Penalty">
          <Input value={form.lateDeliveryPenalty} onChange={e => set("lateDeliveryPenalty", e.target.value)} className="h-8 text-sm" placeholder="e.g. 1% per day" />
        </Row>
        <Row label="Late Response Penalty">
          <Input value={form.lateResponsePenalty} onChange={e => set("lateResponsePenalty", e.target.value)} className="h-8 text-sm" placeholder="e.g. 0.5% per hour" />
        </Row>
        <Row label="SLA Violation Penalty">
          <Input value={form.slaViolationPenalty} onChange={e => set("slaViolationPenalty", e.target.value)} className="h-8 text-sm" placeholder="e.g. 2% of order value" />
        </Row>
        <Row label="Performance Score Deduction">
          <div className="flex items-center gap-2">
            <Input type="number" min={0} max={100} value={form.performanceScoreDeduction} onChange={e => set("performanceScoreDeduction", Number(e.target.value))} className="w-28 h-8 text-sm" />
            <span className="text-xs text-gray-400">pts per violation</span>
          </div>
        </Row>
      </Section>

      <Section title="Notifications">
        <Row label="SLA Reminder"><Switch checked={form.slaReminderEnabled} onCheckedChange={v => set("slaReminderEnabled", v)} /></Row>
        <Row label="SLA Warning"><Switch checked={form.slaWarningEnabled} onCheckedChange={v => set("slaWarningEnabled", v)} /></Row>
        <Row label="SLA Breach Notification"><Switch checked={form.slaBreachNotificationEnabled} onCheckedChange={v => set("slaBreachNotificationEnabled", v)} /></Row>
        <Row label="Escalation Notification"><Switch checked={form.escalationNotificationEnabled} onCheckedChange={v => set("escalationNotificationEnabled", v)} /></Row>
      </Section>
    </div>
  );
}
