import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Users, Info } from 'lucide-react';
import { toast } from 'sonner';
import { getClientTaxSettings, saveClientTaxSettings, getTaxCategories, type ClientTaxSettings } from '@/lib/taxEngine';
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

export default function ClientTaxTab() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<ClientTaxSettings>(getClientTaxSettings);
  const categories = getTaxCategories().filter(c => c.status === 'Active');

  const p = <K extends keyof ClientTaxSettings>(k: K, v: ClientTaxSettings[K]) =>
    setSettings(s => ({ ...s, [k]: v }));

  const handleSave = () => {
    saveClientTaxSettings(settings, user?.name || user?.email || 'System');
    toast.success('Client tax settings saved — Tax Engine updated immediately');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
            <Users className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Client Tax Settings</h2>
            <p className="text-sm text-muted-foreground">Controls taxes applied when selling to clients via quotations, orders and invoices</p>
          </div>
        </div>
        <Button onClick={handleSave} className="gap-1.5"><Save size={14} /> Save Changes</Button>
      </div>

      {/* Price Engine Flow */}
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Info className="w-4 h-4 text-green-600" />
          <span className="text-sm font-semibold text-green-800">Client Price Engine Flow</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap text-xs text-green-700 font-medium">
          {['Selling Price', 'Product Category / HSN Tax Rules', 'GST', 'Additional Charges', 'Final Client Price'].map((step, i, arr) => (
            <span key={step} className="flex items-center gap-2">
              <span className="bg-green-100 px-2 py-1 rounded">{step}</span>
              {i < arr.length - 1 && <span>→</span>}
            </span>
          ))}
        </div>
      </div>

      <Section title="General">
        <Toggle label="Enable Client Tax" description="Apply tax rules to all client-facing transactions" checked={settings.enableClientTax} onCheckedChange={v => p('enableClientTax', v)} />
        <hr className="border-slate-100" />
        <Toggle label="Tax Inclusive Selling Price" description="Selling prices already include tax — back-calculate the tax amount" checked={settings.taxInclusive} onCheckedChange={v => p('taxInclusive', v)} />
        <hr className="border-slate-100" />
        <Toggle label="Product Category Based Mapping" description="Automatically apply tax rules based on product category" checked={settings.productCategoryBasedMapping} onCheckedChange={v => p('productCategoryBasedMapping', v)} />
        <hr className="border-slate-100" />
        <Row label="Default Tax Category">
          <Select value={settings.defaultTaxCategory} onValueChange={v => p('defaultTaxCategory', v)}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </Row>
      </Section>

      <Section title="GST Configuration">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
        </div>
        <hr className="border-slate-100" />
        <Row label="GST Category" description="B2B or B2C classification for GST returns">
          <Select value={settings.gstCategory} onValueChange={v => p('gstCategory', v)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="B2B">B2B</SelectItem>
              <SelectItem value="B2C">B2C</SelectItem>
              <SelectItem value="B2CL">B2CL (Large)</SelectItem>
              <SelectItem value="Export">Export</SelectItem>
            </SelectContent>
          </Select>
        </Row>
        <hr className="border-slate-100" />
        <Toggle label="HSN Validation" description="Validate HSN codes before allowing transactions" checked={settings.hsnValidation} onCheckedChange={v => p('hsnValidation', v)} />
      </Section>

      <Section title="Client Rules">
        <Toggle label="Client Tax Exemption" description="Allow specific clients to be marked as tax-exempt" checked={settings.clientTaxExemption} onCheckedChange={v => p('clientTaxExemption', v)} />
        <hr className="border-slate-100" />
        <Toggle label="Government Client Rules" description="Zero-rated supply to government entities" checked={settings.governmentClientRules} onCheckedChange={v => p('governmentClientRules', v)} />
        <hr className="border-slate-100" />
        <Toggle label="SEZ Client Rules" description="Zero-rated supply to Special Economic Zone clients" checked={settings.sezClientRules} onCheckedChange={v => p('sezClientRules', v)} />
        <hr className="border-slate-100" />
        <Toggle label="Export Client Rules" description="Zero-rated supply for export clients" checked={settings.exportClientRules} onCheckedChange={v => p('exportClientRules', v)} />
      </Section>

      <Section title="Product Category and HSN Based Rules">
        <Toggle label="Apply Tax by Product Category" description="Use category-based tax rates from Product Category Tax Mapping" checked={settings.applyTaxByCategory} onCheckedChange={v => p('applyTaxByCategory', v)} />
        <hr className="border-slate-100" />
        <Toggle label="Apply Tax by HSN Code" description="HSN code tax rates override category rates" checked={settings.applyTaxByHsn} onCheckedChange={v => p('applyTaxByHsn', v)} />
        <hr className="border-slate-100" />
        <Toggle label="Category-wise Tax Exemption" description="Allow specific categories to have zero tax for certain clients" checked={settings.categoryWiseTaxExemption} onCheckedChange={v => p('categoryWiseTaxExemption', v)} />
        <hr className="border-slate-100" />
        <Toggle label="Product-wise Tax Override" description="Allow individual products to override category tax rates" checked={settings.productWiseTaxOverride} onCheckedChange={v => p('productWiseTaxOverride', v)} />
        <hr className="border-slate-100" />
        <Toggle label="Client-specific Category Override" description="Allow per-client overrides on category tax rates" checked={settings.clientSpecificCategoryOverride} onCheckedChange={v => p('clientSpecificCategoryOverride', v)} />
      </Section>

      <Section title="Invoice & Display Rules">
        <Toggle label="Show Tax Breakdown" description="Display CGST, SGST, IGST separately on invoices and quotes" checked={settings.showTaxBreakdown} onCheckedChange={v => p('showTaxBreakdown', v)} />
        <hr className="border-slate-100" />
        <Row label="Round-off Rule">
          <Select value={settings.roundOffRule} onValueChange={v => p('roundOffRule', v as ClientTaxSettings['roundOffRule'])}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Rounding</SelectItem>
              <SelectItem value="nearest">Nearest Rupee</SelectItem>
              <SelectItem value="up">Round Up</SelectItem>
              <SelectItem value="down">Round Down</SelectItem>
            </SelectContent>
          </Select>
        </Row>
        <hr className="border-slate-100" />
        <Row label="Tax Display Format">
          <Select value={settings.taxDisplayFormat} onValueChange={v => p('taxDisplayFormat', v as ClientTaxSettings['taxDisplayFormat'])}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="breakdown">Show Breakdown</SelectItem>
              <SelectItem value="inclusive">Tax Inclusive</SelectItem>
              <SelectItem value="exclusive">Tax Exclusive</SelectItem>
            </SelectContent>
          </Select>
        </Row>
        <hr className="border-slate-100" />
        <Row label="Tax Label" description="Label shown on invoices and quotes">
          <Input className="w-32" value={settings.taxLabel} onChange={e => p('taxLabel', e.target.value)} placeholder="GST" />
        </Row>
      </Section>

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} size="lg" className="gap-1.5"><Save size={14} /> Save Client Tax Settings</Button>
      </div>
    </div>
  );
}
