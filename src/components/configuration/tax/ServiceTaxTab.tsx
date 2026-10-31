import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Save, Wrench, Plus, Pencil, Trash2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  getServiceTaxSettings, saveServiceTaxSettings,
  getSacCodes, getTaxCategories,
  type ServiceTaxSettings, type ServiceCategoryTaxRule,
} from '@/lib/taxEngine';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-4 space-y-4">
      <h3 className="font-semibold text-sm text-slate-700 uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  );
}

function Toggle({ label, description, checked, onCheckedChange }: { label: string; description?: string; checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1">
        <div className="text-sm font-medium">{label}</div>
        {description && <div className="text-xs text-muted-foreground">{description}</div>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

const EMPTY_RULE: Omit<ServiceCategoryTaxRule, 'id'> = {
  serviceCategory: '', sacCode: '', gstRate: 18, taxCategoryId: 'tc-9',
  isReverseCharge: false, isExempt: false, taxInclusive: false,
};

export default function ServiceTaxTab() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<ServiceTaxSettings>(getServiceTaxSettings);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ServiceCategoryTaxRule | null>(null);
  const [ruleForm, setRuleForm] = useState<Omit<ServiceCategoryTaxRule, 'id'>>(EMPTY_RULE);
  const categories = getTaxCategories().filter(c => c.status === 'Active');
  const sacCodes = getSacCodes().filter(s => s.status === 'Active');

  const p = <K extends keyof ServiceTaxSettings>(k: K, v: ServiceTaxSettings[K]) =>
    setSettings(s => ({ ...s, [k]: v }));

  const handleSave = () => {
    saveServiceTaxSettings(settings, user?.name || user?.email || 'System');
    toast.success('Service tax settings saved — Tax Engine updated immediately');
  };

  const openAddRule = () => { setEditingRule(null); setRuleForm(EMPTY_RULE); setRuleOpen(true); };
  const openEditRule = (r: ServiceCategoryTaxRule) => { setEditingRule(r); setRuleForm({ ...r }); setRuleOpen(true); };

  const handleSaveRule = () => {
    if (!ruleForm.serviceCategory.trim()) { toast.error('Service category is required'); return; }
    const rules = editingRule
      ? settings.serviceCategoryRules.map(r => r.id === editingRule.id ? { ...ruleForm, id: editingRule.id } : r)
      : [...settings.serviceCategoryRules, { ...ruleForm, id: crypto.randomUUID() }];
    setSettings(s => ({ ...s, serviceCategoryRules: rules }));
    setRuleOpen(false);
    toast.success(editingRule ? 'Rule updated' : 'Rule added');
  };

  const deleteRule = (id: string) =>
    setSettings(s => ({ ...s, serviceCategoryRules: s.serviceCategoryRules.filter(r => r.id !== id) }));

  const rf = (k: keyof Omit<ServiceCategoryTaxRule, 'id'>, v: unknown) =>
    setRuleForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
            <Wrench className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Service Tax Settings</h2>
            <p className="text-sm text-muted-foreground">Controls taxation for all services — AMC, installation, maintenance, support</p>
          </div>
        </div>
        <Button onClick={handleSave} className="gap-1.5"><Save size={14} /> Save Changes</Button>
      </div>

      {/* Flow */}
      <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Info className="w-4 h-4 text-purple-600" />
          <span className="text-sm font-semibold text-purple-800">Service Price Engine Flow</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap text-xs text-purple-700 font-medium">
          {['Service Quotation / Invoice', 'Service Category + SAC Code', 'GST on Services', 'Final Service Price'].map((step, i, arr) => (
            <span key={step} className="flex items-center gap-2">
              <span className="bg-purple-100 px-2 py-1 rounded">{step}</span>
              {i < arr.length - 1 && <span>→</span>}
            </span>
          ))}
        </div>
      </div>

      <Section title="General">
        <Toggle label="Enable Service Tax" description="Apply GST to all service transactions" checked={settings.enableServiceTax} onCheckedChange={v => p('enableServiceTax', v)} />
        <hr className="border-slate-100" />
        <Toggle label="GST on Services" description="GST is applicable on all services" checked={settings.gstOnServices} onCheckedChange={v => p('gstOnServices', v)} />
        <hr className="border-slate-100" />
        <Toggle label="Tax Inclusive Pricing" description="Service prices already include GST" checked={settings.taxInclusive} onCheckedChange={v => p('taxInclusive', v)} />
        <hr className="border-slate-100" />
        <Toggle label="Reverse Charge" description="Apply reverse charge mechanism on eligible services" checked={settings.reverseCharge} onCheckedChange={v => p('reverseCharge', v)} />
        <hr className="border-slate-100" />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Default GST Rate %</Label>
            <Input type="number" step="0.5" value={settings.defaultGstRate} onChange={e => p('defaultGstRate', +e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Default Tax Category</Label>
            <Select value={settings.defaultTaxCategoryId} onValueChange={v => p('defaultTaxCategoryId', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </Section>

      <Section title="Service Types">
        <p className="text-xs text-muted-foreground">Enable the service types your organization provides — these determine which service category rules apply</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-1">
          <Toggle label="AMC Services" checked={settings.amcServices} onCheckedChange={v => p('amcServices', v)} />
          <Toggle label="Installation Services" checked={settings.installationServices} onCheckedChange={v => p('installationServices', v)} />
          <Toggle label="Maintenance Services" checked={settings.maintenanceServices} onCheckedChange={v => p('maintenanceServices', v)} />
          <Toggle label="Support Services" checked={settings.supportServices} onCheckedChange={v => p('supportServices', v)} />
          <Toggle label="Consultancy Services" checked={settings.consultancyServices} onCheckedChange={v => p('consultancyServices', v)} />
          <Toggle label="Professional Services" checked={settings.professionalServices} onCheckedChange={v => p('professionalServices', v)} />
        </div>
      </Section>

      {/* Service Category Rules */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Service Category Tax Rules</CardTitle>
            <Button size="sm" onClick={openAddRule} className="gap-1.5"><Plus size={14} /> Add Rule</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Each rule maps a service category + SAC code to a specific tax rate. These rules are automatically applied when creating service quotations or invoices.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service Category</TableHead>
                <TableHead>SAC Code</TableHead>
                <TableHead>GST Rate</TableHead>
                <TableHead>Tax Category</TableHead>
                <TableHead>Flags</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settings.serviceCategoryRules.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.serviceCategory}</TableCell>
                  <TableCell className="font-mono text-sm">{r.sacCode || '—'}</TableCell>
                  <TableCell><Badge variant="outline">{r.gstRate}%</Badge></TableCell>
                  <TableCell className="text-sm">{categories.find(c => c.id === r.taxCategoryId)?.name || r.taxCategoryId}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {r.isReverseCharge && <Badge className="bg-orange-100 text-orange-700 border-none text-xs">RC</Badge>}
                      {r.isExempt && <Badge className="bg-slate-100 text-slate-600 border-none text-xs">Exempt</Badge>}
                      {r.taxInclusive && <Badge className="bg-blue-100 text-blue-700 border-none text-xs">Inclusive</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEditRule(r)}><Pencil size={14} /></Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteRule(r.id)}><Trash2 size={14} className="text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {settings.serviceCategoryRules.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">No service category rules — add one above</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} size="lg" className="gap-1.5"><Save size={14} /> Save Service Tax Settings</Button>
      </div>

      {/* Rule dialog */}
      <Dialog open={ruleOpen} onOpenChange={setRuleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Edit Service Tax Rule' : 'Add Service Tax Rule'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Service Category *</Label>
              <Input value={ruleForm.serviceCategory} onChange={e => rf('serviceCategory', e.target.value)} placeholder="e.g., AMC Services" />
            </div>
            <div>
              <Label>SAC Code</Label>
              <Select value={ruleForm.sacCode} onValueChange={v => rf('sacCode', v)}>
                <SelectTrigger><SelectValue placeholder="Select SAC code…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {sacCodes.map(s => (
                    <SelectItem key={s.id} value={s.code}>{s.code} — {s.description}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>GST Rate %</Label>
                <Input type="number" step="0.5" value={ruleForm.gstRate} onChange={e => rf('gstRate', +e.target.value)} />
              </div>
              <div>
                <Label>Tax Category</Label>
                <Select value={ruleForm.taxCategoryId} onValueChange={v => rf('taxCategoryId', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-1">
              <div className="flex items-center gap-2"><Switch checked={ruleForm.isReverseCharge} onCheckedChange={v => rf('isReverseCharge', v)} /><Label className="text-xs">Reverse Charge</Label></div>
              <div className="flex items-center gap-2"><Switch checked={ruleForm.isExempt} onCheckedChange={v => rf('isExempt', v)} /><Label className="text-xs">Exempt</Label></div>
              <div className="flex items-center gap-2"><Switch checked={ruleForm.taxInclusive} onCheckedChange={v => rf('taxInclusive', v)} /><Label className="text-xs">Inclusive</Label></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveRule}>{editingRule ? 'Update' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
