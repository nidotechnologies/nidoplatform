import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Truck, Users, Wrench, Tag, Hash, Layers, ClipboardList, Calculator } from 'lucide-react';
import { Link } from 'react-router-dom';
import VendorTaxTab from '@/components/configuration/tax/VendorTaxTab';
import ClientTaxTab from '@/components/configuration/tax/ClientTaxTab';
import ServiceTaxTab from '@/components/configuration/tax/ServiceTaxTab';
import TaxCategoriesTab from '@/components/configuration/tax/TaxCategoriesTab';
import HsnSacTab from '@/components/configuration/tax/HsnSacTab';
import ProductCategoryTaxTab from '@/components/configuration/tax/ProductCategoryTaxTab';
import TaxAuditTab from '@/components/configuration/tax/TaxAuditTab';

const TABS = [
  { value: 'vendor',    label: 'Vendor Tax',       Icon: Truck,         shortLabel: 'Vendor'   },
  { value: 'client',    label: 'Client Tax',        Icon: Users,         shortLabel: 'Client'   },
  { value: 'service',   label: 'Service Tax',       Icon: Wrench,        shortLabel: 'Service'  },
  { value: 'categories',label: 'Tax Categories',    Icon: Tag,           shortLabel: 'Categories'},
  { value: 'hsnsac',    label: 'HSN / SAC Codes',   Icon: Hash,          shortLabel: 'HSN/SAC'  },
  { value: 'mapping',   label: 'Category Mapping',  Icon: Layers,        shortLabel: 'Mapping'  },
  { value: 'audit',     label: 'Audit Log',         Icon: ClipboardList, shortLabel: 'Audit'    },
];

export default function TaxSettingsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="w-full px-2 sm:px-4 md:px-6 py-4 md:py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-3 mb-6">
          <Link to="/configuration">
            <Button variant="ghost" size="sm" className="gap-1.5 text-slate-500 hover:text-slate-800">
              <ArrowLeft size={16} /> Configuration
            </Button>
          </Link>
          <span className="text-slate-300">/</span>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Calculator className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Tax Settings</h1>
              <p className="text-xs text-muted-foreground">
                Centralized Tax Engine — single source of truth for all calculations
              </p>
            </div>
          </div>
        </div>

        {/* Engine Status Banner */}
        <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 mt-0.5">
              <Calculator className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-blue-900">Tax Engine Active</h2>
              <p className="text-sm text-blue-700 mt-0.5">
                All tax calculations across the platform — vendor procurement, client invoicing, service quotations,
                purchase orders, and reports — are driven by this configuration.
                Changes take effect immediately for all new transactions.
              </p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="vendor" className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-slate-100 p-1 rounded-xl">
            {TABS.map(({ value, label, Icon, shortLabel }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                <Icon size={14} />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{shortLabel}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="vendor">   <VendorTaxTab /></TabsContent>
          <TabsContent value="client">   <ClientTaxTab /></TabsContent>
          <TabsContent value="service">  <ServiceTaxTab /></TabsContent>
          <TabsContent value="categories"><TaxCategoriesTab /></TabsContent>
          <TabsContent value="hsnsac">   <HsnSacTab /></TabsContent>
          <TabsContent value="mapping">  <ProductCategoryTaxTab /></TabsContent>
          <TabsContent value="audit">    <TaxAuditTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
