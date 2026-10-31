import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Settings,
  Users,
  GitBranch,
  ClipboardList,
  Bell,
  BookOpen,
  Plug,
  FileText,
  Zap,
  DollarSign,
} from "lucide-react";

const menuItems = [
  {
    title: "General Settings",
    description: "Organization, localization & defaults",
    icon: Settings,
  },
  {
    title: "Nido-Users",
    description: "Manage roles and user assignments",
    icon: Users,
  },
  {
    title: "Approval Workflows",
    description: "Define multi-level approval chains",
    icon: GitBranch,
  },
  {
    title: "Order Statuses",
    description: "Customize order lifecycle stages",
    icon: ClipboardList,
  },
  {
    title: "Notifications",
    description: "Email, SMS & in-app alert rules",
    icon: Bell,
  },
  {
    title: "Master Catalogue",
    description: "Manage and register the global product/service catalogue",
    icon: BookOpen,
  },
  {
    title: "Integrations",
    description: "Manage connectors and API integrations",
    icon: Plug,
  },
  {
    title: "System Logs",
    description: "Activity & system event logs",
    icon: FileText,
  },
  {
    title: "Auto Assignment",
    description: "Smart analyst auto-routing rules",
    icon: Zap,
  },
  {
    title: "Price Engine",
    description: "Configure pricing rules and calculations",
    icon: DollarSign,
  },
];

export default function Configuration() {
  return (
    <div className="min-h-screen bg-background p-2">
      <div className="w-full">
        <h1 className="text-4xl font-bold text-foreground mb-8 tracking-tight">
          Configuration
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
          {menuItems.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.title}
                className="bg-card dark:bg-secondary border border-border dark:border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer"
              >
                <div className="flex justify-center mb-5">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Icon className="w-7 h-7 text-primary" />
                  </div>
                </div>

                <div className="text-center">
                  <h3 className="font-semibold text-foreground text-lg flex items-center justify-center gap-1">
                    {item.title}
                    <span className="text-muted-foreground">›</span>
                  </h3>

                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed opacity-100">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
