import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Truck, Info } from 'lucide-react';
import { toast } from 'sonner';
import { getVendorTaxSettings, saveVendorTaxSettings, getTaxCategories, type VendorTaxSettings } from '@/lib/taxEngine';
import { useAuth } from '@/contexts/AuthContext';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-4 space-y-4">
      <h3 className="font-semibold text-sm text-slate-700 uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {description && <div className="text-xs text-muted-foreground">{description}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ label, description, checked, onCheckedChange }: { label: string; description?: string; checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <Row label={label} description={description}>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </Row>
  );
}

export default function VendorTaxTab() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<VendorTaxSettings>(getVendorTaxSettings);
  const categories = getTaxCategories().filter(c => c.status === 'Active');

  const p = <K extends keyof VendorTaxSettings>(k: K, v: VendorTaxSettings[K]) =>
    setSettings(s => ({ ...s, [k]: v }));

  const handleSave = () => {
    saveVendorTaxSettings(settings, user?.name || user?.email || 'System');
    toast.success('Vendor tax settings saved — Tax Engine updated immediately');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <Truck className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Vendor Tax Settings</h2>
            <p className="text-sm text-muted-foreground">Controls taxes applied to all vendor procurement transactions</p>
          </div>
        </div>
        <Button onClick={handleSave} className="gap-1.5"><Save size={14} /> Save Changes</Button>
      </div>

      {/* Price Engine Flow */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Info className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-semibold text-blue-800">Vendor Price Engine Flow</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap text-xs text-blue-700 font-medium">
          {['Base Price', 'Product Category / HSN Tax Rules', 'Applicable GST', 'TDS / TCS', 'Additional Charges', 'Final Procurement Cost'].map((step, i, arr) => (
            <span key={step} className="flex items-center gap-2">
              <span className="bg-blue-100 px-2 py-1 rounded">{step}</span>
              {i < arr.length - 1 && <span>→</span>}
            </span>
          ))}
        </div>
      </div>

      <Section title="General">
        <Toggle label="Enable Vendor Tax" description="Apply tax rules to all vendor procurement transactions" checked={settings.enableVendorTax} onCheckedChange={v => p('enableVendorTax', v)} />
        <hr className="border-slate-100" />
        <Toggle label="Tax Inclusive Pricing" description="Vendor prices already include tax — back-calculate the tax amount" checked={settings.taxInclusive} onCheckedChange={v => p('taxInclusive', v)} />
        <hr className="border-slate-100" />
        <Toggle label="Product Category Based Mapping" description="Automatically apply tax rules based on product category" checked={settings.productCategoryBasedMapping} onCheckedChange={v => p('productCategoryBasedMapping', v)} />
        <hr className="border-slate-100" />
        <Row label="Default Tax Rule" description="Used when no category or HSN match is found">
          <Input className="w-56" value={settings.defaultTaxRule} onChange={e => p('defaultTaxRule', e.target.value)} />
        </Row>
        <hr className="border-slate-100" />
        <Row label="Default Currency">
          <Select value={settings.defaultCurrency} onValueChange={v => p('defaultCurrency', v)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="INR">INR ₹</SelectItem>
              <SelectItem value="USD">USD $</SelectItem>
              <SelectItem value="EUR">EUR €</SelectItem>
            </SelectContent>
          </Select>
        </Row>
      </Section>

      <Section title="GST Configuration">
        <Toggle label="GST Applicable" description="Enable GST on all vendor procurement" checked={settings.gstApplicable} onCheckedChange={v => p('gstApplicable', v)} />
        <hr className="border-slate-100" />
        <Row label="GST Calculation Method">
          <Select value={settings.gstCalcMethod} onValueChange={v => p('gstCalcMethod', v as 'exclusive' | 'inclusive')}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="exclusive">Tax Exclusive</SelectItem>
              <SelectItem value="inclusive">Tax Inclusive</SelectItem>
            </SelectContent>
          </Select>
        </Row>
        <hr className="border-slate-100" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <Label className="text-xs">CGST %</Label>
            <Input type="number" step="0.5" value={settings.cgstPct} onChange={e => p('cgstPct', +e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">SGST %</Label>
            <Input type="number" step="0.5" value={settings.sgstPct} onChange={e => p('sgstPct', +e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">IGST % (Interstate)</Label>
            <Input type="number" step="0.5" value={settings.igstPct} onChange={e => p('igstPct', +e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">UTGST % (UT)</Label>
            <Input type="number" step="0.5" value={settings.utgstPct} onChange={e => p('utgstPct', +e.target.value)} />
          </div>
        </div>
      </Section>

      <Section title="Vendor Specific Rules">
        <Row label="Default Tax Category">
          <Select value={settings.defaultTaxCategory} onValueChange={v => p('defaultTaxCategory', v)}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Row>
        <hr className="border-slate-100" />
        <Toggle label="Tax Exemption" description="Allow vendors to be marked as tax-exempt" checked={settings.taxExemption} onCheckedChange={v => p('taxExemption', v)} />
        <hr className="border-slate-100" />
        <Toggle label="Reverse Charge" description="Apply reverse charge mechanism on eligible purchases" checked={settings.reverseCharge} onCheckedChange={v => p('reverseCharge', v)} />
        <hr className="border-slate-100" />
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Toggle label="TDS Applicable" description="Tax Deducted at Source on vendor payments" checked={settings.tdsApplicable} onCheckedChange={v => p('tdsApplicable', v)} />
            {settings.tdsApplicable && (
              <div><Label className="text-xs">TDS Rate %</Label><Input type="number" step="0.01" value={settings.tdsPct} onChange={e => p('tdsPct', +e.target.value)} className="w-28 mt-1" /></div>
            )}
          </div>
          <div className="space-y-2">
            <Toggle label="TCS Applicable" description="Tax Collected at Source" checked={settings.tcsApplicable} onCheckedChange={v => p('tcsApplicable', v)} />
            {settings.tcsApplicable && (
              <div><Label className="text-xs">TCS Rate %</Label><Input type="number" step="0.01" value={settings.tcsPct} onChange={e => p('tcsPct', +e.target.value)} className="w-28 mt-1" /></div>
            )}
          </div>
        </div>
        <hr className="border-slate-100" />
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Toggle label="Import Tax" checked={settings.importTax} onCheckedChange={v => p('importTax', v)} />
            {settings.importTax && (
              <div><Label className="text-xs">Import Tax %</Label><Input type="number" step="0.5" value={settings.importTaxPct} onChange={e => p('importTaxPct', +e.target.value)} className="w-28 mt-1" /></div>
            )}
          </div>
          <Toggle label="Export Tax" checked={settings.exportTax} onCheckedChange={v => p('exportTax', v)} />
        </div>
        <hr className="border-slate-100" />
        <div className="grid grid-cols-2 gap-4">
          <Toggle label="Interstate Purchase Rules" description="Apply IGST for cross-state purchases" checked={settings.interstateRules} onCheckedChange={v => p('interstateRules', v)} />
          <Toggle label="Intrastate Purchase Rules" description="Apply CGST+SGST for same-state purchases" checked={settings.intrastateRules} onCheckedChange={v => p('intrastateRules', v)} />
        </div>
      </Section>

      <Section title="Product Category and HSN Based Rules">
        <Toggle label="Map Tax Rules by Product Category" description="Automatically apply category-specific tax rates from the Product Category Tax Mapping" checked={settings.mapTaxByCategory} onCheckedChange={v => p('mapTaxByCategory', v)} />
        <hr className="border-slate-100" />
        <Toggle label="Map Tax Rules by HSN Code" description="HSN code tax rates take priority over category mapping" checked={settings.mapTaxByHsn} onCheckedChange={v => p('mapTaxByHsn', v)} />
        <hr className="border-slate-100" />
        <Toggle label="Category-wise Tax Exemption" description="Allow specific categories to be marked exempt" checked={settings.categoryWiseExemption} onCheckedChange={v => p('categoryWiseExemption', v)} />
        <hr className="border-slate-100" />
        <Toggle label="Category-wise Reverse Charge" description="Enable reverse charge for specific product categories" checked={settings.categoryWiseReverseCharge} onCheckedChange={v => p('categoryWiseReverseCharge', v)} />
      </Section>

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} size="lg" className="gap-1.5"><Save size={14} /> Save Vendor Tax Settings</Button>
      </div>
    </div>
  );
}
