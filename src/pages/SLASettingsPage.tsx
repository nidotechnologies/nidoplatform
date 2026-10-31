import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Truck, Users, ClipboardList, Wrench, CheckSquare, AlertTriangle, CalendarDays, LayoutDashboard, FileBarChart, Gauge } from "lucide-react";
import { Link } from "react-router-dom";
import VendorSLATab       from "@/components/configuration/sla/VendorSLATab";
import ClientSLATab       from "@/components/configuration/sla/ClientSLATab";
import ProcurementSLATab  from "@/components/configuration/sla/ProcurementSLATab";
import ServiceSLATab      from "@/components/configuration/sla/ServiceSLATab";
import ApprovalSLATab     from "@/components/configuration/sla/ApprovalSLATab";
import EscalationRulesTab from "@/components/configuration/sla/EscalationRulesTab";
import BusinessCalendarTab from "@/components/configuration/sla/BusinessCalendarTab";
import SLADashboardTab    from "@/components/configuration/sla/SLADashboardTab";
import SLAReportsTab      from "@/components/configuration/sla/SLAReportsTab";
import { Button } from "@/components/ui/button";

const TABS = [
  { value: "dashboard",    label: "SLA Dashboard",        shortLabel: "Dashboard",    Icon: LayoutDashboard },
  { value: "vendor",       label: "Vendor SLA",           shortLabel: "Vendor",       Icon: Truck           },
  { value: "client",       label: "Client SLA",           shortLabel: "Client",       Icon: Users           },
  { value: "procurement",  label: "Procurement SLA",      shortLabel: "Procurement",  Icon: ClipboardList   },
  { value: "service",      label: "Service SLA",          shortLabel: "Service",      Icon: Wrench          },
  { value: "approval",     label: "Approval SLA",         shortLabel: "Approval",     Icon: CheckSquare     },
  { value: "escalation",   label: "Escalation Rules",     shortLabel: "Escalation",   Icon: AlertTriangle   },
  { value: "calendar",     label: "Business Calendar",    shortLabel: "Calendar",     Icon: CalendarDays    },
  { value: "reports",      label: "SLA Reports",          shortLabel: "Reports",      Icon: FileBarChart    },
];

export default function SLASettingsPage() {
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
              <Gauge className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">SLA Management</h1>
              <p className="text-xs text-muted-foreground">
                Centralized SLA Engine — single source of truth for all service commitments
              </p>
            </div>
          </div>
        </div>

        {/* Engine Status Banner */}
        <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 mt-0.5">
              <Gauge className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-blue-900">SLA Engine Active</h2>
              <p className="text-sm text-blue-700 mt-0.5">
                All SLA timelines, escalation rules, approval deadlines, vendor commitments, and service response times
                across the NIDO platform are driven by this configuration. Changes take effect immediately for all new workflows.
              </p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-slate-100 p-1 rounded-xl">
            {TABS.map(({ value, label, shortLabel, Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                <Icon size={14} />
                <span className="hidden md:inline">{label}</span>
                <span className="md:hidden">{shortLabel}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="dashboard">   <SLADashboardTab /></TabsContent>
          <TabsContent value="vendor">      <VendorSLATab /></TabsContent>
          <TabsContent value="client">      <ClientSLATab /></TabsContent>
          <TabsContent value="procurement"> <ProcurementSLATab /></TabsContent>
          <TabsContent value="service">     <ServiceSLATab /></TabsContent>
          <TabsContent value="approval">    <ApprovalSLATab /></TabsContent>
          <TabsContent value="escalation">  <EscalationRulesTab /></TabsContent>
          <TabsContent value="calendar">    <BusinessCalendarTab /></TabsContent>
          <TabsContent value="reports">     <SLAReportsTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
